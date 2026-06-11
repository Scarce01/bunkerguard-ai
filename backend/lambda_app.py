"""AWS Lambda HTTP API adapter for BunkerGuard."""
from __future__ import annotations

import hashlib
import base64
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
from ingestion.workflow import process_ingestion
from storage import put_bytes, put_json, get_bytes


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


def _copilot_chat(payload: dict[str, Any]) -> dict[str, Any]:
    """Tool-using copilot — Lambda twin of `/api/copilot-chat` in dev.

    Parity goals with `scripts/copilot_chat_runner.py`:
      * Loads chat history from Supabase via `llm.chat_store`.
      * Runs `llm.stage4_copilot.run_stage4_chat_turn_supabase` which
        executes Claude with the 8-tool surface (show_chart, get_verdict_brief,
        get_lop_draft, …).
      * Uploads any chart PNG / PDF the tools wrote to disk to the
        EvidenceBucket so `/api/copilot-asset/<key>` can stream them
        back. Lambda has no persistent filesystem — local paths only
        survive within one invocation.
    """
    import tempfile
    from pathlib import Path

    from llm.chat_store import get_or_create_chat
    from llm.stage4_copilot import run_stage4_chat_turn_supabase

    session_id = str(payload.get("session_id") or "").strip()
    question = str(payload.get("question") or "").strip()
    if not session_id:
        raise ValueError("session_id is required")
    if not question:
        raise ValueError("question is required")

    chat_id = payload.get("chat_id") or None
    chat = get_or_create_chat(session_id=session_id, chat_id=chat_id)

    # Force Copilot tools to write artefacts to a fresh /tmp dir we
    # control, then sweep them into S3 below.
    with tempfile.TemporaryDirectory(prefix="copilot-") as tmp:
        out_root = Path(tmp)
        # llm.copilot_tools picks up CWD-relative `output/<session>/...`
        # by default. Pin CWD to the tmp dir so every chart lands there.
        prev_cwd = os.getcwd()
        os.chdir(out_root)
        try:
            result = run_stage4_chat_turn_supabase(chat, question, session_id)
        finally:
            os.chdir(prev_cwd)

        tool_calls: list[dict[str, Any]] = []
        for tc in result.get("tool_calls") or []:
            res = dict(tc.get("result") or {})
            local_path = res.get("path") or res.get("pdf_path")
            if local_path:
                p = Path(local_path)
                if not p.is_absolute():
                    p = (out_root / p).resolve()
                if p.exists() and p.is_file():
                    suffix = p.suffix.lower()
                    content_type = (
                        "image/png" if suffix == ".png"
                        else "image/jpeg" if suffix in (".jpg", ".jpeg")
                        else "image/svg+xml" if suffix == ".svg"
                        else "application/pdf" if suffix == ".pdf"
                        else "text/markdown; charset=utf-8" if suffix == ".md"
                        else "application/octet-stream"
                    )
                    body = p.read_bytes()
                    s3_key = put_bytes(
                        "copilot-assets",
                        session_id,
                        p.name,
                        body,
                        content_type,
                    )
                    # FE fetches /api/copilot-asset/<asset_relpath>.
                    # Using the S3 key directly keeps the contract
                    # unchanged — the GET handler reads from S3.
                    res["asset_relpath"] = s3_key
                else:
                    res["asset_relpath"] = None
            tool_calls.append({
                "name": tc.get("name"),
                "args": tc.get("args") or {},
                "result": res,
            })

    return {
        "ok": True,
        "answer": result.get("answer") or result.get("error") or "",
        "tool_calls": tool_calls,
        "usage": result.get("_usage") or {},
        "chat_id": chat.chat_id,
        "chat_messages": [
            {"role": m.role, "content": m.content, "turn_index": m.turn_index}
            for m in chat.messages
        ],
    }


def _copilot_asset(path_suffix: str) -> dict[str, Any]:
    """Stream a previously-uploaded copilot asset from S3.

    The FE's <img src="/api/copilot-asset/<key>"> uses `asset_relpath`
    from a tool call — which `_copilot_chat` populated with the S3 key
    of the upload. We fetch it and return base64-encoded so API
    Gateway can serialise the binary body.
    """
    key = path_suffix.lstrip("/")
    if not key:
        return _response(400, {"ok": False, "error": "asset key required"})
    try:
        body = get_bytes(key)
    except Exception as exc:
        return _response(404, {"ok": False, "error": f"asset not found: {exc}"})
    suffix = key.rsplit(".", 1)[-1].lower() if "." in key else ""
    content_type = (
        "image/png" if suffix == "png"
        else "image/jpeg" if suffix in ("jpg", "jpeg")
        else "image/svg+xml" if suffix == "svg"
        else "application/pdf" if suffix == "pdf"
        else "text/markdown; charset=utf-8" if suffix == "md"
        else "application/octet-stream"
    )
    headers = _cors_headers()
    headers["Content-Type"] = content_type
    headers["Cache-Control"] = "no-store"
    return {
        "statusCode": 200,
        "headers": headers,
        "body": base64.b64encode(body).decode("ascii"),
        "isBase64Encoded": True,
    }


