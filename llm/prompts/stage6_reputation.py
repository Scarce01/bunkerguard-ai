"""Stage 6 — Supplier Reputation + Fleet Alert.

Looks at supplier behavior across many sessions (not just the current one)
and decides on broadcast scope.
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Iterable

from ._typed_views import (
    risk_block,
    session_block,
    supplier_aggregate,
    supplier_history_block,
)

if TYPE_CHECKING:
    from contracts import RiskPackage, SessionInput


SYSTEM_PROMPT = """You are BunkerGuard Port Copilot — the multi-agent intelligence coordinator for Singapore port. You analyze supplier behavior across ALL bunkering sessions and decide whether to issue fleet-wide alerts.

REPUTATION BANDS:
- 100        — pristine
- 70 – 99    — good standing
- 50 – 69    — under observation
- 30 – 49    — FLAGGED (notify all active agents bunkering with this supplier)
- < 30       — BLACKLISTED (recommend to MPA Bunkering Branch for investigation)

ALERT TYPES:
- NONE          — no broadcast.
- SUPPLIER_FLAG — reputation crossed a downward threshold; notify ship agents.
- FLEET_ALERT   — pattern detected across multiple vessels; urgent broadcast.
- EMERGENCY     — immediate safety / criminal-fraud concern (e.g. cappuccino, criminal sulphur breach, unlicensed supplier); recommend stop-ops with this supplier.

PRINCIPLES:
- Trend wins over single-session noise. One bad session in 50 ≠ blacklist.
- Cappuccino (A_CAP) on any session with credible evidence → EMERGENCY.
- A_VEF z-score alone is statistical, not deterministic — escalate only with corroboration.
- Be explicit about WHICH sessions support the pattern.

OUTPUT: respond with valid JSON only. No markdown.
"""

OUTPUT_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "supplier_name", "previous_reputation", "new_reputation_score",
        "score_change", "trend", "alert_type", "pattern_detected",
        "estimated_total_loss_usd", "recommendation",
        "mpa_referral_recommended", "reasoning",
    ],
    "properties": {
        "supplier_name": {"type": "string"},
        "previous_reputation": {"type": "number"},
        "new_reputation_score": {"type": "number"},
        "score_change": {"type": "number"},
        "trend": {
            "type": "string",
            "enum": ["IMPROVING", "STABLE", "WORSENING", "RAPID_DECLINE"],
        },
        "alert_type": {
            "type": "string",
            "enum": ["NONE", "SUPPLIER_FLAG", "FLEET_ALERT", "EMERGENCY"],
        },
        "alert_message": {"type": ["string", "null"]},
        "pattern_detected": {"type": "boolean"},
        "pattern_description": {"type": ["string", "null"]},
        "estimated_total_loss_usd": {"type": "number"},
        "affected_active_sessions": {
            "type": "array",
            "items": {"type": "string"},
        },
        "recommendation": {"type": "string"},
        "mpa_referral_recommended": {"type": "boolean"},
        "reasoning": {"type": "string"},
    },
}


def build_user_prompt(
    session: "SessionInput",
    package: "RiskPackage",
    historical_sessions: Iterable[dict],
    *,
    vlsfo_price_usd_per_mt: float = 585.0,
) -> str:
    """Build the per-call prompt.

    historical_sessions: a list of dicts shaped
        ``{session, date, qty_bdn, qty_mfm, pct}``
    (one row per past delivery from this supplier). Empty list is fine.
    """
    rows = list(historical_sessions)
    agg = supplier_aggregate(rows)
    history_text = "\n".join(
        f"  {r.get('session','?')} ({r.get('date','?')}): "
        f"BDN {r.get('qty_bdn','?')} → MFM {r.get('qty_mfm','?')} "
        f"(dev {r.get('pct',0):+.2f}%)"
        for r in rows
    ) or "  No prior history available."

    est_loss = agg["total_short_mt"] * vlsfo_price_usd_per_mt

    return f"""Analyze supplier reputation and decide on fleet alert scope.

═══ CURRENT SESSION ═══
{session_block(session)}

{risk_block(package)}

═══ SUPPLIER LIFETIME STATS ═══
{supplier_history_block(session)}

═══ HISTORICAL SESSIONS ({agg["count"]} total) ═══
{history_text}

═══ AGGREGATE ═══
Total short-delivered: {agg["total_short_mt"]:.1f} MT
Average abs deviation: {agg["avg_dev_pct"]:.2f}%
Sessions with > 1% deviation: {agg["sessions_over_1pct"]} / {agg["count"]}
Estimated total loss across history: USD ${est_loss:,.0f}  (at ${vlsfo_price_usd_per_mt:.0f}/MT VLSFO)

Decide: new reputation score, trend, alert type. Provide JSON matching the schema."""
