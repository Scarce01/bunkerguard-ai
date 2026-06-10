"""Evidence Report service — migrated from NextAI Hackathon (TS → Python).

Source: NextAI Hackathon/src/services/evidenceReport.service.ts

Mirrors the TypeScript service one-to-one:
  - fetch_evidence_report_input(session_id)  ← Supabase read
  - derive_mfm_summary(...)
  - build_fallback_explanation(...)           ← used when LLM Copilot (Stage 4)
                                                hasn't populated llm_explanation
  - call_claude_for_report(input)             ← Claude call + JSON parse
  - generate_evidence_report(session_id)      ← MAIN ENTRY POINT
  - store_evidence_report(report, bundle_id)  ← Supabase upsert

NOTE FOR INTEGRATOR:
  The existing `llm/stage5_report.py` is the in-pipeline variant that takes
  already-loaded `SessionInput` / `AnomalyReport` / `RiskPackage` objects and
  also handles blockchain notarization. This file is the standalone HTTP-flow
  variant that loads from Supabase by session_id. Integrate by:
    1. Either replace `stage5_report.run_stage5` data loading with this module's
       fetch + Claude call, keeping the existing blockchain step; OR
    2. Expose this as a separate FastAPI/Flask route equivalent to the TS
       `POST /api/sessions/:sessionId/complete` endpoint.
  Supabase env vars expected: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
  Anthropic env var expected:  ANTHROPIC_API_KEY.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any

from carbon import calculate_carbon_exposure
from .claude_client import call_claude
from .prompts.evidence_report_prompt import (
    EVIDENCE_REPORT_SYSTEM,
    EvidenceReportInput,
    build_evidence_report_prompt,
)

log = logging.getLogger("bunkerguard.llm.evidence_report")


def _get_supabase():
    """Lazy supabase client — avoids import cost when module is loaded but unused."""
    from supabase import create_client  # type: ignore

    url = os.environ["SUPABASE_URL"]
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SERVICE_KEY")
    if not key:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY is required")
    return create_client(url, key)


# ── MFM summary derivation ───────────────────────────────────────────────────


def derive_mfm_summary(session_id: str, rows: list[dict], bdn_qty: float) -> dict:
    if not rows:
        return {
            "session_id": session_id,
            "cumulative_mass": 0,
            "avg_flow_rate": 0,
            "duration_hrs": 0,
            "density_avg": 0,
            "final_deviation_pct": 0,
            "readings_count": 0,
        }

    from datetime import datetime

    first_row, last_row = rows[0], rows[-1]
    # Schema shim — real cols use recorded_at / flow_rate_mt_h / cumulative_mt
    def _ts(r):
        return r.get("recorded_at") or r.get("timestamp") or ""
    def _flow(r):
        return r.get("flow_rate_mt_h") or r.get("mass_flow_rate") or 0
    def _cum(r):
        return r.get("cumulative_mt") if r.get("cumulative_mt") is not None else r.get("cumulative_mass", 0)
    t0 = datetime.fromisoformat(_ts(first_row).replace("Z", "+00:00"))
    t1 = datetime.fromisoformat(_ts(last_row).replace("Z", "+00:00"))
    duration_h = (t1 - t0).total_seconds() / 3600.0

    avg_flow = sum(_flow(r) for r in rows) / len(rows)
    density_avg = sum(r.get("density_15c") or 0 for r in rows) / len(rows)
    cum_mass = float(_cum(last_row) or 0)
    dev_pct = ((cum_mass - bdn_qty) / bdn_qty) * 100 if bdn_qty > 0 else 0

    return {
        "session_id": session_id,
        "cumulative_mass": round(cum_mass, 1),
        "avg_flow_rate": round(avg_flow, 2),
        "duration_hrs": round(duration_h, 2),
        "density_avg": round(density_avg, 1),
        "final_deviation_pct": round(dev_pct, 2),
        "readings_count": len(rows),
    }


# ── Fallback explanation (used if Stage 4 Copilot hasn't written one) ────────


def build_fallback_explanation(session: dict, anomalies: list[dict]) -> dict:
    order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    sorted_a = sorted(anomalies, key=lambda a: order.get(a.get("severity"), 4))
    top = sorted_a[0] if sorted_a else None

    return {
        "summary": (
            f"Session {session['session_id']}: {len(anomalies)} anomaly/anomalies detected. "
            f"Risk score {session.get('risk_score')}/100 ({session.get('risk_category')})."
        ),
        "concerns": [
            {
                "title": a.get("rule_name"),
                "evidence": a.get("description"),
                "severity": a.get("severity"),
            }
            for a in anomalies[:3]
        ],
        "recommendation": (
            f"Verdict: {session.get('risk_cat')}. Review anomalies before BDN sign-off."
        ),
        "recommended_action": session.get("recommended_verdict") or "PENDING",
        "lop_draft": (
            f"Letter of Protest — {top['rule_name']}: {top['description']}" if top else ""
        ),
        "supplier_note": "",
        "confidence": 0.7,
    }


# ── Data fetcher (Supabase) ──────────────────────────────────────────────────


def fetch_evidence_report_input(session_id: str) -> EvidenceReportInput:
    sb = _get_supabase()

    session = sb.table("sessions").select("*").eq("session_id", session_id).single().execute().data
    bdn = sb.table("bdn_records").select("*").eq("session_id", session_id).single().execute().data
    mfm_rows = sb.table("mfm_stream").select("*").eq("session_id", session_id).order("seq_no").execute().data or []
    anomalies = sb.table("anomalies").select("*").eq("session_id", session_id).order("triggered_at").execute().data or []
    risk_row = sb.table("risk_scores").select("*").eq("session_id", session_id).single().execute().data

    # ── Schema-translation shim ──────────────────────────────────────────
    # Real Supabase schema differs from the legacy demo schema this module
    # was first written against. Pick from real columns with sensible fallbacks
    # so a missing field never KeyErrors out of the report.
    def pick(row, *names, default=None):
        for n in names:
            if row and n in row and row[n] is not None:
                return row[n]
        return default

    bdn_qty = pick(bdn, "qty_mt", "quantity_mt", default=0)
    mfm_summary = derive_mfm_summary(session_id, mfm_rows, bdn_qty)

    llm_explanation = pick(session, "llm_explanation") or build_fallback_explanation(session, anomalies)

    risk_package = {
        "session_id": session_id,
        "anomaly_severity_raw":   pick(risk_row, "anomaly_severity_raw", "anomaly_severity_0_100", default=0),
        "supplier_history_raw":   pick(risk_row, "supplier_history_raw", "supplier_history_0_100", default=0),
        "doc_completeness_raw":   pick(risk_row, "doc_completeness_raw", "doc_completeness_0_100", default=0),
        "deviation_raw":          pick(risk_row, "deviation_raw", "deviation_0_100", default=0),
        "final_risk_score":       pick(risk_row, "final_risk_score", "risk_score", default=0),
        "risk_category":          pick(risk_row, "risk_category", default="MODERATE"),
        "recommended_verdict":    pick(risk_row, "recommended_verdict", "verdict", default="REVIEW"),
        "estimated_financial_impact_usd": pick(risk_row, "estimated_financial_impact_usd", "estimated_impact_usd", default=0),
        "similar_incidents_30d":  pick(risk_row, "similar_incidents_30d", default=0),
    }

    return EvidenceReportInput(
        session={
            "session_id":     session["session_id"],
            "vessel_name":    pick(session, "vessel_name", "vessel"),
            "vessel_imo":     pick(session, "vessel_imo", default=""),
            "supplier_name":  pick(session, "supplier_name", "supplier", default=""),
            "port":           pick(session, "port", default="Port of Singapore"),
            "fuel_grade":     pick(session, "fuel_grade", default="VLSFO"),
            "bdn_qty_mt":     pick(session, "bdn_qty_mt", default=0),
            "mfm_qty_mt":     pick(session, "mfm_qty_mt", default=0),
            "session_date":   pick(session, "session_date", "date", "created_at", default=""),
            "delivery_start": pick(session, "delivery_start", "start", "created_at", default=""),
            "delivery_end":   pick(session, "delivery_end", "end", default=""),
            "risk_score":     pick(session, "risk_score", default=0),
            "risk_category":  pick(session, "risk_category", "risk_cat", default="MODERATE"),
            "session_status": pick(session, "status", "session_status", default="ACTIVE"),
        },
        bdn=bdn,
        mfm_summary=mfm_summary,
        anomalies=anomalies,
        risk_package=risk_package,
        llm_explanation=llm_explanation,
        vlsfo_spot_price_usd_per_mt=float(os.environ.get("VLSFO_SPOT_PRICE", 585)),
    )


# ── Claude call ──────────────────────────────────────────────────────────────


def call_claude_for_report(payload: EvidenceReportInput) -> dict:
    user_prompt = build_evidence_report_prompt(payload)
    # call_claude already returns a parsed dict when given the JSON-mode contract
    # used elsewhere in this package. If your `claude_client.call_claude`
    # signature differs, adjust this single line.
    return call_claude(
        EVIDENCE_REPORT_SYSTEM,
        user_prompt,
        json_schema=None,
        max_tokens=1200,
    )


# ── Main entry points ────────────────────────────────────────────────────────


def generate_evidence_report(session_id: str) -> dict:
    """Generate a complete evidence report for `session_id`.

    The returned dict does NOT yet have `report_hash` — that is added by the
    hash/signing layer before Supabase storage (mirrors the TS contract).
    """
    payload = fetch_evidence_report_input(session_id)
    report = call_claude_for_report(payload)

    now = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    risk_package = payload.get("risk_package", {})
    session = payload.get("session", {})
    delivered_quantity = float(session.get("mfm_qty_mt") or session.get("bdn_qty_mt") or 0)
    carbon = calculate_carbon_exposure(delivered_quantity, session.get("fuel_grade"))

    # This section is deliberately overwritten after the LLM call. Carbon
    # values come only from delivered quantity and the controlled factor table.
    report["environmental_impact"] = {
        "estimated_carbon_tco2e": carbon["estimated_tco2e"],
        "fuel_grade": carbon["fuel_grade"],
        "quantity_delivered_mt": delivered_quantity,
        "emission_factor_tco2e_per_mt": carbon["emission_factor"],
        "carbon_risk_level": carbon["carbon_risk_level"],
        "calculation_method": "delivered fuel quantity x fuel-grade emission factor",
        "estimated_from_available_session_data": carbon["used_fallback_fuel_grade"],
        "supplementary_intelligence": True,
    }

    if not report.get("report_id"):
        report["report_id"] = f"RPT-{session_id}-{now}"
    if not report.get("generated_at"):
        report["generated_at"] = datetime.now(timezone.utc).isoformat()
    if not report.get("session_id"):
        report["session_id"] = session_id
    if not report.get("sign_off_status"):
        recommended = str(
            report.get("risk_assessment", {}).get("recommended_verdict")
            or risk_package.get("recommended_verdict")
            or ""
        ).upper()
        risk_category = str(
            report.get("risk_assessment", {}).get("risk_category")
            or risk_package.get("risk_category")
            or ""
        ).upper()
        if "REFUSE" in recommended or risk_category in {"CRITICAL", "HIGH"}:
            report["sign_off_status"] = "REFUSE_TO_SIGN"
        elif "LOP" in recommended:
            report["sign_off_status"] = "SIGN_WITH_LOP"
        elif "NOTE" in recommended or risk_category == "MEDIUM":
            report["sign_off_status"] = "SIGN_WITH_NOTES"
        else:
            report["sign_off_status"] = "SIGN"

    if report["session_id"] != session_id:
        raise ValueError(
            f"Report session_id mismatch: got {report['session_id']}, expected {session_id}"
        )
    return report


def store_evidence_report(report: dict, bundle_id: str, anchor_tx: str | None = None) -> None:
    """Upsert the final report (with hash + anchor) to Supabase `evidence_reports`.

    `anchor_tx` is the mocked Ethereum tx hash from the runner — see the
    `frontend/scripts/evidence_report_runner.py` for how it's computed. Kept
    optional so older callers don't break."""
    sb = _get_supabase()
    res = sb.table("evidence_reports").upsert({
        "report_id": report["report_id"],
        "session_id": report["session_id"],
        "generated_at": report["generated_at"],
        "report_json": report,
        "sign_off_status": report["sign_off_status"],
        "report_hash": report.get("report_hash"),
        "signing_bundle_id": bundle_id,
        "anchor_tx": anchor_tx,
    }).execute()
    if getattr(res, "error", None):
        raise RuntimeError(f"Failed to store evidence report: {res.error}")


# ── PDF render (MPA-branded letterhead) ──────────────────────────────────────
def render_evidence_report_pdf(report: dict, out_dir: str | os.PathLike | None = None):
    """Render the final report dict as a branded PDF and return the path.

    The PDF mirrors `report_json` 1:1 — no extra data fetching — so it works
    for any stored report, including those re-loaded from Supabase. Out dir
    defaults to `outputs/<session_id>/`."""
    from pathlib import Path
    from outputs.pdf_from_json import build_pdf

    sid = report.get("session_id", "report")
    base = Path(out_dir) if out_dir else Path("outputs") / str(sid)
    out_path = base / f"EvidenceReport_{sid}.pdf"
    return build_pdf(report, out_path)
