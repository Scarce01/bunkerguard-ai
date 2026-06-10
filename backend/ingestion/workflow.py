"""Asynchronous BDN ingestion and agent orchestration."""
from __future__ import annotations

import hashlib
import re
from datetime import datetime, time, timezone
from typing import Any

import anomaly
import risk
from carbon import calculate_carbon_exposure
from contracts import SessionInput
from enrichment import enrich_entities
from ingestion.document import extract_bdn_document
from storage import get_bytes, put_json

STAGES = (
    "UPLOADED", "OCR", "EXTRACTION", "ENRICHMENT",
    "RISK_ANALYSIS", "EVIDENCE_GENERATION", "DECISION_RECOMMENDATION",
)


def _supabase():
    from supabase import create_client

    return create_client(
        __import__("os").environ["SUPABASE_URL"],
        __import__("os").environ["SUPABASE_SERVICE_ROLE_KEY"],
    )


def _pipeline(current: str, completed: list[str], error: str | None = None) -> dict:
    return {
        "current_stage": current,
        "steps": [{"stage": stage, "status": "COMPLETED" if stage in completed else (
            "FAILED" if stage == current and error else "RUNNING" if stage == current else "PENDING"
        )} for stage in STAGES],
        "error": error,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def _update(document_id: str, current: str, completed: list[str], **values: Any) -> None:
    payload = {
        "status": "FAILED" if values.get("error_message") else (
            "COMPLETED" if current == "COMPLETED" else "PROCESSING"
        ),
        "current_stage": current,
        "pipeline_status": _pipeline(current, completed, values.get("error_message")),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        **values,
    }
    _supabase().table("bdn_documents").update(payload).eq("id", document_id).execute()


def _session_id(document_id: str) -> str:
    year = datetime.now(timezone.utc).year
    number = int(hashlib.sha256(document_id.encode()).hexdigest()[:8], 16) % 1000
    return f"SES-{year}-{number:03d}"


def _digits(value: Any) -> str:
    digits = re.sub(r"\D", "", str(value or ""))
    return digits if len(digits) == 7 else "0000000"


def _grade(value: Any) -> str:
    grade = str(value or "").upper()
    if "B30" in grade:
        return "B30-VLSFO"
    if "B24" in grade or "BIO" in grade:
        return "B24-VLSFO"
    if "LSMGO" in grade:
        return "LSMGO DMA"
    if "MGO" in grade or "DMA" in grade:
        return "MGO DMA"
    if "HSFO" in grade or "HFO" in grade:
        return "HSFO RMG 380"
    return "VLSFO RMG 380"


def _iso_timestamp(date_value: Any, time_value: Any) -> datetime:
    date_text = str(date_value or datetime.now(timezone.utc).date())
    time_text = str(time_value or "00:00")
    try:
        return datetime.fromisoformat(f"{date_text}T{time_text}").replace(tzinfo=timezone.utc)
    except ValueError:
        return datetime.now(timezone.utc)


def _fuel_spec(grade: str) -> dict:
    distillate = "MGO" in grade
    return {
        "grade": grade,
        "max_density_15c_kg_m3": 900 if distillate else 991,
        "max_viscosity_50c_cst": 6 if distillate else 380,
        "max_sulphur_pct": 0.1 if distillate else 0.5,
        "min_flash_point_c": 60,
        "max_al_si_mg_kg": 60,
        "max_ccai": 870,
    }


def _build_session(session_id: str, fields: dict, file_hash: str) -> SessionInput:
    grade = _grade(fields.get("fuel_grade"))
    start = _iso_timestamp(fields.get("delivery_date"), fields.get("start_time"))
    end = _iso_timestamp(fields.get("delivery_date"), fields.get("end_time") or fields.get("start_time"))
    if end < start:
        end = start
    quantity = float(fields.get("quantity_mt") or 0)
    supplier_name = str(fields.get("supplier_name") or "UNKNOWN")
    licence = fields.get("licence_number")
    return SessionInput.model_validate({
        "session_id": session_id,
        "port": "Singapore",
        "start_ts": start,
        "end_ts": end,
        "duration_h": max(0, (end - start).total_seconds() / 3600),
        "vessel": {"name": fields.get("vessel_name") or "UNKNOWN", "imo": _digits(fields.get("imo_number")), "evidence_source": "Uploaded BDN"},
        "barge": {"name": fields.get("barge_name") or "UNKNOWN", "imo": _digits(fields.get("barge_imo")), "mpa_licence": licence, "evidence_source": "Uploaded BDN"},
        "supplier": {
            "supplier_id": f"SUP-{hashlib.sha256(supplier_name.encode()).hexdigest()[:8].upper()}",
            "name": supplier_name,
            "mpa_licence": licence,
            "in_mpa_registry": bool(licence),
        },
        "bdn": {
            "bdn_ref": fields.get("bdn_reference") or f"BDN-{file_hash[:12].upper()}",
            "grade": grade,
            "qty_mt": quantity,
            "density_15c_kg_m3": float(fields.get("density_15c") or 0),
            "viscosity_50c_cst": float(fields.get("viscosity_50c") or 0),
            "sulphur_pct": float(fields.get("sulphur_pct") or 0),
            "flash_point_c": float(fields.get("flash_point_c") or 0),
            "sample_seal": fields.get("sample_seal"),
            "supplier_signed": bool(fields.get("supplier_signed")),
            "officer_signed": bool(fields.get("officer_signed")),
            "ebdn_status": "VERIFIED",
            "ebdn_qr_sha256": file_hash,
            "start_ts": start,
            "end_ts": end,
        },
        "mfm_stream": [],
        "fuel_spec": _fuel_spec(grade),
        "ais": [],
        "history": {},
        "bdn_qty_mt": quantity,
        "mfm_qty_mt": None,
        "in_flight": True,
        "evidence_sha256": file_hash,
        "dataset_classification": "uploaded_document",
    })


def _persist_session(document_id: str, session: SessionInput, fields: dict, confidence: float) -> None:
    sb = _supabase()
    s = session
    carbon = calculate_carbon_exposure(s.bdn_qty_mt, s.bdn.grade.value)
    sb.table("suppliers").upsert({
        "id": s.supplier.supplier_id, "name": s.supplier.name,
        "mpa_licence": s.supplier.mpa_licence,
    }).execute()
    sb.table("sessions").upsert({
        "session_id": s.session_id, "vessel_name": s.vessel.name, "vessel_imo": s.vessel.imo,
        "barge_name": s.barge.name, "barge_imo": s.barge.imo,
        "supplier_id": s.supplier.supplier_id, "supplier_name": s.supplier.name,
        "mpa_licence": s.supplier.mpa_licence, "port": fields.get("port") or "UNKNOWN",
        "fuel_grade": s.bdn.grade.value, "bdn_qty_mt": s.bdn_qty_mt,
        "delivery_date": s.start_ts.date().isoformat(), "start_time": s.start_ts.time().isoformat(),
        "end_time": s.end_ts.time().isoformat(), "duration_h": s.duration_h,
        "status": "ACTIVE", "verdict": "PENDING", "data_quality_pct": int(confidence),
        "evidence_sha256": s.evidence_sha256, "total_fuel_mt": s.bdn_qty_mt,
        "emission_factor_tco2e_per_mt": carbon["emission_factor"],
        "estimated_carbon_tco2e": carbon["estimated_tco2e"],
        "carbon_risk_level": carbon["carbon_risk_level"],
    }).execute()
    sb.table("bdn_records").upsert({
        "bdn_ref": s.bdn.bdn_ref, "session_id": s.session_id,
        "vessel_name": s.vessel.name, "vessel_imo": s.vessel.imo,
        "supplier_name": s.supplier.name, "mpa_licence": s.supplier.mpa_licence,
        "barge_name": s.barge.name, "barge_imo": s.barge.imo,
        "port": fields.get("port") or "UNKNOWN", "delivery_date": s.start_ts.date().isoformat(),
        "start_time": s.start_ts.time().isoformat(), "end_time": s.end_ts.time().isoformat(),
        "fuel_grade": s.bdn.grade.value, "sulphur_pct": s.bdn.sulphur_pct,
        "density_15c": s.bdn.density_15c_kg_m3, "viscosity_50c": s.bdn.viscosity_50c_cst,
        "flash_point_c": s.bdn.flash_point_c, "qty_mt": s.bdn.qty_mt,
        "sample_seal": s.bdn.sample_seal, "supp_signed": s.bdn.supplier_signed,
        "officer_signed": s.bdn.officer_signed, "ebdn_status": s.bdn.ebdn_status.value,
        "ebdn_qr_sha256": s.bdn.ebdn_qr_sha256,
    }).execute()
    sb.table("bdn_documents").update({"session_id": s.session_id}).eq("id", document_id).execute()


def process_ingestion(document_id: str) -> dict[str, Any]:
    sb = _supabase()
    completed = ["UPLOADED"]
    current_stage = "OCR"
    row = sb.table("bdn_documents").select("*").eq("id", document_id).single().execute().data
    try:
        _update(document_id, current_stage, completed)
        document = get_bytes(row["s3_key"])
        extraction = extract_bdn_document(document, row["content_type"], row["filename"])
        completed.append("OCR")
        current_stage = "EXTRACTION"
        _update(
            document_id, current_stage, completed,
            extracted_data=extraction["fields"],
            parsing_confidence=extraction["parsing_confidence"],
            field_confidence=extraction["field_confidence"],
            provider_metadata=extraction["provider"],
        )
        fields = extraction["fields"]
        session_id = _session_id(document_id)
        session = _build_session(session_id, fields, row["file_sha256"])
        _persist_session(document_id, session, fields, extraction["parsing_confidence"])
        surveyor = {"agent": "Surveyor Agent", "normalized_session": session.model_dump(mode="json"), "source_document_id": document_id}
        completed.append("EXTRACTION")

        current_stage = "ENRICHMENT"
        _update(document_id, current_stage, completed)
        enrichment = enrich_entities(fields)
        for kind in ("supplier", "vessel", "barge", "port"):
            sb.table("enrichment_results").upsert({
                "session_id": session_id, "enrichment_type": kind,
                "entity_name": enrichment[kind].get(f"{kind}_name") or enrichment[kind].get(kind),
                "result_json": enrichment[kind], "source": "exa",
            }, on_conflict="session_id,enrichment_type").execute()
        sb.table("supplier_intelligence").upsert({"session_id": session_id, **enrichment["supplier"]}).execute()
        sb.table("vessel_intelligence").upsert({"session_id": session_id, **enrichment["vessel"]}).execute()
        completed.append("ENRICHMENT")

        current_stage = "RISK_ANALYSIS"
        _update(document_id, current_stage, completed)
        anomaly_report = anomaly.run(session)
        risk_package = risk.run(anomaly_report, session)
        investigator = {
            "agent": "Investigator Agent",
            "anomaly_report": anomaly_report.model_dump(mode="json"),
            "risk_package": risk_package.model_dump(mode="json"),
            "enrichment_consulted": True,
            "score_source": "Stage 2 and Stage 3 deterministic engines",
        }
        sb.table("sessions").update({
            "risk_score": risk_package.risk_score,
            "risk_category": risk_package.risk_category.value,
            "verdict": risk_package.verdict.value,
        }).eq("session_id", session_id).execute()
        sb.table("risk_scores").upsert({
            "session_id": session_id,
            "final_risk_score": risk_package.risk_score,
            "risk_category": risk_package.risk_category.value,
            "verdict": risk_package.verdict.value,
            "estimated_impact_usd": risk_package.estimated_impact_usd,
            "similar_sessions_30d": risk_package.similar_30d_count,
        }).execute()
        completed.append("RISK_ANALYSIS")

        current_stage = "EVIDENCE_GENERATION"
        _update(document_id, current_stage, completed)
        compliance_findings = []
        if not session.supplier.mpa_licence:
            compliance_findings.append("Supplier licence number is absent from the uploaded BDN.")
        if not session.bdn.supplier_signed:
            compliance_findings.append("Supplier signature is absent.")
        if not session.bdn.officer_signed:
            compliance_findings.append("Receiving officer signature is absent.")
        if enrichment["supplier"]["sanctions_check"] != "NO_MATCH_IN_SEARCH_RESULTS":
            compliance_findings.append("Potential sanctions-related search result requires manual verification.")
        compliance = {
            "agent": "Compliance Agent",
            "findings": compliance_findings,
            "supporting_evidence": enrichment,
            "external_intelligence_is_supplementary": True,
        }
        evidence = {
            "session_id": session_id, "source_document": row["s3_key"],
            "surveyor": surveyor, "investigator": investigator,
            "compliance": compliance, "file_sha256": row["file_sha256"],
        }
        evidence_key = put_json("ingestion-evidence", session_id, evidence)
        completed.append("EVIDENCE_GENERATION")

        current_stage = "DECISION_RECOMMENDATION"
        _update(document_id, current_stage, completed)
        risk_level = risk_package.risk_category.value
        if risk_level == "CRITICAL":
            recommendation = "REFUSE"
        elif compliance_findings or not session.mfm_stream or risk_level in {"HIGH", "INSUFFICIENT_DATA"}:
            recommendation = "REVIEW"
        else:
            recommendation = "SIGN"
        decision = {
            "agent": "Decision Agent", "recommendation": recommendation,
            "reason": "MFM reconciliation remains pending." if not session.mfm_stream else risk_package.verdict_reason,
            "risk_score": risk_package.risk_score, "risk_category": risk_level,
            "carbon_metrics_do_not_affect_decision": True,
        }
        sb.table("bunkering_sessions").upsert({
            "session_id": session_id, "bdn_document_id": document_id,
            "normalized_session": session.model_dump(mode="json"),
            "surveyor_output": surveyor, "investigator_output": investigator,
            "compliance_output": compliance, "decision_output": decision,
            "evidence_s3_key": evidence_key,
        }).execute()
        completed.extend(["DECISION_RECOMMENDATION"])
        _update(document_id, "COMPLETED", completed)
        return {"document_id": document_id, "session_id": session_id, "decision": decision}
    except Exception as exc:
        _update(document_id, current_stage, completed, error_message=f"{type(exc).__name__}: {exc}")
        raise
