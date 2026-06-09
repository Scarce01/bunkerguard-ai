# BunkerGuard AI

> **Maritime fraud-intelligence platform for Singapore bunker operations.**
> Real-time multi-agent reasoning over MFM telemetry, BDN documents, AIS
> tracks, supplier history, and regulatory rules — producing auditable,
> blockchain-anchored evidence reports a Chief Engineer can sign off in 90
> seconds instead of three days.

Built for the **Singapore NEXT / SuperAI 2026 Hackathon**.

---

## TL;DR

When a bunker barge under-delivers fuel to a vessel in Singapore today, the
Chief Engineer has minutes to either sign the Bunker Delivery Note (and pay
for missing fuel) or refuse and trigger a multi-week dispute. Detection
relies on a calibrated **Mass Flow Meter (MFM)** reading, a paper **Bunker
Delivery Note (BDN)**, and human judgement under time pressure.

BunkerGuard AI runs four cooperating LLM agents over live MFM telemetry,
historical supplier behaviour, MARPOL/MPA/ISO 8217 rule packs, and Exa-sourced
news context, then produces a signed, hash-chained evidence package that ties
the verdict to:

- **Per-anomaly rule citations** (e.g. *A02 Quantity Final Mismatch · MEPC.1/Circ.891*)
- **MFM trajectory deltas** vs. expected delivery curve
- **Supplier reputation history** + Exa news scrape
- **A drafted Letter of Protest** in formal maritime-legal voice
- **SHA-256 hash + Ethereum anchor tx** for tamper-evident audit

---

## Live demo flow (90 seconds)

1. **Dashboard** — Singapore port map shows 10 terminals + 28 vessels live.
   AI Recommendation panel surfaces `REFUSE TO SIGN BDN` for the top-risk
   session with 4 clickable signals that deep-link to root-cause pages.
2. **Live Session** (`/live`) — Top-down 3D scene of vessel + barge with
   light-bars flowing along the bunker hose at MFM-rate. Green geofence ring,
   real-time KPIs (transfer %, duration, shortage MT, alerts), and a
   "Simulate Drift" button that drags the receiving vessel outside the MPA
   anchorage and lights up the Surveyor agent in red.
3. **Agent Decision Workflow** (right rail of `/live`) — 4 agent cards run
   in sequence with threshold gates: **Surveyor → Investigator → Compliance
   → Decision**, plus a **Chief Engineer** human-in-the-loop sign-off step.
4. **Intelligence** (`/intelligence`) — Supplier ↔ AI Agent ↔ Fleet
   network graph. Hover any agent for its role/inputs/outputs. The Live
   Agent Conversation panel streams 5 inter-agent messages with payload
   chips, ending in a *Generate Evidence Report* CTA that spawns the
   Python pipeline and opens a glass drawer with the result.
5. **Evidence Report Drawer** — Six-step pipeline indicator (`Fetch →
   MFM → Anomalies → Claude → Hash → Store`), then the full report with
   AI Verdict, recommended actions, drafted Letter of Protest,
   SHA-256 hash, and Ethereum anchor tx. Buttons to download JSON,
   copy hash, copy tx.
6. **Port Copilot** (right-rail dock, `Cmd+K`) — Glass-blur chat with
   session-aware context. Asks Claude (or AWS Bedrock when configured)
   anything about the active session, anomaly, or supplier.

---

## Repository layout

