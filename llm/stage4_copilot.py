"""Stage 4 — LLM Copilot orchestrator.

Takes the deterministic Stage 1/2/3 outputs (typed pydantic objects) and
produces a Chief-Engineer-facing analysis dict.
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

import json

from .chat_store import Chat, ChatMessage
from .claude_client import call_claude, call_claude_with_tools
from .copilot_tools import TOOL_SPECS, CopilotTools
from .prompts.stage4_copilot import (
    OUTPUT_SCHEMA,
    SYSTEM_PROMPT,
    build_user_prompt,
)

if TYPE_CHECKING:
    from contracts import AnomalyReport, RiskPackage, SessionInput


AGENT_SYSTEM_PROMPT = """You are BunkerGuard Copilot, on a tablet at the rail next to a bunker surveyor who has minutes to decide whether to sign a Bunker Delivery Note.

CRITICAL: You have NO knowledge of the current session except through tools. You must call tools — never invent session IDs, vessel names, suppliers, or numbers. If you don't have a fact from a tool result, you don't know it.

REQUIRED behaviours:
- Every turn must begin with a tool call. If the officer asks "do I sign / verdict / what's wrong / brief" → call get_verdict_brief FIRST.
- "Show / plot / chart / see the curve / visualise / graph" → you MUST call show_chart. Never reply that you cannot plot — the tool returns a PNG path that the UI renders inline.
- "Why <rule>? / explain <rule> / measured vs expected" → call show_anomaly.
- "Cite / what does <regulation> say / quote the rule" → call cite.
- LOP draft → call draft_lop (only if verdict requires it).
- "Generate / build / email the report / PDF" → call generate_evidence_pdf.
- "Open / show me on dashboard / switch tab" → call open_tab. NEVER call open_tab unless the officer explicitly asks to navigate.
- Officer confirms an action done → call mark_action_done.

You operate on ONE session at a time. Do not list other sessions, other vessels, or other suppliers — those are not visible to you.

