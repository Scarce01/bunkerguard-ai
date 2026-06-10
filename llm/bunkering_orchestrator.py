"""Live bunkering orchestrator — wires BDN upload to a running session.

Flow once a BDN upload is accepted by Claude (`llm.bdn_ingest_service`):

    BDN upload  →  start_session(extraction)
                       creates an in-flight session, status=BUNKERING,
                       mfm_qty=0, dev_pct=0, mfm_stream=[]
                ↓
    real MFM    →  append_packet(...)
                       OR for the demo: tick(session_id, dt_seconds)
                       advances cumulative_mt at the BDN's natural flow rate
                       until we reach the BDN target.
                ↓
    end of run  →  finalize_session(session_id)
                       flips status to COMPLETED so the existing
                       anomaly/risk pipeline treats it as final.

The orchestrator keeps an in-memory store keyed by `session_id`. The
dashboard reads from it on every rerun; an optional `_persist` hook is
called on every state change so a future Supabase writer can plug in
without touching this file's API.

Design notes:
  * Pure-Python, no asyncio — Streamlit reruns drive ticks, no background
    thread needed.
  * Deterministic per session_id: same extraction + same elapsed seconds
    → same MFM packet. Lets us replay the live demo in a recording.
  * `_persist` is module-level so a host that wires Supabase only swaps
    one symbol, no class hierarchy.
"""
from __future__ import annotations

import hashlib
import logging
import threading
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional

from .bdn_ingest_service import BDNIngestResult, to_bdn_doc

log = logging.getLogger("bunkerguard.llm.orchestrator")


# ── Session record ────────────────────────────────────────────────────────────


@dataclass
class MFMTick:
    """One MFM packet produced by `tick()` or `append_packet()`."""
    seq_no: int
    timestamp: datetime
    flow_rate_mt_h: float
    cumulative_mt: float
    density_15c_kg_m3: float
    temp_c: float = 30.0
    direction: str = "FORWARD"
    status_code: str = "OK"


@dataclass
class BunkeringSession:
    """Snapshot of an in-flight bunkering session.

    Field shapes intentionally mirror the columns in
    `supabase/migrations/20260606000001_init.sql` so a future writer can
    upsert this dataclass directly into `sessions` / `bdn_records` /
    `mfm_stream` with minimal mapping.
    """
    session_id: str
    status: str                       # 'PENDING' | 'BUNKERING' | 'COMPLETED' | 'HALTED'
    vessel_name: str
    vessel_imo: str
    supplier_name: str
    barge_name: str
    barge_imo: str
    port: str
    fuel_grade: str
    bdn_qty_mt: float                 # the BDN-declared target
    mfm_qty_mt: float                 # advances 0 → bdn_qty_mt as we tick
    density_15c: float
    delivery_date: str
    start_time: str
    end_time: Optional[str]
    bdn_ref: str
    parsing_confidence: float
    started_at: datetime
    last_tick_at: datetime
    mfm_stream: list[MFMTick] = field(default_factory=list)
    notes: str = "BDN uploaded — un-bunked, awaiting MFM stream."

    # Derived ----------------------------------------------------------------

    @property
    def progress_pct(self) -> float:
        if self.bdn_qty_mt <= 0:
            return 0.0
        return min(100.0, (self.mfm_qty_mt / self.bdn_qty_mt) * 100.0)

    @property
    def deviation_mt(self) -> float:
        return self.mfm_qty_mt - self.bdn_qty_mt

    @property
    def deviation_pct(self) -> float:
        if self.bdn_qty_mt <= 0:
            return 0.0
        return (self.deviation_mt / self.bdn_qty_mt) * 100.0

    @property
    def is_active(self) -> bool:
        """Tickable — covers both 'just uploaded' and 'flowing' states."""
        return self.status in ("PENDING", "BUNKERING")

    def to_dict(self) -> dict:
        return {
            "session_id": self.session_id,
            "status": self.status,
            "vessel_name": self.vessel_name,
            "vessel_imo": self.vessel_imo,
            "supplier_name": self.supplier_name,
            "barge_name": self.barge_name,
            "barge_imo": self.barge_imo,
            "port": self.port,
            "fuel_grade": self.fuel_grade,
            "bdn_qty_mt": self.bdn_qty_mt,
            "mfm_qty_mt": self.mfm_qty_mt,
            "progress_pct": self.progress_pct,
            "deviation_mt": self.deviation_mt,
            "deviation_pct": self.deviation_pct,
            "density_15c": self.density_15c,
            "delivery_date": self.delivery_date,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "bdn_ref": self.bdn_ref,
            "parsing_confidence": self.parsing_confidence,
            "started_at": self.started_at.isoformat(),
            "last_tick_at": self.last_tick_at.isoformat(),
            "notes": self.notes,
            "mfm_stream": [t.__dict__ for t in self.mfm_stream],
        }


# ── In-memory store ───────────────────────────────────────────────────────────

_STORE: dict[str, BunkeringSession] = {}
_LOCK = threading.Lock()

