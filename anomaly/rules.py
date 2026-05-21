"""Stage 2 anomaly rule library — complete BunkerGuard taxonomy.

Each rule is a pure function:  (SessionInput) -> list[dict]
Returned dicts get wrapped into typed `Anomaly` objects by `detect.run`.

Design principles:
  * Pure, deterministic, no I/O.
  * Citations + regulatory_basis pulled from RULE_REGISTRY (single source).
  * Confidence calibrated per rule; reduced when input data is uncertain.
  * Evidence references are STRUCTURED (typed + ref ID), never free text.
"""
from __future__ import annotations

import math
import statistics
from typing import Callable, List

from contracts import (
    EBDNStatus,
    EvidenceRef,
    EvidenceType,
    FlowDirection,
    RULE_REGISTRY,
    RuleId,
    SessionInput,
    Severity,
    StreamStatusCode,
    canonical_json,
    sha256_hex,
    verify_packet_hmac,
)
from policy import TOL

RuleFn = Callable[[SessionInput], List[dict]]


_EARTH_R_M = 6_371_000.0


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in metres (WGS-84 sphere approx)."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * _EARTH_R_M * math.asin(math.sqrt(a))


def _spec(rid: RuleId):
    return RULE_REGISTRY[rid]


def _base(rid: RuleId, **overrides) -> dict:
    spec = _spec(rid)
    d = {
        "rule": rid,
        "rule_name": spec.name,
        "severity": spec.default_severity,
        "regulatory_basis": spec.regulatory_basis,
        "citation": spec.citation,
        "confidence": spec.base_confidence,
    }
    d.update(overrides)
    return d


# =========================================================== A02 final qty
def rule_a02_qty_final(s: SessionInput) -> List[dict]:
    if s.in_flight or s.is_halted or s.deviation_pct is None:
        return []
    dev = s.deviation_pct
    abs_dev = abs(dev)
    if abs_dev <= TOL.qty_dev_pct_low:
        return []
    severity = Severity.CRITICAL if abs_dev > TOL.qty_dev_pct_high else (
        Severity.HIGH if abs_dev > TOL.qty_dev_pct_medium else Severity.MEDIUM)
    return [_base(RuleId.A02,
        severity=severity,
        timestamp=s.end_ts,
        measured=s.mfm_qty_mt, reference=s.bdn_qty_mt,
        deviation_value=s.deviation_mt, deviation_pct=dev,
        unit="MT",
        description=f"Final MFM {s.mfm_qty_mt:.1f} MT vs BDN {s.bdn_qty_mt:.1f} MT (deviation {dev:+.2f}%).",
        evidence_refs=[
            EvidenceRef(type=EvidenceType.BDN_DOC, ref=s.bdn.bdn_ref),
            EvidenceRef(type=EvidenceType.MFM_PACKET,
                ref=f"{s.bdn.bdn_ref}:cumulative",
                detail=f"last_packet={s.mfm_stream[-1].seq_no}" if s.mfm_stream else None),
        ])]


