"""End-to-end Stage 1 → 2 → 3 pipeline smoke test."""
from __future__ import annotations

import json
from pathlib import Path

import anomaly
import risk
from contracts import SessionInput

ROOT = Path(__file__).parent.parent


def main() -> None:
    s_dict = json.loads((ROOT / "contracts/examples/session_input_example.json").read_text())
    session = SessionInput.model_validate(s_dict)

    report = anomaly.run(session)
    print(f"[Stage 2] anomalies={len(report.anomalies)} "
          f"crit={report.critical_count} high={report.high_count} "
          f"med={report.medium_count} low={report.low_count}")
    for a in report.anomalies:
        print(f"          - {a.rule.value} {a.severity.value:<8} {a.rule_name}")

    pkg = risk.run(report, session)
    print(f"[Stage 3] score={pkg.risk_score}  category={pkg.risk_category.value}  "
          f"verdict={pkg.verdict.value}")
    print(f"          reason: {pkg.verdict_reason}")
    print(f"          floors: {[f.code for f in pkg.audit.floor_triggers]}")
    print(f"          chain ok: parent={pkg.parent_sha256[:12]}... payload={pkg.payload_sha256[:12]}...")


if __name__ == "__main__":
    main()
