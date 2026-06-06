
hshshshhssh

# Copy this to .env and fill in your values.
# Never commit .env to git.

# ── Supabase ──────────────────────────────────────────────────────────────────
# From: Supabase Dashboard → Project Settings → API
SUPABASE_URL=https://supabase.com/dashboard/project/jdnzznxwdczcktfqwxmj
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impkbnp6bnh3ZGN6Y2t0ZnF3eG1qIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDc1MDUxMiwiZXhwIjoyMDk2MzI2NTEyfQ.OPqryB55sxjpXnY5cGwceTe7p9AfMUB6jbzGlS4AVZ0

# ── Anthropic (Stages 4-6 LLM) ───────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...

# ── Ingestion defaults ────────────────────────────────────────────────────────
BDN_DEFAULT_PORT=Singapore
BDN_SESSION_PREFIX=SES


shhhhh


# BunkerGuard — Stage 2 & Stage 3

> Real-time **anomaly detection** + **risk scoring** for ship-bunkering fraud.
> Singapore NEXT / SuperAI 2026 Hackathon — our 2-stage slice of a 6-stage pipeline.

Pure-Python, deterministic, auditable. **No I/O in detection or scoring** — every input is a typed `SessionInput`, every output is a signed, hash-chained report. Compliance edits live in [`policy/`](policy/__init__.py); no detector or scorer code changes when thresholds move.

---

## 1. What we own

| # | Stage | Module | Owner |
|---|-------|--------|-------|
| 1 | Data ingestion → `SessionInput` | `_other_stages/ingest/` | other team |
| **2** | **Real-time anomaly detector** | [`anomaly/`](anomaly/) | **us** |
| **3** | **Risk scoring engine** | [`risk/`](risk/) | **us** |
| 4 | LLM explanation copilot | (other team) | other team |
| 5 | Evidence report + BDN + blockchain | `_other_stages/pipeline/` | other team |
| 6 | Supplier reputation update + MQTT | (other team) | other team |

Everything not under Stage 2/3 lives under [`_other_stages/`](_other_stages/) and is only kept so we can run the full pipeline end-to-end in demos.

---

## 2. Architecture

```mermaid
flowchart LR
    A[Stage 1<br/>Ingestion<br/>MFM + BDN + AIS] -->|SessionInput<br/>signed Ed25519| B
    subgraph OURS[Our scope]
      direction TB
      B[Stage 2<br/>anomaly/<br/>26 rules] -->|AnomalyReport<br/>hash-chained| C[Stage 3<br/>risk/<br/>weighted + floors]
    end
    C -->|RiskPackage<br/>score + verdict + USD| D[Stage 4<br/>LLM Copilot]
    D --> E[Stage 5<br/>Evidence + BDN + Blockchain]
    E --> F[Stage 6<br/>Reputation + MQTT]

    style B fill:#1f6feb,color:#fff,stroke:#fff
    style C fill:#1f6feb,color:#fff,stroke:#fff
```

### Why two stages, not one
- **Stage 2 is evidence**: every rule emits *what is wrong, how confident, and which standard says so* — surveyor-ready proof.
- **Stage 3 is judgment**: it never re-derives evidence; it weighs Stage 2 + supplier history + doc completeness + realtime delta and converts to a money-and-action verdict.
- Separating them lets policy/compliance change the verdict without rebuilding any detector.

---

## 3. End-to-end data flow

```mermaid
sequenceDiagram
    participant S1 as Stage 1 (Ingest)
    participant S2 as Stage 2 (anomaly.run)
    participant S3 as Stage 3 (risk.run)
    participant Out as RiskPackage

    S1->>S2: SessionInput (typed, Ed25519-signed)
    Note over S2: verify chain hash<br/>verify HMAC on MFM packets<br/>run all 26 rules in parallel
    S2->>S2: dedupe + sort anomalies
    S2->>S3: AnomalyReport (sha256 chained to parent)
    Note over S3: confidence × calibration haircut<br/>weighted 40/25/15/20<br/>apply floors (max wins)<br/>compute USD impact
    S3->>Out: RiskPackage (score, category, verdict, because[], USD)
    Out->>Out: sha256 chained to AnomalyReport
```

