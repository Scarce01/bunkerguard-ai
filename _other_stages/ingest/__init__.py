"""Stage 1 (mock) — load BunkerGuard v3 CSV dataset into typed SessionInput objects.

This module is what an enterprise Stage 1 (ingestion + normalization) would
produce. It is intentionally pure (no network, no clock) so the same CSVs
always yield byte-identical SessionInput payloads (replayable, signable).

When the production Stage 1 lands (Kafka / message bus consumers), replace
`load_sessions()` and the contracts stay untouched.
"""
from __future__ import annotations

import csv
import hashlib
import re
from datetime import datetime, time, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Optional

from contracts import (
    AISObservation,
    BargeAISObservation,
    BargeRef,
    BDNDoc,
    EBDNStatus,
    FlowDirection,
    FuelGrade,
    FuelSpec,
    GeofenceZone,
    HistoryStats,
    MeterCalibration,
    MFMPacket,
    Port,
    SessionInput,
    SoundingRecord,
    StreamStatusCode,
    SupplierRef,
    VesselRef,
    canonical_json,
    sha256_hex,
    sign_packet,
)

DEFAULT_DATA_DIR = Path(__file__).resolve().parent.parent / "MockDataset" / "v3"


# ============================================================ parsing helpers

def _pct(s: str) -> Optional[float]:
    if s is None or s.strip() in ("", "—", "N/A"):
        return None
    return float(s.replace("%", "").strip())


def _num(s: str) -> Optional[float]:
    if s is None or s.strip() in ("", "—", "N/A"):
        return None
    return float(re.sub(r"[^\d.\-]", "", s))


def _int(s: str) -> Optional[int]:
    v = _num(s)
    return int(v) if v is not None else None


def _bool_check(s: str) -> bool:
    return "✓" in (s or "") or s.strip().lower().startswith("yes")


def _dt(date_s: str, time_s: str, fallback: Optional[datetime] = None) -> datetime:
    """Combine 'YYYY-MM-DD' + 'HH:MM' as UTC. If time is blank, return fallback or 00:00."""
    d = datetime.strptime(date_s.strip(), "%Y-%m-%d").date()
    ts = (time_s or "").strip()
    if not ts:
        if fallback is not None:
            return fallback
        return datetime.combine(d, time(0, 0), tzinfo=timezone.utc)
    t = time.fromisoformat(ts)
    return datetime.combine(d, t, tzinfo=timezone.utc)


def _ts_utc(ts: str) -> datetime:
    """Parse ISO8601, force UTC."""
    s = ts.strip().replace("Z", "+00:00")
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _expiry(s: str) -> Optional[datetime]:
    s = (s or "").strip()
    if not s or s.upper() in {"N/A", "—"}:
        return None
    return datetime.strptime(s, "%Y-%m-%d").replace(tzinfo=timezone.utc)


def _grade(s: str) -> FuelGrade:
    s = s.strip().upper()
    mapping = {
        "VLSFO RMG 380": FuelGrade.VLSFO_RMG_380,
        "HSFO RMG 380":  FuelGrade.HSFO_RMG_380,
        "MGO DMA":       FuelGrade.MGO_DMA,
        "LSMGO DMA":     FuelGrade.LSMGO_DMA,
        "B24-VLSFO":     FuelGrade.B24_VLSFO,
        "B30-VLSFO":     FuelGrade.B30_VLSFO,
    }
    if s in mapping:
        return mapping[s]
    if "HSFO" in s: return FuelGrade.HSFO_RMG_380
    if "VLSFO" in s and "B24" in s: return FuelGrade.B24_VLSFO
    if "VLSFO" in s: return FuelGrade.VLSFO_RMG_380
    if "MGO" in s:   return FuelGrade.MGO_DMA
    raise ValueError(f"Unknown fuel grade: {s!r}")


def _ebdn(s: str) -> EBDNStatus:
    s = (s or "").strip().upper()
    if s == "VERIFIED":           return EBDNStatus.VERIFIED
    if s == "INVALID_SIGNATURE":  return EBDNStatus.INVALID_SIGNATURE
    if s == "MISMATCH":           return EBDNStatus.MISMATCH
    if s == "MISSING":            return EBDNStatus.MISSING
    if s == "EXPIRED_CERT":       return EBDNStatus.EXPIRED_CERT
    return EBDNStatus.MISSING


