# Output tooling — `outputs/`

Backend file generators for the BunkerGuard pipeline. No UI.

## What gets produced

For a single session run, `outputs.report_bundle.generate_all()` produces:

- `EvidenceReport_<sid>.pdf` — multi-section A4 evidence report (PSC / insurance / arbitration)
- `LetterOfProtest_<sid>.pdf` — formal LoP (only when verdict is `SIGN_WITH_LOP` or `REFUSE_TO_SIGN`)
- `BlockchainCertificate_<sid>.pdf` — tamper-evident hash-chain certificate
- `chart_quantity.png` — BDN vs MFM bar chart
- `chart_risk.png` — weighted risk component breakdown
- `chart_supplier.png` — per-session short-delivery history (when history is provided)
- `chart_mfm_flow.png` — cumulative + flow-rate timeline (when MFM stream is non-empty)
- `qr_blockchain.png` — QR linking to the explorer URL
- `pipeline_<sid>.json` — full ViewBundle as JSON
- `anomalies.csv` — one row per anomaly
- `session_<sid>.xlsx` — multi-sheet workbook (BDN / MFM / Anomalies / Risk / History / AI)

Output directory: `output/<session_id>_<utc>/`. Override the root with `BUNKERGUARD_OUTPUT`.

## Adaptations vs the spec

| Spec assumed | Reality | What we did |
|---|---|---|
| `src/outputs/` | repo has no `src/` | placed at repo root: `outputs/` |
| Flat dicts (`bdn["vessel_name"]`, `mfm["cumulative_mass"]`) | typed `SessionInput`/`AnomalyReport`/`RiskPackage` | `outputs/_extract.py` does the one-shot translation → `ViewBundle` |
| `risk["financial_impact"]` | `RiskPackage.estimated_impact_usd` | renamed in `_extract.py` |
| `risk["components"]["severity_score"]` etc. | `RiskPackage.audit.components.anomaly_severity` | flattened in `_extract.py` |
| `bdn["flash_point"]` / `bdn["sample_seal_no"]` | `bdn.flash_point_c` / `bdn.sample_seal` | renamed |
| MFM timeline as input | derived from `session.mfm_stream` | `outputs._extract.mfm_timeline()` builds it |
| `pdf_certificate.py` declared but no code | filled in | full implementation with QR + chain summary |

## Files

```
outputs/
├── README.md                ← you are here
├── __init__.py
├── config.py                ← paths, branding, fuel prices, severity/verdict colors
├── _extract.py              ← typed contracts → ViewBundle (single adapter)
├── charts.py                ← matplotlib (Agg) chart functions
├── pdf_report.py            ← evidence report
├── pdf_lop.py               ← Letter of Protest
├── pdf_certificate.py       ← blockchain certificate
├── data_export.py           ← JSON / CSV / Excel
└── report_bundle.py         ← generate_all() — one call drives every renderer
```

## Run

```powershell
pip install -r requirements-outputs.txt
$env:BUNKERGUARD_OUTPUT = ".\output"   # optional, default is .\output

# Full pipeline (Stages 1-6 + outputs)
PYTHONPATH=. python -m llm.pipeline_runner

# Stages 1-3 only, but still produce charts/PDF/JSON/Excel offline
PYTHONPATH=. python -m llm.pipeline_runner --skip-llm

# Pipeline without outputs (for cheap iteration)
PYTHONPATH=. python -m llm.pipeline_runner --skip-llm --no-outputs
```

## Failure mode

If a renderer's dep is missing (e.g. `qrcode` not installed) only the affected output is skipped — the rest still produce. The pipeline log shows `[skip qr_code] missing dep (qrcode)`. The deterministic verdict is never affected by output failures.