---

## 4. Anomaly rules (Stage 2 — 26 rules)

Each rule = a pure function `(SessionInput) -> list[Anomaly]`. All citations and confidence priors come from the single source `RULE_REGISTRY` in [`contracts/enums.py`](contracts/enums.py).

### Quantity & flow physics
| ID | Name | Trigger | Regulatory basis |
|----|------|---------|------------------|
| **A01** | Quantity trajectory deviation | Cumulative MFM curve deviates from linear delivery profile | MEPC.1/Circ.891 §4.2 |
| **A02** | Quantity final mismatch | abs(MFM − BDN) / BDN > 0.5 % (LOW) → 1.5 % (MED) → 3 % (CRIT) | SS 648:2019, MEPC.1/Circ.891 |
| **A04** | Flow-rate anomaly | Zero-flow gap > 120 s mid-delivery | MEPC.1/Circ.891 §5.3 |
| **A05** | Reverse flow | Any `FlowDirection.REVERSE` packet during active delivery | MEPC.1/Circ.891 Annex III |
| **A06** | Meter fault | `StreamStatusCode.FAULT` seen | MEPC.1/Circ.891 §5.3 |

### Fuel-quality physics
| ID | Name | Trigger | Regulatory basis |
|----|------|---------|------------------|
| **A03** | Density deviation | abs(ρ@15 − BDN) > 2 kg/m³ OR mid-session jump > 3 kg/m³ | ISO 8217:2024 Table 2 |
| **A07** | Meter health | Drive-gain z-score > 3σ vs baseline OR tube-freq drift > 2 % OR cal cert > 365 days | OIML R 117-1 |
| **A08** | Sulphur non-compliance | Lab sulphur > 0.50 % global / 0.10 % ECA, no IAPP scrubber cert | MARPOL Annex VI Reg. 14 |
| **A09** | Flash point | Lab flash < 60 °C | SOLAS II-2/4.2.1 |
| **A10** | Grade mismatch | BDN grade ≠ BRF requested grade | ISO 8217 |

### Identity, location, paperwork
| ID | Name | Trigger | Regulatory basis |
|----|------|---------|------------------|
| **A11** | Vessel-name mismatch | BDN name ≠ AIS resolved name | MPA bunker procedure |
| **A12** | IMO mismatch | IMO checksum invalid OR ≠ registry | IMO Res. A.600(15) |
| **A13** | Location mismatch | Bunker position outside permitted geofence | MPA VTIS |
| **A14** | Barge proximity | Barge AIS > 500 m (alarm 1 000 m) from vessel | MEPC.1/Circ.891 §5.1 |
| **A15** | Supplier unlicensed | Supplier not in MPA registry / licence expired | MPA Port Marine Circular |
| **A16** | Missing signature | Any required BDN signature absent | SS 648:2019 §6 |
| **A19** | Invoice mismatch | Invoice MT ≠ BDN MT | BIMCO BunkerVoy |
| **A21** | Sample seal mismatch | Seal ID ≠ BDN, or chain-of-custody broken | MARPOL Annex VI Reg. 18 |

### Cryptographic / data-integrity
| ID | Name | Trigger | Regulatory basis |
|----|------|---------|------------------|
| **SEC01** | e-BDN authenticity | `EBDNStatus ≠ VERIFIED` (INVALID_SIG / MISMATCH / MISSING / EXPIRED_CERT) | Singapore Digital Bunkering |
| **SEC02** | MFM stream integrity | Any MFM packet fails HMAC, OR < 70 % packet coverage, OR < 5 packets | OIML R 117-1 §4.5 |

