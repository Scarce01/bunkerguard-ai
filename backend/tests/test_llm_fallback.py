"""LLM provider fallback tests without external network calls."""
from __future__ import annotations

from unittest.mock import patch

import pytest
from botocore.exceptions import ClientError

from llm import claude_client


def _client_error(code: str) -> ClientError:
    return ClientError(
        {"Error": {"Code": code, "Message": "test failure"}},
        "Converse",
    )


def test_bedrock_access_denied_falls_back_to_openrouter(monkeypatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "bedrock")
    monkeypatch.setenv("BEDROCK_MODEL_ID", "bedrock-test-model")
    bedrock = type(
        "BedrockClient",
        (),
        {"converse": lambda *args, **kwargs: (_ for _ in ()).throw(
            _client_error("AccessDeniedException")
        )},
    )()
    fallback = {
        "text": "Fallback response",
        "provider_used": "openrouter",
        "model": "anthropic/claude-sonnet-4.6",
        "provider": "openrouter",
        "model_id": "anthropic/claude-sonnet-4.6",
        "_usage": {
            "input_tokens": 2,
            "output_tokens": 3,
            "provider": "openrouter",
            "model": "anthropic/claude-sonnet-4.6",
        },
    }

    with (
        patch.object(claude_client, "_get_bedrock_client", return_value=bedrock),
        patch.object(claude_client, "_call_openrouter", return_value=fallback) as call,
    ):
        result = claude_client.call_text(
            "system",
            [{"role": "user", "content": "hello"}],
        )

    assert result["provider_used"] == "openrouter"
    assert result["model"] == "anthropic/claude-sonnet-4.6"
    call.assert_called_once()


def test_non_access_denied_bedrock_error_does_not_fallback(monkeypatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "bedrock")
    monkeypatch.setenv("BEDROCK_MODEL_ID", "bedrock-test-model")
    bedrock = type(
        "BedrockClient",
        (),
        {"converse": lambda *args, **kwargs: (_ for _ in ()).throw(
            _client_error("ValidationException")
        )},
    )()

    with (
        patch.object(claude_client, "_get_bedrock_client", return_value=bedrock),
        patch.object(claude_client, "_call_openrouter") as fallback,
        pytest.raises(ClientError),
    ):
        claude_client.call_text(
            "system",
            [{"role": "user", "content": "hello"}],
        )

    fallback.assert_not_called()
