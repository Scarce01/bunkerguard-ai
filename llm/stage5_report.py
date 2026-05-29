"""Stage 5 — Evidence report + blockchain notarization.

Generates the formal report. Hash chain anchors the BDN, MFM, and validation
payloads on the (mock) Sepolia chain so the report is tamper-evident.
"""
from __future__ import annotations

import hashlib
import json
import logging
from typing import TYPE_CHECKING

from .blockchain import write_to_chain
from .claude_client import call_claude
from .prompts.stage5_evidence import (
    OUTPUT_SCHEMA,
    SYSTEM_PROMPT,
    build_user_prompt,
)

if TYPE_CHECKING:
    from contracts import AnomalyReport, RiskPackage, SessionInput

log = logging.getLogger("bunkerguard.llm.stage5")


def _canonical_sha256(obj) -> str:
    """Stable hash — sort keys so different orderings hash identically."""
    return hashlib.sha256(
        json.dumps(obj, sort_keys=True, default=str).encode("utf-8")
    ).hexdigest()


def run_stage5(
    session: "SessionInput",
    report: "AnomalyReport",
    package: "RiskPackage",
    llm_analysis: dict,
) -> dict:
    """Generate the evidence report and anchor hashes on-chain."""
    user_prompt = build_user_prompt(session, report, package, llm_analysis)
    evidence_report = call_claude(SYSTEM_PROMPT, user_prompt, json_schema=OUTPUT_SCHEMA)

    # Compute hashes regardless of LLM outcome — they don't depend on the report.
    bdn_hash = _canonical_sha256(session.bdn.model_dump(mode="json"))
    mfm_hash = _canonical_sha256(
        [p.model_dump(mode="json") for p in session.mfm_stream]
    )
    validation_hash = _canonical_sha256({
        "anomalies": [a.model_dump(mode="json") for a in report.anomalies],
        "risk": package.model_dump(mode="json", exclude={"signature"}),
    })

    tx_result = write_to_chain(
        session_id=session.session_id,
        bdn_hash=bdn_hash,
        mfm_hash=mfm_hash,
        validation_hash=validation_hash,
        risk_score=package.risk_score or 0,
    )

    evidence_report["blockchain"] = {
        "bdn_hash": f"0x{bdn_hash[:32]}",
        "mfm_hash": f"0x{mfm_hash[:32]}",
        "validation_hash": f"0x{validation_hash[:32]}",
        "tx_hash": tx_result.get("tx_hash", "pending"),
        "chain": tx_result.get("chain", "unknown"),
        "status": tx_result.get("status", "pending"),
        "explorer": tx_result.get("explorer"),
    }

    log.info(
        "stage5_done",
        extra={
            "session_id": session.session_id,
            "tx_chain": evidence_report["blockchain"]["chain"],
            "tx_status": evidence_report["blockchain"]["status"],
            "tokens": evidence_report.get("_usage", {}),
        },
    )
    return evidence_report
