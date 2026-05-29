"""Stage 6 smoke test."""
from __future__ import annotations

import os
import sys

from llm.stage6_reputation import run_stage6
from llm.tests._loader import load_fixture


# Plausible synthetic history for the example supplier. Real callers would
# load this from MockDataset/v3/Historical_Transactions.csv.
SAMPLE_HISTORY = [
    {"session": "SES-2026-001", "date": "2026-04-12", "qty_bdn": 500.0, "qty_mfm": 488.5, "pct": -2.30},
    {"session": "SES-2026-005", "date": "2026-04-22", "qty_bdn": 420.0, "qty_mfm": 411.8, "pct": -1.95},
    {"session": "SES-2026-009", "date": "2026-05-02", "qty_bdn": 600.0, "qty_mfm": 583.4, "pct": -2.77},
]


def main() -> int:
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("SKIP: ANTHROPIC_API_KEY not set")
        return 0

    session, _, package = load_fixture()
    result = run_stage6(session, package, SAMPLE_HISTORY)

    if "error" in result:
        print(f"FAIL: {result['error']}")
        return 1

    print(f"supplier: {result.get('supplier_name')}")
    print(f"reputation: {result.get('previous_reputation')} → {result.get('new_reputation_score')}")
    print(f"trend: {result.get('trend')}")
    print(f"alert: {result.get('alert_type')}")
    print(f"mpa referral: {result.get('mpa_referral_recommended')}")
    print(f"tokens: {result.get('_usage')}")

    assert result.get("alert_type") in {"NONE", "SUPPLIER_FLAG", "FLEET_ALERT", "EMERGENCY"}
    assert result.get("trend") in {"IMPROVING", "STABLE", "WORSENING", "RAPID_DECLINE"}
    print("PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
