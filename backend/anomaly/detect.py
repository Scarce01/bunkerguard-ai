"""Stage 2 detector entry point — runs all rules, builds AnomalyReport."""
from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone
from typing import List

from contracts import (
    Anomaly,
    AnomalyReport,
    DataQuality,
    EvidenceRef,
    SessionInput,
    Severity,
    compute_payload_sha256,
)
from policy import TOL

from . import rules

log = logging.getLogger("bunkerguard.anomaly")


def _stable_anomaly_id(session_id: str, rule_value: str, refs: List[EvidenceRef]) -> str:
    seed = f"{session_id}|{rule_value}|" + "|".join(f"{r.type.value}:{r.ref}" for r in refs)
    h = hashlib.sha256(seed.encode()).hexdigest()[:6].upper()
    year = session_id.split("-")[1] if "-" in session_id else "0000"
    return f"ANO-{year}-{h}"


def _data_quality(s: SessionInput) -> DataQuality:
    coverage = 100.0 if s.mfm_stream and len(s.mfm_stream) >= TOL.min_mfm_packets else (
        len(s.mfm_stream) / max(1, TOL.min_mfm_packets) * 100.0)
    coverage = min(100.0, coverage)
    completeness = 100.0 if (s.bdn.supplier_signed and s.bdn.officer_signed) else 50.0
    ais_status = "JOINED" if s.ais else "REFERENCE_ONLY"
    reasons: list[str] = []
    if coverage < TOL.mfm_min_coverage_pct:
        reasons.append(f"MFM coverage {coverage:.0f}% below {TOL.mfm_min_coverage_pct:.0f}% threshold")
    if completeness < TOL.bdn_min_completeness_pct:
        reasons.append("BDN signatures incomplete")
    if not s.mfm_stream and not s.in_flight:
        reasons.append("Final session with no MFM stream")
    # Only mark insufficient when there is no MFM stream at all and the
    # session is final. Short/partial streams still produce a score; the
    # SEC02 rule will capture integrity defects separately.
    insufficient = ((not s.mfm_stream) or s.is_halted) and not s.in_flight
    return DataQuality(
        mfm_coverage_pct=round(coverage, 1),
        bdn_completeness_pct=completeness,
        ebdn_status=s.bdn.ebdn_status.value,
        ais_status=ais_status,
        insufficient_data=insufficient,
        reasons=reasons,
    )


def run(session: SessionInput) -> AnomalyReport:
    found: List[Anomaly] = []
    for fn in rules.ALL_RULES:
        try:
            for raw in fn(session):
                raw.setdefault("session_id", session.session_id)
                raw["anomaly_id"] = _stable_anomaly_id(
                    session.session_id, raw["rule"].value, raw.get("evidence_refs", []))
                anom = Anomaly.model_validate(raw)
                found.append(anom)
                log.info("anomaly_fired", extra={
                    "session_id": session.session_id,
                    "rule": anom.rule.value,
                    "severity": anom.severity.value,
                    "confidence": anom.confidence,
                })
        except Exception as e:  # do not let one bad rule sink the report
            log.exception("rule_error", extra={"rule_fn": fn.__name__, "error": str(e)})

    counts = {Severity.CRITICAL: 0, Severity.HIGH: 0, Severity.MEDIUM: 0, Severity.LOW: 0}
    for a in found:
        counts[a.severity] += 1

    report = AnomalyReport(
        session_id=session.session_id,
        generated_at=datetime.now(timezone.utc),
        anomalies=found,
        data_quality=_data_quality(session),
        critical_count=counts[Severity.CRITICAL],
        high_count=counts[Severity.HIGH],
        medium_count=counts[Severity.MEDIUM],
        low_count=counts[Severity.LOW],
        parent_sha256=compute_payload_sha256(session.model_dump(mode="json")),
        signed_by="stage2-detector",
    )
    return report