# Optional sink for persisting to Supabase / Kafka / wherever. Host wires this
# at startup; orchestrator never imports the sink directly.
_persist: Optional[Callable[[BunkeringSession], None]] = None


def set_persistence_sink(sink: Optional[Callable[[BunkeringSession], None]]) -> None:
    """Register (or clear) a writer called on every session state change."""
    global _persist
    _persist = sink


def _emit(session: BunkeringSession) -> None:
    if _persist is None:
        return
    try:
        _persist(session)
    except Exception:  # never let a flaky writer break the demo
        log.exception("persist_sink_failed", extra={"session_id": session.session_id})


# ── Session id ────────────────────────────────────────────────────────────────


def _next_session_id(extraction: dict, year: int) -> str:
    """Derive a stable SES-YYYY-NNN id from the BDN reference.

    Same BDN ref + same year → same session id, so replays don't pile up
    duplicate sessions. Real Stage 1 would use a Supabase sequence; this
    is the demo equivalent.
    """
    ref = (extraction.get("bdn_ref") or "").strip().upper()
    seed = ref or extraction.get("vessel_name", "UNK")
    digest = hashlib.sha1(seed.encode("utf-8")).hexdigest()
    suffix = int(digest[:5], 16) % 1000
    return f"SES-{year}-{suffix:03d}"


# ── Public API ────────────────────────────────────────────────────────────────


def start_session(ingest: BDNIngestResult, *, now: Optional[datetime] = None) -> BunkeringSession:
    """Create a new BUNKERING session from an accepted BDN extraction.

    Raises ValueError if the upload isn't classified as a BDN — callers
    should check `ingest.is_bdn` first and surface the reason to the
    officer.
    """
    if not ingest.is_bdn:
        raise ValueError(
            "Refusing to start bunkering: uploaded document is not a BDN "
            f"(document_type={ingest.document_type!r}, confidence={ingest.confidence:.2f})."
        )

    extracted = dict(ingest.extracted or {})
    now = now or datetime.now(timezone.utc)
    sid = _next_session_id(extracted, now.year)

    delivery_date = (extracted.get("delivery_date") or now.strftime("%Y-%m-%d")).strip()
    start_time = (extracted.get("time_start") or now.strftime("%H:%M")).strip()
    density = float(extracted.get("density_15c_kg_m3") or 0.0) or 985.0
    bdn_qty = float(extracted.get("qty_mt") or 0.0)

    session = BunkeringSession(
        session_id=sid,
        # 'PENDING' = un-bunked. The session row exists, the BDN is on
        # file, but no MFM packet has been received yet. The first tick
        # (real meter packet or simulated) flips this to 'BUNKERING'.
        status="PENDING",
        vessel_name=(extracted.get("vessel_name") or "UNKNOWN").strip(),
        vessel_imo=str(extracted.get("vessel_imo") or "").strip(),
        supplier_name=(extracted.get("supplier_name") or "UNKNOWN").strip(),
        barge_name=(extracted.get("barge_name") or "UNKNOWN").strip(),
        barge_imo=str(extracted.get("barge_imo") or "").strip(),
        port=(extracted.get("port") or "Singapore").strip(),
        fuel_grade=(extracted.get("grade") or "VLSFO RMG 380").strip(),
        bdn_qty_mt=bdn_qty,
        mfm_qty_mt=0.0,
        density_15c=density,
        delivery_date=delivery_date,
        start_time=start_time,
        end_time=None,
        bdn_ref=(extracted.get("bdn_ref") or sid).strip(),
        parsing_confidence=float(ingest.confidence or 0.0),
        started_at=now,
        last_tick_at=now,
    )

    with _LOCK:
        # Idempotent: if the officer re-uploads the same BDN, return the
        # existing live session rather than wiping its accumulated MFM.
        existing = _STORE.get(sid)
        if existing is not None and existing.is_active:
            return existing
        _STORE[sid] = session

    log.info("bunkering_started", extra={
        "session_id": sid, "bdn_ref": session.bdn_ref,
        "vessel": session.vessel_name, "target_mt": bdn_qty,
    })
    _emit(session)
    return session


def get_session(session_id: str) -> Optional[BunkeringSession]:
    with _LOCK:
        return _STORE.get(session_id)


def list_active() -> list[BunkeringSession]:
    with _LOCK:
        return [s for s in _STORE.values() if s.is_active]


def list_all() -> list[BunkeringSession]:
    with _LOCK:
        return list(_STORE.values())


def _natural_flow_rate(session: BunkeringSession) -> float:
    """MT/h flow rate for the demo tick.

    Singapore VLSFO barges run roughly 400–700 MT/h. We pick a rate that
    lets a typical 500 MT delivery finish in ~45 min of wall-clock demo
    time — fast enough to watch but slow enough to feel like a real run.
    The rate also tapers off near the end so the curve looks realistic
    instead of a straight ramp that abruptly stops.
    """
    target = max(1.0, session.bdn_qty_mt)
    remaining_pct = max(0.0, 1.0 - (session.mfm_qty_mt / target))
    # 0–80%: cruise. 80–100%: taper to ~25% of cruise.
    base = target / 0.75 if target > 50 else 60.0  # finish in ~45 wall-clock mins of ticks
    if remaining_pct < 0.20:
        return base * (0.25 + 0.75 * (remaining_pct / 0.20))
    return base


