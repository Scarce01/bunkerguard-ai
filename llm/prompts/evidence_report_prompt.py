"""Evidence Report prompt (migrated from NextAI Hackathon TS service).

Source: NextAI Hackathon/src/prompts/evidenceReport.prompt.ts

Kept as a separate module from the existing `stage5_evidence.py` so the
integrator can choose which prompt to use without losing either. Builds the
user prompt and system prompt for the Stage 5 Evidence Report.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, TypedDict


class EvidenceReportInput(TypedDict, total=False):
    session: dict
    bdn: dict
    mfm_summary: dict
    anomalies: list[dict]
    risk_package: dict
    llm_explanation: dict
    vlsfo_spot_price_usd_per_mt: float


EVIDENCE_REPORT_SYSTEM = """\
You are BunkerCheck AI, an automated evidence report generator for marine bunkering operations.

Your role is to produce formal, audit-ready Bunker Delivery Mismatch Risk Reports that:
- Are legally defensible and suitable for submission to MPA, port authorities, P&I clubs, and flag states
- Use precise maritime terminology (MARPOL, SOLAS, MFM, BDN, LoP, MEPC.1/Circ.891)
- Cite exact figures from the input data — never round, estimate, or fabricate numbers
- Identify all compliance violations clearly (MARPOL sulphur, SOLAS flash point, MPA licence)
- Produce a complete Letter of Protest draft when verdict is SIGN_WITH_LOP or REFUSE_TO_SIGN

Output rules:
- Respond with ONLY a valid JSON object. No markdown fences, no preamble, no trailing text.
- Every number must exactly match the input data.
- Timestamps must be ISO 8601 format.
- report_id format: RPT-{session_id}-{YYYYMMDDTHHMMSS}Z
- The lop_draft must be a complete, professional document ready to print and present.
- recommended_actions must be specific and numbered — no vague advice."""


def _compact_iso_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def build_evidence_report_prompt(data: EvidenceReportInput) -> str:
    spot_price = data.get("vlsfo_spot_price_usd_per_mt") or 585
    anomalies = data.get("anomalies", [])
    session = data["session"]

    critical = sum(1 for a in anomalies if a.get("severity") == "CRITICAL")
    high = sum(1 for a in anomalies if a.get("severity") == "HIGH")
    medium = sum(1 for a in anomalies if a.get("severity") == "MEDIUM")

    bdn_qty = session.get("bdn_qty_mt") or 0
    mfm_qty = session.get("mfm_qty_mt")
    if mfm_qty is not None and bdn_qty:
        discrepancy_mt = round(mfm_qty - bdn_qty, 1)
        discrepancy_pct = round((discrepancy_mt / bdn_qty) * 100, 2)
        financial_impact = round(abs(discrepancy_mt) * spot_price)
    else:
        discrepancy_mt = None
        discrepancy_pct = None
        financial_impact = 0

    now = _compact_iso_now()

    def _j(obj: Any) -> str:
        return json.dumps(obj, indent=2, default=str)

    return f"""\
Generate a complete Evidence Report for the following bunkering session.

SESSION:
{_j(session)}

BDN RECORD (22 fields):
{_j(data.get("bdn", {}))}

MFM SUMMARY:
{_j(data.get("mfm_summary", {}))}

ANOMALIES DETECTED ({len(anomalies)} total — {critical} CRITICAL, {high} HIGH, {medium} MEDIUM):
{_j(anomalies)}

RISK ASSESSMENT:
{_j(data.get("risk_package", {}))}

AI ANALYSIS (from LLM Copilot):
{_j(data.get("llm_explanation", {}))}

PRE-CALCULATED VALUES (use these exactly):
- discrepancy_mt: {discrepancy_mt}
- discrepancy_pct: {discrepancy_pct}
- financial_impact_usd: {financial_impact}
- vlsfo_spot_price_per_mt: {spot_price}
- report_generated_at: {now}

COMPLIANCE THRESHOLDS to evaluate:
- MARPOL sulphur limit (non-ECA): 0.50%  — flag if bdn.sulphur_pct > 0.50 (unless HSFO + scrubber declared)
- SOLAS flash point minimum: 60°C         — flag if bdn.flash_point < 60
- MPA licence valid: check bdn.licence is not "NONE"
- Quantity tolerance: 0.5%               — flag if abs(discrepancy_pct) > 0.5
- Signatures complete: both supp_signed AND officer_signed must be true

Output the report in this EXACT JSON structure:
{{
  "report_id": "RPT-{session.get('session_id')}-{now}",
  "generated_at": "<ISO 8601>",
  "session_id": "{session.get('session_id')}",
  "header": {{
    "vessel_name": "...",
    "vessel_imo": 0,
    "supplier_name": "...",
    "supplier_licence": "...",
    "barge_name": "...",
    "port": "...",
    "delivery_date": "...",
    "delivery_start": "...",
    "delivery_end": "...",
    "fuel_grade": "...",
    "bdn_reference": "..."
  }},
  "quantity_comparison": {{
    "bdn_declared_mt": 0.0,
    "mfm_measured_mt": 0.0,
    "discrepancy_mt": 0.0,
    "discrepancy_pct": 0.0,
    "financial_impact_usd": 0,
    "vlsfo_spot_price_per_mt": {spot_price}
  }},
  "anomaly_summary": {{
    "total_anomalies": 0,
    "critical_count": 0,
    "high_count": 0,
    "medium_count": 0,
    "anomalies": [
      {{ "rule_id": "...", "rule_name": "...", "severity": "...", "description": "...", "timestamp": "..." }}
    ]
  }},
  "risk_assessment": {{
    "final_score": 0,
    "risk_category": "...",
    "recommended_verdict": "...",
    "similar_incidents_30d": 0
  }},
  "compliance_flags": {{
    "marpol_sulphur_ok": true,
    "solas_flash_point_ok": true,
    "mpa_licence_valid": true,
    "quantity_within_tolerance": true,
    "ais_verified": true,
    "signatures_complete": true,
    "grade_matches_brf": true
  }},
  "ai_narrative": "One authoritative paragraph — cite specific numbers. Do not hedge.",
  "recommended_actions": [
    "1. ...",
    "2. ...",
    "3. ...",
    "4. ...",
    "5. ..."
  ],
  "lop_draft": "Complete Letter of Protest — include To/From, date, vessel, BDN ref, discrepancy details, legal basis (MEPC.1/Circ.891), demand for rectification, chief engineer signature block.",
  "sign_off_status": "SIGN | SIGN_WITH_NOTES | SIGN_WITH_LOP | REFUSE_TO_SIGN"
}}

Respond with ONLY the JSON object. No markdown. No explanation.
"""
