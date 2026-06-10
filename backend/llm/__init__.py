"""LLM layer — Stage 4 (Copilot), Stage 5 (Evidence report), Stage 6 (Reputation).

Wraps the Anthropic SDK so the rest of the pipeline can stay deterministic
Python. All LLM calls go through ``llm.claude_client.call_claude`` (one-shot
JSON) or ``call_claude_with_tools`` (interactive officer copilot).
"""

from .bdn_ingest_service import BDNIngestResult, analyze_bdn_upload, to_bdn_doc
from .bunkering_orchestrator import (
    BunkeringSession,
    MFMTick,
    finalize_session,
    get_session,
    list_active,
    start_session,
    tick,
)
from .chat_store import Chat, ChatMessage, CompositeChatStore, InMemoryChatStore
from .copilot_tools import TOOL_SPECS, CopilotTools
from .stage4_copilot import run_stage4, run_stage4_agent, run_stage4_chat_turn

__all__ = [
    "BDNIngestResult",
    "BunkeringSession",
    "Chat",
    "ChatMessage",
    "CompositeChatStore",
    "CopilotTools",
    "InMemoryChatStore",
    "MFMTick",
    "TOOL_SPECS",
    "analyze_bdn_upload",
    "finalize_session",
    "get_session",
    "list_active",
    "run_stage4",
    "run_stage4_agent",
    "run_stage4_chat_turn",
    "start_session",
    "tick",
    "to_bdn_doc",
]