def _direction(s: str) -> FlowDirection:
    return FlowDirection.REVERSE if (s or "").strip().upper().startswith("REV") else FlowDirection.FORWARD


def _status(s: str) -> StreamStatusCode:
    s = (s or "").strip().upper()
    if "FAULT" in s: return StreamStatusCode.FAULT
    if "WARN"  in s: return StreamStatusCode.WARN
    return StreamStatusCode.OK


def _normalize_imo(s: str) -> str:
    """Force 7-digit IMO. Dataset has a synthetic barge IMO '0786A' — pad to 7 digits."""
    s = (s or "").strip()
    digits = re.sub(r"\D", "", s)
    if not digits:
        digits = "0000000"
    return digits.zfill(7)[:7]


def _hmac_stub(meter_serial: str, seq_no: int, packet_sha: str) -> str:
    """DEPRECATED — kept for back-compat. New code uses contracts.security.sign_packet."""
    return hashlib.sha256(f"{meter_serial}|{seq_no}|{packet_sha}".encode()).hexdigest()


def _packet_chain_hash(prev_packet: Optional[MFMPacket]) -> Optional[str]:
    if prev_packet is None:
        return None
    return sha256_hex(canonical_json(prev_packet.model_dump(mode="json")))


# ============================================================ geofence + barge AIS

_GEOFENCE_ZONES: Dict[str, GeofenceZone] = {
    "Eastern Anchorage": GeofenceZone(
        zone_id="SG_EAST", name="Eastern Anchorage",
        center_lat=1.25, center_lon=103.8833, radius_m=2000.0,
        vtis_sector="Sector 8 — VTIS Central (CH 14)"),
    "Jurong Anchorage": GeofenceZone(
        zone_id="SG_JURONG", name="Jurong Anchorage",
        center_lat=1.2847, center_lon=103.7015, radius_m=2000.0,
        vtis_sector="Sector 7 — VTIS West (CH 73)"),
}


def _load_geofences(data_dir: Path) -> Dict[str, GeofenceZone]:
    """Build {session_id -> GeofenceZone} from Anchorage_Geofences.csv."""
    out: Dict[str, GeofenceZone] = {}
    try:
        rows = list(csv.DictReader(open(data_dir / "Anchorage_Geofences.csv", encoding="utf-8")))
    except FileNotFoundError:
        return out
    for r in rows:
        name = r["anchorage"].strip()
        zone = _GEOFENCE_ZONES.get(name)
        if zone is None:
            zone = GeofenceZone(
                zone_id=name.upper().replace(" ", "_"),
                name=name,
                center_lat=float(r["latitude_n"]),
                center_lon=float(r["longitude_e"]),
                radius_m=float(r.get("geofence_radius_m") or 2000.0),
                vtis_sector=r.get("vtis_sector"))
        for tok in (r.get("used_in_workbook_sessions") or "").split(","):
            tok = tok.strip().replace("SES-", "SES-2026-")
            if tok:
                # tokens look like 'SES-001' → 'SES-2026-001'
                if not tok.startswith("SES-2026-"):
                    tok = tok.replace("SES-2026-2026-", "SES-2026-")
                out[tok] = zone
    return out


def _load_barge_ais(data_dir: Path) -> Dict[str, list[BargeAISObservation]]:
    """Synthesize one barge AIS ping per session at the geofence centre (demo).

    Real Stage 1 would join an aisstream.io WebSocket feed. For the demo we use
    the static barge→MMSI mapping in Barge_AIS_References.csv and place a single
    ping at the declared anchorage centroid.
    """
    out: Dict[str, list[BargeAISObservation]] = {}
    try:
        rows = list(csv.DictReader(open(data_dir / "Barge_AIS_References.csv", encoding="utf-8")))
    except FileNotFoundError:
        return out
    for r in rows:
        mmsi = (r.get("mmsi") or "").strip()
        lat = float(r["lat_approx"])
        lon = float(r["lon_approx"])
        for tok in (r.get("used_in_workbook_sessions") or "").split(","):
            tok = tok.strip().replace("SES-", "SES-2026-")
            if not tok:
                continue
            obs = BargeAISObservation(
                timestamp=datetime(2026, 5, 10, 6, 0, tzinfo=timezone.utc),
                lat=lat, lon=lon, mmsi=mmsi)
            out.setdefault(tok, []).append(obs)
    return out


