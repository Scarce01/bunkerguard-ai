"""CLI bridge: Vite /api/copilot/chat → run_stage4_chat_turn_supabase.

Spawned by vite.config.ts. Reads one JSON object from stdin:

    {
      "session_id": "SES-2026-016",
      "question":   "Plot the cumulative flow.",
      "history":    [                               # optional, prior turns
        {"role": "user", "content": {"text": "..."}},
        {"role": "tool", "content": {"name": "...", "args": {}, "result": {}}},
        {"role": "assistant", "content": {"text": "..."}}
      ]
    }

Writes one JSON object to stdout:

    {
      "ok": true,
      "answer": "...",
      "tool_calls": [{"name", "args", "result"}, ...],
      "usage": {"input_tokens", "output_tokens", "model"},
      "chat_messages": [...]   # new turn appended to history
    }

On any failure:  {"ok": false, "error": "..."}  (exit 1)
"""
from __future__ import annotations

import json
import os
import sys
import traceback
from pathlib import Path


def main() -> int:
    backend = os.environ.get("BACKEND_REPO_PATH", "D:/next bunker")
    if backend not in sys.path:
        sys.path.insert(0, backend)
    # Tools write chart PNGs to ``output/<session>/…`` relative to CWD; chdir
    # into the backend so those land under BACKEND_REPO_PATH where the
    # /api/copilot-asset/* middleware can serve them.
    try:
        os.chdir(backend)
    except OSError:
        pass

    try:
        raw = sys.stdin.read()
        payload = json.loads(raw or "{}")
    except json.JSONDecodeError as e:
        print(json.dumps({"ok": False, "error": f"bad stdin JSON: {e}"}))
        return 1

    session_id = (payload.get("session_id") or "").strip()
    question = (payload.get("question") or "").strip()
    if not session_id or not question:
        print(json.dumps({
            "ok": False,
            "error": "both `session_id` and `question` are required",
        }))
        return 1

    try:
        from llm.chat_store import Chat, ChatMessage  # type: ignore
        from llm.stage4_copilot import run_stage4_chat_turn_supabase  # type: ignore
    except Exception as e:
        print(json.dumps({
            "ok": False,
            "error": f"import failed: {e}",
            "trace": traceback.format_exc(limit=3),
        }))
        return 1

    chat = Chat(
        chat_id=payload.get("chat_id") or "web-ephemeral",
        vessel_session_id=session_id,
    )
    for i, m in enumerate(payload.get("history") or []):
        chat.messages.append(ChatMessage(
            role=m.get("role", "user"),
            content=m.get("content") or {},
            turn_index=i,
        ))

    try:
        result = run_stage4_chat_turn_supabase(chat, question, session_id)
    except Exception as e:
        print(json.dumps({
            "ok": False,
            "error": f"{type(e).__name__}: {e}",
            "trace": traceback.format_exc(limit=5),
        }))
        return 1

    # Convert chart paths to absolute paths so the Vite asset middleware can
    # serve them. Keep the original path too in case the caller wants it.
    tool_calls = []
    for tc in result.get("tool_calls") or []:
        res = dict(tc.get("result") or {})
        path = res.get("path") or res.get("pdf_path")
        if path:
            p = Path(path)
            try:
                res["asset_relpath"] = str(
                    p.resolve().relative_to(Path(backend).resolve())
                ).replace("\\", "/")
            except (ValueError, OSError):
                res["asset_relpath"] = None
        tool_calls.append({
            "name": tc.get("name"),
            "args": tc.get("args"),
            "result": res,
        })

    print(json.dumps({
        "ok": True,
        "answer": result.get("answer") or result.get("error") or "",
        "tool_calls": tool_calls,
        "usage": result.get("_usage") or {},
        "chat_messages": [
            {"role": m.role, "content": m.content, "turn_index": m.turn_index}
            for m in chat.messages
        ],
    }, default=str))
    return 0


if __name__ == "__main__":
    sys.exit(main())
