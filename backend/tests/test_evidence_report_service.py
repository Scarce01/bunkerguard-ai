"""Evidence report service fallback tests."""
from __future__ import annotations

from unittest.mock import patch

from llm import evidence_report_service


def test_generate_evidence_report_fills_missing_required_fields(monkeypatch) -> None:
    payload = {
        "session": {"session_id": "SES-123", "mfm_qty_mt": 500, "fuel_grade": "VLSFO"},
        "risk_package": {"recommended_verdict": "REFUSE_TO_SIGN", "risk_category": "CRITICAL"},
    }
    report = {
        "session_id": "",
        "risk_assessment": {"recommended_verdict": "REFUSE_TO_SIGN"},
    }

    monkeypatch.setattr(
        evidence_report_service,
        "fetch_evidence_report_input",
        lambda session_id: payload,
    )
    with patch.object(
        evidence_report_service,
        "call_claude_for_report",
        return_value=report,
    ):
        generated = evidence_report_service.generate_evidence_report("SES-123")

    assert generated["session_id"] == "SES-123"
    assert generated["sign_off_status"] == "REFUSE_TO_SIGN"
    assert generated["report_id"].startswith("RPT-SES-123-")
    assert generated["generated_at"]
    assert generated["environmental_impact"]["estimated_carbon_tco2e"] == 1557.0
    assert generated["environmental_impact"]["emission_factor_tco2e_per_mt"] == 3.114