# ============================================================ supplier lookup

def _load_suppliers(data_dir: Path) -> Dict[str, SupplierRef]:
    rows = list(csv.DictReader(open(data_dir / "Supplier_Registry.csv", encoding="utf-8")))
    out: Dict[str, SupplierRef] = {}
    for r in rows:
        name = r["Name"].strip()
        rep = _num(r.get("Rep. Score", ""))
        flag = (r.get("Flag") or "").strip().lower()
        in_registry = (r.get("MPA Licence") or "").strip().upper() != "NONE"
        if "NOT_REGISTERED" in (r.get("Flag") or "").upper() or rep is None:
            in_registry = False
        out[name] = SupplierRef(
            supplier_id=r["Supplier ID"].strip(),
            name=name,
            mpa_licence=(r.get("MPA Licence") or "").strip() or None,
            licence_expiry=_expiry(r.get("Expiry", "")),
            in_mpa_registry=in_registry,
            reputation_score=rep,
            total_sessions=_int(r.get("Total Sess.", "0")) or 0,
            mismatch_count=_int(r.get("Mismatch", "0")) or 0,
            avg_deviation_pct=_pct(r.get("Avg Dev %", "0")) or 0.0,
            critical_count=_int(r.get("Critical", "0")) or 0,
            lop_count=_int(r.get("LoPs", "0")) or 0,
            flag=flag or None,
        )
    return out


def _load_fuel_specs(data_dir: Path) -> Dict[FuelGrade, FuelSpec]:
    rows = list(csv.DictReader(open(data_dir / "Fuel_Parameters.csv", encoding="utf-8")))
    out: Dict[FuelGrade, FuelSpec] = {}
    for r in rows:
        try:
            g = _grade(r["Grade"])
        except ValueError:
            continue
        out[g] = FuelSpec(
            grade=g,
            max_density_15c_kg_m3=_num(r.get("Max Density\n(kg/m³)") or r.get("Max Density (kg/m³)", "0")) or 0,
            max_viscosity_50c_cst=_num(r.get("Max Viscosity\n50°C (cSt)") or r.get("Max Viscosity 50°C (cSt)", "0")) or 0,
            max_sulphur_pct=_pct(r.get("Max Sulphur %", "0")) or 0,
            min_flash_point_c=_num(r.get("Min Flash Pt\n(°C)") or r.get("Min Flash Pt (°C)", "0")) or 0,
            max_al_si_mg_kg=_num(r.get("Max Al+Si\n(mg/kg)") or r.get("Max Al+Si (mg/kg)", "")),
            max_ccai=_num(r.get("Max CCAI", "")),
        )
    return out


def _load_history(data_dir: Path) -> Dict[str, HistoryStats]:
    """Aggregate per-supplier-30d history. Keyed by supplier_id."""
    from collections import defaultdict
    bucket: Dict[str, list] = defaultdict(list)
    for r in csv.DictReader(open(data_dir / "Historical_Transactions.csv", encoding="utf-8")):
        bucket[r["Supplier ID"].strip()].append(r)

    out: Dict[str, HistoryStats] = {}
    for sup_id, rows in bucket.items():
        devs = [abs(_pct(r.get("Discrepancy %", "0")) or 0.0) for r in rows]
        crits = sum(1 for r in rows if (r.get("Verdict", "")).upper().startswith("REFUSE"))
        out[sup_id] = HistoryStats(
            supplier_30d_sessions=len(rows),
            supplier_30d_avg_dev_pct=sum(devs) / len(devs) if devs else 0.0,
            supplier_30d_critical_count=crits,
            similar_session_count=min(5, len(rows)),
        )
    return out


