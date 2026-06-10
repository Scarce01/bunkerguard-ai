"""LLM services with lazy exports for optional dashboard dependencies."""

from importlib import import_module
from typing import Any

__all__ = [
    "Chat",
    "ChatMessage",
    "CompositeChatStore",
    "CopilotTools",
    "InMemoryChatStore",
    "TOOL_SPECS",
    "run_stage4",
    "run_stage4_agent",
    "run_stage4_chat_turn",
]

_EXPORTS = {
    "Chat": ("chat_store", "Chat"),
    "ChatMessage": ("chat_store", "ChatMessage"),
    "CompositeChatStore": ("chat_store", "CompositeChatStore"),
    "InMemoryChatStore": ("chat_store", "InMemoryChatStore"),
    "CopilotTools": ("copilot_tools", "CopilotTools"),
    "TOOL_SPECS": ("copilot_tools", "TOOL_SPECS"),
    "run_stage4": ("stage4_copilot", "run_stage4"),
    "run_stage4_agent": ("stage4_copilot", "run_stage4_agent"),
    "run_stage4_chat_turn": ("stage4_copilot", "run_stage4_chat_turn"),
}


def __getattr__(name: str) -> Any:
    try:
        module_name, attribute = _EXPORTS[name]
    except KeyError as exc:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}") from exc
    value = getattr(import_module(f".{module_name}", __name__), attribute)
    globals()[name] = value
    return value