```
bunkerguard-ai/
├── frontend/                       # React 18 + Vite + TypeScript + R3F + MapLibre
│   ├── src/
│   │   ├── app/
│   │   │   ├── pages/              # Dashboard, LiveSession, Sessions, Intelligence, ...
│   │   │   ├── components/
│   │   │   │   ├── live/           # 3D scene (top-down R3F), AgentWorkflow card
│   │   │   │   ├── intelligence/   # Network graph, agent conversation stream
│   │   │   │   ├── evidence/       # Evidence report drawer
│   │   │   │   └── PortCopilot.tsx # Right-rail dock with Cmd+K
│   │   ├── lib/                    # Supabase client + 12 useXxx() hooks (live data)
│   │   ├── data/                   # Mock fallbacks + terminal/vessel scene metadata
│   │   └── styles/                 # globals.css + theme.css + tailwind config
│   ├── scripts/
│   │   └── evidence_report_runner.py   # CLI bridge → backend's Python service
│   ├── public/                     # GLB models, MapLibre style overrides
│   ├── supabase/                   # FE-side seed scripts & migrations
│   ├── vite.config.ts              # Custom proxies: /api/copilot, /api/evidence-report, /models
│   └── package.json
│
├── backend/                        # Python: anomaly detection, risk scoring, LLM pipeline
│   ├── anomaly/                    # Stage 2 — 26-rule deterministic detector
│   ├── risk/                       # Stage 3 — calibrated four-channel risk score
│   ├── llm/
│   │   ├── claude_client.py        # Anthropic SDK wrapper (JSON-mode)
│   │   ├── evidence_report_service.py  # Stage 5 — full evidence pipeline
│   │   ├── stage4_*.py             # Surveyor/Investigator/Compliance prompts
│   │   └── stage5_report.py        # Schema for the signed report
│   ├── outputs/                    # Hash chain, Ed25519 signing, PDF/chart bundlers
│   ├── ingestion/                  # Stage 1 — BDN OCR + MFM parsing → SessionInput
│   ├── policy/                     # Compliance rule packs (MARPOL, MPA, ISO 8217)
│   ├── contracts/                  # Pydantic schemas shared across stages
│   ├── supabase/                   # Migrations + seed scripts for the demo data
│   ├── tests/                      # pytest — deterministic, no I/O
│   └── README.md                   # Deep dive on Stage 2 & 3 deterministic core
│
├── .env.example                    # Linked from each subdir's own example
├── .gitignore
└── README.md                       # ← you are here
```

---

## Architecture overview

### Two execution domains

**Browser (React + Vite)** owns the visual interface — 3D maritime scene,
agent workflow cards, supplier network graph, evidence drawer, and Port
Copilot. It reads Supabase directly for low-latency telemetry rendering.

**Server (Vite middleware → Python subprocess)** owns anything that needs
secrets or heavy computation:

- `/api/copilot` — proxies chat requests to Anthropic via the swappable
  `LLMProvider` interface (Anthropic now, AWS Bedrock by changing one
  factory call).
- `/api/evidence-report` — spawns `scripts/evidence_report_runner.py`,
  which imports the backend's `llm.evidence_report_service`. The runner
  fetches a session's rows from Supabase, calls Claude to draft the
  executive narrative + Letter of Protest, hashes the result, mocks an
  Ethereum anchor tx, and tries to persist into `evidence_reports`.

### Four-agent workflow (the demo's centrepiece)

```
   ┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────┐
   │  Surveyor   │───▶│ Investigator │───▶│ Compliance  │───▶│ Decision │
   │  OBSERVE    │    │  CORRELATE   │    │   VERIFY    │    │  DECIDE  │
   └─────────────┘    └──────────────┘    └─────────────┘    └──────────┘
        ▲                    ▲                                     │
        │                    │                                     ▼
   MFM · AIS · IoT       supplier history                 ┌────────────────┐
   geofence              + Exa news search                │ Chief Engineer │
                                                          │   SIGN-OFF     │
                                                          └────────────────┘
```

Each step is gated by a risk-score threshold: Investigator > 40, Compliance >
80, Decision > 90. Below the gate, the workflow halts — i.e., a clean
session stops at Surveyor and never hits the LLM stack, keeping cost in
check.

### Multi-agent intelligence network

The Intelligence page renders a SVG network with three columns:
**Suppliers → AI Agents → Fleet Sessions**. Edges are colour-coded by risk,
with animated photons travelling along the agent-chain in real time. A
companion **Agent Conversation Stream** plays a scripted but data-faithful
5-message conversation between the agents — culminating in a *Generate
Evidence Report* CTA tied to the same Supabase session.

---

## Tech stack

| Layer | Technologies |
|---|---|
| **Frontend framework** | React 18 · Vite 5 · TypeScript · React Router 6 |
| **3D rendering** | Three.js · React Three Fiber · drei (GLB models, fog, environment) |
| **Maps** | MapLibre GL JS (free CARTO basemap, 10 Singapore bunker terminals) |
| **Charts** | Recharts |
| **Icons** | Lucide React |
| **Backend** | Python 3.11+ · supabase-py · anthropic SDK · Pydantic |
| **Storage** | Supabase Postgres (11 tables, see below) |
| **LLM** | Claude Sonnet 4.6 (default) · AWS Bedrock-ready via `LLMProvider` |
| **Cryptography** | hashlib SHA-256 · cryptography Ed25519 · HMAC |
| **Animation** | CSS keyframes (fadeInUp, fadeInRight, livePulse) + R3F useFrame |
| **Build / dev** | Vite middleware for `/api/*` proxies; spawn() for Python subprocess |

