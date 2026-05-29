"""Stage 5 smoke test."""
from __future__ import annotations

import os
import sys

from llm.stage4_copilot import run_stage4
from llm.stage5_report import run_stage5
from llm.tests._loader import load_fixture


def main() -> int:
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("SKIP: ANTHROPIC_API_KEY not set")
        return 0

    session, report, package = load_fixture()
    stage4 = run_stage4(session, report, package)
    if "error" in stage4:
        print(f"FAIL: stage 4 errored: {stage4['error']}")
        return 1

    evidence = run_stage5(session, report, package, stage4)

    if "error" in evidence:
        print(f"FAIL: {evidence['error']}")
        return 1

    bc = evidence.get("blockchain", {})
    print(f"verdict: {evidence.get('verdict')}")
    print(f"lop required: {evidence.get('lop_required')}")
    print(f"tx: {bc.get('tx_hash')} ({bc.get('chain')})")
    print(f"tokens: {evidence.get('_usage')}")

    assert evidence.get("verdict")
    assert "blockchain" in evidence
    assert bc.get("tx_hash", "").startswith("0x"), "tx hash missing 0x prefix"
    print("PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
