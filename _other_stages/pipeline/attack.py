"""Live attack injection — mutates a SessionInput to demonstrate detection.

Each function returns a NEW SessionInput; the original is untouched. Used by
the dashboard's "Inject attack" sidebar to show fraud detection in real time.
"""
from __future__ import annotations

from contracts import MFMPacket, SessionInput, sha256_hex, sign_packet, canonical_json


def _resign_chain(stream: list[MFMPacket]) -> list[MFMPacket]:
    """Recompute prev_packet_sha256 chain + HMAC for every packet (post-mutation)."""
    out: list[MFMPacket] = []
    prev_hash = None
    for p in stream:
        body = p.model_dump(mode="json")
        body["prev_packet_sha256"] = prev_hash
        body["packet_hmac"] = "0" * 64  # placeholder
        rebuilt = MFMPacket(**body)
        signing_view = rebuilt.model_dump(mode="json")
        real_hmac = sign_packet(signing_view, p.meter_serial)
        signed = rebuilt.model_copy(update={"packet_hmac": real_hmac})
        out.append(signed)
        prev_hash = sha256_hex(canonical_json(signed.model_dump(mode="json")))
    return out


def inject_cappuccino(session: SessionInput, *, intensity: float = 0.8) -> SessionInput:
    """Simulate air injection during the middle 40% of delivery.

    Effects (consistent with real Coriolis-meter cappuccino signatures):
      * density_op drops by ~6 kg/m³ (air lowers apparent density)
      * drive_gain spikes to ~25% (tubes need more excitation against compressible medium)
      * tube_freq jitters
    Stream is re-signed so HMAC stays valid; the FRAUD shows in physics, not crypto.
    """
    if not session.mfm_stream:
        return session
    n = len(session.mfm_stream)
    lo, hi = int(n * 0.3), int(n * 0.7)
    new_stream: list[MFMPacket] = []
    for i, p in enumerate(session.mfm_stream):
        if lo <= i < hi:
            new_stream.append(p.model_copy(update={
                "density_op_kg_m3": max(0.0, p.density_op_kg_m3 - 6.0 * intensity),
                "drive_gain_pct": min(100.0, p.drive_gain_pct + 22.0 * intensity),
                "tube_freq_hz": p.tube_freq_hz * (1.0 + 0.02 * intensity),
            }))
        else:
            new_stream.append(p)
    new_stream = _resign_chain(new_stream)
    return session.model_copy(update={"mfm_stream": new_stream})


def inject_short_delivery(session: SessionInput, *, pct: float = 2.5) -> SessionInput:
    """Simulate the supplier's MFM under-reporting flow by `pct`% — vessel
    sounding (untouched) will disagree, A_ROB fires."""
    if not session.mfm_stream:
        return session
    factor = 1.0 - pct / 100.0
    new_stream = [p.model_copy(update={
        "flow_rate_mt_h": p.flow_rate_mt_h * factor,
        "cumulative_mt": p.cumulative_mt * factor,
    }) for p in session.mfm_stream]
    new_stream = _resign_chain(new_stream)
    new_qty = new_stream[-1].cumulative_mt
    return session.model_copy(update={
        "mfm_stream": new_stream,
        "mfm_qty_mt": new_qty,
        "deviation_mt": new_qty - session.bdn_qty_mt,
        "deviation_pct": ((new_qty - session.bdn_qty_mt) / session.bdn_qty_mt * 100.0)
                          if session.bdn_qty_mt else 0.0,
    })


def inject_meter_tamper(session: SessionInput) -> SessionInput:
    """Corrupt one packet's HMAC mid-stream — SEC02 must catch it."""
    if len(session.mfm_stream) < 5:
        return session
    new_stream = list(session.mfm_stream)
    target = len(new_stream) // 2
    p = new_stream[target]
    new_stream[target] = p.model_copy(update={
        "packet_hmac": "deadbeef" * 8,  # 64-hex garbage
    })
    return session.model_copy(update={"mfm_stream": new_stream})