### Our four advanced detectors (hackathon differentiators)
| ID | Name | Trigger | Why it matters |
|----|------|---------|----------------|
| **A_CAP** | **Cappuccino bunkering** | Global-median ρ drop + drive-gain spike > 4× window median + abs(Δρ@15) < 0.5 kg/m³ | Air injection — criminal in Singapore. Pure physics, no thresholds to game. |
| **A_VEF** | **VEF anomaly** | Vessel Experience Factor abs(z) > 2σ vs ≥ 6-delivery rolling baseline | Crew-side skimming pattern (OCIMF VEF method). |
| **A_CCAI** | **CCAI off-spec** | CCAI = D − 140.7 · log₁₀(log₁₀(V + 0.85)) − 80.6 > 870 | Catalyst-fines poisoning, engine ignition damage (ISO 8217 §5.4). |
| **A_ROB** | **ROB / sounding mismatch** | abs(ROBafter − ROBbefore − MFM_total) > 0.3 % | Independent ground truth disagrees with MFM → tampering or short delivery (ISGOTT 11.1). |

---

## 5. Risk scoring (Stage 3)

### 5.1 Four weighted components

```mermaid
flowchart LR
    A["Anomaly severity<br/>Σ severity × confidence × cal_factor<br/>cap 100"] -->|x0.40| W["Weighted sum"]
    B["Supplier history<br/>100 − reputation<br/>+ 30d critical count<br/>+ flag penalty"] -->|x0.25| W
    C["Doc completeness<br/>100 − BDN completeness<br/>+ eBDN/seal penalties"] -->|x0.15| W
    D["Realtime quantity<br/>stepped table on abs dev_pct<br/>0.5 / 1 / 2 / 5 / 10 %"] -->|x0.20| W
    W --> F["Apply floors<br/>max wins"]
    F --> B1["Band 0-20 LOW"]
    F --> B2["Band 21-45 MODERATE"]
    F --> B3["Band 46-70 HIGH"]
    F --> B4["Band 71-100 CRITICAL"]
```

| Weight | Component | Rationale |
|--------|-----------|-----------|
| **40 %** | Anomaly severity | Direct evidence dominates |
| **25 %** | Supplier history | Bayesian prior — repeated offenders are likelier |
| **15 %** | Doc completeness | Paper trail health (eBDN, samples, seals) |
| **20 %** | Realtime quantity risk | Money-impact signal (stepped commercial table) |

Sum = 1.00 (enforced in `Weights.__post_init__`).

### 5.2 Stepped commercial table — `policy/QTY_RISK_STEPS`
| abs(dev %) ≤ | Score | Basis |
|---|---|---|
| 0.5 | 5 | Within MFM tolerance band |
| 1.0 | 25 | Annotate; CE notify |
| 2.0 | 55 | LoP territory; P&I notify |
| 5.0 | 80 | Severe claim; off-hire possible |
| 10.0 | 95 | **Fraud-investigation trigger** |

### 5.3 Hard floors (any → final score raised to ≥ floor)
| Code | Floor | Why |
|------|------:|-----|
| `A02 > 3 %` | 78 | MEPC commercial-loss threshold |
| `A05_REVERSE_FLOW` | 80 | Loop-back tampering |
| `A06_METER_FAULT` | 80 | Untrustworthy MFM |
| `A08_SULPHUR_EXCEEDED` | 85 | MARPOL Annex VI |
| `A09_FLASH_BELOW_60C` | 72 | SOLAS fire risk |
| `A10_GRADE_MISMATCH` | 85 | Wrong fuel = engine damage |
| `A12_IMO_MISMATCH` | 80 | Identity fraud |
| `A15_SUPPLIER_UNLICENSED` | 90 | MPA criminal offence |
| `A16_MISSING_SIG` | 50 | Paper trail incomplete |
| `SEC01_EBDN` | 85 | Crypto authenticity broken |
| `SEC02_CRITICAL` | 80 | MFM HMAC failure |
| **`A_CAP`** | **88** | Cappuccino → criminal in SG |
| `A_VEF` | 60 | Statistical, not deterministic |
| `A_CCAI` | 70 | Engine-damage liability |
| **`A_ROB`** | **82** | Independent ground truth says short |
| `SUPPLIER_FLAGGED` | 65 | Watchlist hit |
| `SUPPLIER_MONITORING` | 30 | Soft nudge |

### 5.4 Bands → verdict
| Score | Category | Default verdict |
|------:|----------|------------------|
| 0–20 | `LOW` | `SIGN` |
| 21–45 | `MODERATE` | `SIGN_WITH_NOTES` |
| 46–70 | `HIGH` | `SIGN_WITH_LOP` |
| 71–100 | `CRITICAL` | **`REFUSE_TO_SIGN`** |