Final replies are short: one to three sentences plus the artifact the tool returned. Stage 3 is authoritative on the verdict; you explain and assist, you do not overrule."""

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


def run_stage4_agent(
    session: "SessionInput",
    report: "AnomalyReport",
    package: "RiskPackage",
    question: str,
    *,
    max_iterations: int = 6,
) -> dict:
    """Answer an officer's question using the copilot tool surface.

    Unlike ``run_stage4`` (which produces the static one-shot brief), this
    is the interactive entry point: the LLM picks tools, the tools run
    against this session's typed contracts, and the final reply comes back
    with the artifacts (chart paths, PDF, citation text) the tools produced.

    Returns:
        ``{"answer": str, "tool_calls": [...], "_usage": {...}}``
    """
    tools = CopilotTools(session=session, report=report, package=package)
    result = call_claude_with_tools(
        AGENT_SYSTEM_PROMPT,
        question,
        tools=TOOL_SPECS,
        dispatch=tools.dispatch,
        max_iterations=max_iterations,
    )
    log.info(
        "stage4_agent_done",
        extra={
            "session_id": session.session_id,
            "tool_calls": [c["name"] for c in result.get("tool_calls", [])],
            "tokens": result.get("_usage", {}),
        },
    )
    return result


def run_stage4_chat_turn(
    chat: Chat,
    question: str,
    session: "SessionInput",
    report: "AnomalyReport",
    package: "RiskPackage",
    *,
    max_iterations: int = 6,
) -> dict:
    """Add one user turn to ``chat`` and run the agent with prior history.

    Mutates ``chat`` in place: appends the user message, then the assistant
    text, then one ``tool`` message per tool call (so the persisted
    transcript is the full record, not just the visible Q&A).

    Returns the same shape as ``run_stage4_agent``.
    """
    prior = _chat_to_anthropic_messages(chat)
    chat.append("user", {"text": question})

    tools = CopilotTools(session=session, report=report, package=package)
    result = call_claude_with_tools(
        AGENT_SYSTEM_PROMPT,
        question,
        tools=TOOL_SPECS,
        dispatch=tools.dispatch,
        prior_messages=prior,
        max_iterations=max_iterations,
    )

    # Persist tool calls first (chronological), then the assistant's final reply.
    for tc in result.get("tool_calls") or []:
        chat.append("tool", {
            "name": tc.get("name"),
            "args": tc.get("args") or {},
            "result": tc.get("result") or {},
        })
    chat.append("assistant",
                {"text": result.get("answer") or result.get("error") or ""},
                usage=result.get("_usage"))

    log.info("stage4_chat_turn_done", extra={
        "session_id": session.session_id,
        "chat_id": chat.chat_id,
        "turn": chat.turn_count,
        "tool_calls": [tc.get("name") for tc in result.get("tool_calls", [])],
        "tokens": result.get("_usage", {}),
    })
    return result


def run_stage4_chat_turn_supabase(
    chat: Chat,
    question: str,
    session_id: str,
    *,
    max_iterations: int = 6,
) -> dict:
    """Same as ``run_stage4_chat_turn`` but the session is pulled from Supabase.

    Used by the web frontend (``scripts/copilot_chat_runner.py``) where the
    typed ``SessionInput`` / ``AnomalyReport`` / ``RiskPackage`` aren't
    available — only the DB rows are.
    """
    from .supabase_hydrate import hydrate_view

    view, timeline = hydrate_view(session_id)
    prior = _chat_to_anthropic_messages(chat)
    chat.append("user", {"text": question})

    tools = CopilotTools(view=view, mfm_timeline_data=timeline)
    result = call_claude_with_tools(
        AGENT_SYSTEM_PROMPT,
        question,
        tools=TOOL_SPECS,
        dispatch=tools.dispatch,
        prior_messages=prior,
        max_iterations=max_iterations,
    )

    for tc in result.get("tool_calls") or []:
        chat.append("tool", {
            "name": tc.get("name"),
            "args": tc.get("args") or {},
            "result": tc.get("result") or {},
        })
    chat.append("assistant",
                {"text": result.get("answer") or result.get("error") or ""},
                usage=result.get("_usage"))

    log.info("stage4_chat_supabase_done", extra={
        "session_id": session_id,
        "chat_id": chat.chat_id,
        "turn": chat.turn_count,
        "tool_calls": [tc.get("name") for tc in result.get("tool_calls", [])],
        "tokens": result.get("_usage", {}),
    })
    return result


def _chat_to_anthropic_messages(chat: Chat) -> list[dict]:
    """Convert persisted Chat history into Anthropic ``messages`` blocks.

    We don't replay tool_use/tool_result blocks across turns — the model
    sees prior tool calls as a compact assistant note instead. This keeps
    the context small and avoids fragile id-matching across SDK versions;
    the *facts* the tools returned are what the next turn needs, not the
    block IDs.
    """
    out: list[dict] = []
    pending_tools: list[ChatMessage] = []
    for msg in chat.messages:
        if msg.role == "user":
            _flush_tools(pending_tools, out)
            out.append({"role": "user", "content": msg.content.get("text", "")})
        elif msg.role == "tool":
            pending_tools.append(msg)
        elif msg.role == "assistant":
            text = msg.content.get("text", "")
            if pending_tools:
                # Fold any tool calls *into* the assistant turn that produced them.
                note = _tool_summary(pending_tools)
                pending_tools = []
                text = (note + "\n\n" + text).strip() if text else note
            if text:
                out.append({"role": "assistant", "content": text})
    _flush_tools(pending_tools, out)
    return out


def _flush_tools(pending: list[ChatMessage], out: list[dict]) -> None:
    if not pending:
        return
    out.append({"role": "assistant", "content": _tool_summary(pending)})
    pending.clear()


def _tool_summary(pending: list[ChatMessage]) -> str:
    lines = ["[prior tool calls]"]
    for m in pending:
        c = m.content
        result = c.get("result") or {}
        # Truncate large results — the model only needs the gist for context.
        result_preview = json.dumps(result, default=str)
        if len(result_preview) > 600:
            result_preview = result_preview[:600] + "…"
        lines.append(f"- {c.get('name')}({json.dumps(c.get('args') or {})}) -> {result_preview}")
    return "\n".join(lines)
