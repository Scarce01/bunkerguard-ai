"""Stage 2 → Stage 3 contract.

Output of the Anomaly Detection stage. One AnomalyReport per session.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from .enums import EvidenceType, RuleId, Severity


class EvidenceRef(BaseModel):
    """Pointer to the raw data that proved the anomaly."""
    type: EvidenceType
    ref: str  # e.g. MFM seq_no, BDN ref, sha256, supplier_id
    detail: Optional[str] = None


class Anomaly(BaseModel):
    anomaly_id: str = Field(..., pattern=r"^ANO-\d{4}-[A-Z0-9]{3,6}$")
    session_id: str
    rule: RuleId
    rule_name: str
    severity: Severity
    timestamp: datetime  # when detected, UTC

    measured: Optional[float] = None
    reference: Optional[float] = None
    deviation_value: Optional[float] = None
    deviation_pct: Optional[float] = None
    unit: Optional[str] = None  # "MT", "%", "kg/m³", ...

    description: str
    regulatory_basis: Optional[str] = Field(None, description="e.g. 'MARPOL Annex VI Reg. 14'")
    citation: Optional[str] = Field(None, description="Specific threshold text from the standard.")
    evidence_refs: List[EvidenceRef] = []
    confidence: float = Field(1.0, ge=0.0, le=1.0)

    acknowledged: bool = False
    resolved: bool = False


class DataQuality(BaseModel):
    mfm_coverage_pct: float = Field(..., ge=0, le=100)
    bdn_completeness_pct: float = Field(..., ge=0, le=100)
    ebdn_status: str
    ais_status: str  # "JOINED", "REFERENCE_ONLY", "MISSING"
    insufficient_data: bool = False
    reasons: List[str] = []  # why insufficient, if true


class AnomalyReport(BaseModel):
    """Stage 2 output."""
    model_config = ConfigDict(extra="forbid")

    schema_version: str = "0.2"
    session_id: str
    generated_at: datetime
    anomalies: List[Anomaly] = []
    data_quality: DataQuality

    # roll-ups (cheap to compute, expensive to recompute downstream)
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0

    # --- chain-of-custody ---
    parent_sha256: Optional[str] = Field(None, description="sha256 of the Stage 1 SessionInput payload this report was derived from. Stage 3 MUST verify.")
    signed_by: Optional[str] = None
    signature: Optional[str] = None

    # opaque debugging payload, never used for business logic
    debug: Dict[str, Any] = {}
