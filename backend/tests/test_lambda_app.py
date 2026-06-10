"""Lambda adapter smoke tests without AWS network calls."""
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import lambda_app

ROOT = Path(__file__).parent.parent


def _event(method: str, path: str, body: dict | None = None) -> dict:
    return {
        "requestContext": {"http": {"method": method}},
        "rawPath": path,
        "body": json.dumps(body) if body is not None else None,
    }


def test_health() -> None:
    with patch.dict(
        "os.environ",
        {
            "LLM_PROVIDER": "bedrock",
            "AWS_REGION": "us-west-2",
            "BEDROCK_MODEL_ID": "us.anthropic.claude-sonnet-4-6",
            "OPENROUTER_API_KEY": "configured",
        },
    ):
        response = lambda_app.handler(_event("GET", "/health"), None)
    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert body["ok"] is True
    assert body["bedrock_configured"] is True
    assert body["openrouter_configured"] is True
    assert body["active_provider"] == "bedrock"
    assert body["bedrock_model"] == "us.anthropic.claude-sonnet-4-6"


def test_run_session_reuses_stage2_and_stage3() -> None:
    session = json.loads(
        (ROOT / "contracts/examples/session_input_example.json").read_text()
    )
    with patch.object(lambda_app, "put_json", return_value="evidence-packages/test.json"):
        response = lambda_app.handler(
            _event("POST", "/api/run-session", {"session": session}),
            None,
        )
    body = json.loads(response["body"])
    assert response["statusCode"] == 200
    assert body["risk_package"]["risk_category"] == "CRITICAL"
    assert body["risk_package"]["verdict"] == "REFUSE_TO_SIGN"


def test_copilot_provider_response_shape() -> None:
    provider_response = {
        "text": "Refuse to sign.",
        "provider_used": "bedrock",
        "model": "test-model",
        "provider": "bedrock",
        "model_id": "test-model",
        "_usage": {"input_tokens": 1, "output_tokens": 2},
    }
    with patch.object(lambda_app, "call_text", return_value=provider_response):
        response = lambda_app.handler(
            _event(
                "POST",
                "/api/copilot",
                {"messages": [{"role": "user", "content": "What should I do?"}]},
            ),
            None,
        )
    body = json.loads(response["body"])
    assert response["statusCode"] == 200
    assert body["provider_used"] == "bedrock"
    assert body["model"] == "test-model"
    assert body["provider"] == "bedrock"
    assert body["modelId"] == "test-model"


def test_copilot_ai_sdk_text_stream_shape() -> None:
    provider_response = {
        "text": "Refuse to sign.",
        "provider_used": "bedrock",
        "model": "test-model",
        "provider": "bedrock",
        "model_id": "test-model",
        "_usage": {"input_tokens": 1, "output_tokens": 2},
    }
    event = _event(
        "POST",
        "/api/copilot",
        {
            "messages": [
                {
                    "role": "user",
                    "parts": [{"type": "text", "text": "What should I do?"}],
                }
            ]
        },
    )
    event["headers"] = {"x-bunkerguard-stream": "text"}
    with patch.object(lambda_app, "call_text", return_value=provider_response):
        response = lambda_app.handler(event, None)
    assert response["statusCode"] == 200
    assert response["headers"]["Content-Type"].startswith("text/plain")
    assert response["body"] == "Refuse to sign."


def test_evidence_report_provider_response_shape() -> None:
    report = {
        "report_id": "RPT-1",
        "session_id": "SES-1",
        "_usage": {
            "provider": "bedrock",
            "model": "us.anthropic.claude-sonnet-4-6",
        },
    }
    with (
        patch.object(lambda_app, "generate_evidence_report", return_value=report),
        patch.object(lambda_app, "put_json", return_value="generated-reports/report.json"),
        patch.object(lambda_app, "store_evidence_report"),
    ):
        response = lambda_app.handler(
            _event("POST", "/api/evidence-report", {"session_id": "SES-1"}),
            None,
        )

    body = json.loads(response["body"])
    assert response["statusCode"] == 200
    assert body["provider_used"] == "bedrock"
    assert body["model"] == "us.anthropic.claude-sonnet-4-6"


def test_ingest_bdn_stores_file_and_starts_async_worker() -> None:
    event = _event(
        "POST",
        "/api/ingest-bdn",
        {
            "filename": "bdn.pdf",
            "content_type": "application/pdf",
            "file_base64": "JVBERi0xLjQK",
        },
    )
    supabase = type("SB", (), {})()
    table = type("Table", (), {})()
    table.insert = lambda payload: table
    table.execute = lambda: type("Result", (), {"data": [{"id": "doc-123"}]})()
    supabase.table = lambda name: table
    lambda_client = type("Lambda", (), {"invoke": lambda *args, **kwargs: {}})()
    with (
        patch.object(lambda_app, "put_bytes", return_value="uploaded-bdn/test.pdf"),
        patch.object(lambda_app, "_supabase", return_value=supabase),
        patch("boto3.client", return_value=lambda_client),
        patch.dict("os.environ", {"AWS_LAMBDA_FUNCTION_NAME": "test-function"}),
    ):
        response = lambda_app.handler(event, None)
    body = json.loads(response["body"])
    assert response["statusCode"] == 202
    assert body["document_id"] == "doc-123"