# =========================================================== A01 trajectory + phase analysis
def rule_a01_trajectory(s: SessionInput) -> List[dict]:
    """Three sub-detectors: (a) per-packet deviation breach, (b) startup/shutdown
    flow anomaly, (c) nighttime cluster of breaches (22:00–05:00 local SGT)."""
    if not s.mfm_stream:
        return []
    out: List[dict] = []

    # ---- (a) trajectory deviation ----
    breaches = [p for p in s.mfm_stream
                if p.deviation_pct is not None and abs(p.deviation_pct) > TOL.qty_dev_pct_medium]
    if breaches:
        worst = max(breaches, key=lambda p: abs(p.deviation_pct or 0))
        sev = Severity.CRITICAL if abs(worst.deviation_pct or 0) > TOL.qty_dev_pct_high else Severity.HIGH
        out.append(_base(RuleId.A01,
            severity=sev,
            timestamp=worst.timestamp,
            measured=worst.cumulative_mt, reference=worst.expected_mt,
            deviation_pct=worst.deviation_pct, unit="%",
            description=f"Trajectory deviation peaked at {worst.deviation_pct:+.2f}% "
                        f"(seq {worst.seq_no}); {len(breaches)} packet(s) breached tolerance.",
            evidence_refs=[EvidenceRef(type=EvidenceType.MFM_PACKET,
                ref=f"{worst.meter_serial}:seq={worst.seq_no}",
                detail=f"flow={worst.flow_rate_mt_h:.1f} MT/h")]))

    # ---- (b) startup/shutdown phase: first/last 10% of packets ----
    n = len(s.mfm_stream)
    edge = max(1, int(n * TOL.startup_packet_pct))
    head = s.mfm_stream[:edge]
    tail = s.mfm_stream[-edge:]
    flows = [p.flow_rate_mt_h for p in s.mfm_stream if p.flow_rate_mt_h > 0]
    if flows and n >= 10:
        nominal = statistics.median(flows)
        # startup: any head packet with flow > 1.5 × nominal (sudden surge before stabilisation)
        head_anom = [p for p in head if p.flow_rate_mt_h > 1.5 * nominal]
        tail_anom = [p for p in tail if p.flow_rate_mt_h > 1.5 * nominal]
        if head_anom or tail_anom:
            p = (head_anom + tail_anom)[0]
            phase = "startup" if head_anom else "shutdown"
            out.append(_base(RuleId.A01,
                severity=Severity.MEDIUM,
                timestamp=p.timestamp,
                measured=p.flow_rate_mt_h, reference=nominal, unit="MT/h",
                description=f"Abnormal {phase}-phase flow spike at seq {p.seq_no}: "
                            f"{p.flow_rate_mt_h:.1f} MT/h vs nominal {nominal:.1f} MT/h.",
                evidence_refs=[EvidenceRef(type=EvidenceType.MFM_PACKET,
                    ref=f"{p.meter_serial}:seq={p.seq_no}", detail=f"phase={phase}")]))

    # ---- (c) nighttime cluster (UTC -> SGT = +8h; 22:00–05:00 local) ----
    if breaches:
        night = [p for p in breaches
                 if (p.timestamp.hour + 8) % 24 >= TOL.nighttime_start_h
                 or (p.timestamp.hour + 8) % 24 <= TOL.nighttime_end_h]
        if len(night) >= max(3, len(breaches) // 2):
            p = night[0]
            out.append(_base(RuleId.A01,
                severity=Severity.HIGH,
                timestamp=p.timestamp,
                description=f"Nighttime breach cluster: {len(night)}/{len(breaches)} "
                            f"deviation packets between 22:00–05:00 SGT (cappuccino-window indicator).",
                evidence_refs=[EvidenceRef(type=EvidenceType.MFM_PACKET,
                    ref=f"{p.meter_serial}:seq={p.seq_no}", detail="nighttime_cluster")]))
    return out


# =========================================================== A03 density (BDN + density-shift)
def rule_a03_density(s: SessionInput) -> List[dict]:
    """Two checks:
      * BDN-vs-MFM density delta beyond ISO 8217 tolerance.
      * Intra-stream density shift > 3 kg/m³ between consecutive packets
        (signature of mid-stream blend swap / commingling)."""
    if not s.mfm_stream:
        return []
    out: List[dict] = []

    bdn_d = s.bdn.density_15c_kg_m3
    breaches = [p for p in s.mfm_stream if abs(p.density_15c_kg_m3 - bdn_d) > TOL.density_tol_kg_m3]
    if breaches:
        worst = max(breaches, key=lambda p: abs(p.density_15c_kg_m3 - bdn_d))
        dev = worst.density_15c_kg_m3 - bdn_d
        out.append(_base(RuleId.A03,
            timestamp=worst.timestamp,
            measured=worst.density_15c_kg_m3, reference=bdn_d,
            deviation_value=dev, unit="kg/m³",
            description=f"MFM density_15c {worst.density_15c_kg_m3:.1f} vs BDN {bdn_d:.1f} (Δ {dev:+.1f} kg/m³).",
            evidence_refs=[EvidenceRef(type=EvidenceType.MFM_PACKET,
                ref=f"{worst.meter_serial}:seq={worst.seq_no}")]))

    # ---- mid-stream density shift ----
    shifts = []
    for prev, cur in zip(s.mfm_stream, s.mfm_stream[1:]):
        delta = cur.density_15c_kg_m3 - prev.density_15c_kg_m3
        if abs(delta) > TOL.density_shift_kg_m3:
            shifts.append((prev, cur, delta))
    if shifts:
        prev, cur, delta = max(shifts, key=lambda x: abs(x[2]))
        out.append(_base(RuleId.A03,
            severity=Severity.HIGH,
            timestamp=cur.timestamp,
            measured=cur.density_15c_kg_m3, reference=prev.density_15c_kg_m3,
            deviation_value=delta, unit="kg/m³",
            description=f"Mid-stream density shift {delta:+.2f} kg/m³ between seq {prev.seq_no}→{cur.seq_no} "
                        f"(blend-swap signature; {len(shifts)} pair(s) flagged).",
            evidence_refs=[
                EvidenceRef(type=EvidenceType.MFM_PACKET, ref=f"{prev.meter_serial}:seq={prev.seq_no}"),
                EvidenceRef(type=EvidenceType.MFM_PACKET, ref=f"{cur.meter_serial}:seq={cur.seq_no}"),
            ]))
    return out


# =========================================================== A04 flow gap
def rule_a04_flow_gap(s: SessionInput) -> List[dict]:
    if len(s.mfm_stream) < 2:
        return []
    gaps = []
    for prev, cur in zip(s.mfm_stream, s.mfm_stream[1:]):
        gap = (cur.timestamp - prev.timestamp).total_seconds()
        if gap > TOL.flow_zero_gap_seconds and (cur.flow_rate_mt_h == 0 or prev.flow_rate_mt_h == 0):
            gaps.append((prev, cur, gap))
    if not gaps:
        return []
    prev, cur, gap = max(gaps, key=lambda x: x[2])
    return [_base(RuleId.A04,
        timestamp=cur.timestamp,
        deviation_value=gap, unit="s",
        description=f"Zero-flow gap of {gap:.0f}s between seq {prev.seq_no} and {cur.seq_no}.",
        evidence_refs=[
            EvidenceRef(type=EvidenceType.MFM_PACKET, ref=f"{prev.meter_serial}:seq={prev.seq_no}"),
            EvidenceRef(type=EvidenceType.MFM_PACKET, ref=f"{cur.meter_serial}:seq={cur.seq_no}"),
        ])]


# =========================================================== A05 reverse flow
def rule_a05_reverse_flow(s: SessionInput) -> List[dict]:
    rev = [p for p in s.mfm_stream if p.direction == FlowDirection.REVERSE]
    if not rev:
        return []
    p = rev[0]
    return [_base(RuleId.A05,
        timestamp=p.timestamp,
        description=f"Reverse-flow detected at seq {p.seq_no} ({len(rev)} packet(s)).",
        evidence_refs=[EvidenceRef(type=EvidenceType.MFM_PACKET,
            ref=f"{p.meter_serial}:seq={p.seq_no}")])]


# =========================================================== A06 meter fault
def rule_a06_meter_fault(s: SessionInput) -> List[dict]:
    faults = [p for p in s.mfm_stream if p.status_code == StreamStatusCode.FAULT]
    if not faults:
        return []
    p = faults[0]
    return [_base(RuleId.A06,
        timestamp=p.timestamp,
        description=f"Meter FAULT status at seq {p.seq_no} ({len(faults)} packet(s)).",
        evidence_refs=[EvidenceRef(type=EvidenceType.MFM_PACKET,
            ref=f"{p.meter_serial}:seq={p.seq_no}")])]


# =========================================================== A07 meter health (z-score + calibration)
def rule_a07_meter_health(s: SessionInput) -> List[dict]:
    """Coriolis drive-gain has vendor-dependent semantics, so absolute thresholds
    are unreliable. We instead flag:
      * Statistical outliers (z-score > 3.0) within the session itself.
      * Calibration certificate overdue (`next_due` < session end_ts).
      * Fallback: any packet > absolute hard cap."""
    if not s.mfm_stream:
        return []
    out: List[dict] = []
    gains = [p.drive_gain_pct for p in s.mfm_stream]

    # ---- z-score outlier detection ----
    if len(gains) >= 5:
        mu = statistics.fmean(gains)
        sd = statistics.pstdev(gains)
        if sd > 0.01:
            outliers = [p for p in s.mfm_stream
                        if abs(p.drive_gain_pct - mu) / sd > TOL.drive_gain_zscore_alarm]
            if outliers:
                worst = max(outliers, key=lambda p: abs(p.drive_gain_pct - mu))
                z = (worst.drive_gain_pct - mu) / sd
                out.append(_base(RuleId.A07,
                    severity=Severity.HIGH,
                    timestamp=worst.timestamp,
                    measured=worst.drive_gain_pct, reference=mu,
                    deviation_value=z, unit="σ",
                    description=f"Drive-gain outlier: {worst.drive_gain_pct:.1f}% "
                                f"(z={z:+.2f}σ vs session μ={mu:.1f}%, σ={sd:.2f}); seq {worst.seq_no}.",
                    evidence_refs=[EvidenceRef(type=EvidenceType.MFM_PACKET,
                        ref=f"{worst.meter_serial}:seq={worst.seq_no}", detail="zscore_outlier")]))

    # ---- absolute hard cap ----
    bad = [p for p in s.mfm_stream if p.drive_gain_pct > TOL.drive_gain_abs_max_pct]
    if bad:
        worst = max(bad, key=lambda p: p.drive_gain_pct)
        out.append(_base(RuleId.A07,
            severity=Severity.CRITICAL,
            timestamp=worst.timestamp,
            measured=worst.drive_gain_pct, reference=TOL.drive_gain_abs_max_pct,
            unit="%",
            description=f"Drive gain {worst.drive_gain_pct:.1f}% > absolute cap {TOL.drive_gain_abs_max_pct}% (seq {worst.seq_no}).",
            evidence_refs=[EvidenceRef(type=EvidenceType.MFM_PACKET,
                ref=f"{worst.meter_serial}:seq={worst.seq_no}", detail="drive_gain_overrun")]))

    # ---- calibration certificate overdue ----
    cal = s.meter_calibration
    if cal and cal.next_due < s.end_ts:
        days_overdue = (s.end_ts - cal.next_due).days
        out.append(_base(RuleId.A07,
            severity=Severity.HIGH,
            timestamp=s.end_ts,
            measured=days_overdue, reference=0, unit="days",
            description=f"Meter calibration certificate {cal.cert_id} OVERDUE by {days_overdue} day(s) "
                        f"(due {cal.next_due.date()}).",
            evidence_refs=[EvidenceRef(type=EvidenceType.METER_CAL_CERT, ref=cal.cert_id,
                detail=f"issuer={cal.issuer}")]))
    return out


# =========================================================== A08 sulphur (scrubber-aware)
def rule_a08_sulphur(s: SessionInput) -> List[dict]:
    """MARPOL Annex VI Reg. 14:
      * Sulphur > 0.50% on a low-sulphur grade is always a violation.
      * HSFO (>0.50%) is legal only if the vessel has an IAPP-endorsed scrubber.
        A scrubber missing/expired/unendorsed escalates HSFO use to CRITICAL."""
    from contracts import FuelGrade
    cap = TOL.sulphur_global_cap_pct
    bdn_s = s.bdn.sulphur_pct
    low_sulphur_grades = {FuelGrade.VLSFO_RMG_380, FuelGrade.LSMGO_DMA,
                          FuelGrade.MGO_DMA, FuelGrade.B24_VLSFO, FuelGrade.B30_VLSFO}
    out: List[dict] = []

    # ---- low-sulphur grade exceeding cap ----
    if s.bdn.grade in low_sulphur_grades and bdn_s > cap:
        out.append(_base(RuleId.A08,
            severity=Severity.CRITICAL,
            timestamp=s.end_ts,
            measured=bdn_s, reference=cap, unit="%",
            description=f"BDN sulphur {bdn_s:.2f}% exceeds MARPOL global cap {cap}% for low-sulphur grade {s.bdn.grade.value}.",
            evidence_refs=[EvidenceRef(type=EvidenceType.BDN_DOC, ref=s.bdn.bdn_ref)]))

    # ---- HSFO without endorsed scrubber ----
    if s.bdn.grade == FuelGrade.HSFO_RMG_380 and bdn_s > cap:
        v = s.vessel
        problem = None
        if not v.has_scrubber:
            problem = "vessel has no scrubber declared"
        elif not v.scrubber_iapp_endorsed:
            problem = "scrubber not IAPP-endorsed (MEPC.1/Circ.883)"
        elif v.iapp_expiry and v.iapp_expiry < s.end_ts:
            problem = f"IAPP supplement expired {v.iapp_expiry.date()}"
        if problem:
            out.append(_base(RuleId.A08,
                severity=Severity.CRITICAL,
                timestamp=s.end_ts,
                measured=bdn_s, reference=cap, unit="%",
                description=f"HSFO {bdn_s:.2f}% S delivered but {problem}; "
                            f"MARPOL Annex VI Reg. 14 abatement requirement unmet.",
                evidence_refs=[
                    EvidenceRef(type=EvidenceType.BDN_DOC, ref=s.bdn.bdn_ref),
                    EvidenceRef(type=EvidenceType.IAPP_CERTIFICATE,
                        ref=v.iapp_certificate or f"VESSEL:{v.imo}",
                        detail=problem),
                ]))
    return out


# =========================================================== A09 flash point
def rule_a09_flash_point(s: SessionInput) -> List[dict]:
    if s.bdn.flash_point_c >= TOL.flash_point_min_c:
        return []
    return [_base(RuleId.A09,
        timestamp=s.end_ts,
        measured=s.bdn.flash_point_c, reference=TOL.flash_point_min_c, unit="°C",
        description=f"BDN flash point {s.bdn.flash_point_c:.1f}°C below SOLAS minimum {TOL.flash_point_min_c}°C.",
        evidence_refs=[EvidenceRef(type=EvidenceType.BDN_DOC, ref=s.bdn.bdn_ref)])]


# =========================================================== A10 grade mismatch
def rule_a10_grade_mismatch(s: SessionInput) -> List[dict]:
    if s.bdn.grade != s.fuel_spec.grade:
        return [_base(RuleId.A10,
            timestamp=s.end_ts,
            description=f"BDN grade '{s.bdn.grade.value}' does not match ordered '{s.fuel_spec.grade.value}'.",
            evidence_refs=[
                EvidenceRef(type=EvidenceType.BDN_DOC, ref=s.bdn.bdn_ref),
                EvidenceRef(type=EvidenceType.FUEL_SPEC, ref=s.fuel_spec.grade.value),
            ])]
    if s.fuel_spec.max_sulphur_pct and s.bdn.sulphur_pct > s.fuel_spec.max_sulphur_pct:
        return [_base(RuleId.A10,
            timestamp=s.end_ts,
            measured=s.bdn.sulphur_pct, reference=s.fuel_spec.max_sulphur_pct,
            unit="%",
            description=f"BDN sulphur {s.bdn.sulphur_pct:.2f}% exceeds grade spec max {s.fuel_spec.max_sulphur_pct:.2f}%.",
            evidence_refs=[
                EvidenceRef(type=EvidenceType.BDN_DOC, ref=s.bdn.bdn_ref),
                EvidenceRef(type=EvidenceType.FUEL_SPEC, ref=s.fuel_spec.grade.value),
            ])]
    return []


# =========================================================== A11/A12 identity
def rule_a11_vessel_name(s: SessionInput) -> List[dict]:
    """BDN does not currently carry a vessel_name field in v3 mock — A11 is enforced
    upstream by the BDN issuer and re-checked here only when the field is added."""
    bdn_name = (getattr(s.bdn, "vessel_name", "") or "").strip().upper()
    ses_name = (s.vessel.name or "").strip().upper()
    if not bdn_name or not ses_name or bdn_name == ses_name:
        return []
    return [_base(RuleId.A11,
        timestamp=s.end_ts,
        description=f"BDN vessel name '{bdn_name}' ≠ session vessel '{s.vessel.name}'.",
        evidence_refs=[
            EvidenceRef(type=EvidenceType.BDN_DOC, ref=s.bdn.bdn_ref),
            EvidenceRef(type=EvidenceType.VESSEL_REGISTRY, ref=s.vessel.imo),
        ])]


def rule_a12_imo_mismatch(s: SessionInput) -> List[dict]:
    if s.vessel.imo.startswith("0000") or len(s.vessel.imo) != 7:
        return [_base(RuleId.A12,
            timestamp=s.end_ts,
            description=f"Vessel IMO {s.vessel.imo!r} is not a valid 7-digit identifier.",
            evidence_refs=[EvidenceRef(type=EvidenceType.VESSEL_REGISTRY, ref=s.vessel.imo)])]
    return []


# =========================================================== A13/A14 location (AIS-driven)
def rule_a13_location(s: SessionInput) -> List[dict]:
    """Geofence breach: any barge AIS observation outside the declared anchorage radius."""
    if not s.geofence or not s.barge_ais:
        return []
    g = s.geofence
    outside = [obs for obs in s.barge_ais
               if _haversine_m(obs.lat, obs.lon, g.center_lat, g.center_lon) > g.radius_m]
    if not outside:
        return []
    worst = max(outside, key=lambda o: _haversine_m(o.lat, o.lon, g.center_lat, g.center_lon))
    dist = _haversine_m(worst.lat, worst.lon, g.center_lat, g.center_lon)
    return [_base(RuleId.A13,
        timestamp=worst.timestamp,
        measured=dist, reference=g.radius_m, unit="m",
        description=f"Barge AIS position {dist:.0f} m from {g.name} centroid "
                    f"(radius {g.radius_m:.0f} m); {len(outside)} ping(s) outside geofence.",
        evidence_refs=[EvidenceRef(type=EvidenceType.BARGE_AIS,
            ref=f"MMSI:{worst.mmsi}", detail=f"zone={g.zone_id}")])]


def rule_a14_barge_proximity(s: SessionInput) -> List[dict]:
    """Barge–vessel separation: AIS distance > 1000 m at any point during the session
    indicates the bunker barge is not actually alongside."""
    if not s.barge_ais:
        return []
    far = [obs for obs in s.barge_ais
           if obs.distance_to_vessel_m is not None
           and obs.distance_to_vessel_m > TOL.barge_proximity_alarm_m]
    if not far:
        return []
    worst = max(far, key=lambda o: o.distance_to_vessel_m or 0)
    return [_base(RuleId.A14,
        severity=Severity.CRITICAL,
        timestamp=worst.timestamp,
        measured=worst.distance_to_vessel_m, reference=TOL.barge_proximity_alarm_m, unit="m",
        description=f"Barge AIS {worst.distance_to_vessel_m:.0f} m from vessel "
                    f"(threshold {TOL.barge_proximity_alarm_m} m); not alongside.",
        evidence_refs=[EvidenceRef(type=EvidenceType.BARGE_AIS,
            ref=f"MMSI:{worst.mmsi}", detail="barge_not_alongside")])]


# =========================================================== A15 unlicensed supplier
def rule_a15_supplier_unlicensed(s: SessionInput) -> List[dict]:
    if not s.supplier.in_mpa_registry:
        return [_base(RuleId.A15,
            timestamp=s.end_ts,
            description=f"Supplier '{s.supplier.name}' is NOT in MPA bunker licence registry.",
            evidence_refs=[EvidenceRef(type=EvidenceType.SUPPLIER_REGISTRY, ref=s.supplier.supplier_id)])]
    if s.supplier.licence_expiry and s.supplier.licence_expiry < s.end_ts:
        return [_base(RuleId.A15,
            timestamp=s.end_ts,
            description=f"Supplier licence {s.supplier.mpa_licence} expired {s.supplier.licence_expiry.date()}.",
            evidence_refs=[EvidenceRef(type=EvidenceType.SUPPLIER_REGISTRY, ref=s.supplier.supplier_id)])]
    return []


# =========================================================== A16 signatures
def rule_a16_missing_signature(s: SessionInput) -> List[dict]:
    if s.bdn.supplier_signed and s.bdn.officer_signed:
        return []
    missing = []
    if not s.bdn.supplier_signed: missing.append("supplier")
    if not s.bdn.officer_signed:  missing.append("receiving officer")
    return [_base(RuleId.A16,
        timestamp=s.end_ts,
        description=f"BDN missing signature(s): {', '.join(missing)}.",
        evidence_refs=[EvidenceRef(type=EvidenceType.BDN_DOC, ref=s.bdn.bdn_ref)])]


# =========================================================== A19 invoice
def rule_a19_invoice(s: SessionInput) -> List[dict]:
    return []  # not in v3 mock dataset


# =========================================================== A21 sample seal
def rule_a21_seal(s: SessionInput) -> List[dict]:
    if s.bdn.sample_seal and s.bdn.sample_seal.strip():
        return []
    return [_base(RuleId.A21,
        timestamp=s.end_ts,
        description="MARPOL fuel sample seal missing or unrecorded on BDN.",
        evidence_refs=[EvidenceRef(type=EvidenceType.BDN_DOC, ref=s.bdn.bdn_ref)])]


# =========================================================== SEC01 e-BDN
def rule_sec01_ebdn(s: SessionInput) -> List[dict]:
    if s.bdn.ebdn_status == EBDNStatus.VERIFIED:
        return []
    sev = Severity.CRITICAL if s.bdn.ebdn_status in (
        EBDNStatus.INVALID_SIGNATURE, EBDNStatus.MISMATCH) else Severity.HIGH
    return [_base(RuleId.SEC01,
        severity=sev,
        timestamp=s.end_ts,
        description=f"e-BDN authenticity status: {s.bdn.ebdn_status.value}.",
        evidence_refs=[EvidenceRef(type=EvidenceType.EBDN_SIGNATURE,
            ref=s.bdn.ebdn_qr_sha256 or s.bdn.bdn_ref)])]


# =========================================================== SEC02 MFM integrity
def rule_sec02_mfm_integrity(s: SessionInput) -> List[dict]:
    """Cryptographic + sequence integrity of the MFM stream:
      * Per-packet HMAC-SHA256 verified against per-meter shared secret.
      * `prev_packet_sha256` chain: each packet's prev_hash must equal
        sha256(canonical_json(packet[i-1])).
      * Strictly increasing timestamps (no replay / re-order).
      * No sequence-number gaps; no FAULT-status packets."""
    if not s.mfm_stream:
        return [_base(RuleId.SEC02,
            timestamp=s.end_ts,
            description="No MFM packets received — stream integrity cannot be established.",
            evidence_refs=[EvidenceRef(type=EvidenceType.MFM_PACKET, ref="<no-stream>")])]

    bad_hmac: List = []
    bad_chain: List = []
    bad_ts: List = []
    fault = [p for p in s.mfm_stream if p.status_code == StreamStatusCode.FAULT]
    gaps: List = []

    prev_pkt = None
    prev_hash_expected = None
    for p in s.mfm_stream:
        # HMAC verify
        try:
            if not verify_packet_hmac(p.model_dump(mode="json")):
                bad_hmac.append(p)
        except Exception:
            bad_hmac.append(p)
        # chain hash
        if prev_hash_expected is not None and p.prev_packet_sha256 != prev_hash_expected:
            bad_chain.append(p)
        # monotonic timestamp
        if prev_pkt is not None and p.timestamp <= prev_pkt.timestamp:
            bad_ts.append(p)
        # seq gap
        if prev_pkt is not None and p.seq_no - prev_pkt.seq_no > 1:
            gaps.append((prev_pkt.seq_no, p.seq_no))
        prev_pkt = p
        prev_hash_expected = sha256_hex(canonical_json(p.model_dump(mode="json")))

    if not (bad_hmac or bad_chain or bad_ts or fault or gaps):
        return []

    parts: List[str] = []
    refs: List[EvidenceRef] = []
    if bad_hmac:
        parts.append(f"{len(bad_hmac)} HMAC failure(s)")
        refs.append(EvidenceRef(type=EvidenceType.MFM_PACKET,
            ref=f"{bad_hmac[0].meter_serial}:seq={bad_hmac[0].seq_no}", detail="hmac_invalid"))
    if bad_chain:
        parts.append(f"{len(bad_chain)} broken chain link(s)")
        refs.append(EvidenceRef(type=EvidenceType.MFM_PACKET,
            ref=f"{bad_chain[0].meter_serial}:seq={bad_chain[0].seq_no}", detail="prev_hash_mismatch"))
    if bad_ts:
        parts.append(f"{len(bad_ts)} timestamp regression(s)")
        refs.append(EvidenceRef(type=EvidenceType.MFM_PACKET,
            ref=f"{bad_ts[0].meter_serial}:seq={bad_ts[0].seq_no}", detail="timestamp_replay"))
    if fault:
        parts.append(f"{len(fault)} FAULT packet(s)")
        refs.append(EvidenceRef(type=EvidenceType.MFM_PACKET,
            ref=f"{fault[0].meter_serial}:seq={fault[0].seq_no}", detail="FAULT"))
    if gaps:
        parts.append(f"{len(gaps)} sequence gap(s)")
        refs.append(EvidenceRef(type=EvidenceType.MFM_PACKET,
            ref=f"seq_gap:{gaps[0][0]}->{gaps[0][1]}"))

    sev = Severity.CRITICAL if (bad_hmac or bad_chain or bad_ts) else Severity.HIGH
    return [_base(RuleId.SEC02,
        severity=sev,
        timestamp=s.end_ts,
        description="MFM stream integrity defects: " + "; ".join(parts) + ".",
        evidence_refs=refs)]


# =========================================================== A_CAP cappuccino bunkering
def rule_a_cap_cappuccino(s: SessionInput) -> List[dict]:
    """Aerated-fuel detection. Two physics signatures:

    (1) **Density inconsistency**: density_op should differ from density_15c only
        by thermal expansion: drho = -alpha * rho_15c * (T_op - 15), with
        alpha ~ 0.00064 /K for marine residual. Anything beyond that, with
        density_op LOWER, indicates entrained air.
    (2) **Drive-gain / tube-frequency micro-spikes**: when a slug of air passes
        the Coriolis tubes, drive_gain shoots up briefly (the tubes need more
        excitation to stay vibrating against compressible medium) and tube
        frequency jitters. We detect this with a rolling 5-packet median.
    """
    if len(s.mfm_stream) < 5:
        return []
    out: List[dict] = []

    # ---- (1) density anomaly: density_op suddenly drops vs window-median, while
    # density_15c stays flat. Air injection lowers OPERATING density (the meter
    # sees the void fraction) but the lab-derived 15°C density is unaffected.
    op_vals = [p.density_op_kg_m3 for p in s.mfm_stream]
    d15_vals = [p.density_15c_kg_m3 for p in s.mfm_stream]
    dg_vals = [p.drive_gain_pct for p in s.mfm_stream]
    # Global medians are robust if <50% of packets are contaminated; works
    # against block-wise air injection that fools rolling windows.
    op_med_global = statistics.median(op_vals)
    d15_med_global = statistics.median(d15_vals)
    dg_med_global = statistics.median(dg_vals)
    physics_violations = []
    for p in s.mfm_stream:
        op_drop = op_med_global - p.density_op_kg_m3      # +ve = abnormally light (air)
        d15_move = abs(p.density_15c_kg_m3 - d15_med_global)
        dg_spike = p.drive_gain_pct - dg_med_global       # +ve = excitation surge
        # Cappuccino footprint = density drops AND drive gain spikes AND 15°C density unchanged
        if (op_drop > TOL.cap_density_physics_max_kg_m3
                and d15_move < 0.5
                and dg_spike > 8.0):
            physics_violations.append((p, op_drop, dg_spike))
    if physics_violations:
        worst = max(physics_violations, key=lambda x: x[1])
        p, gap, dgs = worst
        out.append(_base(RuleId.A_CAP,
            severity=Severity.CRITICAL,
            timestamp=p.timestamp,
            measured=p.density_op_kg_m3, reference=op_med_global,
            deviation_value=gap, unit="kg/m³",
            description=f"Aerated-fuel signature: density_op {p.density_op_kg_m3:.1f} is "
                        f"{gap:.2f} kg/m³ below stream-median, drive_gain spiked +{dgs:.1f}% "
                        f"({len(physics_violations)} contiguous packets affected) — "
                        f"consistent with air injection (cappuccino bunkering).",
            evidence_refs=[EvidenceRef(type=EvidenceType.MFM_PACKET,
                ref=f"{p.meter_serial}:seq={p.seq_no}", detail="density+drive_gain anomaly")]))

    # ---- (2) drive-gain rolling spikes ----
    gains = [p.drive_gain_pct for p in s.mfm_stream]
    spikes = []
    W = 5
    for i, p in enumerate(s.mfm_stream):
        lo, hi = max(0, i - W), min(len(gains), i + W + 1)
        window = gains[lo:hi]
        if len(window) < 3:
            continue
        med = statistics.median(window)
        if med > 0.1 and p.drive_gain_pct > TOL.cap_drive_gain_spike_factor * med:
            spikes.append((p, p.drive_gain_pct / med))
    if spikes:
        p, ratio = max(spikes, key=lambda x: x[1])
        out.append(_base(RuleId.A_CAP,
            severity=Severity.HIGH,
            timestamp=p.timestamp,
            measured=p.drive_gain_pct, reference=ratio, unit="× window-median",
            description=f"Drive-gain micro-spike: {p.drive_gain_pct:.1f}% is "
                        f"{ratio:.1f}× the surrounding window-median (seq {p.seq_no}, "
                        f"{len(spikes)} spike(s)) — air slug passing through Coriolis tubes.",
            evidence_refs=[EvidenceRef(type=EvidenceType.MFM_PACKET,
                ref=f"{p.meter_serial}:seq={p.seq_no}", detail="drive_gain_spike")]))
    return out


# =========================================================== A_VEF vessel experience factor anomaly
def rule_a_vef_anomaly(s: SessionInput) -> List[dict]:
    """OCIMF VEF: vessel's own correction factor (delivered_loaded / BL_qty).

    A sudden deviation from a stable history is a strong signal of crew
    skimming or supplier-crew collusion (BL says 500 MT, vessel actually
    received 485 MT but signed for 500, then sells the unaccounted 15 MT).
    """
    history = s.vef_history or []
    if len(history) < TOL.vef_min_history:
        return []
    current = s.bdn.vef_factor
    if current <= 0:
        return []
    mu = statistics.fmean(history)
    sd = statistics.pstdev(history)
    if sd < 0.001:  # numerically degenerate
        return []
    z = (current - mu) / sd
    if abs(z) < TOL.vef_zscore_alarm:
        return []
    direction = "high" if z > 0 else "low"
    return [_base(RuleId.A_VEF,
        severity=Severity.HIGH,
        timestamp=s.end_ts,
        measured=current, reference=mu,
        deviation_value=z, unit="σ",
        description=f"VEF anomaly: this delivery VEF={current:.4f} is {abs(z):.2f}σ "
                    f"{direction} vs vessel's {len(history)}-bunker baseline μ={mu:.4f}, σ={sd:.4f}. "
                    f"Investigate crew-skimming / supplier-crew collusion.",
        evidence_refs=[EvidenceRef(type=EvidenceType.VEF_RECORD,
            ref=f"VESSEL:{s.vessel.imo}",
            detail=f"history_n={len(history)}; baseline μ={mu:.4f}σ={sd:.4f}")])]


# =========================================================== A_CCAI ignition quality
def rule_a_ccai(s: SessionInput) -> List[dict]:
    """CCAI = density_15c − 140.7·log₁₀(log₁₀(viscosity_50c + 0.85)) − 80.6.

    Threshold per ISO 8217:2024: residual fuels CCAI ≤ 870, distillates ≤ 850.
    High CCAI = poor ignition quality, hard-starting, catalyst-fines damage.
    This is the parameter P&I clubs use for catalyst-poisoning claims.
    """
    from contracts import FuelGrade
    d = s.bdn.density_15c_kg_m3
    v = s.bdn.viscosity_50c_cst
    if d <= 0 or v <= 0:
        return []
    try:
        ccai = d - 140.7 * math.log10(math.log10(v + 0.85)) - 80.6
    except ValueError:
        return []
    distillate_grades = {FuelGrade.MGO_DMA, FuelGrade.LSMGO_DMA}
    cap = TOL.ccai_max_distillate if s.bdn.grade in distillate_grades else TOL.ccai_max_residual
    if ccai <= cap:
        return []
    return [_base(RuleId.A_CCAI,
        severity=Severity.HIGH,
        timestamp=s.end_ts,
        measured=round(ccai, 1), reference=cap, unit="CCAI",
        description=f"CCAI {ccai:.1f} exceeds ISO 8217 cap {cap} for {s.bdn.grade.value} "
                    f"(density 15°C={d:.1f}, viscosity 50°C={v:.1f} cSt). "
                    f"Poor ignition quality — engine starting & catalyst-fines liability.",
        evidence_refs=[EvidenceRef(type=EvidenceType.BDN_DOC, ref=s.bdn.bdn_ref,
            detail=f"CCAI={ccai:.1f}")])]


# =========================================================== A_ROB sounding cross-check
def rule_a_rob(s: SessionInput) -> List[dict]:
    """The ONLY fraud-resistant qty check: vessel's independent tank measurement.

    A tampered MFM + colluding BDN can agree perfectly — but the vessel's own
    sounding tape (or radar gauge) is taken by the receiving officer with no
    supplier involvement. ISGOTT 6th Ed. §11.1 makes this the surveyor's
    primary reconciliation reference.
    """
    if not s.sounding or s.mfm_qty_mt is None:
        return []
    delivered = s.sounding.delivered_mt
    if delivered <= 0:
        return []
    gap = s.mfm_qty_mt - delivered
    gap_pct = (gap / delivered) * 100.0
    if abs(gap_pct) <= TOL.rob_mfm_max_dev_pct:
        return []
    sev = Severity.CRITICAL if abs(gap_pct) > 1.0 else Severity.HIGH
    return [_base(RuleId.A_ROB,
        severity=sev,
        timestamp=s.end_ts,
        measured=s.mfm_qty_mt, reference=delivered,
        deviation_value=gap, deviation_pct=gap_pct, unit="MT",
        description=f"MFM {s.mfm_qty_mt:.1f} MT vs vessel sounding {delivered:.1f} MT "
                    f"(Δ {gap:+.2f} MT / {gap_pct:+.2f}%) — independent measurement disagrees. "
                    f"Either MFM tampered or short delivery concealed in BDN.",
        evidence_refs=[
            EvidenceRef(type=EvidenceType.EVIDENCE_SOUNDING,
                ref=f"{s.session_id}:sounding",
                detail=f"method={s.sounding.method}; by={s.sounding.measured_by}"),
            EvidenceRef(type=EvidenceType.BDN_DOC, ref=s.bdn.bdn_ref),
        ])]


# ----------------------------------------------------------------- registry
ALL_RULES: List[RuleFn] = [
    rule_a01_trajectory,
    rule_a02_qty_final,
    rule_a03_density,
    rule_a04_flow_gap,
    rule_a05_reverse_flow,
    rule_a06_meter_fault,
    rule_a07_meter_health,
    rule_a08_sulphur,
    rule_a09_flash_point,
    rule_a10_grade_mismatch,
    rule_a11_vessel_name,
    rule_a12_imo_mismatch,
    rule_a13_location,
    rule_a14_barge_proximity,
    rule_a15_supplier_unlicensed,
    rule_a16_missing_signature,
    rule_a19_invoice,
    rule_a21_seal,
    rule_sec01_ebdn,
    rule_sec02_mfm_integrity,
    rule_a_cap_cappuccino,
    rule_a_vef_anomaly,
    rule_a_ccai,
    rule_a_rob,
]
