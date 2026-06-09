"""Stage 4 — LLM Copilot orchestrator.

Takes the deterministic Stage 1/2/3 outputs (typed pydantic objects) and
produces a Chief-Engineer-facing analysis dict.
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from .claude_client import call_claude
from .prompts.stage4_copilot import (
    OUTPUT_SCHEMA,
    SYSTEM_PROMPT,
    build_user_prompt,
)

if TYPE_CHECKING:
    from contracts import AnomalyReport, RiskPackage, SessionInput

log = logging.getLogger("bunkerguard.llm.stage4")


def run_stage4(
    session: "SessionInput",
    report: "AnomalyReport",
    package: "RiskPackage",
) -> dict:
    """Generate the Chief Engineer explanation.

    Returns the parsed JSON dict from Claude. On error, the dict will have
    an ``error`` key and the deterministic verdict still stands (Stage 3
    is authoritative).
    """
    user_prompt = build_user_prompt(session, report, package)
    result = call_claude(SYSTEM_PROMPT, user_prompt, json_schema=OUTPUT_SCHEMA)

    # Defensive defaults — keep the pipeline running even if Claude misbehaves.
    result.setdefault("summary", "LLM analysis unavailable.")
    result.setdefault("concerns", [])
    result.setdefault(
        "recommended_action",
        package.verdict.value if hasattr(package.verdict, "value") else str(package.verdict),
    )
    result.setdefault("confidence", 0.0)

    log.info(
        "stage4_done",
        extra={
            "session_id": session.session_id,
            "action": result.get("recommended_action"),
            "concerns": len(result.get("concerns", [])),
            "tokens": result.get("_usage", {}),
        },
    )
    return result