def _load_mfm(data_dir: Path) -> Dict[str, List[MFMPacket]]:
    """Group MFM packets by session_id, ordered by seq.

    For every packet we compute:
      * `prev_packet_sha256` — chain of custody back to the previous packet
      * `packet_hmac` — real HMAC-SHA256 using the per-meter shared secret
        (`contracts.security.sign_packet`). Stage 2 SEC02 verifies it.
    """
    from collections import defaultdict
    raw: Dict[str, list] = defaultdict(list)
    for r in csv.DictReader(open(data_dir / "MFM_Stream.csv", encoding="utf-8")):
        raw[r["Session ID"].strip()].append(r)

    bucket: Dict[str, List[MFMPacket]] = {}
    for sid, rows in raw.items():
        rows.sort(key=lambda r: _int(r.get("Seq No", "0")) or 0)
        packets: List[MFMPacket] = []
        prev_hash: Optional[str] = None
        for r in rows:
            seq = _int(r.get("Seq No", "0")) or 0
            meter = r.get("Meter Serial", "").strip()
            # --- build packet WITHOUT hmac so we can canonical-hash it ---
            base = dict(
                seq_no=seq,
                timestamp=_ts_utc(r["Timestamp"]),
                flow_rate_mt_h=_num(r["Flow Rate (MT/h)"]) or 0.0,
                cumulative_mt=_num(r["Cumulative (MT)"]) or 0.0,
                density_op_kg_m3=_num(r["Density Op (kg/m³)"]) or 0.0,
                density_15c_kg_m3=_num(r["Density 15°C (kg/m³)"]) or 0.0,
                temp_c=_num(r["Temp (°C)"]) or 0.0,
                drive_gain_pct=_num(r["Drive Gain (%)"]) or 0.0,
                tube_freq_hz=_num(r["Tube Freq (Hz)"]) or 0.0,
                direction=_direction(r["Direction"]),
                status_code=_status(r["Status Code"]),
                meter_serial=meter,
                expected_mt=_num(r.get("Expected (MT)", "")),
                deviation_pct=_pct(r.get("Deviation %", "")),
                prev_packet_sha256=prev_hash,
            )
            # Build packet with placeholder hmac, dump to canonical JSON form,
            # sign that exact form, then rebuild packet with the real hmac.
            tmp = MFMPacket(**base, packet_hmac="0" * 64)
            signing_view = tmp.model_dump(mode="json")
            real_hmac = sign_packet(signing_view, meter)
            pkt = tmp.model_copy(update={"packet_hmac": real_hmac})
            packets.append(pkt)
            # next iteration's chain hash = sha256 of THIS packet's canonical JSON
            prev_hash = sha256_hex(canonical_json(pkt.model_dump(mode="json")))
        bucket[sid] = packets
    return bucket


def _load_bdns(data_dir: Path) -> Dict[str, BDNDoc]:
    out: Dict[str, BDNDoc] = {}
    for r in csv.DictReader(open(data_dir / "BDN_Records.csv", encoding="utf-8")):
        sid = r["Session ID"].strip()
        start = _dt(r["Date"], r["Start"])
        end = _dt(r["Date"], r["End"], fallback=start)
        out[sid] = BDNDoc(
            bdn_ref=r["BDN Ref"].strip(),
            grade=_grade(r["Grade"]),
            qty_mt=_num(r["Qty (MT)"]) or 0.0,
            density_15c_kg_m3=_num(r["Density 15°C"]) or 0.0,
            viscosity_50c_cst=_num(r["Viscosity 50°C"]) or 0.0,
            sulphur_pct=_pct(r["Sulphur %"]) or 0.0,
            flash_point_c=_num(r["Flash Pt (°C)"]) or 0.0,
            biofuel_pct=_pct(r.get("Biofuel %", "0")) or 0.0,
            sample_seal=(r.get("Sample Seal") or "").strip() or None,
            supplier_signed=_bool_check(r.get("Supp. Signed", "")),
            officer_signed=_bool_check(r.get("Officer Signed", "")),
            ebdn_status=_ebdn(r.get("eBDN Verification", "")),
            ebdn_qr_sha256=(r.get("eBDN QR SHA256") or "").strip() or None,
            start_ts=start,
            end_ts=end,
        )
    return out


