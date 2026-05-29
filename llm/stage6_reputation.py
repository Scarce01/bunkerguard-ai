"""Stage 6 — Supplier reputation update + fleet alert broadcast."""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Iterable, Optional

from .claude_client import call_claude
from .prompts.stage6_reputation import (
    OUTPUT_SCHEMA,
    SYSTEM_PROMPT,
    build_user_prompt,
)

if TYPE_CHECKING:
    from contracts import RiskPackage, SessionInput

log = logging.getLogger("bunkerguard.llm.stage6")


def run_stage6(
    session: "SessionInput",
    package: "RiskPackage",
    historical_sessions: Iterable[dict],
    *,
    on_alert: Optional[callable] = None,
) -> dict:
    """Update supplier reputation and decide on fleet alerts.

    Args:
        session: current SessionInput.
        package: Stage 3 RiskPackage.
        historical_sessions: iterable of dicts shaped
            ``{session, date, qty_bdn, qty_mfm, pct}``.
        on_alert: optional callback fired for FLEET_ALERT/EMERGENCY. Receives
            the full result dict. Default: print to stdout.
    """
    user_prompt = build_user_prompt(session, package, historical_sessions)
    result = call_claude(SYSTEM_PROMPT, user_prompt, json_schema=OUTPUT_SCHEMA)

    result.setdefault("supplier_name", session.supplier.name)
    result.setdefault(
        "previous_reputation",
        session.supplier.reputation_score if session.supplier.reputation_score is not None else 100.0,
    )
    result.setdefault("alert_type", "NONE")

    if result.get("alert_type") in ("FLEET_ALERT", "EMERGENCY"):
        cb = on_alert or _default_alert
        try:
            cb(result)
        except Exception:  # don't kill the pipeline on a misbehaving callback
            log.exception("broadcast_failed")

    log.info(
        "stage6_done",
        extra={
            "session_id": session.session_id,
            "supplier": result.get("supplier_name"),
            "alert": result.get("alert_type"),
            "trend": result.get("trend"),
            "tokens": result.get("_usage", {}),
        },
    )
    return result


def _default_alert(alert: dict) -> None:
    msg = alert.get("alert_message") or alert.get("recommendation", "")
    print(f"[FLEET ALERT] {alert.get('alert_type')}: {alert.get('supplier_name')} — {msg}")
