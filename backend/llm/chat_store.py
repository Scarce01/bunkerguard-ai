"""Copilot chat persistence.

Active chat lives in memory (``InMemoryChatStore``). When the officer
clicks "New chat", the active chat is archived to Supabase via
``SupabaseChatStore`` and a fresh one is started.

A ``Chat`` is the unit the UI binds to: ``messages`` is the rolling
transcript the LLM also sees (so multi-turn context is preserved
verbatim across turns).

Message ``content`` shapes:
    role=user       {"text": str}
    role=assistant  {"text": str}              # may be empty if turn was all tool_use
    role=tool       {"name": str, "args": dict, "result": dict}

The store does NOT depend on the Anthropic message block format. The
agent loop converts to/from Anthropic blocks at the boundary (see
``stage4_copilot.run_stage4_chat_turn``). This keeps the DB stable
even if the SDK shape changes.
"""
from __future__ import annotations

import logging
import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional, Protocol

log = logging.getLogger("bunkerguard.llm.chat_store")


# ---------------------------------------------------------------- data model

@dataclass
class ChatMessage:
    role: str                       # 'user' | 'assistant' | 'tool'
    content: dict[str, Any]
    turn_index: int
    usage: Optional[dict] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_row(self, chat_id: str) -> dict:
        return {
            "chat_id": chat_id,
            "turn_index": self.turn_index,
            "role": self.role,
            "content": self.content,
            "usage": self.usage,
            "created_at": self.created_at.isoformat(),
        }


@dataclass
class Chat:
    chat_id: str
    vessel_session_id: str
    title: str = "New chat"
    status: str = "active"          # 'active' | 'archived'
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    archived_at: Optional[datetime] = None
    messages: list[ChatMessage] = field(default_factory=list)

    @property
    def turn_count(self) -> int:
        return len(self.messages)

    @property
    def total_tokens(self) -> tuple[int, int]:
        ti = sum((m.usage or {}).get("input_tokens", 0) for m in self.messages)
        to = sum((m.usage or {}).get("output_tokens", 0) for m in self.messages)
        return ti, to

    def append(self, role: str, content: dict, usage: Optional[dict] = None) -> ChatMessage:
        msg = ChatMessage(role=role, content=content,
                          turn_index=len(self.messages), usage=usage)
        self.messages.append(msg)
        # Auto-title from the first user message — first 60 chars.
        if self.title == "New chat" and role == "user":
            text = (content.get("text") or "").strip()
            if text:
                self.title = text[:60] + ("…" if len(text) > 60 else "")
        return msg


# ---------------------------------------------------------------- store API

class ChatStore(Protocol):
    """Two-store split: memory for the live conversation, Supabase for archive.

    Implementations should be cheap on the hot path (every officer turn calls
    ``get_active`` + ``append``). Archive writes happen once per "New chat".
    """

    def get_active(self, vessel_session_id: str) -> Chat: ...
    def new_chat(self, vessel_session_id: str) -> Chat: ...
    def append(self, chat: Chat, role: str, content: dict,
               usage: Optional[dict] = None) -> ChatMessage: ...
    def archive(self, chat: Chat) -> None: ...
    def list_archived(self, vessel_session_id: str) -> list[Chat]: ...
    def load_chat(self, chat_id: str) -> Optional[Chat]: ...


# ---------------------------------------------------------------- in-memory

class InMemoryChatStore:
    """Process-local store. Used during dev and as the live-chat buffer.

    Holds one ``active`` chat per vessel session, plus any archived chats
    that haven't been flushed yet. Production wires this in front of a
    ``SupabaseChatStore`` (see ``CompositeChatStore``).
    """
    def __init__(self) -> None:
        self._active: dict[str, Chat] = {}
        self._archived: dict[str, list[Chat]] = {}
        self._by_id: dict[str, Chat] = {}

    def get_active(self, vessel_session_id: str) -> Chat:
        chat = self._active.get(vessel_session_id)
        if chat is None:
            chat = self.new_chat(vessel_session_id)
        return chat

    def new_chat(self, vessel_session_id: str) -> Chat:
        chat = Chat(chat_id=str(uuid.uuid4()),
                    vessel_session_id=vessel_session_id)
        self._active[vessel_session_id] = chat
        self._by_id[chat.chat_id] = chat
        return chat

    def append(self, chat: Chat, role: str, content: dict,
               usage: Optional[dict] = None) -> ChatMessage:
        return chat.append(role, content, usage)

    def archive(self, chat: Chat) -> None:
        chat.status = "archived"
        chat.archived_at = datetime.now(timezone.utc)
        self._archived.setdefault(chat.vessel_session_id, []).append(chat)
        # If this was the active chat for its session, clear the slot.
        if self._active.get(chat.vessel_session_id) is chat:
            del self._active[chat.vessel_session_id]

    def list_archived(self, vessel_session_id: str) -> list[Chat]:
        return list(self._archived.get(vessel_session_id, []))

    def load_chat(self, chat_id: str) -> Optional[Chat]:
        return self._by_id.get(chat_id)


# ---------------------------------------------------------------- supabase

