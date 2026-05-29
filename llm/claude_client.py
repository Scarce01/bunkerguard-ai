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

_client: Optional[Any] = None


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
            "format": {"type": "json_schema", "schema": json_schema},
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
