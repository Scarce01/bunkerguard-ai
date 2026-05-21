"""Stage 3 → Stage 4/5/6 contract.

Final risk package. Consumed by:
  - Stage 4 (LLM Copilot) → builds officer-facing recommendation
  - Stage 5 (Report / Blockchain) → anchors verdict on-chain
  - Stage 6 (Supplier Reputation) → updates supplier scores
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from .enums import RiskCategory, Verdict


class ScoreComponents(BaseModel):
    """Raw 0-100 inputs before weighting."""
    anomaly_severity: float = Field(..., ge=0, le=100)
    supplier_history: float = Field(..., ge=0, le=100)
    doc_completeness: float = Field(..., ge=0, le=100)
    realtime_quantity_risk: float = Field(..., ge=0, le=100)


class WeightedScores(BaseModel):
    """Components after applying weights."""
    anomaly_x40: float
    supplier_x25: float
    doc_x15: float
    realtime_x20: float

    @property
    def total(self) -> float:
        return self.anomaly_x40 + self.supplier_x25 + self.doc_x15 + self.realtime_x20


class FloorTrigger(BaseModel):
    """Policy floor that forced the score upward."""
    code: str  # e.g. "A02>3%", "SEC01_INVALID", "A14_LICENCE_EXPIRED"
    forced_min_score: int
    reason: str


class AuditTrace(BaseModel):
    """Everything an auditor needs to replay the decision."""
    components: ScoreComponents
    weighted: WeightedScores
    raw_weighted_sum: float
    floor_triggers: List[FloorTrigger] = []
    final_score_before_floor: float
    final_score_after_floor: float


class RiskPackage(BaseModel):
    """Stage 3 output."""
    model_config = ConfigDict(extra="forbid")

    schema_version: str = "0.2"
    session_id: str
    generated_at: datetime

    risk_score: Optional[int] = Field(None, ge=0, le=100)  # null if INSUFFICIENT_DATA
    risk_category: RiskCategory
    verdict: Verdict
    verdict_reason: str
    because: List[str] = Field(default_factory=list,
        description="Natural-language audit trail. One line per factor that drove the verdict; readable by officer or LLM.")

    estimated_impact_usd: Optional[float] = None
    similar_30d_count: int = 0

    requires_lop: bool = False
    requires_surveyor: bool = False
    requires_resample: bool = False
    escalation_path: List[str] = Field(default_factory=list,
        description="Ordered notification chain, e.g. ['Master', 'Charterer', 'P&I', 'MPA Bunkering Branch'].")
    dispute_window_hours: int = Field(72, description="BIMCO/SS 648 standard window for supplier dispute.")

    audit: AuditTrace

    # --- chain-of-custody (Stage 5 will anchor `payload_sha256` on-chain) ---
    parent_sha256: Optional[str] = Field(None, description="sha256 of the Stage 2 AnomalyReport this risk package was derived from.")
    payload_sha256: Optional[str] = Field(None, description="sha256 of THIS payload (excl. signature). Anchored on-chain by Stage 5.")
    signed_by: Optional[str] = None
    signature: Optional[str] = None
