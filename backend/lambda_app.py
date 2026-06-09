"""AWS Lambda HTTP API adapter for BunkerGuard."""
from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone
from typing import Any

import anomaly
import risk
from contracts import SessionInput, canonical_json
from llm.claude_client import call_text
from llm.evidence_report_service import (
    generate_evidence_report,
    store_evidence_report,
)
from storage import put_json


def _cors_headers() -> dict[str, str]:
    return {
        "Access-Control-Allow-Origin": os.environ.get("CORS_ORIGIN", "*"),
        "Access-Control-Allow-Headers": "content-type,authorization,x-bunkerguard-stream",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Content-Type": "application/json",
    }


def _response(status: int, payload: Any) -> dict[str, Any]:
    return {
        "statusCode": status,
        "headers": _cors_headers(),
        "body": json.dumps(payload, default=str),
    }


def _text_response(status: int, text: str) -> dict[str, Any]:
    headers = _cors_headers()
    headers["Content-Type"] = "text/plain; charset=utf-8"
    return {"statusCode": status, "headers": headers, "body": text}


def _body(event: dict[str, Any]) -> dict[str, Any]:
    raw = event.get("body")
    if not raw:
        return {}
    if event.get("isBase64Encoded"):
        import base64

        raw = base64.b64decode(raw).decode("utf-8")
    return json.loads(raw) if isinstance(raw, str) else raw


def _route(event: dict[str, Any]) -> tuple[str, str]:
    context = event.get("requestContext", {}).get("http", {})
    method = context.get("method") or event.get("httpMethod") or "GET"
    path = event.get("rawPath") or event.get("path") or "/"
    return method.upper(), path.rstrip("/") or "/"


def _run_session(payload: dict[str, Any]) -> dict[str, Any]:
    session_payload = payload.get("session", payload)
    session = SessionInput.model_validate(session_payload)
    report = anomaly.run(session)
    package = risk.run(report, session)
    result = {
        "ok": True,
        "session": session.model_dump(mode="json"),
        "anomaly_report": report.model_dump(mode="json"),
        "risk_package": package.model_dump(mode="json"),
    }
    result["s3_key"] = put_json("evidence-packages", session.session_id, result)
    return result


def _copilot(payload: dict[str, Any]) -> dict[str, Any]:
    messages = []
    for message in payload.get("messages") or []:
        content = message.get("content")
        if content is None:
            content = "".join(
                part.get("text", "")
                for part in message.get("parts", [])
                if part.get("type") == "text"
            )
        messages.append({"role": message.get("role"), "content": content or ""})
    if not messages:
        raise ValueError("messages must contain at least one chat message")
    result = call_text(
        payload.get("system") or "You are BunkerGuard Copilot.",
        messages,
        max_tokens=int(payload.get("maxTokens") or payload.get("max_tokens") or 700),
    )
    return {
        "ok": True,
        "text": result["text"],
        "provider_used": result["provider_used"],
        "model": result["model"],
        "provider": result["provider"],
        "modelId": result["model_id"],
        "usage": result["_usage"],
    }


def _evidence_report(payload: dict[str, Any]) -> dict[str, Any]:
    session_id = str(payload.get("session_id", "")).strip()
    if not session_id:
        raise ValueError("session_id is required")

    report = generate_evidence_report(session_id)
    hashed_at = datetime.now(timezone.utc).isoformat()
    report_hash = hashlib.sha256(canonical_json(report)).hexdigest()
    report["report_hash"] = report_hash
    s3_key = put_json("generated-reports", session_id, report)

    store_error = None
    try:
        store_evidence_report(report, bundle_id=s3_key)
    except Exception as exc:
        store_error = f"{type(exc).__name__}: {exc}"

    return {
        "ok": True,
        "report": report,
        "provider_used": report.get("_usage", {}).get("provider"),
        "model": report.get("_usage", {}).get("model"),
        "hashed_at": hashed_at,
        "anchored": False,
        "anchor_tx": None,
        "s3_key": s3_key,
        "store_error": store_error,
    }


def handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    method, path = _route(event)
    if method == "OPTIONS":
        return _response(204, {})

    try:
        if method == "GET" and path == "/health":
            return _response(
                200,
                {
                    "ok": True,
                    "service": "bunkerguard-ai",
                    "llm_provider": os.environ.get("LLM_PROVIDER", "anthropic"),
                    "region": os.environ.get("AWS_REGION"),
                    "s3_bucket": os.environ.get("S3_BUCKET"),
                    "exa_configured": bool(os.environ.get("EXA_API_KEY")),
                    "openrouter_configured": bool(
                        os.environ.get("OPENROUTER_API_KEY")
                    ),
                    "openrouter_model": os.environ.get(
                        "OPENROUTER_MODEL", "anthropic/claude-sonnet-4.6"
                    ),
                },
            )
        if method == "POST" and path == "/api/run-session":
            return _response(200, _run_session(_body(event)))
        if method == "POST" and path == "/api/copilot":
            result = _copilot(_body(event))
            headers = {
                str(key).lower(): str(value)
                for key, value in (event.get("headers") or {}).items()
            }
            if headers.get("x-bunkerguard-stream") == "text":
                return _text_response(200, result["text"])
            return _response(200, result)
        if method == "POST" and path == "/api/evidence-report":
            return _response(200, _evidence_report(_body(event)))
        return _response(404, {"ok": False, "error": "Not found"})
    except ValueError as exc:
        return _response(400, {"ok": False, "error": str(exc)})
    except Exception as exc:
        return _response(
            500,
            {"ok": False, "error": f"{type(exc).__name__}: {exc}"},
        )
