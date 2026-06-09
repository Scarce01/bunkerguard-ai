"""Stage 5 — Formal Evidence Report.

May be used in legal disputes, PSC inspections, insurance claims.
Lower temperature in practice (we leave Sonnet to decide), strict schema.
"""
from __future__ import annotations

import json
from typing import TYPE_CHECKING

from ._typed_views import (
    anomalies_block,
    fuel_block,
    risk_block,
    session_block,
)

if TYPE_CHECKING:
    from contracts import AnomalyReport, RiskPackage, SessionInput


SYSTEM_PROMPT = """You are BunkerGuard AI generating a FORMAL EVIDENCE REPORT for a completed bunkering session in Singapore port.

PURPOSE: This report may be used in legal disputes, Port State Control inspections, or insurance claims. It must be factual, precise, legally defensible.

REQUIREMENTS:
- Quote numbers exactly as provided. Do not round arbitrarily.
- Every anomaly entry must carry its rule ID and the data source that proved it.
- Do not invent rules, regulations, or evidence.
- If verdict is REFUSE_TO_SIGN or SIGN_WITH_LOP, the Letter of Protest text is mandatory.
- Chronology should walk the bunkering window in order of MFM seq / event timestamps.
- Recommendations must be concrete actions for the Chief Engineer or shore office.

OUTPUT: respond with valid JSON only. No markdown.
"""

OUTPUT_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "report_title", "session_summary", "bdn_validation",
        "quantity_comparison", "anomaly_report", "risk_assessment",
        "chronology", "verdict", "verdict_justification",
        "lop_required", "lop_text", "recommendations", "blockchain_note",
    ],
    "properties": {
        "report_title": {"type": "string"},
        "session_summary": {"type": "string"},
        "bdn_validation": {
            "type": "object",
            "additionalProperties": False,
            "required": ["total_fields", "passed", "failed", "warnings", "failed_fields"],
            "properties": {
                "total_fields": {"type": "integer"},
                "passed": {"type": "integer"},
                "failed": {"type": "integer"},
                "warnings": {"type": "integer"},
                "failed_fields": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["field", "bdn_value", "actual_value", "rule"],
                        "properties": {
                            "field": {"type": "string"},
                            "bdn_value": {"type": "string"},
                            "actual_value": {"type": "string"},
                            "rule": {"type": "string"},
                        },
                    },
                },
            },
        },
        "quantity_comparison": {
            "type": "object",
            "additionalProperties": False,
            "required": ["bdn_mt", "mfm_mt", "bdn_vs_mfm_diff_mt", "bdn_vs_mfm_diff_pct"],
            "properties": {
                "bdn_mt": {"type": "number"},
                "mfm_mt": {"type": "number"},
                "survey_mt": {"type": ["number", "null"]},
                "invoice_mt": {"type": ["number", "null"]},
                "bdn_vs_mfm_diff_mt": {"type": "number"},
                "bdn_vs_mfm_diff_pct": {"type": "number"},
            },
        },
        "anomaly_report": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["rule_id", "severity", "description", "evidence", "impact"],
                "properties": {
                    "rule_id": {"type": "string"},
                    "severity": {"type": "string"},
                    "description": {"type": "string"},
                    "evidence": {"type": "string"},
                    "impact": {"type": "string"},
                },
            },
        },
        "risk_assessment": {"type": "string"},
        "chronology": {"type": "string"},
        "verdict": {
            "type": "string",
            "enum": ["SIGN", "SIGN_WITH_NOTES", "SIGN_WITH_LOP",
                     "REFUSE_TO_SIGN", "INSUFFICIENT_DATA"],
        },
        "verdict_justification": {"type": "string"},
        "lop_required": {"type": "boolean"},
        "lop_text": {"type": ["string", "null"]},
        "recommendations": {
            "type": "array",
            "items": {"type": "string"},
        },
        "blockchain_note": {"type": "string"},
    },
}


def build_user_prompt(
    session: "SessionInput",
    report: "AnomalyReport",
    package: "RiskPackage",
    llm_analysis: dict,
) -> str:
    bdn_dict = session.bdn.model_dump(mode="json")
    return f"""Generate a formal evidence report.

═══ SESSION ═══
{session_block(session)}

═══ FUEL & QUANTITY ═══
{fuel_block(session)}

═══ ANOMALIES ({len(report.anomalies)} total — critical={report.critical_count}) ═══
{anomalies_block(report)}

═══ RISK ASSESSMENT (Stage 3 verdict — authoritative) ═══
{risk_block(package)}

═══ STAGE 4 COPILOT SUMMARY ═══
Summary: {llm_analysis.get("summary", "N/A")}
Recommended action: {llm_analysis.get("recommended_action", package.verdict.value if hasattr(package.verdict, "value") else package.verdict)}
Confidence: {llm_analysis.get("confidence", "N/A")}

═══ FULL BDN (for verification) ═══
{json.dumps(bdn_dict, indent=2, default=str)}

Produce the complete evidence report as JSON matching the schema."""