def _agent_output(payload: dict[str, Any]) -> dict[str, Any]:
    """Generate Compliance or Decision agent narrative lines via Claude.

    Mirrors `/api/agent-output` in `vite.config.ts`. The model is told
    to return strict JSON; we extract the first {...} block defensively
    so stray markdown fences don't break the FE.
    """
    agent = str(payload.get("agent") or "").strip().lower()
    if agent not in ("compliance", "decision"):
        raise ValueError("agent must be 'compliance' or 'decision'")
    ctx = payload.get("context") or {}

    systems = {
        "compliance": (
            "You are the COMPLIANCE agent in a maritime bunkering fraud detection system.\n\n"
            "Given a session's risk score, anomalies, supplier sanctions check, and evidence hashes,\n"
            "write a short compliance verification summary.\n\n"
            "Return ONLY a JSON object — no markdown, no prose:\n"
            "{\n"
            '  "lines": [\n'
            '    "<one-line evidence package status>",\n'
            '    "<one-line regulatory citation: MARPOL / MPA / ISO 8217 / SS 648>",\n'
            '    "<one-line blockchain anchor / chain-of-custody status>"\n'
            "  ],\n"
            '  "confidence": <0-100 integer>\n'
            "}"
        ),
        "decision": (
            "You are the DECISION agent in a maritime bunkering fraud detection system.\n\n"
            "Given a session's risk score, anomalies, Exa intelligence, and Compliance findings,\n"
            "recommend a verdict for the Chief Engineer.\n\n"
            "Return ONLY a JSON object — no markdown, no prose:\n"
            "{\n"
            '  "lines": [\n'
            '    "<verdict line — REFUSE_TO_SIGN / SIGN_WITH_OBJECTION / APPROVE — plus one-sentence reason>",\n'
            '    "<dollar exposure or operational impact, one line>",\n'
            '    "<recommended next action: LoP / independent survey / MPA notification / proceed>"\n'
            "  ],\n"
            '  "confidence": <0-100 integer>\n'
            "}"
        ),
    }

    user_msg = (
        f"CONTEXT for session {ctx.get('session_id', 'unknown')}:\n"
        + json.dumps(ctx, default=str, indent=2)
    )
    result = call_text(systems[agent], [{"role": "user", "content": user_msg}], max_tokens=400)
    raw_text = result.get("text") or ""
    # Defensive JSON extraction — the model is told to return strict
    # JSON but may wrap it in fences.
    import re

    parsed: dict[str, Any] = {}
    match = re.search(r"\{[\s\S]*\}", raw_text)
    if match:
        try:
            parsed = json.loads(match.group(0))
        except Exception:
            parsed = {}
    lines = [l for l in (parsed.get("lines") or []) if isinstance(l, str)]
    if not lines:
        lines = [l for l in raw_text.split("\n") if l.strip()][:3]

    confidence = parsed.get("confidence")
    return {
        "ok": True,
        "agent": agent,
        "lines": lines,
        "confidence": confidence if isinstance(confidence, (int, float)) else None,
        "provider": result.get("provider"),
        "modelId": result.get("model_id"),
    }


def _enrich(payload: dict[str, Any]) -> dict[str, Any]:
    """Run Exa entity enrichment for the Investigator agent.

    Direct import of `enrichment.enrich_entities` — same module the
    Vite dev proxy invokes via subprocess. Requires EXA_API_KEY in env.
    """
    from enrichment.pipeline import enrich_entities

    result = enrich_entities(payload or {})
    return {"ok": True, "result": result}


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


def _supabase():
    from supabase import create_client

    return create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )


