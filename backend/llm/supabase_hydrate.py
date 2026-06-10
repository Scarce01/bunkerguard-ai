"""Build a ``ViewBundle`` from Supabase rows — no typed contracts required.

The copilot tools in ``llm.copilot_tools`` were designed around the in-process
pipeline output (typed ``SessionInput`` / ``AnomalyReport`` / ``RiskPackage``).
The web copilot has no such objects; it has Supabase row dicts. This module
synthesises the flat ``ViewBundle`` directly from those rows so the same
tools can serve the web frontend.

Schema columns this expects (with permissive fallbacks):

    sessions       session_id, vessel_name, vessel_imo, supplier_name,
                   port, fuel_grade, bdn_qty_mt, mfm_qty_mt, risk_score,
                   risk_category, verdict, ...
    bdn_records    bdn_ref, qty_mt, density_15c_kg_m3, sulphur_pct,
                   flash_point_c, sample_seal, ...
    mfm_stream     seq_no, recorded_at, flow_rate_mt_h, cumulative_mt,
                   density_15c_kg_m3, ...
    anomalies      rule, rule_name, severity, description, measured,
                   reference, deviation_pct, confidence, ...
    risk_scores    final_risk_score, risk_category, recommended_verdict,
                   requires_lop, requires_resample, requires_surveyor,
                   estimated_financial_impact_usd, ...
    suppliers      name, mpa_licence, reputation_score, flag,
                   total_sessions, mismatch_count, ...

Missing fields degrade to ``None`` / sensible defaults; tools that depend on
them surface a clean message rather than crashing.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Optional

from outputs._extract import ViewBundle

log = logging.getLogger("bunkerguard.llm.supabase_hydrate")


def _sb():
    from supabase import create_client  # type: ignore
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_KEY"]
    return create_client(url, key)


def _pick(row: Optional[dict], *names: str, default: Any = None) -> Any:
    if not row:
        return default
    for n in names:
        v = row.get(n)
        if v is not None:
            return v
    return default


def hydrate_view(session_id: str) -> tuple[ViewBundle, list[dict]]:
    """Return ``(ViewBundle, mfm_timeline_rows)`` for one Supabase session.

    The timeline rows have the shape ``mfm_timeline()`` would emit from a
    typed ``SessionInput``, so ``charts.chart_mfm_flow_profile`` works as-is.
    """
    sb = _sb()

    session = sb.table("sessions").select("*").eq(
        "session_id", session_id).single().execute().data or {}
    bdn = (sb.table("bdn_records").select("*").eq(
        "session_id", session_id).limit(1).execute().data or [{}])[0]
    mfm_rows = sb.table("mfm_stream").select("*").eq(
        "session_id", session_id).order("seq_no").execute().data or []
    anomalies = sb.table("anomalies").select("*").eq(
        "session_id", session_id).order("triggered_at").execute().data or []
    risk_row = (sb.table("risk_scores").select("*").eq(
        "session_id", session_id).limit(1).execute().data or [{}])[0]

    supplier_name = _pick(session, "supplier_name", "supplier")
    supplier_row: dict = {}
    if supplier_name:
        sup = sb.table("suppliers").select("*").eq(
            "name", supplier_name).limit(1).execute().data or []
        if sup:
            supplier_row = sup[0]

    bdn_qty = float(_pick(bdn, "qty_mt", "quantity_mt",
                          default=_pick(session, "bdn_qty_mt", default=0)) or 0)
    mfm_summary = _mfm_summary(mfm_rows, bdn_qty,
                               session_default=float(_pick(
                                   session, "mfm_qty_mt", default=0) or 0))
    timeline = _mfm_timeline_rows(mfm_rows)

    bdn_view = {
        "bdn_ref": _pick(bdn, "bdn_ref"),
        "vessel_name": _pick(session, "vessel_name", "vessel"),
        "vessel_imo": _pick(session, "vessel_imo", default=""),
        "supplier_name": supplier_name,
        "barge_name": _pick(session, "barge_name", default=""),
        "port": _pick(session, "port", default="Port of Singapore"),
        "date": _pick(session, "session_date", "delivery_start",
                      "created_at", default=""),
        "time_start": _pick(session, "delivery_start", default=""),
        "time_end": _pick(session, "delivery_end", default=""),
        "product_grade": _pick(session, "fuel_grade", default="VLSFO"),
        "grade": _pick(session, "fuel_grade", default="VLSFO"),
        "quantity_mt": bdn_qty,
        "density_15c": _pick(bdn, "density_15c_kg_m3", "density_15c"),
        "viscosity_50c": _pick(bdn, "viscosity_50c_cst", "viscosity_50c"),
        "sulphur_pct": _pick(bdn, "sulphur_pct"),
        "flash_point": _pick(bdn, "flash_point_c", "flash_point"),
        "biofuel_pct": _pick(bdn, "biofuel_pct", default=0),
        "sample_seal_no": _pick(bdn, "sample_seal", default="N/A"),
        "supplier_signed": _pick(bdn, "supplier_signed", default=True),
        "officer_signed": _pick(bdn, "officer_signed", default=True),
        "ebdn_status": _pick(bdn, "ebdn_status", default="—"),
    }

    risk_view = {
        "risk_score": _pick(risk_row, "final_risk_score", "risk_score",
                            default=_pick(session, "risk_score", default=0)),
        "category": _pick(risk_row, "risk_category",
                          default=_pick(session, "risk_category", default="—")),
        "verdict": _pick(risk_row, "recommended_verdict", "verdict",
                         default=_pick(session, "verdict",
                                       default="INSUFFICIENT_DATA")),
        "verdict_reason": _pick(risk_row, "verdict_reason", default=""),
        "financial_impact": _pick(risk_row, "estimated_financial_impact_usd",
                                  "estimated_impact_usd"),
        "requires_lop": bool(_pick(risk_row, "requires_lop", default=False)),
        "requires_surveyor": bool(_pick(risk_row, "requires_surveyor",
                                        default=False)),
        "requires_resample": bool(_pick(risk_row, "requires_resample",
                                        default=False)),
        "escalation_path": list(_pick(risk_row, "escalation_path",
                                      default=[]) or []),
        "dispute_window_hours": _pick(risk_row, "dispute_window_hours",
                                      default=72),
        "because": list(_pick(risk_row, "because", default=[]) or []),
        "components": {},
        "weighted": {},
        "floor_triggers": [],
    }

    anomalies_view = [{
        "rule_id": _pick(a, "rule"),
        "name": _pick(a, "rule_name"),
        "severity": _pick(a, "severity"),
        "description": _pick(a, "description", default=""),
        "regulatory_basis": _pick(a, "regulatory_basis", default=""),
        "measured": _pick(a, "measured"),
        "reference": _pick(a, "reference"),
        "deviation_value": _pick(a, "deviation_value"),
        "deviation_pct": _pick(a, "dev_pct", "deviation_pct"),
        "unit": _pick(a, "unit", default=""),
        "confidence": _pick(a, "confidence"),
        "evidence_refs": [],
    } for a in anomalies]

    view = ViewBundle(
        session_id=session_id,
        generated_at=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        bdn=bdn_view,
        mfm=mfm_summary,
        vessel={"name": bdn_view["vessel_name"], "imo": bdn_view["vessel_imo"],
                "has_scrubber": False},
        supplier={
            "name": supplier_name or "—",
            "mpa_licence": _pick(supplier_row, "mpa_licence", default="UNKNOWN"),
            "reputation_score": _pick(supplier_row, "reputation_score"),
            "total_sessions": _pick(supplier_row, "total_sessions", default=0),
            "mismatch_count": _pick(supplier_row, "mismatch_count", default=0),
            "critical_count": _pick(supplier_row, "critical_count", default=0),
            "lop_count": _pick(supplier_row, "lop_count", default=0),
            "flag": _pick(supplier_row, "flag", default="clear"),
        },
        barge={"name": bdn_view["barge_name"], "imo": "", "mpa_licence": "—"},
        risk=risk_view,
        anomalies=anomalies_view,
        data_quality={
            "mfm_coverage_pct": _pick(session, "mfm_coverage_pct",
                                      default=100 if mfm_rows else 0),
            "bdn_completeness_pct": _pick(session, "bdn_completeness_pct",
                                          default=100 if bdn else 0),
            "ebdn_status": bdn_view["ebdn_status"],
            "ais_status": _pick(session, "ais_status", default="—"),
            "insufficient_data": not mfm_rows or not bdn,
            "reasons": [],
        },
        history={"count": 0, "rows": [], "total_short_mt": 0.0,
                 "avg_dev_pct": 0.0, "sessions_over_1pct": 0},
        chain={
            "parent_sha256": _pick(session, "parent_sha256", default=""),
            "payload_sha256": _pick(session, "payload_sha256", default=""),
            "anomaly_parent_sha256": "",
        },
        llm_analysis={},
    )
    return view, timeline


def _mfm_summary(rows: list[dict], bdn_qty: float,
                 session_default: float = 0.0) -> dict:
    if not rows:
        return {"cumulative_mass": session_default, "density_15c": None,
                "duration_hrs": 0.0, "avg_flow_rate": 0.0, "packet_count": 0}
    last = rows[-1]
    first = rows[0]
    cum = float(_pick(last, "cumulative_mt", "cumulative_mass",
                      default=session_default) or 0)
    flows = [float(_pick(r, "flow_rate_mt_h", "mass_flow_rate", default=0) or 0)
             for r in rows]
    avg_flow = sum(flows) / len(flows) if flows else 0.0
    densities = [_pick(r, "density_15c_kg_m3", "density_15c") for r in rows]
    densities = [float(d) for d in densities if d is not None]
    density_15c = sum(densities) / len(densities) if densities else None
    try:
        t0 = datetime.fromisoformat(str(_pick(first, "recorded_at", "timestamp",
                                              default="")).replace("Z", "+00:00"))
        t1 = datetime.fromisoformat(str(_pick(last, "recorded_at", "timestamp",
                                              default="")).replace("Z", "+00:00"))
        duration_h = max(0.0, (t1 - t0).total_seconds() / 3600.0)
    except (TypeError, ValueError):
        duration_h = 0.0
    return {"cumulative_mass": cum, "density_15c": density_15c,
            "duration_hrs": duration_h, "avg_flow_rate": avg_flow,
            "packet_count": len(rows)}


def _mfm_timeline_rows(rows: list[dict]) -> list[dict]:
    if not rows:
        return []
    try:
        t0 = datetime.fromisoformat(str(_pick(rows[0], "recorded_at", "timestamp",
                                              default="")).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return []
    out = []
    for r in rows:
        try:
            t = datetime.fromisoformat(str(_pick(r, "recorded_at", "timestamp",
                                                 default="")).replace("Z", "+00:00"))
        except (TypeError, ValueError):
            continue
        out.append({
            "time_min": (t - t0).total_seconds() / 60.0,
            "cumulative_mt": float(_pick(r, "cumulative_mt", "cumulative_mass",
                                         default=0) or 0),
            "flow_rate": float(_pick(r, "flow_rate_mt_h", "mass_flow_rate",
                                     default=0) or 0),
        })
    return out
