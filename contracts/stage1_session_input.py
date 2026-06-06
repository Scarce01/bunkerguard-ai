"""Stage 1 → Stage 2 contract.

The complete bunkering session bundle that Stage 2 (Anomaly Detection) consumes.
All units: MT (mass), m³ (volume), kg/m³ (density), USD (money), UTC ISO-8601 (time).
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


# ── Ingestion output type (produced by ingestion/bdn_ocr.py) ─────────────────

@dataclass
class SessionBDN:
    """Bunker Delivery Note — 22 BDN fields extracted via OCR from a physical/PDF BDN."""
    bdn_ref: str
    session_id: str
    vessel: str
    imo: int
    supplier: str
    licence: str
    barge: str
    barge_imo: str          # alphanumeric, e.g. "0786A"
    port: str
    date: str               # ISO date "2026-06-10"
    start: str              # "10:15"
    end: Optional[str]      # None while delivery is still in progress
    grade: str              # "VLSFO RMG 380"
    sulphur_pct: float      # e.g. 0.47  (not a percentage string)
    density_15c: float      # kg/m³ at 15 °C
    viscosity_50c: float    # cSt at 50 °C
    flash_point: float      # °C
    qty_mt: float           # BDN-declared quantity, metric tonnes
    sample_seal: str
    supp_signed: bool
    officer_signed: bool
    biofuel_pct: float

    def to_dict(self) -> dict:
        return asdict(self)

    def immutable_core(self) -> dict:
        """Fields that must not change after delivery — used by the hash service."""
        return {
            "bdn_ref":     self.bdn_ref,
            "imo":         self.imo,
            "licence":     self.licence,
            "barge_imo":   self.barge_imo,
            "grade":       self.grade,
            "sulphur_pct": self.sulphur_pct,
            "density_15c": self.density_15c,
            "flash_point": self.flash_point,
            "qty_mt":      self.qty_mt,
            "sample_seal": self.sample_seal,
            "date":        self.date,
            "start":       self.start,
        }

from .enums import (
    EBDNStatus,
    FlowDirection,
    FuelGrade,
    Port,
    StreamStatusCode,
)


# ---------- sub-objects ----------

class VesselRef(BaseModel):
    name: str
    imo: str = Field(..., pattern=r"^\d{7}$")
    evidence_source: Optional[str] = None  # e.g. "Equasis", "MPA"
    # ---- MARPOL Annex VI Reg. 6 / 14 ----
    has_scrubber: bool = Field(False, description="Exhaust Gas Cleaning System fitted (MARPOL Annex VI Reg. 14.4 alternative).")
    iapp_certificate: Optional[str] = Field(None, description="International Air Pollution Prevention certificate ID.")
    iapp_expiry: Optional[datetime] = None
    scrubber_iapp_endorsed: bool = Field(False, description="True only if scrubber listed on IAPP supplement.")


class BargeRef(BaseModel):
    name: str
    imo: str = Field(..., pattern=r"^\d{7}$")
    mpa_licence: Optional[str] = None
    evidence_source: Optional[str] = None


class SupplierRef(BaseModel):
    supplier_id: str
    name: str
    mpa_licence: Optional[str] = None
    licence_expiry: Optional[datetime] = None
    in_mpa_registry: bool
    reputation_score: Optional[float] = Field(None, ge=0, le=100)
    total_sessions: int = 0
    mismatch_count: int = 0
    avg_deviation_pct: float = 0.0
    critical_count: int = 0
    lop_count: int = 0
    flag: Optional[str] = None  # e.g. "watchlist", "clear"


class BDNDoc(BaseModel):
    bdn_ref: str
    grade: FuelGrade
    qty_mt: float = Field(..., ge=0)
    density_15c_kg_m3: float
    viscosity_50c_cst: float
    sulphur_pct: float
    flash_point_c: float
    biofuel_pct: float = 0.0
    sample_seal: Optional[str] = None
    supplier_signed: bool
    officer_signed: bool
    ebdn_status: EBDNStatus
    ebdn_qr_sha256: Optional[str] = None
    start_ts: datetime
    end_ts: datetime
    # ---- ISO 91-1 / ASTM D1250 corrections ----
    volume_observed_m3: Optional[float] = Field(None, description="Observed volume at delivery temperature, before VCF/VEF correction.")
    temperature_c: Optional[float] = Field(None, description="Average delivery temperature (°C).")
    vcf_table: Optional[str] = Field(None, description="ASTM/IP volume-correction table used, e.g. 'ASTM D1250 Table 54B'.")
    vef_factor: float = Field(1.0, description="Vessel Experience Factor applied (BDN qty = VEF * (volume * density). VEF=1.0 if no history).")
    vef_sample_size: int = Field(0, description="Number of historical bunkers feeding this VEF.")


class MFMPacket(BaseModel):
    seq_no: int
    timestamp: datetime
    flow_rate_mt_h: float
    cumulative_mt: float
    density_op_kg_m3: float
    density_15c_kg_m3: float
    temp_c: float
    drive_gain_pct: float
    tube_freq_hz: float
    direction: FlowDirection
    status_code: StreamStatusCode
    meter_serial: str
    expected_mt: Optional[float] = None
    deviation_pct: Optional[float] = None
    packet_hmac: str = Field(..., description="HMAC-SHA256(meter_secret, canonical_packet) hex. Bare SHA256 is recomputable and useless for SEC02.")
    prev_packet_sha256: Optional[str] = Field(None, description="Hash chain: SHA256 of previous packet, links the stream into a tamper-evident chain.")


class MeterCalibration(BaseModel):
    """OIML R 117-1 calibration certificate for the MFM in use."""
    meter_serial: str
    cert_id: str
    last_calibration: datetime
    next_due: datetime
    accuracy_class: str = Field("0.5", description="OIML accuracy class (0.3 / 0.5 / 1.0).")
    issuer: str = Field("SAC-SINGLAS", description="Issuing accreditation body.")


class GeofenceZone(BaseModel):
    """MPA-declared anchorage geofence for A13."""
    zone_id: str  # e.g. "SG_EAST", "SG_JURONG"
    name: str
    center_lat: float
    center_lon: float
    radius_m: float
    vtis_sector: Optional[str] = None


class BargeAISObservation(BaseModel):
    """AIS ping from the supply barge (MMSI-tracked)."""
    timestamp: datetime
    lat: float
    lon: float
    mmsi: str
    sog_kn: Optional[float] = None
    distance_to_vessel_m: Optional[float] = None


class FuelSpec(BaseModel):
    grade: FuelGrade
    max_density_15c_kg_m3: float
    max_viscosity_50c_cst: float
    max_sulphur_pct: float
    min_flash_point_c: float
    max_al_si_mg_kg: Optional[float] = None
    max_ccai: Optional[float] = None


class AISObservation(BaseModel):
    timestamp: datetime
    lat: float
    lon: float
    sog_kn: Optional[float] = None
    cog_deg: Optional[float] = None
    inside_geofence_id: Optional[str] = None


class HistoryStats(BaseModel):
    supplier_30d_sessions: int = 0
    supplier_30d_avg_dev_pct: float = 0.0
    supplier_30d_critical_count: int = 0
    similar_session_count: int = 0  # similar in last 30d
    # ---- multi-dimensional supplier reputation (BIMCO) ----
    supplier_on_spec_rate_pct: Optional[float] = Field(
        None, description="% of last-90d deliveries within ISO 8217 spec.")
    supplier_dispute_rate_pct: Optional[float] = Field(
        None, description="% of last-90d deliveries with formal LOP raised.")
    supplier_avg_short_pct: Optional[float] = Field(
        None, description="Mean short-delivery % (positive = systematic shortfall).")
    supplier_owner_change_90d: bool = Field(
        False, description="Beneficial owner / company-name change in last 90d (shell-company red flag).")


class SoundingRecord(BaseModel):
    """Independent vessel-side measurement (sounding tape or radar gauge).

    ROB = Remaining-On-Board. Delivered = ROB_after - ROB_before. This is the
    only fraud-resistant ground truth: even a fully-tampered MFM cannot fake
    the vessel's own tank level.
    """
    rob_before_mt: float = Field(..., description="ROB before bunkering (vessel sounding).")
    rob_after_mt: float = Field(..., description="ROB after bunkering (vessel sounding).")
    method: str = Field("sounding_tape", description="sounding_tape | radar_gauge | manual_dip.")
    measured_by: str = Field(..., description="Officer rank/name who took the reading.")
    tank_temp_c: Optional[float] = None

    @property
    def delivered_mt(self) -> float:
        return self.rob_after_mt - self.rob_before_mt


# ---------- root ----------

class SessionInput(BaseModel):
    """Full payload Stage 1 hands to Stage 2."""
    model_config = ConfigDict(extra="forbid")

    schema_version: str = "0.2"
    session_id: str = Field(..., pattern=r"^SES-\d{4}-\d{3}$")
    port: Port
    start_ts: datetime
    end_ts: datetime
    duration_h: float = Field(..., ge=0)

    vessel: VesselRef
    barge: BargeRef
    supplier: SupplierRef

    bdn: BDNDoc
    mfm_stream: List[MFMPacket]
    fuel_spec: FuelSpec

    ais: List[AISObservation] = []
    barge_ais: List[BargeAISObservation] = []
    geofence: Optional[GeofenceZone] = None
    meter_calibration: Optional[MeterCalibration] = None
    history: HistoryStats = HistoryStats()

    # ---- independent vessel measurement (fraud-resistant) ----
    sounding: Optional[SoundingRecord] = Field(
        None, description="ISGOTT 6th Ed. \u00a711.1 sounding tape / ROB record. None = vessel did not provide.")
    vef_history: List[float] = Field(
        default_factory=list,
        description="Last N (typically 6) VEF observations for this vessel; "
                    "current delivery's VEF is in bdn.vef_factor.")

    # convenience pre-computed by Stage 1
    bdn_qty_mt: float
    mfm_qty_mt: Optional[float] = None
    deviation_mt: Optional[float] = None
    deviation_pct: Optional[float] = None
    in_flight: bool = Field(False, description="True = bunkering still ongoing, no final reconciliation possible.")
    is_halted: bool = Field(False, description="True = bunkering aborted/HALTED; reconciliation impossible, treat as insufficient.")

    evidence_sha256: Optional[str] = None
    dataset_classification: Optional[str] = None  # e.g. "simulated", "real_reference"

    # --- chain-of-custody ---
    signed_by: Optional[str] = Field(None, description="Key id of the stage that produced this payload, e.g. 'stage1'.")
    signature: Optional[str] = Field(None, description="Base64 Ed25519 signature over canonical_json(payload) excluding this field.")
