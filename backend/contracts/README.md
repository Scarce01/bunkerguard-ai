# BunkerGuard MOCK Contracts (v0.1)

> Purpose: unblock **Stage 2 (Anomaly Detection)** and **Stage 3 (Risk Scoring)** development
> while the official contracts are still being defined by the team.
>
> Drop-in replaceable. When the teammates finalise the real contracts, only this folder
> changes. Stage 2/3 business logic does NOT need to be rewritten.

## Files

| File | Owner | Stage Boundary |
|---|---|---|
| `stage1_session_input.py` | Stage 1 → Stage 2 | Ingest output |
| `stage2_anomaly_output.py` | Stage 2 → Stage 3 | Anomaly detection output |
| `stage3_risk_package.py`   | Stage 3 → Stage 4/5/6 | Final risk verdict |
| `enums.py` | shared | Allowed values |
| `examples/` | shared | One JSON sample per contract |

## Rules

1. Every field has a **type**, **unit**, and **required/optional** flag.
2. All timestamps are **UTC ISO-8601** (`2026-05-10T06:00:00Z`). No local time.
3. All money is **USD**. All mass is **MT**. All volume is **m³**.
4. `null` is allowed only where the schema explicitly marks `Optional`.
5. If Stage 2 cannot evaluate a rule, it MUST emit a `data_quality.insufficient_data = true`
   instead of fabricating values. Stage 3 then returns `risk_score = null` and
   `risk_category = INSUFFICIENT_DATA`.

## How Stage 2/3 should use this

```python
from contracts.stage1_session_input import SessionInput
from contracts.stage2_anomaly_output import AnomalyReport
from contracts.stage3_risk_package import RiskPackage

def run_stage2(session: SessionInput) -> AnomalyReport: ...
def run_stage3(report: AnomalyReport, session: SessionInput) -> RiskPackage: ...
```

When the real contracts arrive, only the imports change.
