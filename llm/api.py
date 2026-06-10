"""HTTP API for BDN upload + live bunkering — what the Next.js webpage calls.

Surface area is intentionally tiny: one endpoint per orchestrator step plus
a couple of reads. The frontend pill that's hardcoded to 98% should bind
to ``parsing_confidence_pct`` from ``POST /api/bdn/upload``; the four ticks
(Vessel / Supplier / Quantity / Fuel Grade) bind to ``checks.*`` from the
same response. Nothing in the response is fabricated — every value comes
from Claude or from a real-field-presence check.

Run:
    uvicorn llm.api:app --reload --port 8787

Env:
    ANTHROPIC_API_KEY   required (Claude calls)
    SUPABASE_URL        optional — when set, every upload is persisted to
    SUPABASE_SERVICE_KEY   `bdn_uploads` and sessions sync to `sessions`
                           / `bdn_records` / `mfm_stream`.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Optional


def _bootstrap_env() -> None:
    """Load ANTHROPIC_API_KEY (and friends) from the usual .env locations.

    The Next.js frontend already stores the key in `.env.local`; loading the
    same file from the Python backend means the operator doesn't have to
    duplicate it. We search a small, explicit list rather than walking the
    tree, and skip silently when nothing is found.
    """
    if os.environ.get("ANTHROPIC_API_KEY"):
        return
    try:
        from dotenv import load_dotenv  # type: ignore
    except ImportError:
        return
    here = Path(__file__).resolve().parent.parent
    candidates = [
        here / ".env",
        here / ".env.local",
        here.parent / "next-bunker-fe" / ".env.local",
    ]
    for p in candidates:
        if p.is_file():
            load_dotenv(p, override=False)


_bootstrap_env()

try:
    from fastapi import FastAPI, File, Form, HTTPException, UploadFile
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel
except ImportError as e:  # pragma: no cover
    raise RuntimeError(
        "FastAPI not installed. Run: pip install fastapi uvicorn python-multipart"
    ) from e

from . import supabase_sync
from .bdn_ingest_service import BDNIngestResult, analyze_bdn_upload
from .bunkering_orchestrator import (
    finalize_session,
    get_session,
    list_active,
    list_all,
    start_session,
    tick,
)

log = logging.getLogger("bunkerguard.api")
app = FastAPI(title="BunkerGuard BDN Upload API", version="1.0")

# Localhost dev frontends (Next.js 3000 / Vite 5173) — broaden as needed.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Activate Supabase persistence if env vars are set; no-op otherwise.
_SUPABASE_ACTIVE = supabase_sync.install()


# ── Response shapes (so the frontend has a typed contract) ───────────────────


class UploadResponse(BaseModel):
    """Exactly what the frontend should render after a BDN upload.

    The hardcoded "98%" pill should bind to `parsing_confidence_pct`. The
    four ticks bind to `checks`. The "is it a BDN?" decision and its
    justification come from Claude — not a rule, not a constant.
    """
    is_bdn: bool
    document_type: str
    parsing_confidence: float            # 0..1
    parsing_confidence_pct: float        # 0..100, ready for the UI
    reasoning: str
    red_flags: list[str]
    checks: dict
    extracted: dict
    usage: dict
    persisted: bool                      # True if a bdn_uploads row was written
    raw_response: Optional[str] = None   # Claude's raw text — for debugging


class StartSessionResponse(BaseModel):
    session_id: str
    status: str                          # 'PENDING' (un-bunked) on success
    bdn_qty_mt: float
    mfm_qty_mt: float
    notes: str


class SessionView(BaseModel):
    session_id: str
    status: str
    vessel_name: str
    vessel_imo: str
    supplier_name: str
    barge_name: str
    port: str
    fuel_grade: str
    bdn_qty_mt: float
    mfm_qty_mt: float
    progress_pct: float
    deviation_mt: float
    deviation_pct: float
    parsing_confidence: float
    started_at: str
    last_tick_at: str
    notes: str


# ── Routes ───────────────────────────────────────────────────────────────────


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "supabase_sync": _SUPABASE_ACTIVE}


@app.post("/api/bdn/upload", response_model=UploadResponse)
async def upload_bdn(
    file: UploadFile = File(...),
    text_hint: Optional[str] = Form(None),
    uploaded_by: Optional[str] = Form(None),
) -> UploadResponse:
    """Classify + extract an uploaded document.

    Returns Claude's verdict verbatim. If the document is not a BDN the
    extracted fields will be empty and the four ticks will all be false —
    the frontend should render this as a rejection with `reasoning`
    explaining why.
    """
    payload = await file.read()
    if not payload:
        raise HTTPException(400, "Empty upload.")

    result = analyze_bdn_upload(
        payload,
        filename=file.filename or "upload.bin",
        mime_type=file.content_type,
        text_hint=text_hint,
        persist=_SUPABASE_ACTIVE,
        uploaded_by=uploaded_by,
    )
    return UploadResponse(**_serialize_upload(result))


@app.post("/api/bdn/start-session", response_model=StartSessionResponse)
def start_bunkering_session(
    is_bdn: bool = Form(...),
    confidence: float = Form(...),
    reasoning: str = Form(""),
    document_type: str = Form("BDN"),
    extracted_json: str = Form(...),
) -> StartSessionResponse:
    """Promote an accepted BDN upload into a live PENDING (un-bunked) session.

    The frontend should call this only when the user clicks "Create session"
    on a BDN that Claude classified as is_bdn=true. Sessions start with
    `status='PENDING'` and `mfm_qty_mt=0`; the first tick flips it to
    'BUNKERING'.
    """
    import json
    try:
        extracted = json.loads(extracted_json)
    except json.JSONDecodeError as e:
        raise HTTPException(400, f"extracted_json must be valid JSON: {e}")

    ingest = BDNIngestResult(
        is_bdn=is_bdn,
        confidence=confidence,
        reasoning=reasoning,
        document_type=document_type,
        red_flags=[],
        extracted=extracted,
    )
    try:
        session = start_session(ingest)
    except ValueError as e:
        # Non-BDN — let the frontend render Claude's reason.
        raise HTTPException(422, str(e))

    return StartSessionResponse(
        session_id=session.session_id,
        status=session.status,
        bdn_qty_mt=session.bdn_qty_mt,
        mfm_qty_mt=session.mfm_qty_mt,
        notes=session.notes,
    )


@app.post("/api/sessions/{session_id}/tick", response_model=SessionView)
def advance_session(session_id: str, dt_seconds: float = 30.0) -> SessionView:
    """Advance the bunkering by `dt_seconds` of simulated time."""
    session = tick(session_id, dt_seconds=dt_seconds)
    if session is None:
        raise HTTPException(404, f"Session {session_id} not found.")
    return _session_view(session)


@app.post("/api/sessions/{session_id}/finalize", response_model=SessionView)
def stop_session(session_id: str, halted: bool = False) -> SessionView:
    try:
        session = finalize_session(session_id, halted=halted)
    except KeyError:
        raise HTTPException(404, f"Session {session_id} not found.")
    return _session_view(session)


@app.get("/api/sessions/{session_id}", response_model=SessionView)
def fetch_session(session_id: str) -> SessionView:
    session = get_session(session_id)
    if session is None:
        raise HTTPException(404, f"Session {session_id} not found.")
    return _session_view(session)


@app.get("/api/sessions")
def list_sessions(active_only: bool = False) -> list[SessionView]:
    rows = list_active() if active_only else list_all()
    return [_session_view(s) for s in rows]


# ── Helpers ──────────────────────────────────────────────────────────────────


def _present(extracted: dict, key: str) -> bool:
    v = extracted.get(key)
    if v is None:
        return False
    if isinstance(v, str) and v.strip().upper() in ("", "UNKNOWN", "N/A"):
        return False
    if isinstance(v, (int, float)) and float(v) == 0.0 and key == "qty_mt":
        return False
    return True


def _serialize_upload(result: BDNIngestResult) -> dict:
    extracted = dict(result.extracted or {})
    conf = float(result.confidence or 0.0)
    return {
        "is_bdn": result.is_bdn,
        "document_type": result.document_type or "unknown",
        "parsing_confidence": round(conf, 3),
        "parsing_confidence_pct": round(conf * 100, 1),
        "reasoning": result.reasoning or "",
        "red_flags": list(result.red_flags or []),
        "checks": {
            "vessel_identified":    _present(extracted, "vessel_name"),
            "supplier_identified":  _present(extracted, "supplier_name"),
            "quantity_extracted":   _present(extracted, "qty_mt"),
            "fuel_grade_extracted": _present(extracted, "grade"),
        },
        "extracted": extracted,
        "usage": result.usage or {},
        "persisted": _SUPABASE_ACTIVE,
        "raw_response": result.raw_response,
    }


def _session_view(session) -> SessionView:
    return SessionView(
        session_id=session.session_id,
        status=session.status,
        vessel_name=session.vessel_name,
        vessel_imo=session.vessel_imo,
        supplier_name=session.supplier_name,
        barge_name=session.barge_name,
        port=session.port,
        fuel_grade=session.fuel_grade,
        bdn_qty_mt=session.bdn_qty_mt,
        mfm_qty_mt=session.mfm_qty_mt,
        progress_pct=session.progress_pct,
        deviation_mt=session.deviation_mt,
        deviation_pct=session.deviation_pct,
        parsing_confidence=session.parsing_confidence,
        started_at=session.started_at.isoformat(),
        last_tick_at=session.last_tick_at.isoformat(),
        notes=session.notes,
    )
