"""Typed contract -> flat view dicts for rendering.

The spec assumed the renderers receive dicts like ``bdn["vessel_name"]``.
The real codebase uses pydantic models. All adaptation lives here so the
PDF / chart / CSV modules stay readable.

Public functions:
    extract_view(session, report, package, llm_analysis=None) -> ViewBundle
        — the one-stop adapter. Everything downstream takes a ``ViewBundle``.

    mfm_timeline(session) -> list[dict]
        — derive the chart-friendly flow timeline from session.mfm_stream.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING, Any, Optional

from .config import FUEL_PRICE

if TYPE_CHECKING:
    from contracts import AnomalyReport, RiskPackage, SessionInput


def _enum(v) -> str:
    return v.value if hasattr(v, "value") else str(v)


def _iso_date(ts: datetime) -> str:
    return ts.strftime("%Y-%m-%d")


@dataclass
class ViewBundle:
    """Flat dicts the renderers consume.

    Field names mirror what the spec assumed wherever possible so the spec's
    pdf/chart code translates with minimal edits.
    """
    session_id: str
    generated_at: str
    bdn: dict
    mfm: dict           # rolled-up MFM summary (cumulative + density + duration)
    vessel: dict
    supplier: dict
    barge: dict
    risk: dict
    anomalies: list[dict]
    data_quality: dict
    history: dict        # supplier history aggregate
    chain: dict          # parent + payload hashes from pkg.parent_sha256 etc.
    llm_analysis: dict = field(default_factory=dict)


def extract_view(
    session: "SessionInput",
    report: "AnomalyReport",
    package: "RiskPackage",
    llm_analysis: Optional[dict] = None,
    supplier_history: Optional[list[dict]] = None,
    *,
    generated_at: Optional[datetime] = None,
) -> ViewBundle:
    """Convert typed contracts to flat view dicts."""
    s = session
    bdn = s.bdn
    grade = _enum(bdn.grade)

    mfm_summary = _summarize_mfm(s)

    bdn_view = {
        "bdn_ref": bdn.bdn_ref,
        "vessel_name": s.vessel.name,
        "vessel_imo": s.vessel.imo,
        "supplier_name": s.supplier.name,
        "barge_name": s.barge.name,
        "port": _enum(s.port),
        "date": _iso_date(bdn.start_ts),
        "time_start": bdn.start_ts.isoformat(),
        "time_end": bdn.end_ts.isoformat(),
        "product_grade": grade,
        "grade": grade,
        "quantity_mt": float(bdn.qty_mt),
        "density_15c": float(bdn.density_15c_kg_m3),
        "viscosity_50c": float(bdn.viscosity_50c_cst),
        "sulphur_pct": float(bdn.sulphur_pct),
        "flash_point": float(bdn.flash_point_c),
        "biofuel_pct": float(bdn.biofuel_pct),
        "sample_seal_no": bdn.sample_seal or "N/A",
        "supplier_signed": bdn.supplier_signed,
        "officer_signed": bdn.officer_signed,
        "ebdn_status": _enum(bdn.ebdn_status),
    }

    risk_view = _risk_view(package, bdn_view, mfm_summary)

    anomalies_view = [_anomaly_to_dict(a) for a in report.anomalies]

    chain = {
        "parent_sha256": package.parent_sha256,
        "payload_sha256": package.payload_sha256,
        "anomaly_parent_sha256": report.parent_sha256,
    }

    history_agg = _history_aggregate(supplier_history or [])

    return ViewBundle(
        session_id=s.session_id,
        generated_at=(generated_at or _utcnow()).strftime("%Y-%m-%d %H:%M UTC"),
        bdn=bdn_view,
        mfm=mfm_summary,
        vessel={
            "name": s.vessel.name,
            "imo": s.vessel.imo,
            "has_scrubber": s.vessel.has_scrubber,
        },
        supplier={
            "supplier_id": s.supplier.supplier_id,
            "name": s.supplier.name,
            "mpa_licence": s.supplier.mpa_licence or "UNKNOWN",
            "in_mpa_registry": s.supplier.in_mpa_registry,
            "reputation_score": s.supplier.reputation_score,
            "total_sessions": s.supplier.total_sessions,
            "mismatch_count": s.supplier.mismatch_count,
            "critical_count": s.supplier.critical_count,
            "lop_count": s.supplier.lop_count,
            "flag": s.supplier.flag or "clear",
        },
        barge={
            "name": s.barge.name,
            "imo": s.barge.imo,
            "mpa_licence": s.barge.mpa_licence or "UNKNOWN",
        },
        risk=risk_view,
        anomalies=anomalies_view,
        data_quality={
            "mfm_coverage_pct": report.data_quality.mfm_coverage_pct,
            "bdn_completeness_pct": report.data_quality.bdn_completeness_pct,
            "ebdn_status": report.data_quality.ebdn_status,
            "ais_status": report.data_quality.ais_status,
            "insufficient_data": report.data_quality.insufficient_data,
            "reasons": list(report.data_quality.reasons),
        },
        history=history_agg,
        chain=chain,
        llm_analysis=llm_analysis or {},
    )


def _summarize_mfm(s: "SessionInput") -> dict:
    """Roll session.mfm_stream into a summary dict the renderers expect."""
    stream = s.mfm_stream or []
    cumulative = float(s.mfm_qty_mt) if s.mfm_qty_mt is not None else (
        float(stream[-1].cumulative_mt) if stream else 0.0)
    if stream:
        densities = [p.density_15c_kg_m3 for p in stream
                     if p.density_15c_kg_m3 is not None]
        density_15c = sum(densities) / len(densities) if densities else None
        flow_rates = [p.flow_rate_mt_h for p in stream if p.flow_rate_mt_h]
        avg_flow = sum(flow_rates) / len(flow_rates) if flow_rates else 0.0
    else:
        density_15c = None
        avg_flow = 0.0
    return {
        "cumulative_mass": cumulative,
        "density_15c": density_15c,
        "duration_hrs": s.duration_h,
        "avg_flow_rate": avg_flow,
        "packet_count": len(stream),
    }


def _risk_view(package: "RiskPackage", bdn_view: dict, mfm_view: dict) -> dict:
    """Flatten RiskPackage + audit into a dict the renderers consume."""
    a = package.audit
    grade = bdn_view["grade"]
    fallback_impact = None
    if package.estimated_impact_usd is None:
        # be robust to missing impact
        unit = FUEL_PRICE.get(grade, 585.0)
        fallback_impact = abs(mfm_view["cumulative_mass"] - bdn_view["quantity_mt"]) * unit

    return {
        "risk_score": package.risk_score if package.risk_score is not None else 0,
        "category": _enum(package.risk_category),
        "verdict": _enum(package.verdict),
        "verdict_reason": package.verdict_reason,
        "financial_impact": package.estimated_impact_usd if package.estimated_impact_usd is not None else fallback_impact,
        "requires_lop": package.requires_lop,
        "requires_surveyor": package.requires_surveyor,
        "requires_resample": package.requires_resample,
        "because": list(package.because),
        "components": {
            "severity_score": a.components.anomaly_severity,
            "supplier_score": a.components.supplier_history,
            "doc_score": a.components.doc_completeness,
            "realtime_score": a.components.realtime_quantity_risk,
        },
        "weighted": {
            "anomaly_x40": a.weighted.anomaly_x40,
            "supplier_x25": a.weighted.supplier_x25,
            "doc_x15": a.weighted.doc_x15,
            "realtime_x20": a.weighted.realtime_x20,
        },
        "floor_triggers": [
            {"code": ft.code, "forced_min_score": ft.forced_min_score, "reason": ft.reason}
            for ft in a.floor_triggers
        ],
        "raw_weighted_sum": a.raw_weighted_sum,
        "final_score_before_floor": a.final_score_before_floor,
        "final_score_after_floor": a.final_score_after_floor,
    }


def _anomaly_to_dict(a: Any) -> dict:
    """Anomaly pydantic model -> flat dict."""
    return {
        "rule_id": _enum(a.rule),
        "name": a.rule_name,
        "severity": _enum(a.severity),
        "description": a.description,
        "regulatory_basis": a.regulatory_basis,
        "measured": a.measured,
        "reference": a.reference,
        "deviation_value": a.deviation_value,
        "deviation_pct": a.deviation_pct,
        "unit": a.unit,
        "confidence": a.confidence,
        "evidence_refs": [
            {"type": _enum(e.type), "ref": e.ref, "detail": e.detail}
            for e in (a.evidence_refs or [])
        ],
    }


def _history_aggregate(rows: list[dict]) -> dict:
    if not rows:
        return {"count": 0, "rows": [], "total_short_mt": 0.0,
                "avg_dev_pct": 0.0, "sessions_over_1pct": 0}
    total_short = sum(abs(float(r.get("qty_bdn", 0)) - float(r.get("qty_mfm", 0)))
                      for r in rows)
    avg_dev = sum(abs(float(r.get("pct", 0))) for r in rows) / len(rows)
    over_1pct = sum(1 for r in rows if abs(float(r.get("pct", 0))) > 1.0)
    return {
        "count": len(rows),
        "rows": rows,
        "total_short_mt": total_short,
        "avg_dev_pct": avg_dev,
        "sessions_over_1pct": over_1pct,
    }


def mfm_timeline(session: "SessionInput") -> list[dict]:
    """Convert ``session.mfm_stream`` (list[MFMPacket]) to the chart-friendly
    list[{time_min, cumulative_mt, flow_rate}] the chart module expects.
    """
    stream = session.mfm_stream or []
    if not stream:
        return []
    t0 = stream[0].timestamp
    out = []
    for p in stream:
        elapsed_min = (p.timestamp - t0).total_seconds() / 60.0
        out.append({
            "time_min": elapsed_min,
            "cumulative_mt": float(p.cumulative_mt),
            "flow_rate": float(p.flow_rate_mt_h),
        })
    return out


def _utcnow() -> datetime:
    from datetime import timezone
    return datetime.now(timezone.utc)
