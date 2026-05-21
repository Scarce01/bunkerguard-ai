"""BunkerGuard MOCK contracts (v0.1).

Replace this whole folder when the official contracts land.
Stage 2/3 should import only from `contracts.*`, never reference CSV columns directly.
"""
from .enums import (
    EBDNStatus,
    EvidenceType,
    FlowDirection,
    FuelGrade,
    Port,
    RISK_BANDS,
    RULE_REGISTRY,
    RiskCategory,
    RuleId,
    RuleSpec,
    SEVERITY_SCORE,
    Severity,
    StreamStatusCode,
    Verdict,
    rule_basis,
    rule_name,
)
from .stage1_session_input import (
    AISObservation,
    BargeAISObservation,
    BargeRef,
    BDNDoc,
    FuelSpec,
    GeofenceZone,
    HistoryStats,
    MeterCalibration,
    MFMPacket,
    SessionInput,
    SoundingRecord,
    SupplierRef,
    VesselRef,
)
from .stage2_anomaly_output import (
    Anomaly,
    AnomalyReport,
    DataQuality,
    EvidenceRef,
)
from .stage3_risk_package import (
    AuditTrace,
    FloorTrigger,
    RiskPackage,
    ScoreComponents,
    WeightedScores,
)
from .security import (
    canonical_json,
    compute_payload_sha256,
    hmac_sha256_hex,
    load_or_create_keypair,
    meter_secret,
    packet_canonical,
    sha256_hex,
    sign_packet,
    sign_payload,
    verify_chain,
    verify_packet_hmac,
    verify_payload,
)

__all__ = [
    # enums
    "EBDNStatus", "EvidenceType", "FlowDirection", "FuelGrade", "Port",
    "RISK_BANDS", "RULE_REGISTRY", "RiskCategory", "RuleId", "RuleSpec",
    "SEVERITY_SCORE", "Severity", "StreamStatusCode", "Verdict",
    "rule_basis", "rule_name",
    # stage 1
    "AISObservation", "BargeAISObservation", "BargeRef", "BDNDoc", "FuelSpec",
    "GeofenceZone", "HistoryStats", "MeterCalibration", "MFMPacket",
    "SessionInput", "SoundingRecord", "SupplierRef", "VesselRef",
    # stage 2
    "Anomaly", "AnomalyReport", "DataQuality", "EvidenceRef",
    # stage 3
    "AuditTrace", "FloorTrigger", "RiskPackage", "ScoreComponents", "WeightedScores",
    # security
    "canonical_json", "compute_payload_sha256", "hmac_sha256_hex",
    "load_or_create_keypair", "meter_secret", "packet_canonical",
    "sha256_hex", "sign_packet", "sign_payload",
    "verify_chain", "verify_packet_hmac", "verify_payload",
]

__version__ = "0.2.0-mock"
