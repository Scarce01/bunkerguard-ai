"""Shared fixture loader for LLM-stage tests."""
from __future__ import annotations

import json
from pathlib import Path

import anomaly
import risk
from contracts import SessionInput

ROOT = Path(__file__).resolve().parent.parent.parent


def load_fixture() -> tuple[SessionInput, "anomaly.AnomalyReport", "risk.RiskPackage"]:
    s_dict = json.loads(
        (ROOT / "contracts/examples/session_input_example.json").read_text(encoding="utf-8")
    )
    session = SessionInput.model_validate(s_dict)
    report = anomaly.run(session)
    package = risk.run(report, session)
    return session, report, package