# ============================================================ main entry

def load_sessions(data_dir: Optional[Path] = None) -> List[SessionInput]:
    """Return one SessionInput per row of Sessions.csv."""
    d = data_dir or DEFAULT_DATA_DIR

    suppliers = _load_suppliers(d)
    fuel_specs = _load_fuel_specs(d)
    history = _load_history(d)
    mfm = _load_mfm(d)
    bdns = _load_bdns(d)
    geofences = _load_geofences(d)
    barge_ais_map = _load_barge_ais(d)

    sessions: List[SessionInput] = []
    for r in csv.DictReader(open(d / "Sessions.csv", encoding="utf-8")):
        sid = r["Session ID"].strip()
        sup_name = r["Supplier"].strip()
        sup = suppliers.get(sup_name) or SupplierRef(
            supplier_id="SUP-UNKNOWN", name=sup_name,
            mpa_licence=None, licence_expiry=None,
            in_mpa_registry=False, reputation_score=None,
        )

        grade = _grade(r["Fuel Grade"])
        spec = fuel_specs.get(grade) or FuelSpec(
            grade=grade, max_density_15c_kg_m3=0, max_viscosity_50c_cst=0,
            max_sulphur_pct=0, min_flash_point_c=0,
        )

        bdn = bdns.get(sid)
        if bdn is None:
            # Skip sessions with no BDN at all (none expected in v3 — every session has one)
            continue

        stream = mfm.get(sid, [])

        start = _dt(r["Date"], r["Start"])
        end = _dt(r["Date"], r["End"], fallback=start)
        duration_h = _num(r.get("Duration (h)", "0")) or 0.0

        bdn_qty = _num(r["BDN Qty (MT)"]) or 0.0
        raw_mfm_qty = _num(r["MFM Qty (MT)"])
        raw_dev_mt = _num(r.get("Dev (MT)", ""))
        raw_dev_pct = _pct(r.get("Dev %", ""))
        status = (r.get("Status") or "").strip().upper()
        verdict = (r.get("Verdict") or "").strip().upper()
        # In-flight = the bunkering operation is still streaming (ACTIVE).
        # HALTED = ended early (treat as final but data may be incomplete).
        # COMPLETED = final and clean.
        in_flight = status == "ACTIVE" or status == "IN_PROGRESS" or verdict == "PENDING"
        is_halted = status == "HALTED"

        # ---- vessel scrubber / IAPP (Stage 1 enrichment from vessel registry) ----
        # In v3 mock, any HSFO consumer is assumed scrubber-equipped with valid IAPP.
        # Real Stage 1: pulled from Equasis IAPP supplement.
        has_scrubber = (grade == FuelGrade.HSFO_RMG_380)
        iapp_id = f"IAPP-{_normalize_imo(r['Vessel IMO'])}-2026" if has_scrubber else None
        iapp_exp = datetime(2027, 12, 31, tzinfo=timezone.utc) if has_scrubber else None

        # ---- meter calibration (OIML R 117-1) ----
        meter_cal = None
        if stream:
            meter_serial = stream[0].meter_serial
            meter_cal = MeterCalibration(
                meter_serial=meter_serial,
                cert_id=f"SAC-CAL-{meter_serial}-2025",
                last_calibration=datetime(2025, 11, 15, tzinfo=timezone.utc),
                next_due=datetime(2026, 11, 15, tzinfo=timezone.utc),
                accuracy_class="0.5",
                issuer="SAC-SINGLAS",
            )

        # ---- VEF history (OCIMF) — deterministic mock seeded by IMO ----
        # Real Stage 1: pulled from vessel's bunker logbook (last 6 deliveries).
        vessel_imo = _normalize_imo(r["Vessel IMO"])
        seed = sum(ord(c) for c in vessel_imo)
        vef_history = [round(0.985 + ((seed + i * 7) % 25) * 0.0008, 4) for i in range(6)]

        # ---- Sounding / ROB independent measurement (ISGOTT §11.1) ----
        # Officer-of-the-watch reading. For honest sessions, ROB tracks the
        # actual MFM-measured delivery within tank gauging accuracy (~0.3%).
        # For fraud sessions, ROB shows the TRUTH and disagrees with MFM/BDN.
        sounding = None
        bdn_qty_for_sounding = _num(r["BDN Qty (MT)"]) or 0.0
        actual_mfm_qty = (raw_mfm_qty if raw_mfm_qty is not None
                          else (stream[-1].cumulative_mt if stream else 0.0))
        if bdn_qty_for_sounding > 0 and actual_mfm_qty > 0:
            verdict_hint = (r.get("Verdict") or "").strip().upper()
            # Fraud: vessel ROB shows actual delivery was less than what
            # MFM/BDN claimed. The 'real' delivered is somewhere between.
            if verdict_hint in ("REFUSE", "DISPUTED") or sid in ("SES-2026-008", "SES-2026-022"):
                shortfall_pct = 2.0 + ((seed + 3) % 15) * 0.2  # 2.0–5.0%
                rob_delivered = actual_mfm_qty * (1.0 - shortfall_pct / 100.0)
            else:
                # Honest: ROB ≈ MFM within tank gauging accuracy.
                noise = ((seed + 11) % 5 - 2) * 0.0006  # ±0.12%
                rob_delivered = actual_mfm_qty * (1.0 + noise)
            sounding = SoundingRecord(
                rob_before_mt=round(450.0 + (seed % 200), 1),
                rob_after_mt=round(450.0 + (seed % 200) + rob_delivered, 1),
                method="sounding_tape",
                measured_by="Chief Officer",
                tank_temp_c=round(28.0 + (seed % 8) * 0.5, 1),
            )


        if in_flight:
            mfm_qty = raw_mfm_qty  # may be None
            dev_mt = raw_dev_mt
            dev_pct = raw_dev_pct
        else:
            mfm_qty = raw_mfm_qty if raw_mfm_qty is not None else (
                stream[-1].cumulative_mt if stream else 0.0)
            dev_mt = raw_dev_mt if raw_dev_mt is not None else (mfm_qty - bdn_qty)
            dev_pct = raw_dev_pct if raw_dev_pct is not None else (
                (dev_mt / bdn_qty * 100.0) if bdn_qty else 0.0)

        sessions.append(SessionInput(
            session_id=sid,
            port=Port.SINGAPORE,
            start_ts=start,
            end_ts=end,
            duration_h=duration_h,
            vessel=VesselRef(
                name=r["Vessel"].strip(),
                imo=_normalize_imo(r["Vessel IMO"]),
                evidence_source=(r.get("Vessel Evidence Source") or "").strip() or None,
                has_scrubber=has_scrubber,
                iapp_certificate=iapp_id,
                iapp_expiry=iapp_exp,
                scrubber_iapp_endorsed=has_scrubber,
            ),
            barge=BargeRef(
                name=r["Barge"].strip(),
                imo=_normalize_imo(r["Barge IMO"]),
                mpa_licence=(r.get("MPA Licence") or "").strip() or None,
                evidence_source=(r.get("Barge Evidence Source") or "").strip() or None,
            ),
            supplier=sup,
            bdn=bdn,
            mfm_stream=stream,
            fuel_spec=spec,
            ais=[],
            history=history.get(sup.supplier_id, HistoryStats()),
            bdn_qty_mt=bdn_qty,
            mfm_qty_mt=mfm_qty,
            deviation_mt=dev_mt,
            deviation_pct=dev_pct,
            in_flight=in_flight,
            is_halted=is_halted,
            evidence_sha256=(r.get("Evidence SHA256") or "").strip() or None,
            dataset_classification=(r.get("Dataset Classification") or "").strip() or None,
            signed_by="stage1-mock-loader",
            geofence=geofences.get(sid),
            barge_ais=barge_ais_map.get(sid, []),
            meter_calibration=meter_cal,
            sounding=sounding,
            vef_history=vef_history,
        ))
    return sessions


def load_session(session_id: str, data_dir: Optional[Path] = None) -> SessionInput:
    for s in load_sessions(data_dir):
        if s.session_id == session_id:
            return s
    raise KeyError(f"Session not found: {session_id}")


__all__ = ["load_sessions", "load_session", "DEFAULT_DATA_DIR"]