---

## Supabase schema

```
sessions              ─ bunkering session header (vessel · barge · supplier · port · qty)
bdn_records           ─ Bunker Delivery Note (paper-trail per session)
mfm_stream            ─ time-series MFM telemetry packets (per second-ish)
anomalies             ─ 26-rule deterministic detector outputs
risk_scores           ─ Stage-3 calibrated four-channel composite
llm_outputs           ─ all Stage-4 agent narratives, by session × stage
suppliers             ─ master supplier list + reputation score
historical_transactions ─ rolling supplier delivery history (for cross-ref)
anchorage_geofences   ─ MPA-published anchorage polygons + radii
fuel_parameters       ─ per-grade compliance limits (MARPOL Annex VI, ISO 8217)
fuel_prices           ─ VLSFO/MGO spot prices for financial-impact calc
```

`evidence_reports` is intended for persisted reports but is **not yet
provisioned** in the demo project. The drawer still works without it — the
runner returns the report directly to the browser and only logs the missing
table as a `store_error`.

---

## Getting started

### 1. Clone

```bash
git clone https://github.com/<your-org>/bunkerguard-ai.git
cd bunkerguard-ai
```

### 2. Configure environment

```bash
# Frontend
cp frontend/.env.example frontend/.env.local
# Fill in SUPABASE_URL, SUPABASE_ANON_KEY, ANTHROPIC_API_KEY

# Backend
cp backend/.env.example backend/.env
# Fill in SUPABASE_URL, SUPABASE_KEY, ANTHROPIC_API_KEY
```

### 3. Install

```bash
# Frontend
cd frontend
npm install

# Backend
cd ../backend
python -m venv .venv
.venv\Scripts\activate           # Windows
# source .venv/bin/activate      # macOS/Linux
pip install -r requirements-outputs.txt
pip install supabase anthropic pydantic
```

### 4. Seed Supabase

In Supabase Studio, run the SQL files in `backend/supabase/migrations/`
in order. Then seed demo data:

```bash
cd frontend
python supabase/seed/v03_telemetry.py    # 26 MFM packets + Stage-4 LLM output for SES-2026-016
```

### 5. Run

```bash
cd frontend
npm run dev
```

Visit <http://localhost:5173>. The Vite dev server auto-loads
`frontend/.env.local`, aliases `VITE_SUPABASE_*` to the unprefixed names
needed by the Python subprocess, and exposes the `/api/copilot` and
`/api/evidence-report` proxies on the same port.

---

## Anatomy of an evidence report (real Claude output)

Calling `POST /api/evidence-report` with `{session_id: "SES-2026-016"}`
returns a fully drafted package. The Letter of Protest in particular is
~1,400 words of formal maritime legal voice — drafted in one Claude call
against the structured prompt in `backend/llm/stage5_report.py`. Sample
fields:

```json
{
  "report_id": "RPT-SES-2026-016-20260609T121902Z",
  "header": {
    "vessel_name": "EVER GIVEN",
    "supplier_name": "BunkerGuard Demo Supplier Gamma Pte Ltd",
    "fuel_grade": "VLSFO RMG 380",
    "bdn_reference": "BDN-SG-2026-06-0016"
  },
  "quantity_comparison": {
    "bdn_declared_mt": 500.0,
    "mfm_measured_mt": 481.2,
    "discrepancy_mt": -18.8,
    "discrepancy_pct": -3.76,
    "financial_impact_usd": 10998
  },
  "anomaly_summary": { "total_anomalies": 2, "critical_count": 1 },
  "risk_assessment": {
    "final_score": 78,
    "risk_category": "CRITICAL",
    "recommended_verdict": "REFUSE_TO_SIGN"
  },
  "compliance_flags": {
    "marpol_sulphur_ok": true,
    "quantity_within_tolerance": false,
    "ais_verified": true
  },
  "ai_narrative": "Session SES-2026-016 for M/V EVER GIVEN (IMO 9776002) at Singapore Eastern Anchorage on 2026-06-10 presents a CRITICAL risk profile…",
  "recommended_actions": [ "1. REFUSE TO SIGN the BDN…", "2. PRESERVE ALL EVIDENCE…", "..." ],
  "lop_draft": "LETTER OF PROTEST\n\nTO: Master / Officer-in-Charge…",
  "_usage": { "input_tokens": 3042, "output_tokens": 3989, "model": "claude-sonnet-4-6" },
  "report_hash": "0x08db28e9c5df3507"
}
```

