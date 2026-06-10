"""Provider-switching Claude client for BunkerGuard.

- ``LLM_PROVIDER=anthropic`` uses the Anthropic SDK.
- ``LLM_PROVIDER=bedrock`` uses boto3 Bedrock Runtime.
- Structured JSON enforced via ``output_config.format`` when a schema is given,
  where supported, otherwise fenced-JSON parsing as a fallback.
- Prompt caching on the system prompt (the big static one is ~2KB and reused
  across every session; one breakpoint saves ~90% on subsequent reads).
- Anthropic SDK auto-retries 429/5xx with exponential backoff; we add a
  small wrapper for JSON-parse errors only.

Env:
    LLM_PROVIDER, AWS_REGION, BEDROCK_MODEL_ID, ANTHROPIC_API_KEY,
    OPENROUTER_API_KEY, OPENROUTER_MODEL.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Optional
from urllib import error as urllib_error
from urllib import request as urllib_request

try:
    import anthropic
    _HAS_SDK = True
except ImportError:  # allow imports in environments without the SDK
    anthropic = None  # type: ignore[assignment]
    _HAS_SDK = False

log = logging.getLogger("bunkerguard.llm")

ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6")
OPENROUTER_MODEL = "anthropic/claude-sonnet-4.6"
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
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
_bedrock_client: Optional[Any] = None


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


def _provider() -> str:
    provider = os.environ.get("LLM_PROVIDER", "anthropic").strip().lower()
    if provider not in {"anthropic", "bedrock"}:
        raise RuntimeError("LLM_PROVIDER must be 'anthropic' or 'bedrock'")
    return provider


def _get_bedrock_client() -> Any:
    global _bedrock_client
    if _bedrock_client is None:
        import boto3

        region = os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION")
        _bedrock_client = boto3.client("bedrock-runtime", region_name=region)
    return _bedrock_client


def _bedrock_model_id() -> str:
    model_id = os.environ.get("BEDROCK_MODEL_ID", "").strip()
    if not model_id:
        raise RuntimeError("BEDROCK_MODEL_ID is required when LLM_PROVIDER=bedrock")
    return model_id


def _usage_dict(usage: Any, model: str, provider: str) -> dict[str, Any]:
    if isinstance(usage, dict):
        input_tokens = usage.get(
            "inputTokens",
            usage.get("input_tokens", usage.get("prompt_tokens", 0)),
        )
        output_tokens = usage.get(
            "outputTokens",
            usage.get("output_tokens", usage.get("completion_tokens", 0)),
        )
    else:
        input_tokens = getattr(usage, "input_tokens", 0)
        output_tokens = getattr(usage, "output_tokens", 0)
    return {
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "model": model,
        "provider": provider,
    }


def _provider_result(
    text: str,
    model: str,
    provider: str,
    usage: Any,
) -> dict[str, Any]:
    return {
        "text": text,
        "provider_used": provider,
        "model": model,
        # Preserve the original fields for existing frontend and backend callers.
        "provider": provider,
        "model_id": model,
        "_usage": _usage_dict(usage, model, provider),
    }


def _call_openrouter(
    system_prompt: str,
    messages: list[dict[str, str]],
    *,
    max_tokens: int,
) -> dict[str, Any]:
    api_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError(
            "Bedrock could not serve the request and OPENROUTER_API_KEY is not configured"
        )

    model = os.environ.get("OPENROUTER_MODEL", OPENROUTER_MODEL).strip()
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            *[
                {"role": message["role"], "content": message.get("content", "")}
                for message in messages
                if message.get("role") in {"user", "assistant"}
            ],
        ],
        "max_tokens": max_tokens,
        "temperature": 0.1,
    }
    req = urllib_request.Request(
        os.environ.get("OPENROUTER_BASE_URL", OPENROUTER_URL),
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": os.environ.get(
                "OPENROUTER_SITE_URL", "https://bunkerguard-ai.vercel.app"
            ),
            "X-Title": "BunkerGuard AI",
        },
        method="POST",
    )
    try:
        with urllib_request.urlopen(req, timeout=90) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib_error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(
            f"OpenRouter request failed with HTTP {exc.code}: {detail}"
        ) from exc

    choices = data.get("choices") or []
    if not choices:
        raise RuntimeError("OpenRouter returned no response choices")
    content = choices[0].get("message", {}).get("content", "")
    if isinstance(content, list):
        content = "".join(
            part.get("text", "")
            for part in content
            if isinstance(part, dict) and part.get("type") == "text"
        )
    return _provider_result(
        str(content).strip(),
        model,
        "openrouter",
        data.get("usage", {}),
    )


def call_text(
    system_prompt: str,
    messages: list[dict[str, str]],
    *,
    max_tokens: int = 800,
) -> dict[str, Any]:
    """Return a plain-text chat response using the selected provider."""
    provider = _provider()

    if provider == "bedrock":
        model_id = _bedrock_model_id()
        try:
            response = _get_bedrock_client().converse(
                modelId=model_id,
                system=[{"text": system_prompt}],
                messages=[
                    {
                        "role": message["role"],
                        "content": [{"text": message.get("content", "")}],
                    }
                    for message in messages
                    if message.get("role") in {"user", "assistant"}
                ],
                inferenceConfig={"maxTokens": max_tokens, "temperature": 0.1},
            )
        except Exception as exc:
            log.warning(
                "bedrock_unavailable_falling_back",
                extra={
                    "model": model_id,
                    "fallback_provider": "openrouter",
                    "error_type": type(exc).__name__,
                },
            )
            return _call_openrouter(
                system_prompt,
                messages,
                max_tokens=max_tokens,
            )
        blocks = response.get("output", {}).get("message", {}).get("content", [])
        text = "".join(block.get("text", "") for block in blocks if "text" in block).strip()
        return _provider_result(
            text, model_id, "bedrock", response.get("usage", {})
        )

    client = _get_client()
    response = client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=max_tokens,
        system=system_prompt,
        messages=[
            {"role": message["role"], "content": message.get("content", "")}
            for message in messages
            if message.get("role") in {"user", "assistant"}
        ],
    )
    text = "".join(
        block.text
        for block in response.content
        if getattr(block, "type", None) == "text"
    ).strip()
    model = getattr(response, "model", ANTHROPIC_MODEL)
    return _provider_result(text, model, "anthropic", response.usage)


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
    provider = _provider()

    if provider == "bedrock":
        schema_instruction = ""
        if json_schema is not None:
            schema_instruction = (
                "\n\nReturn only JSON matching this schema:\n"
                + json.dumps(_sanitize_schema(json_schema), separators=(",", ":"))
            )
        messages = [{"role": "user", "content": user_prompt + schema_instruction}]
        last_text: Optional[str] = None
        last_usage: dict[str, Any] = {}
        for attempt in range(JSON_RETRIES + 1):
            try:
                response = call_text(
                    system_prompt,
                    messages,
                    max_tokens=max_tokens,
                )
            except Exception as exc:
                log.exception("bedrock_call_failed")
                return {"error": f"{type(exc).__name__}: {exc}", "_usage": {}}
            last_text = response["text"]
            last_usage = response["_usage"]
            parsed = _try_parse_json(last_text)
            if parsed is not None:
                parsed["_usage"] = last_usage
                return parsed
            log.warning(
                "json_parse_failed",
                extra={"attempt": attempt, "preview": last_text[:200]},
            )
        return {"error": "JSON parse failed", "raw": last_text, "_usage": last_usage}

    client = _get_client()

    system_block: list[dict[str, Any]] = [{"type": "text", "text": system_prompt}]
    if cache_system:
        system_block[0]["cache_control"] = {"type": "ephemeral"}

    kwargs: dict[str, Any] = {
        "model": ANTHROPIC_MODEL,
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
            "model": ANTHROPIC_MODEL,
            "provider": "anthropic",
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


def call_claude_with_tools(
    system_prompt: str,
    user_prompt: str,
    *,
    tools: list[dict],
    dispatch,
    prior_messages: Optional[list[dict]] = None,
    max_iterations: int = 6,
    max_tokens: int = MAX_TOKENS,
    cache_system: bool = True,
) -> dict:
    """Run a Claude tool-use loop and return the final answer.

    Args:
        system_prompt: stable, cacheable instructions for the agent.
        user_prompt: the officer's question.
        tools: Anthropic tool specs (see CopilotTools.TOOL_SPECS).
        dispatch: callable ``(name, args) -> dict`` that runs one tool.
        max_iterations: cap on Claude<->tool rounds. Officer flow rarely needs
            more than 3; the cap is just a runaway guard.

    Returns:
        ``{"answer": <final text>, "tool_calls": [...], "_usage": {...}}``
        or ``{"error": <msg>, "_usage": {...}}`` on failure. ``tool_calls``
        is the full transcript so the UI can render the chart/PDF paths the
        tools produced.
    """
    client = _get_client()

    system_block: list[dict[str, Any]] = [{"type": "text", "text": system_prompt}]
    if cache_system:
        system_block[0]["cache_control"] = {"type": "ephemeral"}

    messages: list[dict[str, Any]] = list(prior_messages or [])
    messages.append({"role": "user", "content": user_prompt})
    tool_calls: list[dict[str, Any]] = []
    usage_total = {"input_tokens": 0, "output_tokens": 0,
                   "cache_read_input_tokens": 0,
                   "cache_creation_input_tokens": 0, "model": MODEL}

    for _ in range(max_iterations):
        try:
            response = client.messages.create(
                model=MODEL,
                max_tokens=max_tokens,
                system=system_block,
                tools=tools,
                messages=messages,
            )
        except Exception as e:
            log.exception("claude_tool_call_failed")
            return {"error": f"{type(e).__name__}: {e}", "_usage": usage_total}

        u = response.usage
        usage_total["input_tokens"] += u.input_tokens
        usage_total["output_tokens"] += u.output_tokens
        usage_total["cache_read_input_tokens"] += getattr(
            u, "cache_read_input_tokens", 0) or 0
        usage_total["cache_creation_input_tokens"] += getattr(
            u, "cache_creation_input_tokens", 0) or 0

        # Append assistant turn (text + tool_use blocks) verbatim.
        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason != "tool_use":
            answer = "".join(b.text for b in response.content
                             if getattr(b, "type", None) == "text").strip()
            return {"answer": answer, "tool_calls": tool_calls,
                    "_usage": usage_total}

        # Run every tool_use block in this turn, return all results in one
        # user message — required by the Anthropic API.
        tool_results: list[dict[str, Any]] = []
        for block in response.content:
            if getattr(block, "type", None) != "tool_use":
                continue
            name = block.name
            args = block.input or {}
            log.info("tool_call", extra={"tool": name, "args": args})
            result = dispatch(name, args) or {}
            tool_calls.append({"name": name, "args": args, "result": result})
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": json.dumps(result, default=str),
            })
        messages.append({"role": "user", "content": tool_results})

    return {"error": f"tool loop exceeded {max_iterations} iterations",
            "tool_calls": tool_calls, "_usage": usage_total}


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