def tick(
    session_id: str,
    *,
    dt_seconds: float = 5.0,
    now: Optional[datetime] = None,
) -> BunkeringSession:
    """Advance the bunkering by `dt_seconds` of simulated time.

    Appends one MFM packet, bumps `mfm_qty_mt`, and auto-finalises when
    we reach (or overshoot) the BDN target. No-op for non-active sessions
    so the dashboard can keep calling it on every rerun without guards.
    """
    with _LOCK:
        session = _STORE.get(session_id)
        if session is None or not session.is_active:
            return session  # type: ignore[return-value]

        now = now or datetime.now(timezone.utc)
        rate = _natural_flow_rate(session)
        added = rate * (dt_seconds / 3600.0)

        # Clamp so we never overshoot the BDN target during normal flow —
        # overshoot is a real-world signal we leave for the attack injectors.
        remaining = max(0.0, session.bdn_qty_mt - session.mfm_qty_mt)
        added = min(added, remaining)

        session.mfm_qty_mt = round(session.mfm_qty_mt + added, 3)
        session.last_tick_at = now
        # First packet ever → flip out of un-bunked into actively flowing.
        if session.status == "PENDING":
            session.status = "BUNKERING"
            session.notes = "Bunkering in progress — MFM stream live."

        packet = MFMTick(
            seq_no=len(session.mfm_stream) + 1,
            timestamp=now,
            flow_rate_mt_h=round(rate, 2),
            cumulative_mt=session.mfm_qty_mt,
            density_15c_kg_m3=session.density_15c,
        )
        session.mfm_stream.append(packet)

        # Auto-finalise when essentially complete (within 1 kg of target).
        if session.bdn_qty_mt > 0 and remaining <= 0.001:
            session.status = "COMPLETED"
            session.end_time = now.strftime("%H:%M")

    _emit(session)
    return session


def append_packet(
    session_id: str,
    *,
    flow_rate_mt_h: float,
    delta_mt: float,
    density_15c_kg_m3: Optional[float] = None,
    now: Optional[datetime] = None,
) -> BunkeringSession:
    """Append a real MFM packet (production path — not the demo ticker).

    Use this when wiring an actual Coriolis stream into the orchestrator;
    the dashboard uses `tick()` instead so judges can watch the line move.
    """
    with _LOCK:
        session = _STORE.get(session_id)
        if session is None:
            raise KeyError(session_id)
        if not session.is_active:
            raise RuntimeError(f"Session {session_id} is {session.status}, not BUNKERING.")

        now = now or datetime.now(timezone.utc)
        session.mfm_qty_mt = round(session.mfm_qty_mt + delta_mt, 3)
        session.last_tick_at = now
        if session.status == "PENDING":
            session.status = "BUNKERING"
            session.notes = "Bunkering in progress — MFM stream live."
        packet = MFMTick(
            seq_no=len(session.mfm_stream) + 1,
            timestamp=now,
            flow_rate_mt_h=flow_rate_mt_h,
            cumulative_mt=session.mfm_qty_mt,
            density_15c_kg_m3=density_15c_kg_m3 or session.density_15c,
        )
        session.mfm_stream.append(packet)

    _emit(session)
    return session


def finalize_session(session_id: str, *, halted: bool = False) -> BunkeringSession:
    """Stop ticking and mark the session COMPLETED (or HALTED)."""
    with _LOCK:
        session = _STORE.get(session_id)
        if session is None:
            raise KeyError(session_id)
        session.status = "HALTED" if halted else "COMPLETED"
        session.end_time = datetime.now(timezone.utc).strftime("%H:%M")

    _emit(session)
    return session


def reset_store() -> None:
    """Test helper — wipe the in-memory store."""
    with _LOCK:
        _STORE.clear()


def to_bdn_doc_from_session(session: BunkeringSession):
    """Convenience: produce a `BDNDoc` from the session for the existing pipeline."""
    return to_bdn_doc({
        "bdn_ref": session.bdn_ref,
        "grade": session.fuel_grade,
        "qty_mt": session.bdn_qty_mt,
        "density_15c_kg_m3": session.density_15c,
        "viscosity_50c_cst": 0.0,
        "sulphur_pct": 0.0,
        "flash_point_c": 0.0,
        "biofuel_pct": 0.0,
        "sample_seal": None,
        "supplier_signed": True,
        "officer_signed": False,
        "ebdn_status": "MISSING",
        "delivery_date": session.delivery_date,
        "time_start": session.start_time,
        "time_end": session.end_time or session.start_time,
    })


__all__ = [
    "BunkeringSession",
    "MFMTick",
    "append_packet",
    "finalize_session",
    "get_session",
    "list_active",
    "list_all",
    "reset_store",
    "set_persistence_sink",
    "start_session",
    "tick",
    "to_bdn_doc_from_session",
]
