"""Base Claude API client for BunkerGuard.

- Model: claude-sonnet-4-6 (per hackathon brief — fast + cheap)
- Structured JSON enforced via ``output_config.format`` when a schema is given,
  otherwise fenced-JSON parsing as a fallback.
- Prompt caching on the system prompt (the big static one is ~2KB and reused
  across every session; one breakpoint saves ~90% on subsequent reads).
- Anthropic SDK auto-retries 429/5xx with exponential backoff; we add a
  small wrapper for JSON-parse errors only.

Env:
    ANTHROPIC_API_KEY — required.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Optional

try:
    import anthropic
    _HAS_SDK = True
except ImportError:  # allow imports in environments without the SDK
    anthropic = None  # type: ignore[assignment]
    _HAS_SDK = False

log = logging.getLogger("bunkerguard.llm")

MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 4096
JSON_RETRIES = 2  # JSON-parse-error retries only; SDK handles network retries

# JSON-Schema keywords the structured-outputs *raw* API rejects with a 400.
# The SDK strips these automatically, but only inside ``messages.parse()`` /
# ``messages.stream()``; ``messages.create()`` (what we call) sends the schema
# verbatim. We therefore replicate the strip ourselves — see _sanitize_schema.
_UNSUPPORTED_CONSTRAINTS = (
    "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum",
    "minLength", "maxLength", "pattern", "minItems", "maxItems",
    "multipleOf",
)

_client: Optional[Any] = None


def _sanitize_schema(node: Any) -> Any:
    """Make a JSON schema acceptable to ``messages.create`` structured outputs.

    The raw structured-outputs API only accepts a strict subset of JSON Schema.
    Two things our hand-written schemas use are rejected with a 400:

    1. List-form union types, e.g. ``{"type": ["string", "null"]}`` — must be
       expressed as ``anyOf``.
    2. Validation keywords such as ``minimum`` / ``maximum`` — must be removed
       (we fold them into the field description so the model still sees them).

    This mirrors ``anthropic.lib._parse._transform.transform_schema``, which the
    SDK applies for ``parse()`` / ``stream()`` but *not* for ``create()``.
    Recurses through ``properties`` / ``items`` / ``anyOf`` / ``$defs``.
    """
    if not isinstance(node, dict):
        return node

    node = dict(node)

    # 1. list-form type -> anyOf
    t = node.get("type")
    if isinstance(t, list):
        node.pop("type")
        node["anyOf"] = [{"type": x} for x in t]

    # 2. strip unsupported constraints, preserving intent in the description
    stripped = {k: node.pop(k) for k in _UNSUPPORTED_CONSTRAINTS if k in node}
    if stripped:
        existing = node.get("description", "")
        extra = ", ".join(f"{k}: {v}" for k, v in stripped.items())
        node["description"] = (f"{existing} " if existing else "") + f"({extra})"

    # 3. recurse into nested schemas
    for key in ("properties", "$defs", "definitions"):
        sub = node.get(key)
        if isinstance(sub, dict):
            node[key] = {k: _sanitize_schema(v) for k, v in sub.items()}
    if "items" in node:
        node["items"] = _sanitize_schema(node["items"])
    for key in ("anyOf", "oneOf", "allOf"):
        sub = node.get(key)
        if isinstance(sub, list):
            node[key] = [_sanitize_schema(v) for v in sub]

    return node


def _get_client() -> Any:
    """Lazy singleton — keeps import-time cheap and tolerates missing key
    until the first real call.
    """
    global _client
    if not _HAS_SDK:
        raise RuntimeError(
            "anthropic SDK not installed. Run: pip install anthropic")
    if _client is None:
        _client = anthropic.Anthropic()
    return _client


def call_claude(
    system_prompt: str,
    user_prompt: str,
    *,
    json_schema: Optional[dict] = None,
    max_tokens: int = MAX_TOKENS,
    cache_system: bool = True,
) -> dict:
    """Call Claude and return a parsed JSON dict.

    Args:
        system_prompt: stable, cacheable system instructions.
        user_prompt: per-session payload (varies every call).
        json_schema: if given, response is constrained via ``output_config.format``.
            The schema must declare ``additionalProperties: false`` on every object.
        max_tokens: hard cap on response length.
        cache_system: place a 5-minute ephemeral cache breakpoint on the
            system prompt. Only useful when the same system text is reused.

    Returns:
        Parsed JSON object plus a ``_usage`` key with token counts. On any
        unrecoverable failure, returns ``{"error": <msg>, "_usage": {...}}``.
    """
    client = _get_client()

    system_block: list[dict[str, Any]] = [{"type": "text", "text": system_prompt}]
    if cache_system:
        system_block[0]["cache_control"] = {"type": "ephemeral"}

    kwargs: dict[str, Any] = {
        "model": MODEL,
        "max_tokens": max_tokens,
        "system": system_block,
        "messages": [{"role": "user", "content": user_prompt}],
    }
    if json_schema is not None:
        kwargs["output_config"] = {
            "format": {"type": "json_schema", "schema": _sanitize_schema(json_schema)},
        }

    last_err: Optional[str] = None
    last_text: Optional[str] = None
    last_usage: dict[str, Any] = {}

    for attempt in range(JSON_RETRIES + 1):
        try:
            response = client.messages.create(**kwargs)
        except Exception as e:  # network/auth/quota all bubble up here
            log.exception("claude_call_failed")
            return {"error": f"{type(e).__name__}: {e}", "_usage": {}}

        text = "".join(b.text for b in response.content if getattr(b, "type", None) == "text")
        last_text = text
        last_usage = {
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
            "cache_read_input_tokens": getattr(response.usage, "cache_read_input_tokens", 0),
            "cache_creation_input_tokens": getattr(response.usage, "cache_creation_input_tokens", 0),
            "model": MODEL,
        }

        parsed = _try_parse_json(text)
        if parsed is not None:
            parsed["_usage"] = last_usage
            return parsed

        last_err = "JSON parse failed"
        log.warning("json_parse_failed", extra={"attempt": attempt, "preview": text[:200]})

    return {
        "error": last_err or "unknown",
        "raw": last_text,
        "_usage": last_usage,
    }


def _try_parse_json(text: str) -> Optional[dict]:
    """Best-effort JSON extraction: strip code fences, then parse."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        # remove opening fence (```json or ```)
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

    try:
        result = json.loads(cleaned)
        return result if isinstance(result, dict) else None
    except json.JSONDecodeError:
        return None
