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
from storage import put_bytes, put_json


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
