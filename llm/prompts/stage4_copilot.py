"""Stage 4 — Ship Copilot.

Plain-English explanation of the bunkering session for the Chief Engineer.
Cites exact numbers, ties every concern to a rule + evidence, recommends an
action (and drafts a LoP if required).
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from ._typed_views import (
    anomalies_block,
    fuel_block,
    risk_block,
    session_block,
    supplier_history_block,
)

if TYPE_CHECKING:
    from contracts import AnomalyReport, RiskPackage, SessionInput


SYSTEM_PROMPT = """You are BunkerGuard AI, a 24/7 Chief Engineer Copilot for marine bunkering operations in Singapore port.

ROLE: Analyze the structured bunkering session data and explain findings to the Chief Engineer. You must be:
- Specific: always cite exact numbers (MT, %, USD, timestamps).
- Actionable: every concern lists a recommended response.
- Prioritized: CRITICAL first, then HIGH, then MEDIUM/LOW.
- Evidence-based: link every claim to a rule ID and data source (MFM, BDN, AIS, lab).

REGULATORY ANCHORS (cite these when relevant):
- MARPOL Annex VI Reg. 14: 0.50% m/m global sulphur cap; 0.10% in ECA.
- SOLAS Ch. II-2/4.2.1: flash point ≥ 60 °C.
- MARPOL Annex VI Reg. 18: BDN retention 3 years, sample retention 12 months.
- SS 648:2019 / MEPC.1/Circ.891: bunker delivery procedure + MFM tolerance.
- MPA Port Marine Circular: supplier licensing / digital bunkering (eBDN, SS 709).
- ISO 8217:2024: fuel quality (density, viscosity, CCAI).
- OIML R 117-1: legal-metrology meter accuracy + calibration.

GUIDANCE:
- Do NOT invent rule IDs or citations. Use only the rule IDs that appear in the input.
- Do NOT change the deterministic verdict (it is set by Stage 3). You may downgrade severity in the recommendation only if the rationale is clearly documented.
- If A_CAP (cappuccino) or SEC01 (eBDN invalid) fires, treat as criminal-risk territory regardless of total score.
- Letter of Protest (LoP) draft is required iff recommended_action is SIGN_WITH_LOP or REFUSE_TO_SIGN. Format as a short formal note (To/From/Date/Subject/Body, no signatures).

OUTPUT: respond with valid JSON only. No markdown, no prose outside the JSON object.
"""

# JSON schema for output_config.format. Keeps Sonnet's response parseable.
OUTPUT_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["summary", "concerns", "recommendation", "recommended_action", "confidence"],
    "properties": {
        "summary": {"type": "string"},
        "concerns": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["title", "evidence", "severity", "rule_id"],
                "properties": {
                    "title": {"type": "string"},
                    "evidence": {"type": "string"},
                    "severity": {"type": "string",
                                  "enum": ["CRITICAL", "HIGH", "MEDIUM", "LOW"]},
                    "rule_id": {"type": "string"},
                    "financial_impact_usd": {"type": ["number", "null"]},
                },
            },
        },
        "recommendation": {"type": "string"},
        "recommended_action": {
            "type": "string",
            "enum": ["SIGN", "SIGN_WITH_NOTES", "SIGN_WITH_LOP",
                     "REFUSE_TO_SIGN", "INSUFFICIENT_DATA"],
        },
        "lop_draft": {"type": ["string", "null"]},
        "supplier_note": {"type": "string"},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        "reasoning_chain": {"type": "string"},
    },
}


def build_user_prompt(
    session: "SessionInput",
    report: "AnomalyReport",
    package: "RiskPackage",
) -> str:
    return f"""Analyze this bunkering session.

═══ SESSION ═══
{session_block(session)}

═══ FUEL & QUANTITY ═══
{fuel_block(session)}

═══ ANOMALIES DETECTED ({len(report.anomalies)}) ═══
critical={report.critical_count} high={report.high_count} medium={report.medium_count} low={report.low_count}
{anomalies_block(report)}

═══ RISK ASSESSMENT (Stage 3 — authoritative) ═══
{risk_block(package)}

Audit trail (Stage 3 "because" lines):
{chr(10).join(f"  - {line}" for line in package.because) if package.because else "  (none)"}

═══ SUPPLIER ═══
{supplier_history_block(session)}

Provide your full analysis as JSON matching the schema."""