def _ingest_bdn(payload: dict[str, Any]) -> dict[str, Any]:
    filename = str(payload.get("filename") or "uploaded-bdn").strip()
    content_type = str(payload.get("content_type") or "application/octet-stream")
    encoded = payload.get("file_base64")
    if not encoded:
        raise ValueError("file_base64 is required")
    try:
        document = base64.b64decode(encoded, validate=True)
    except Exception as exc:
        raise ValueError("file_base64 is invalid") from exc
    if not document:
        raise ValueError("Uploaded BDN is empty")
    if len(document) > 6 * 1024 * 1024:
        raise ValueError("Uploaded BDN exceeds the 6 MB API limit")
    if content_type not in {
        "application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif",
    }:
        raise ValueError("Supported BDN formats are PDF, JPEG, PNG, WEBP, and GIF")

    file_hash = hashlib.sha256(document).hexdigest()
    temporary_id = file_hash[:16]
    s3_key = put_bytes("uploaded-bdn", temporary_id, filename, document, content_type)
    result = _supabase().table("bdn_documents").insert({
        "filename": filename,
        "content_type": content_type,
        "file_size_bytes": len(document),
        "s3_key": s3_key,
        "file_sha256": file_hash,
        "status": "UPLOADED",
        "current_stage": "UPLOADED",
        "pipeline_status": {
            "current_stage": "UPLOADED",
            "steps": [{"stage": stage, "status": "COMPLETED" if stage == "UPLOADED" else "PENDING"} for stage in (
                "UPLOADED", "OCR", "EXTRACTION", "ENRICHMENT",
                "RISK_ANALYSIS", "EVIDENCE_GENERATION", "DECISION_RECOMMENDATION",
            )],
        },
    }).execute()
    document_id = result.data[0]["id"]

    import boto3
    boto3.client("lambda").invoke(
        FunctionName=os.environ["AWS_LAMBDA_FUNCTION_NAME"],
        InvocationType="Event",
        Payload=json.dumps({"source": "bunkerguard.ingestion", "document_id": document_id}).encode(),
    )
    return {
        "ok": True,
        "document_id": document_id,
        "status": "UPLOADED",
        "status_url": f"/api/ingestion/{document_id}",
    }


def _ingestion_status(document_id: str) -> dict[str, Any]:
    rows = _supabase().table("bdn_documents").select("*").eq("id", document_id).limit(1).execute().data
    if not rows:
        return {"ok": False, "error": "Ingestion document not found"}
    row = rows[0]
    session = None
    if row.get("session_id"):
        response = _supabase().table("bunkering_sessions").select(
            "session_id,investigator_output,compliance_output,decision_output,evidence_s3_key"
        ).eq("session_id", row["session_id"]).maybe_single().execute()
        session = response.data
    return {
        "ok": True,
        "document": row,
        "session": session,
    }


def handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    if event.get("source") == "bunkerguard.ingestion":
        process_ingestion(str(event["document_id"]))
        return {"ok": True}

    method, path = _route(event)
    if method == "OPTIONS":
        return _response(204, {})

    try:
        if method == "GET" and path == "/health":
            llm_provider = os.environ.get("LLM_PROVIDER", "anthropic").strip().lower()
            bedrock_configured = bool(
                llm_provider == "bedrock"
                and (os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION"))
                and os.environ.get("BEDROCK_MODEL_ID")
            )
            openrouter_configured = bool(os.environ.get("OPENROUTER_API_KEY"))
            vercel_ai_gateway_configured = bool(
                os.environ.get("AI_GATEWAY_API_KEY")
            )
            return _response(
                200,
                {
                    "ok": True,
                    "service": "bunkerguard-ai",
                    "llm_provider": llm_provider,
                    "region": os.environ.get("AWS_REGION"),
                    "s3_bucket": os.environ.get("S3_BUCKET"),
                    "exa_configured": bool(os.environ.get("EXA_API_KEY")),
                    "bedrock_configured": bedrock_configured,
                    "vercel_ai_gateway_configured": vercel_ai_gateway_configured,
                    "openrouter_configured": openrouter_configured,
                    "active_provider": os.environ.get(
                        "ACTIVE_PROVIDER",
                        "bedrock_with_openrouter_fallback"
                        if bedrock_configured and openrouter_configured
                        else "bedrock"
                        if bedrock_configured
                        else "openrouter"
                        if openrouter_configured
                        else "unavailable",
                    ),
                    "bedrock_model": os.environ.get("BEDROCK_MODEL_ID"),
                    "vercel_ai_gateway_model": os.environ.get(
                        "VERCEL_AI_GATEWAY_MODEL",
                        "anthropic/claude-sonnet-4.6",
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
        if method == "POST" and path == "/api/copilot-chat":
            return _response(200, _copilot_chat(_body(event)))
        if method == "POST" and path == "/api/agent-output":
            return _response(200, _agent_output(_body(event)))
        if method == "POST" and path == "/api/enrich":
            return _response(200, _enrich(_body(event)))
        if method == "GET" and path.startswith("/api/copilot-asset/"):
            # Binary response — built by _copilot_asset so the wrapper
            # doesn't JSON-encode the image bytes.
            return _copilot_asset(path[len("/api/copilot-asset/"):])
        if method == "POST" and path == "/api/ingest-bdn":
            return _response(202, _ingest_bdn(_body(event)))
        if method == "GET" and path.startswith("/api/ingestion/"):
            status = _ingestion_status(path.rsplit("/", 1)[-1])
            return _response(200 if status.get("ok") else 404, status)
        return _response(404, {"ok": False, "error": "Not found"})
    except ValueError as exc:
        return _response(400, {"ok": False, "error": str(exc)})
    except Exception as exc:
        return _response(
            500,
            {"ok": False, "error": f"{type(exc).__name__}: {exc}"},
        )