Cost on Sonnet 4.6: roughly **USD 0.07 per report**.

---

## Vite proxies

```ts
// vite.config.ts highlights

// Auto-loads .env.local server-side, aliases VITE_SUPABASE_* → SUPABASE_*
loadServerEnv()

plugins: [
  externalModelServer(),    // /models/*.glb — serves oversized GLBs from disk
  copilotProxy(),           // /api/copilot — POST { system, messages, maxTokens }
  evidenceReportProxy(),    // /api/evidence-report — POST { session_id }
  react(),
  tailwindcss(),
]
```

`copilotProxy()` resolves the provider via `getLLMProvider(process.env)`:
- If `AWS_BEDROCK_REGION` + `AWS_BEDROCK_MODEL_ID` are set → AWS Bedrock.
- Else if `ANTHROPIC_API_KEY` is set → Anthropic SDK.
- Else throws — Copilot returns a 500 with a helpful error string.

`evidenceReportProxy()` spawns `python scripts/evidence_report_runner.py
<session_id>` with the resolved env. The runner is a thin CLI bridge
around `backend/llm/evidence_report_service.generate_evidence_report()`,
adding SHA-256 hashing and a mock Ethereum anchor tx before persisting
(or surfacing the failure if `evidence_reports` is not yet provisioned).

---

## Stage 2 & 3 (deterministic Python core)

The backend's `anomaly/` and `risk/` modules carry their own deep technical
README at [`backend/README.md`](backend/README.md). Highlights:

- 26 anomaly rules over 9 detector families (quantity, density, flow,
  drive-gain, AIS, geofence, MARPOL, ISO 8217, supplier history).
- Composite risk score over four calibrated channels: `anomaly_severity`,
  `supplier_history`, `doc_completeness`, `deviation`.
- Deterministic — no LLM calls, no I/O. Same `SessionInput` always produces
  the same `RiskScore`. Everything is signed Ed25519 + hash-chained.
- Compliance policy lives in `policy/__init__.py` as data, not code, so
  MPA threshold tweaks don't touch any detector logic.

---

## Roadmap / honest limitations

This is a hackathon demo, not a production system. Known gaps:

| Area | Status |
|---|---|
| Supabase `evidence_reports` table | Not provisioned. The drawer works without persistence; reports surface a `store_error` field when storage fails. |
| Row-Level Security | Off. The demo currently uses the `service_role` JWT for browser reads — convenient for the demo, unsuitable for production. Swap to anon key + RLS before any non-demo use. |
| Ethereum anchor | Mocked. The `anchor_tx` field is a deterministic-looking hex string but no transaction is actually broadcast. |
| Letter of Protest legal review | Drafted by Claude; not reviewed by a maritime lawyer. Treat as a starting point. |
| Real AIS feed | Currently driven by `anchorage_geofences` + a "Simulate Drift" button. Production needs an actual AIS subscription. |
| Real MFM telemetry | Seeded in Supabase from `v03_telemetry.py`. Production needs a barge-side IoT gateway. |
| Multi-port support | Singapore-only. Map / geofences / fuel-price ticker are hard-coded to SGP. |

---

## License

Hackathon submission — internal use only. Contact the authors before any
external distribution.

---

## Acknowledgements

- **Anthropic** for the Claude API.
- **Singapore Maritime and Port Authority** for the public regulatory data
  used in the policy packs (MEPC.1/Circ.891, MPA bunkering licence rules).
- **Vopak · Stolthaven · Tankstore · Shell** for being recognisable terminal
  names on the demo map.

Authors: BunkerGuard hackathon team, 2026.
