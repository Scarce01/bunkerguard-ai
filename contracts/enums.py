"""Shared enums + canonical rule registry for BunkerGuard contracts (v0.3).

Rule taxonomy is the single source of truth — IDs, names, severities, and
regulatory citations live here so Stage 2 detectors, Stage 3 scorers, and
Stage 4 LLM copilot all speak the same language.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Dict


class FuelGrade(str, Enum):
    VLSFO_RMG_380 = "VLSFO RMG 380"
    HSFO_RMG_380 = "HSFO RMG 380"
    MGO_DMA = "MGO DMA"
    LSMGO_DMA = "LSMGO DMA"
    B24_VLSFO = "B24-VLSFO"
    B30_VLSFO = "B30-VLSFO"


class Port(str, Enum):
    SINGAPORE = "Singapore"


class EBDNStatus(str, Enum):
    VERIFIED = "VERIFIED"
    INVALID_SIGNATURE = "INVALID_SIGNATURE"
    MISMATCH = "MISMATCH"
    MISSING = "MISSING"
    EXPIRED_CERT = "EXPIRED_CERT"


class Severity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class RuleId(str, Enum):
    A01 = "A01"  # Quantity Trajectory Deviation
    A02 = "A02"  # Quantity Final Mismatch
    A03 = "A03"  # Density Deviation
    A04 = "A04"  # Flow Rate Anomaly
    A05 = "A05"  # Reverse Flow
    A06 = "A06"  # Meter Fault
    A07 = "A07"  # Meter Health
    A08 = "A08"  # Sulphur Non-Compliance
    A09 = "A09"  # Flash Point Violation
    A10 = "A10"  # Grade Mismatch
    A11 = "A11"  # Vessel Name Mismatch
    A12 = "A12"  # Vessel IMO Mismatch
    A13 = "A13"  # Location Mismatch
    A14 = "A14"  # Barge Proximity
    A15 = "A15"  # Supplier Unlicensed
    A16 = "A16"  # Missing Signature
    A19 = "A19"  # Invoice Quantity Mismatch
    A21 = "A21"  # Sample Seal Mismatch
    SEC01 = "SEC01"  # e-BDN Authenticity
    SEC02 = "SEC02"  # MFM Stream Integrity
    A_CAP = "A_CAP"      # Cappuccino bunkering (air-injection physics)
    A_VEF = "A_VEF"      # Vessel Experience Factor anomaly (crew skimming)
    A_CCAI = "A_CCAI"    # CCAI ignition-quality (catalyst-fines / cat-poisoning)
    A_ROB = "A_ROB"      # Sounding tape / ROB cross-check mismatch


class EvidenceType(str, Enum):
    MFM_PACKET = "MFM_PACKET"
    BDN_DOC = "BDN_DOC"
    EBDN_SIGNATURE = "EBDN_SIGNATURE"
    SUPPLIER_REGISTRY = "SUPPLIER_REGISTRY"
    BARGE_REGISTRY = "BARGE_REGISTRY"
    VESSEL_REGISTRY = "VESSEL_REGISTRY"
    AIS_POSITION = "AIS_POSITION"
    GEOFENCE = "GEOFENCE"
    FUEL_SPEC = "FUEL_SPEC"
    INVOICE = "INVOICE"
    SAMPLE_SEAL = "SAMPLE_SEAL"
    HISTORICAL_TX = "HISTORICAL_TX"
    FUEL_PRICE = "FUEL_PRICE"
    IAPP_CERTIFICATE = "IAPP_CERTIFICATE"      # MARPOL Annex VI Reg. 6 — proves scrubber
    METER_CAL_CERT = "METER_CAL_CERT"          # OIML R 117-1 calibration certificate
    BARGE_AIS = "BARGE_AIS"                    # MMSI-tracked barge position
    EVIDENCE_SOUNDING = "EVIDENCE_SOUNDING"    # Vessel sounding tape / ROB record
    VEF_RECORD = "VEF_RECORD"                  # Vessel Experience Factor history

class RiskCategory(str, Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"


class Verdict(str, Enum):
    SIGN = "SIGN"
    SIGN_WITH_NOTES = "SIGN_WITH_NOTES"
    SIGN_WITH_LOP = "SIGN_WITH_LOP"
    REFUSE_TO_SIGN = "REFUSE_TO_SIGN"
    PENDING = "PENDING"        # in-flight (no final BDN), trajectory monitoring
    DISPUTED = "DISPUTED"      # supplier contested the verdict; BIMCO dispute resolution open


class FlowDirection(str, Enum):
    FORWARD = "FORWARD"
    REVERSE = "REVERSE"


class StreamStatusCode(str, Enum):
    OK = "OK"
    WARN = "WARN"
    FAULT = "FAULT"


# ---------- canonical rule registry ----------

@dataclass(frozen=True)
class RuleSpec:
    rule_id: RuleId
    name: str
    default_severity: Severity
    regulatory_basis: str
    citation: str
    base_confidence: float = 0.95


RULE_REGISTRY: Dict[RuleId, RuleSpec] = {
    RuleId.A01: RuleSpec(RuleId.A01, "Quantity Trajectory Deviation", Severity.HIGH,
        "MEPC.1/Circ.891 — MFM Guidelines",
        "Cumulative MFM vs expected trajectory > 1.5% mid-bunkering.", 0.88),
    RuleId.A02: RuleSpec(RuleId.A02, "Quantity Final Mismatch", Severity.CRITICAL,
        "MEPC.1/Circ.891 para 4.2 / SS 648:2019",
        "Final MFM vs BDN deviation > 0.5%; > 3% triggers CRITICAL floor.", 0.98),
    RuleId.A03: RuleSpec(RuleId.A03, "Density Deviation", Severity.MEDIUM,
        "ISO 8217:2024 Table 2",
        "MFM density_15c vs BDN > ±2 kg/m³ tolerance.", 0.92),
    RuleId.A04: RuleSpec(RuleId.A04, "Flow Rate Anomaly", Severity.MEDIUM,
        "MEPC.1/Circ.891 para 5.3",
        "Zero flow > 120s requires documented justification.", 0.90),
    RuleId.A05: RuleSpec(RuleId.A05, "Reverse Flow", Severity.CRITICAL,
        "MEPC.1/Circ.891 Annex III",
        "Any FORWARD→REVERSE transition during delivery.", 0.99),
    RuleId.A06: RuleSpec(RuleId.A06, "Meter Fault", Severity.CRITICAL,
        "SS 648:2019 Clause 7",
        "Status code FAULT = meter alarm; delivery suspended.", 0.99),
    RuleId.A07: RuleSpec(RuleId.A07, "Meter Health", Severity.MEDIUM,
        "OIML R 117-1 (2007)",
        "Drive gain > 30% or tube frequency deviation > 2%.", 0.85),
    RuleId.A08: RuleSpec(RuleId.A08, "Sulphur Non-Compliance", Severity.CRITICAL,
        "MARPOL Annex VI Reg. 14",
        "0.50% global cap (outside ECA); 0.10% within SECA/ECA.", 0.99),
    RuleId.A09: RuleSpec(RuleId.A09, "Flash Point Violation", Severity.CRITICAL,
        "SOLAS Reg. II-2/4.2.1",
        "Minimum 60°C flash point (closed cup) for marine fuels.", 0.99),
    RuleId.A10: RuleSpec(RuleId.A10, "Grade Mismatch", Severity.CRITICAL,
        "ISO 8217:2024 / Charter Party",
        "BDN grade must match Bunker Requisition Form (BRF) order.", 0.97),
    RuleId.A11: RuleSpec(RuleId.A11, "Vessel Name Mismatch", Severity.HIGH,
        "IMO FAL Convention",
        "BDN vessel name must match AIS / charter party.", 0.90),
    RuleId.A12: RuleSpec(RuleId.A12, "Vessel IMO Mismatch", Severity.CRITICAL,
        "SOLAS V/19 (AIS mandatory)",
        "BDN IMO must match vessel registered IMO (7-digit).", 0.99),
    RuleId.A13: RuleSpec(RuleId.A13, "Location Mismatch", Severity.HIGH,
        "MPA VTIS Port Limits",
        "Vessel must lie within declared anchorage geofence.", 0.85),
    RuleId.A14: RuleSpec(RuleId.A14, "Barge Proximity", Severity.HIGH,
        "MEPC.1/Circ.891 para 5.1",
        "Barge–vessel separation > 500m suggests no actual delivery.", 0.80),
    RuleId.A15: RuleSpec(RuleId.A15, "Supplier Unlicensed", Severity.CRITICAL,
        "MPA Bunkering Act (Cap.170A)",
        "Supplier must hold valid MPA bunker licence on delivery date.", 1.00),
    RuleId.A16: RuleSpec(RuleId.A16, "Missing Signature", Severity.HIGH,
        "MARPOL Annex VI Reg. 18(9)",
        "BDN must be signed by supplier representative AND receiving officer.", 0.99),
    RuleId.A19: RuleSpec(RuleId.A19, "Invoice Quantity Mismatch", Severity.HIGH,
        "UNCITRAL Model Law / SS 524",
        "Invoice quantity vs BDN delivered quantity must agree.", 0.95),
    RuleId.A21: RuleSpec(RuleId.A21, "Sample Seal Mismatch", Severity.HIGH,
        "MARPOL Annex VI Reg. 18(8.2)",
        "MARPOL fuel sample seal must match BDN sample reference.", 0.99),
    RuleId.SEC01: RuleSpec(RuleId.SEC01, "e-BDN Authenticity", Severity.CRITICAL,
        "MPA Digital Bunkering Standard / SS 660",
        "e-BDN signature / QR must verify against issuing authority.", 1.00),
    RuleId.SEC02: RuleSpec(RuleId.SEC02, "MFM Stream Integrity", Severity.CRITICAL,
        "OIML R 117-1 / MEPC.1/Circ.891",
        "MFM packets must carry valid HMAC and contiguous sequence numbers.", 0.99),
    RuleId.A_CAP: RuleSpec(RuleId.A_CAP, "Cappuccino Bunkering (air injection)", Severity.CRITICAL,
        "MEPC.1/Circ.891 §6 / Singapore CRIMINAL Bunkering Investigations 2017",
        "Aerated fuel signature: density_op deviates from density_15c beyond thermal-expansion physics, "
        "or short drive-gain/tube-frequency spikes during stable-flow window.", 0.90),
    RuleId.A_VEF: RuleSpec(RuleId.A_VEF, "Vessel Experience Factor Anomaly", Severity.HIGH,
        "OCIMF VEF Guidelines / API MPMS Ch.17",
        "VEF for this delivery deviates > 2σ from vessel's 6-bunker rolling baseline; "
        "signal of crew skimming or supplier collusion.", 0.85),
    RuleId.A_CCAI: RuleSpec(RuleId.A_CCAI, "CCAI / Ignition Quality", Severity.HIGH,
        "ISO 8217:2024 §5.4 / CIMAC No.25",
        "CCAI = D - 140.7·log₁₀(log₁₀(V+0.85)) - 80.6 must be ≤ 870 for residual fuels; "
        "high CCAI = poor ignition, hard-starting, catalyst fines damage.", 0.95),
    RuleId.A_ROB: RuleSpec(RuleId.A_ROB, "ROB / Sounding-Tape Mismatch", Severity.CRITICAL,
        "ISGOTT 6th Ed. §11.1 / OCIMF Ship-to-Ship Transfer Guide",
        "Independent ROB after − ROB before must equal MFM cumulative within 0.3%; "
        "larger gap proves either MFM tampered or short delivery.", 0.97),
}


SEVERITY_SCORE: Dict[Severity, int] = {
    Severity.LOW: 3,
    Severity.MEDIUM: 10,
    Severity.HIGH: 22,
    Severity.CRITICAL: 40,
}

RISK_BANDS = [
    (0, 20, RiskCategory.LOW),
    (21, 45, RiskCategory.MODERATE),
    (46, 70, RiskCategory.HIGH),
    (71, 100, RiskCategory.CRITICAL),
]


def rule_name(rid: RuleId) -> str:
    return RULE_REGISTRY[rid].name


def rule_basis(rid: RuleId) -> str:
    return RULE_REGISTRY[rid].regulatory_basis