class SupabaseChatStore:
    """Persists archived chats. Active state stays in InMemoryChatStore.

    Lazy client init — won't fail at import if env vars aren't set; only
    fails when an archive write or read is actually attempted.
    """
    def __init__(self) -> None:
        self._client: Any = None

    def _sb(self) -> Any:
        if self._client is None:
            from supabase import create_client  # type: ignore
            url = os.environ["SUPABASE_URL"]
            key = os.environ["SUPABASE_SERVICE_KEY"]
            self._client = create_client(url, key)
        return self._client

    # Active chats aren't persisted until archived. These delegate to memory.
    def get_active(self, vessel_session_id: str) -> Chat:  # pragma: no cover - delegated
        raise NotImplementedError("Use CompositeChatStore for active state.")

    def new_chat(self, vessel_session_id: str) -> Chat:  # pragma: no cover
        raise NotImplementedError("Use CompositeChatStore for active state.")

    def append(self, chat: Chat, role: str, content: dict,
               usage: Optional[dict] = None) -> ChatMessage:  # pragma: no cover
        raise NotImplementedError("Use CompositeChatStore for active state.")

    def archive(self, chat: Chat) -> None:
        chat.status = "archived"
        chat.archived_at = datetime.now(timezone.utc)
        sb = self._sb()
        ti, to = chat.total_tokens
        sb.table("copilot_chats").upsert({
            "chat_id": chat.chat_id,
            "vessel_session_id": chat.vessel_session_id,
            "title": chat.title,
            "status": "archived",
            "started_at": chat.started_at.isoformat(),
            "archived_at": chat.archived_at.isoformat(),
            "message_count": chat.turn_count,
            "total_tokens_in": ti,
            "total_tokens_out": to,
        }).execute()
        if chat.messages:
            sb.table("copilot_messages").insert(
                [m.to_row(chat.chat_id) for m in chat.messages]
            ).execute()
        log.info("chat_archived", extra={
            "chat_id": chat.chat_id,
            "session_id": chat.vessel_session_id,
            "messages": chat.turn_count,
        })

    def list_archived(self, vessel_session_id: str) -> list[Chat]:
        sb = self._sb()
        rows = sb.table("copilot_chats").select(
            "chat_id,vessel_session_id,title,status,started_at,archived_at"
        ).eq("vessel_session_id", vessel_session_id).eq(
            "status", "archived"
        ).order("archived_at", desc=True).execute().data or []
        return [self._chat_from_row(r) for r in rows]

    def load_chat(self, chat_id: str) -> Optional[Chat]:
        sb = self._sb()
        head = sb.table("copilot_chats").select(
            "*").eq("chat_id", chat_id).limit(1).execute().data
        if not head:
            return None
        chat = self._chat_from_row(head[0])
        msgs = sb.table("copilot_messages").select(
            "role,content,usage,turn_index,created_at"
        ).eq("chat_id", chat_id).order("turn_index").execute().data or []
        chat.messages = [
            ChatMessage(
                role=m["role"], content=m["content"],
                turn_index=m["turn_index"], usage=m.get("usage"),
                created_at=_parse_ts(m.get("created_at")),
            ) for m in msgs
        ]
        return chat

    @staticmethod
    def _chat_from_row(r: dict) -> Chat:
        return Chat(
            chat_id=r["chat_id"],
            vessel_session_id=r["vessel_session_id"],
            title=r.get("title") or "Chat",
            status=r.get("status") or "archived",
            started_at=_parse_ts(r.get("started_at")),
            archived_at=_parse_ts(r.get("archived_at")),
        )


# ---------------------------------------------------------------- composite

class CompositeChatStore:
    """Memory in front, Supabase behind. The store the UI actually uses.

    Reads of archived chats are served from Supabase; the live chat lives
    in memory until ``archive`` is called.
    """
    def __init__(self, *, persist: bool = True) -> None:
        self.memory = InMemoryChatStore()
        self.supabase = SupabaseChatStore() if persist else None

    def get_active(self, vessel_session_id: str) -> Chat:
        return self.memory.get_active(vessel_session_id)

    def new_chat(self, vessel_session_id: str) -> Chat:
        # If there's an existing active chat with messages, archive it first.
        existing = self.memory._active.get(vessel_session_id)
        if existing and existing.messages:
            self.archive(existing)
        return self.memory.new_chat(vessel_session_id)

    def append(self, chat: Chat, role: str, content: dict,
               usage: Optional[dict] = None) -> ChatMessage:
        return self.memory.append(chat, role, content, usage)

    def archive(self, chat: Chat) -> None:
        self.memory.archive(chat)
        if self.supabase is not None and chat.messages:
            try:
                self.supabase.archive(chat)
            except Exception as e:
                log.warning("supabase_archive_failed: %s", e)

    def list_archived(self, vessel_session_id: str) -> list[Chat]:
        # Live archives (not yet flushed) + persisted ones.
        local = self.memory.list_archived(vessel_session_id)
        remote: list[Chat] = []
        if self.supabase is not None:
            try:
                remote = self.supabase.list_archived(vessel_session_id)
            except Exception as e:
                log.warning("supabase_list_failed: %s", e)
        seen = {c.chat_id for c in local}
        return local + [c for c in remote if c.chat_id not in seen]

    def load_chat(self, chat_id: str) -> Optional[Chat]:
        chat = self.memory.load_chat(chat_id)
        if chat is not None:
            return chat
        if self.supabase is not None:
            try:
                return self.supabase.load_chat(chat_id)
            except Exception as e:
                log.warning("supabase_load_failed: %s", e)
        return None


def _parse_ts(ts: Any) -> datetime:
    if isinstance(ts, datetime):
        return ts
    if not ts:
        return datetime.now(timezone.utc)
    try:
        return datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
    except ValueError:
        return datetime.now(timezone.utc)