A missing essential input downgrades the verdict to `INSUFFICIENT_DATA` and prevents `SIGN`.

### 5.5 USD impact
`USD = |deviation_mt| × FUEL_PRICE_USD_PER_MT[grade]` — quotes from Ship & Bunker Singapore, snapshot tagged via `POLICY_VERSION`.

---

## 6. Design guidelines (we hold ourselves to these)

1. **Pure functions, no I/O.** Detection and scoring read the typed input only; no DB, no network, no clock except `session.end_ts`.
2. **Citations on every rule.** A rule that can't point to a standard doesn't ship. `RULE_REGISTRY` is the single source of truth.
3. **Structured evidence, never free text.** Every `Anomaly` carries typed `EvidenceRef`s pointing back to packet IDs / doc IDs.
4. **Confidence ≠ severity.** Confidence is calibrated per rule and haircut when meter cal is stale.
5. **Policy ≠ code.** Tunables live in [`policy/`](policy/__init__.py); detectors and scorer never hard-code thresholds.
6. **Chain hash everything.** Stage 2 hashes Stage 1; Stage 3 verifies and re-hashes Stage 2. Any link tampering = hash mismatch.
7. **Floors over curves.** When a rule is criminal (e.g. cappuccino, unlicensed supplier), we floor the score — no algebra can talk us down.
8. **Determinism.** Same input → same output, byte-for-byte. Audit trace pins `POLICY_VERSION`.
9. **Severity-Floor-Band, in that order.** Raw weighted score → apply floors → look up band. Floors never *lower*, only *raise*.
10. **Reproducible USD.** Prices snapshot in policy; downstream Stage 5 quotes the same number.

---

## 7. Repository layout

```
NEXT/
├── README.md                  ← you are here
├── BunkerGuard-Pipeline-Mapping-V3.docx   ← official 6-stage spec
│
├── anomaly/                   ← STAGE 2 (ours)
│   ├── __init__.py            ← exports `run(session) -> AnomalyReport`
│   ├── detect.py              ← orchestrator: validates HMAC, runs ALL_RULES, hash-chains
│   └── rules.py               ← 26 pure rule functions
│
├── risk/                      ← STAGE 3 (ours)
│   ├── __init__.py            ← exports `run(report, session) -> RiskPackage`
│   └── score.py               ← components → weights → floors → band → verdict → USD
│
├── policy/                    ← Policy-as-Code (ours, edited by compliance)
│   └── __init__.py            ← TOL, WEIGHTS, FLOORS, QTY_RISK_STEPS, FUEL_PRICE
│
├── contracts/                 ← Shared schemas (joint with Stage 1)
│   ├── enums.py               ← RuleId, RULE_REGISTRY, RISK_BANDS, SEVERITY_SCORE
│   ├── stage1_session_input.py
│   ├── stage2_anomaly_output.py
│   ├── stage3_risk_package.py
│   └── security.py            ← Ed25519 sign/verify, HMAC packets, sha256 chain
│
├── tests/
│   ├── test_pipeline.py       ← Stage 2 + 3 smoke against example JSON
│   └── test_regression.py     ← 11-session expected-vs-actual verdict match
│
└── _other_stages/             ← borrowed for full-pipeline demos only — NOT ours
    ├── MockDataset/           Stage 1 mock CSVs + MFM streams
    ├── ingest/                Stage 1 ingestion
    ├── pipeline/              Stage 5 orchestrator (writes evidence + BDN)
    ├── dashboard/             Streamlit UX prototype
    ├── replay/                Houston-2022 / Singapore-2018 historical replays
    └── out/                   pipeline output artifacts
```

---

## 8. Run it

### Prereqs
- Python ≥ 3.11
- No third-party deps for Stage 2/3 (stdlib + `cryptography` for security tests)

### Stage 2/3 smoke test
```bash
cd NEXT
PYTHONPATH=. python3 tests/test_pipeline.py
```
Expected: a `CRITICAL` / `REFUSE_TO_SIGN` verdict on the seeded fraud example with a clean hash chain.

