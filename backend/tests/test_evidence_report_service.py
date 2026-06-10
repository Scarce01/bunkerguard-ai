"""Evidence report service fallback tests."""
from __future__ import annotations

from unittest.mock import patch

from llm import evidence_report_service


def test_generate_evidence_report_fills_missing_required_fields(monkeypatch) -> None:
    payload = {
        "session": {
            "session_id": "SES-123",
            "bdn_qty_mt": 500,
            "mfm_qty_mt": 490,
            "fuel_grade": "VLSFO",
            "vessel_name": "MV TEST",
        },
        "bdn": {"bdn_ref": "BDN-123"},
        "mfm_summary": {"readings_count": 10},
        "anomalies": [{
            "rule_id": "A02",
            "severity": "CRITICAL",
            "description": "Quantity mismatch",
        }],
        "risk_package": {"recommended_verdict": "REFUSE_TO_SIGN", "risk_category": "CRITICAL"},
    }
    narrative = {
        "executive_summary": "Concise summary.",
        "ai_narrative": "Concise narrative.",
        "recommended_actions": ["1. Refuse sign-off."],
        "_usage": {"provider": "bedrock", "model": "test-model"},
    }

    monkeypatch.setattr(
        evidence_report_service,
        "fetch_evidence_report_input",
        lambda session_id: payload,
    )
    with patch.object(
        evidence_report_service,
        "call_claude_for_report",
        return_value=narrative,
    ):
        generated = evidence_report_service.generate_evidence_report("SES-123")

    assert generated["session_id"] == "SES-123"
    assert generated["sign_off_status"] == "REFUSE_TO_SIGN"
    assert generated["report_id"].startswith("RPT-SES-123-")
    assert generated["generated_at"]
    assert generated["environmental_impact"]["estimated_carbon_tco2e"] == 1525.86
    assert generated["environmental_impact"]["emission_factor_tco2e_per_mt"] == 3.114
    assert generated["quantity_comparison"]["discrepancy_mt"] == -10
    assert generated["evidence_items"]
    assert generated["_usage"]["provider"] == "bedrock"


def test_report_uses_backend_fallback_when_llm_json_is_invalid(monkeypatch) -> None:
    payload = {
        "session": {
            "session_id": "SES-456",
            "bdn_qty_mt": 100,
            "mfm_qty_mt": 99,
            "fuel_grade": "MGO",
        },
        "bdn": {},
        "mfm_summary": {},
        "anomalies": [],
        "risk_package": {
            "final_risk_score": 20,
            "risk_category": "LOW",
            "recommended_verdict": "SIGN",
        },
    }
    monkeypatch.setattr(
        evidence_report_service,
        "fetch_evidence_report_input",
        lambda session_id: payload,
    )
    with patch.object(
        evidence_report_service,
        "call_text",
        return_value={
            "text": "not json",
            "_usage": {"provider": "vercel_ai_gateway", "model": "gateway-model"},
        },
    ) as call:
        generated = evidence_report_service.generate_evidence_report("SES-456")

    call.assert_called_once()
    assert generated["executive_summary"]
    assert generated["recommended_actions"]
    assert generated["_usage"]["provider"] == "vercel_ai_gateway"
