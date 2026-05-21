"""BunkerGuard Policy-as-Code (v0.3).

Single source of all tunable thresholds, weights, floors, and prices used by
Stage 2 (anomaly detection) and Stage 3 (risk scoring).

Compliance / ops team edits THIS FILE only — no detector or scorer code change.
Every value is documented with the standard or commercial source it comes from.

Snapshot tagged by `POLICY_VERSION` so audit logs can pin the policy used.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict

from contracts import FuelGrade

POLICY_VERSION = "2026.05.21-r2"


# ------------------------------------------------------------------ tolerances
@dataclass(frozen=True)
class Tolerances:
    # ---- A01 / A02 quantity (MEPC.1/Circ.891 §4.2, SS 648:2019) ----
    qty_dev_pct_low: float = 0.5       # within: A02 LOW (within standard tolerance)
    qty_dev_pct_medium: float = 1.5    # above: A01 MEDIUM trajectory deviation
    qty_dev_pct_high: float = 3.0      # above: A02 CRITICAL + floor trigger
    over_delivery_pct: float = 0.5     # positive deviation > this = supplier over-delivery

    # ---- A03 density (ISO 8217:2024 Table 2) ----
    density_tol_kg_m3: float = 2.0
    density_shift_kg_m3: float = 3.0   # mid-session density jump: fuel switch / cappuccino

    # ---- A04 flow / A05 reverse / A06 fault (MEPC.1/Circ.891 §5.3, Annex III) ----
    flow_zero_gap_seconds: int = 120

    # ---- A07 meter health (OIML R 117-1) ----
    # NOTE: drive-gain semantics differ by vendor (Emerson MMI vs E+H Promass).
    # The robust check is statistical: z-score vs session baseline > 3.0 sigma.
    drive_gain_zscore_alarm: float = 3.0
    drive_gain_abs_max_pct: float = 65.0   # secondary backstop only
    tube_freq_dev_pct: float = 2.0
    meter_cal_max_age_days: int = 365      # OIML R 117-1: 12-month max interval

    # ---- A08 sulphur (MARPOL Annex VI Reg. 14) ----
    sulphur_global_cap_pct: float = 0.50   # outside ECA
    sulphur_eca_cap_pct: float = 0.10      # inside SECA/ECA

    # ---- A09 flash point (SOLAS II-2/4.2.1) ----
    flash_point_min_c: float = 60.0

    # ---- A13 / A14 location & barge (MPA VTIS, MEPC.1/Circ.891 §5.1) ----
    barge_proximity_max_m: float = 500.0
    barge_proximity_alarm_m: float = 1000.0  # beyond this = no actual delivery

    # ---- data-quality gates ----
    mfm_min_coverage_pct: float = 70.0
    bdn_min_completeness_pct: float = 80.0
    min_mfm_packets: int = 5

    # ---- session phase analysis (A01) ----
    startup_packet_pct: float = 0.10       # first 10% of packets = startup
    shutdown_packet_pct: float = 0.10      # last  10% = shutdown
    nighttime_start_h: int = 22            # local time 22:00 onwards
    nighttime_end_h: int = 5               # to 05:00

    # ---- A_CAP cappuccino bunkering (air-injection signature) ----
    # Thermal expansion of marine residual fuel: density_op should differ from
    # density_15c by predictable d(rho)/dT ~ 0.64 kg/m^3/K (ISO 91-1). When air
    # is injected, density_op drops far more than thermal physics allows.
    cap_density_physics_max_kg_m3: float = 1.5  # additional unexplained drop beyond thermal
    cap_drive_gain_spike_window: int = 60       # rolling-window seconds
    cap_drive_gain_spike_factor: float = 4.0    # spike = factor * window median
    cap_tube_freq_jitter_pct: float = 1.5       # short-window |df/f| > 1.5%

    # ---- A_VEF vessel experience factor anomaly ----
    vef_min_history: int = 6                    # OCIMF: minimum N to trust VEF
    vef_zscore_alarm: float = 2.0               # |z| > 2 vs rolling baseline

    # ---- A_CCAI ignition quality (ISO 8217 \u00a75.4 / CIMAC No.25) ----
    ccai_max_residual: float = 870.0            # residual grades max
    ccai_max_distillate: float = 850.0          # distillate grades max

    # ---- A_ROB sounding/ROB cross-check (ISGOTT 6th Ed.) ----
    rob_mfm_max_dev_pct: float = 0.3            # tank gauging accuracy ~ 0.3%


# ------------------------------------------------------------------ stepped quantity-risk thresholds
# Source: BIMCO BunkerVoy Standard Terms; P&I Club guidance; SS 648:2019 Annex A
# These are the quantity-deviation pain points actually used by surveyors:
QTY_RISK_STEPS = (
    (0.5, 5,   "Within MFM tolerance band"),
    (1.0, 25,  "Annotate; chief engineer notify"),
    (2.0, 55,  "Letter of Protest territory; P&I notify"),
    (5.0, 80,  "Severe claim; potential off-hire"),
    (10.0, 95, "Fraud-investigation trigger"),
)


# ------------------------------------------------------------------ weights
@dataclass(frozen=True)
class Weights:
    anomaly: float = 0.40
    supplier: float = 0.25
    doc: float = 0.15
    realtime: float = 0.20

    def __post_init__(self) -> None:
        total = self.anomaly + self.supplier + self.doc + self.realtime
        if abs(total - 1.0) > 1e-9:
            raise ValueError(f"Weights must sum to 1.0, got {total}")


# ------------------------------------------------------------------ floors
@dataclass(frozen=True)
class PolicyFloors:
    """If condition fires, final score is RAISED to at least the given value."""
    a02_qty_above_3pct: int = 78
    a05_reverse_flow: int = 80
    a06_meter_fault: int = 80
    a08_sulphur_exceeded: int = 85
    a09_flash_below_60c: int = 72
    a10_grade_mismatch: int = 85
    a12_imo_mismatch: int = 80
    a15_unlicensed: int = 90
    a16_missing_sig: int = 50
    sec01_ebdn_invalid: int = 85
    sec02_mfm_integrity_critical: int = 80
    a_cap_cappuccino: int = 88              # cappuccino fraud is criminal in SG
    a_vef_anomaly: int = 60                 # statistical, not deterministic
    a_ccai_off_spec: int = 70               # engine damage liability
    a_rob_mismatch: int = 82                # independent ground-truth disagreement
    supplier_flagged: int = 65
    supplier_monitoring: int = 30


# ------------------------------------------------------------------ fuel prices
# Source: Ship & Bunker Singapore (https://shipandbunker.com/prices/apac/sea/sg-sin-singapore)
# Snapshot date stamped via POLICY_VERSION
FUEL_PRICE_USD_PER_MT: Dict[FuelGrade, float] = {
    FuelGrade.VLSFO_RMG_380: 865.50,
    FuelGrade.HSFO_RMG_380:  545.00,
    FuelGrade.MGO_DMA:       785.00,
    FuelGrade.LSMGO_DMA:     785.00,
    FuelGrade.B24_VLSFO:     780.00,
    FuelGrade.B30_VLSFO:     800.00,
}


# ------------------------------------------------------------------ singletons
TOL = Tolerances()
WEIGHTS = Weights()
FLOORS = PolicyFloors()


def snapshot() -> dict:
    """Serializable policy snapshot for inclusion in audit trace."""
    return {
        "version": POLICY_VERSION,
        "weights": {"anomaly": WEIGHTS.anomaly, "supplier": WEIGHTS.supplier,
                    "doc": WEIGHTS.doc, "realtime": WEIGHTS.realtime},
        "tolerances": TOL.__dict__,
        "floors": FLOORS.__dict__,
        "fuel_prices_usd_mt": {g.value: p for g, p in FUEL_PRICE_USD_PER_MT.items()},
        "qty_risk_steps": [{"max_dev_pct": s[0], "score": s[1], "action": s[2]}
                           for s in QTY_RISK_STEPS],
    }