### Regression (11 expected verdicts)
```bash
PYTHONPATH=.:_other_stages python3 tests/test_regression.py
```
Expected: `PASSED: match rate >= 70%` (currently **9/11 = 82 %**).

### Security tests (sign, HMAC, chain, tamper detection)
```bash
PYTHONPATH=. python3 contracts/tests/test_security.py
```
Expected: **6/6 PASS**.

### Full 6-stage demo (borrowing the other teams' code)
```bash
PYTHONPATH=.:_other_stages python3 -m pipeline
```

### Dashboard
```bash
streamlit run _other_stages/dashboard/app.py
```

---

## 9. Workflow when changing a rule or threshold

```mermaid
flowchart TD
    A[Compliance officer<br/>spots new threshold] --> B{Where does it live?}
    B -->|tolerance value| C[Edit policy/__init__.py<br/>bump POLICY_VERSION]
    B -->|new detection<br/>logic| D[Add rule_*_xx in anomaly/rules.py<br/>register in RULE_REGISTRY<br/>add to ALL_RULES]
    B -->|new floor| E[Add field to PolicyFloors<br/>wire trigger in risk/score.py]
    C --> F[Run tests/test_regression.py]
    D --> F
    E --> F
    F -->|match rate ≥ 70%| G[Commit + tag<br/>with POLICY_VERSION]
    F -->|regressed| H[Investigate mismatch<br/>before merging]
```

### Hard rules
- **Never** hard-code a threshold inside `anomaly/` or `risk/`. It goes in `policy/`.
- **Never** invent a citation. If you can't cite a clause, the rule isn't ready.
- **Always** bump `POLICY_VERSION` when a value changes — the audit trace pins it.

---

## 10. Hash chain & cryptography (so nobody can rewrite history)

```mermaid
flowchart LR
    S1[SessionInput<br/>Ed25519 signed by Stage 1] -->|payload_sha256| H1[Hash A]
    H1 --> S2[AnomalyReport<br/>parent_hash = A<br/>own payload_sha256 = B]
    S2 -->|B| S3[RiskPackage<br/>parent_hash = B<br/>own payload_sha256 = C]
    P[MFM packets] -->|HMAC-SHA256<br/>shared secret| S2
```

- **Stage 1 → 2**: Ed25519 signature is verified. Parent hash recorded.
- **MFM packets**: each carries an HMAC; Stage 2 marks any failure as `SEC02`.
- **Stage 2 → 3**: Stage 3 re-computes payload hash, refuses if it doesn't match.
- Tampering with any link → the next stage's verification fails *and* the chain hash mismatch is logged.

---

## 11. Test results (snapshot 2026-05-21)

| Test | Result |
|------|--------|
| `tests/test_regression.py` | **9/11 = 82 %** (mismatches SES-008, SES-021) |
| `tests/test_pipeline.py` | CRITICAL / REFUSE_TO_SIGN on seeded fraud ✅ |
| `contracts/tests/test_security.py` | **6/6 PASS** |
| Full pipeline (24 sessions) | runs end-to-end, no exceptions ✅ |

---

## 12. Glossary

- **BDN** — Bunker Delivery Note (the legal receipt of fuel delivery).
- **MFM** — Mass Flow Meter (Coriolis sensor measuring real fuel mass).
- **eBDN** — Electronic, digitally-signed BDN (Singapore digital bunkering).
- **ROB** — Remaining On Board (independent tank-sounding measurement).
- **VEF** — Vessel Experience Factor (OCIMF ship-tank vs shore-tank ratio).
- **CCAI** — Calculated Carbon Aromaticity Index (ISO 8217 ignition-quality proxy).
- **LOP** — Letter Of Protest (formal dispute filing).
- **MARPOL Annex VI** — IMO emissions regulation (sulphur, NOx).
- **MEPC.1/Circ.891** — IMO best-practice guide for bunker delivery.
- **OIML R 117-1** — Legal metrology standard for liquid flow meters.
- **MPA** — Maritime and Port Authority of Singapore.

---

*Built for NEXT / SuperAI 2026 — Singapore. Stage 2 & Stage 3 only.*
