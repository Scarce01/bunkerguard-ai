# BunkerGuard LLM Layer — Stage 4 / 5 / 6

Built per `claude-code-prompt-llm-framework.md`, with three adaptations to match the actual repo:

| Spec assumed | Reality | What we did |
|---|---|---|
| `src/stage2_anomaly/`, `src/stage3_risk/` | `anomaly/`, `risk/` at repo root | Put this layer at repo root as `llm/` |
| Flat dicts (`bdn["vessel_name"]`) | Typed pydantic models (`session.vessel.name`) | `prompts/_typed_views.py` adapts `SessionInput`/`AnomalyReport`/`RiskPackage` |
| `risk["financial_impact"]` | `RiskPackage.estimated_impact_usd` | Field renames handled in `_typed_views.py` |

## Files

```
llm/
├── __init__.py
├── README.md                  ← you are here
├── claude_client.py           ← SDK wrapper, prompt-caching, JSON schema
├── blockchain.py              ← Sepolia tx; mock if no WALLET_PRIVATE_KEY
├── stage4_copilot.py          ← Stage 4 orchestrator
├── stage5_report.py           ← Stage 5 orchestrator + hash chain
├── stage6_reputation.py       ← Stage 6 orchestrator + fleet broadcast hook
├── pipeline_runner.py         ← End-to-end Stage 1→6 driver
├── prompts/
│   ├── __init__.py
│   ├── _typed_views.py        ← typed contract → LLM-friendly view strings
│   ├── stage4_copilot.py
│   ├── stage5_evidence.py
│   └── stage6_reputation.py
└── tests/
    ├── _loader.py             ← shared fixture: loads example session + runs Stage 2/3
    ├── test_stage4.py
    ├── test_stage5.py
    └── test_stage6.py
```

## Model and cost

- `claude-sonnet-4-6` — fast + cheap per the brief.
- 3 API calls per session (Stage 4 + 5 + 6).
- System prompts are stable + cached (`cache_control: ephemeral`) — after the first call you pay ~10% on the system prefix.
- JSON schema enforcement via `output_config.format` — no fragile regex on Claude's output.

## Run

```bash
# install
pip install anthropic                       # required
pip install web3                            # optional, only for real Sepolia tx

# env
$env:ANTHROPIC_API_KEY = "sk-ant-..."       # PowerShell
$env:WALLET_PRIVATE_KEY = "0x..."           # optional (mock if absent)

# full pipeline on the example session
PYTHONPATH=. python -m llm.pipeline_runner --session contracts/examples/session_input_example.json

# Stages 1-3 only (no Claude calls — useful for offline smoke)
PYTHONPATH=. python -m llm.pipeline_runner --skip-llm

# stage-by-stage smoke tests
PYTHONPATH=. python -m llm.tests.test_stage4
PYTHONPATH=. python -m llm.tests.test_stage5
PYTHONPATH=. python -m llm.tests.test_stage6
```

Output JSON lands in `pipeline_out/<session_id>_<utc>.json`.

## Authority split

Stages 2 + 3 are deterministic and authoritative. Stage 4 explains; it can flag concerns but must not contradict the Stage 3 verdict. Stage 5 packages evidence and anchors hashes on-chain. Stage 6 looks at fleet-level patterns.

If `ANTHROPIC_API_KEY` is missing or the API fails, Stages 4/5/6 return `{"error": ...}` and the pipeline keeps going on the deterministic outputs — no silent corruption of the verdict.
