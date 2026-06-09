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
    response = lambda_app.handler(_event("GET", "/health"), None)
    assert response["statusCode"] == 200
    assert json.loads(response["body"])["ok"] is True


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
