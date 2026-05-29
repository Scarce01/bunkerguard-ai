"""Stage 4 smoke test.

Run:
    PYTHONPATH=. python -m llm.tests.test_stage4

Requires ANTHROPIC_API_KEY. Without a key the call returns ``{"error": ...}``
and we exit non-zero.
"""
from __future__ import annotations

import os
import sys

from llm.stage4_copilot import run_stage4
from llm.tests._loader import load_fixture


def main() -> int:
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("SKIP: ANTHROPIC_API_KEY not set")
        return 0

    session, report, package = load_fixture()
    print(f"[fixture] session={session.session_id} "
          f"anomalies={len(report.anomalies)} score={package.risk_score}")

    result = run_stage4(session, report, package)

    if "error" in result:
        print(f"FAIL: {result['error']}")
        return 1

    print(f"summary: {result.get('summary')}")
    print(f"action:  {result.get('recommended_action')}")
    print(f"confidence: {result.get('confidence')}")
    print(f"concerns: {len(result.get('concerns', []))}")
    print(f"tokens: {result.get('_usage')}")

    assert result.get("summary"), "summary missing"
    assert result.get("recommended_action") in {
        "SIGN", "SIGN_WITH_NOTES", "SIGN_WITH_LOP",
        "REFUSE_TO_SIGN", "INSUFFICIENT_DATA",
    }
    print("PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
