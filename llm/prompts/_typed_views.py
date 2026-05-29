"""Convert typed contract objects into LLM-friendly view strings.

The spec assumed flat dicts like ``bdn["vessel_name"]``. The real codebase
uses nested pydantic models (``session.vessel.name``, ``session.bdn.qty_mt``,
etc.). All adaptation lives here so the prompt modules stay readable.
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Iterable

if TYPE_CHECKING:
    from contracts import AnomalyReport, RiskPackage, SessionInput


def session_block(s: "SessionInput") -> str:
    """Vessel / supplier / port / time header."""
    return (
        f"Session ID: {s.session_id}\n"
        f"Vessel: {s.vessel.name} (IMO {s.vessel.imo})\n"
        f"Supplier: {s.supplier.name} "
        f"(MPA Licence: {s.supplier.mpa_licence or 'UNKNOWN'}, "
        f"in registry: {s.supplier.in_mpa_registry}, "
        f"flag: {s.supplier.flag or 'clear'})\n"
        f"Barge: {s.barge.name} (IMO {s.barge.imo}, "
        f"MPA Licence: {s.barge.mpa_licence or 'UNKNOWN'})\n"
        f"Port: {s.port.value if hasattr(s.port, 'value') else s.port}\n"
        f"Window: {s.start_ts.isoformat()} -> {s.end_ts.isoformat()} ({s.duration_h:.2f}h)"
    )


def fuel_block(s: "SessionInput") -> str:
    """Fuel quality and quantity summary."""
    bdn = s.bdn
    dev_pct = s.deviation_pct if s.deviation_pct is not None else 0.0
    dev_mt = s.deviation_mt if s.deviation_mt is not None else 0.0
    return (
        f"Grade: {bdn.grade.value if hasattr(bdn.grade, 'value') else bdn.grade}\n"
        f"BDN declared: {s.bdn_qty_mt:.2f} MT\n"
        f"MFM measured: {(s.mfm_qty_mt or 0):.2f} MT\n"
        f"Deviation: {dev_mt:+.2f} MT ({dev_pct:+.2f}%)\n"
        f"BDN sulphur: {bdn.sulphur_pct:.3f}% | "
        f"BDN density @15°C: {bdn.density_15c_kg_m3:.1f} kg/m³ | "
        f"viscosity: {bdn.viscosity_50c_cst:.1f} cSt | "
        f"flash point: {bdn.flash_point_c:.1f}°C\n"
        f"eBDN status: {bdn.ebdn_status.value if hasattr(bdn.ebdn_status, 'value') else bdn.ebdn_status} | "
        f"supplier signed: {bdn.supplier_signed} | officer signed: {bdn.officer_signed} | "
        f"sample seal: {bdn.sample_seal or 'NONE'}"
    )


def anomalies_block(report: "AnomalyReport") -> str:
    """One bullet per anomaly. Keeps rule ID, severity, what was measured."""
    if not report.anomalies:
        return "  None detected."
    lines = []
    for a in report.anomalies:
        rule = a.rule.value if hasattr(a.rule, "value") else str(a.rule)
        sev = a.severity.value if hasattr(a.severity, "value") else str(a.severity)
        measured = f"measured={a.measured}" if a.measured is not None else ""
        ref = f"ref={a.reference}" if a.reference is not None else ""
        dev = f"dev={a.deviation_pct:+.2f}%" if a.deviation_pct is not None else ""
        nums = " ".join(x for x in (measured, ref, dev) if x)
        lines.append(
            f"  - [{sev}] {rule} ({a.rule_name}) conf={a.confidence:.2f} {nums}\n"
            f"      {a.description}"
            + (f"\n      basis: {a.regulatory_basis}" if a.regulatory_basis else "")
        )
    return "\n".join(lines)


def risk_block(pkg: "RiskPackage") -> str:
    """Score, components, floors that fired, USD impact."""
    a = pkg.audit
    floors = ", ".join(f.code for f in a.floor_triggers) or "none"
    score = pkg.risk_score if pkg.risk_score is not None else "N/A"
    cat = pkg.risk_category.value if hasattr(pkg.risk_category, "value") else pkg.risk_category
    verdict = pkg.verdict.value if hasattr(pkg.verdict, "value") else pkg.verdict
    usd = f"${pkg.estimated_impact_usd:,.2f}" if pkg.estimated_impact_usd else "N/A"
    return (
        f"Score: {score}/100 ({cat})\n"
        f"Verdict: {verdict} - {pkg.verdict_reason}\n"
        f"Components: sev={a.components.anomaly_severity:.1f}  "
        f"supplier={a.components.supplier_history:.1f}  "
        f"doc={a.components.doc_completeness:.1f}  "
        f"realtime={a.components.realtime_quantity_risk:.1f}\n"
        f"Raw weighted: {a.raw_weighted_sum:.1f} -> after floors: {a.final_score_after_floor:.1f}\n"
        f"Floors triggered: {floors}\n"
        f"USD impact: {usd}\n"
        f"Requires: LOP={pkg.requires_lop} surveyor={pkg.requires_surveyor} resample={pkg.requires_resample}"
    )


def supplier_history_block(s: "SessionInput") -> str:
    """Aggregated supplier reputation + 30d stats."""
    sup = s.supplier
    h = s.history
    return (
        f"Reputation: {sup.reputation_score if sup.reputation_score is not None else 'unknown'}/100\n"
        f"Total sessions: {sup.total_sessions} | mismatches: {sup.mismatch_count} | "
        f"critical: {sup.critical_count} | LoPs raised: {sup.lop_count}\n"
        f"Avg deviation lifetime: {sup.avg_deviation_pct:.2f}%\n"
        f"Last 30d: {h.supplier_30d_sessions} sessions, "
        f"avg dev {h.supplier_30d_avg_dev_pct:.2f}%, "
        f"{h.supplier_30d_critical_count} critical, "
        f"{h.similar_session_count} similar to this one"
    )


def supplier_aggregate(history_rows: Iterable[dict]) -> dict:
    """Compute summary stats over a list of historical-session dicts.

    Each row should look like: {session, date, qty_bdn, qty_mfm, pct}.
    Used by Stage 6 when caller already has a flat history list (e.g. from
    a CSV or MockDataset). Tolerant of missing fields.
    """
    rows = list(history_rows)
    if not rows:
        return {"count": 0, "total_short_mt": 0.0, "avg_dev_pct": 0.0,
                "sessions_over_1pct": 0}
    total_short = sum(abs(float(r.get("qty_bdn", 0)) - float(r.get("qty_mfm", 0)))
                      for r in rows)
    avg_dev = sum(abs(float(r.get("pct", 0))) for r in rows) / len(rows)
    over_1pct = sum(1 for r in rows if abs(float(r.get("pct", 0))) > 1.0)
    return {
        "count": len(rows),
        "total_short_mt": total_short,
        "avg_dev_pct": avg_dev,
        "sessions_over_1pct": over_1pct,
    }
