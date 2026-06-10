"""Supabase persistence for BDN uploads + live bunkering sessions.

Wires the in-memory orchestrator and the Claude-driven ingest service to
the real `sessions` / `bdn_records` / `mfm_stream` / `bdn_uploads` tables,
so the Next.js frontend can stop hardcoding values like the "Parsing
Confidence: 98%" pill and read whatever Claude actually produced.

Two entry points:

  * ``persist_upload(result, ...)``  — call right after
    ``analyze_bdn_upload`` to log every Claude analysis (including
    is_bdn=false rejections, with the model's justification).

  * ``install()``  — registers ``persist_session`` as the orchestrator's
    sink so every start/tick/finalise propagates to Supabase.

No Supabase env vars set → ``install()`` is a no-op and ``persist_*``
returns ``None`` quietly. Demo still works; production picks up
SUPABASE_URL + SUPABASE_SERVICE_KEY and everything flows.
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime
from typing import Any, Optional

from .bdn_ingest_service import BDNIngestResult
from .bunkering_orchestrator import BunkeringSession, set_persistence_sink

log = logging.getLogger("bunkerguard.llm.supabase_sync")

_supabase: Any = None


def _client() -> Any:
    """Return a cached Supabase client, or None if creds aren't configured.

    Returning None (rather than raising) lets the dashboard demo run
    happily on a laptop without a Supabase project, while still flipping
    on automatically in environments that have the env vars set.
    """
    global _supabase
    if _supabase is not None:
        return _supabase
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY")
    if not (url and key):
        return None
    try:
        from supabase import create_client  # type: ignore
    except ImportError:
        log.warning("supabase sdk not installed — sync disabled")
        return None
    _supabase = create_client(url, key)
    return _supabase


# ── BDN upload row ───────────────────────────────────────────────────────────


def persist_upload(
    result: BDNIngestResult,
    *,
    filename: str,
    mime_type: str,
    size_bytes: int,
    session_id: Optional[str] = None,
    uploaded_by: Optional[str] = None,
) -> Optional[str]:
    """Insert one row into ``bdn_uploads`` capturing Claude's verdict.

    Returns the upload_id (uuid string) on success, or None when no
    Supabase client is configured. Critically: this is what the frontend
    should read for `parsing_confidence`, `is_bdn`, `reasoning`, and the
    four per-field tick flags. Nothing about the row is invented — every
    value comes from Claude's JSON response.
    """
    sb = _client()
    if sb is None:
        return None

    upload_id = f"UPL-{uuid.uuid4().hex[:12].upper()}"
    extracted = dict(result.extracted or {})
    usage = result.usage or {}

    payload = {
        "upload_id": upload_id,
        "session_id": session_id,
        "filename": filename,
        "mime_type": mime_type,
        "size_bytes": size_bytes,
        "is_bdn": bool(result.is_bdn),
        "document_type": result.document_type or "unknown",
        "classification_confidence": round(float(result.confidence or 0.0), 3),
        # parsing_confidence: same value for one-shot Claude analyses; gives
        # the frontend a stable column to bind even when the deeper OCR
        # pipeline later writes its own field-coverage figure on top.
        "parsing_confidence": round(float(result.confidence or 0.0), 3),
        "reasoning": result.reasoning or "",
        "red_flags": list(result.red_flags or []),
        "extracted": extracted,
        "vessel_identified":    _present(extracted, "vessel_name"),
        "supplier_identified":  _present(extracted, "supplier_name"),
        "quantity_extracted":   _present(extracted, "qty_mt"),
        "fuel_grade_extracted": _present(extracted, "grade"),
        "tokens_input":  usage.get("input_tokens"),
        "tokens_output": usage.get("output_tokens"),
        "model": usage.get("model"),
        "uploaded_by": uploaded_by,
    }

    try:
        sb.table("bdn_uploads").insert(payload).execute()
    except Exception:  # never break the user flow on a sync hiccup
        log.exception("persist_upload_failed", extra={"upload_id": upload_id})
        return None
    return upload_id


def _present(extracted: dict, key: str) -> bool:
    v = extracted.get(key)
    if v is None:
        return False
    if isinstance(v, str) and v.strip().upper() in ("", "UNKNOWN", "N/A"):
        return False
    if isinstance(v, (int, float)) and float(v) == 0.0 and key in ("qty_mt",):
        return False
    return True


# ── Session sync sink ────────────────────────────────────────────────────────


def persist_session(session: BunkeringSession) -> None:
    """Sink registered with the orchestrator — upserts the live state.

    Three tables touched per call (all idempotent on (session_id) /
    (bdn_ref) / (session_id, seq_no)):

      * ``sessions``     — top-level row, status flips PENDING → ACTIVE
                           once we have an mfm packet, then COMPLETED /
                           HALTED at finalise.
      * ``bdn_records``  — full BDN copy, written once.
      * ``mfm_stream``   — every new packet since the last call.
    """
    sb = _client()
    if sb is None:
        return

    status = _supabase_status(session)
    try:
        sb.table("sessions").upsert({
            "session_id":      session.session_id,
            "vessel_name":     session.vessel_name,
            "vessel_imo":      session.vessel_imo or "0000000",
            "barge_name":      session.barge_name,
            "barge_imo":       session.barge_imo,
            "supplier_name":   session.supplier_name,
            "port":            session.port,
            "fuel_grade":      session.fuel_grade,
            "bdn_qty_mt":      session.bdn_qty_mt,
            "mfm_qty_mt":      session.mfm_qty_mt,
            "dev_mt":          session.deviation_mt,
            "dev_pct":         session.deviation_pct,
            "delivery_date":   session.delivery_date,
            "start_time":      session.start_time,
            "end_time":        session.end_time,
            "status":          status,
            "parsing_confidence": round(float(session.parsing_confidence or 0.0), 3),
            "notes":           session.notes,
            "updated_at":      _now_iso(),
        }, on_conflict="session_id").execute()

        sb.table("bdn_records").upsert({
            "bdn_ref":       session.bdn_ref,
            "session_id":    session.session_id,
            "vessel_name":   session.vessel_name,
            "vessel_imo":    session.vessel_imo or "0000000",
            "supplier_name": session.supplier_name,
            "barge_name":    session.barge_name,
            "barge_imo":     session.barge_imo,
            "port":          session.port,
            "delivery_date": session.delivery_date,
            "start_time":    session.start_time,
            "end_time":      session.end_time,
            "fuel_grade":    session.fuel_grade,
            "qty_mt":        session.bdn_qty_mt,
            "density_15c":   session.density_15c,
        }, on_conflict="bdn_ref").execute()

        if session.mfm_stream:
            sb.table("mfm_stream").upsert([
                {
                    "session_id":     session.session_id,
                    "seq_no":         p.seq_no,
                    "recorded_at":    p.timestamp.isoformat(),
                    "flow_rate_mt_h": p.flow_rate_mt_h,
                    "cumulative_mt":  p.cumulative_mt,
                    "density_15c":    p.density_15c_kg_m3,
                    "temp_c":         p.temp_c,
                    "direction":      p.direction,
                }
                for p in session.mfm_stream
            ], on_conflict="session_id,seq_no").execute()
    except Exception:
        log.exception("persist_session_failed", extra={"session_id": session.session_id})


def _supabase_status(session: BunkeringSession) -> str:
    """Map orchestrator status to the DB enum.

    The orchestrator's ``BUNKERING`` is the same idea as the DB's ``ACTIVE``,
    but a freshly-uploaded BDN with zero MFM packets is reported as
    ``PENDING`` ("un-bunked") so the dashboard can list it under
    "Awaiting bunkering start" rather than under "In progress".
    """
    if session.status == "HALTED":
        return "HALTED"
    if session.status == "COMPLETED":
        return "COMPLETED"
    # BUNKERING in orchestrator terms.
    if not session.mfm_stream or session.mfm_qty_mt <= 0:
        return "PENDING"
    return "ACTIVE"


def _now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"


def install() -> bool:
    """Register `persist_session` with the orchestrator. Returns True if active."""
    if _client() is None:
        log.info("supabase sync skipped — SUPABASE_URL/SERVICE_KEY not set")
        return False
    set_persistence_sink(persist_session)
    return True


__all__ = ["install", "persist_session", "persist_upload"]
