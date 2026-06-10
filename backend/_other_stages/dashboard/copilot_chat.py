"""Chief Engineer Copilot — chat panel for the Streamlit dashboard.

Drop-in: call ``render_copilot_chat(session, report, package)`` inside any
tab (e.g. Overview, or a dedicated 💬 Copilot tab). Three things:

  * Sidebar lists archived chats for THIS vessel session.
  * Main area shows the current chat — user bubbles, assistant replies,
    and inline tool artifacts (chart PNGs, PDF download links).
  * "+ New chat" button archives the current chat to Supabase and starts
    a fresh one. Old chats are read-only; clicking one loads it in place.

State lives in ``st.session_state['copilot_store']`` (a CompositeChatStore)
so it survives reruns within the Streamlit session. On "New chat" the
active conversation is flushed to ``copilot_chats`` / ``copilot_messages``
in Supabase.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING

import streamlit as st

from llm import CompositeChatStore, run_stage4_chat_turn
from llm.chat_store import Chat

if TYPE_CHECKING:
    from contracts import AnomalyReport, RiskPackage, SessionInput


# ---------------------------------------------------------------- state

_STORE_KEY = "copilot_store"
_VIEW_CHAT_KEY = "copilot_viewed_chat_id"


def _get_store() -> CompositeChatStore:
    store = st.session_state.get(_STORE_KEY)
    if store is None:
        # Persist to Supabase only if creds are available; otherwise memory-only.
        import os
        persist = bool(os.environ.get("SUPABASE_URL") and
                       os.environ.get("SUPABASE_SERVICE_KEY"))
        store = CompositeChatStore(persist=persist)
        st.session_state[_STORE_KEY] = store
        if not persist:
            st.session_state["_copilot_no_supabase"] = True
    return store


# ---------------------------------------------------------------- render

def render_copilot_chat(session: "SessionInput",
                        report: "AnomalyReport",
                        package: "RiskPackage") -> None:
    """Render the copilot chat panel for one bunkering session."""
    store = _get_store()
    sid = session.session_id

    # ------------------------------------------------------------ sidebar
    with st.sidebar:
        st.markdown("### 💬 Copilot chats")
        if st.session_state.get("_copilot_no_supabase"):
            st.caption("⚠️ SUPABASE_URL not set — chats live in memory only.")

        if st.button("➕ New chat", width="stretch", key="copilot_new_chat"):
            store.new_chat(sid)
            st.session_state.pop(_VIEW_CHAT_KEY, None)
            st.rerun()

        active = store.get_active(sid)
        viewing_id = st.session_state.get(_VIEW_CHAT_KEY) or active.chat_id

        # Active first.
        active_label = f"🟢 {active.title}" + (
            f"  ·  {active.turn_count}" if active.turn_count else "")
        if st.button(active_label, width="stretch",
                     key=f"copilot_pick_{active.chat_id}",
                     type="primary" if viewing_id == active.chat_id else "secondary"):
            st.session_state.pop(_VIEW_CHAT_KEY, None)
            st.rerun()

        # Archived list.
        archived = [c for c in store.list_archived(sid)
                    if c.chat_id != active.chat_id]
        if archived:
            st.caption("Archived")
            for c in archived:
                label = f"📁 {c.title}"
                if st.button(label, width="stretch",
                             key=f"copilot_pick_{c.chat_id}",
                             type="primary" if viewing_id == c.chat_id else "secondary"):
                    st.session_state[_VIEW_CHAT_KEY] = c.chat_id
                    st.rerun()

    # ------------------------------------------------------------ main
    viewing_id = st.session_state.get(_VIEW_CHAT_KEY)
    if viewing_id and viewing_id != active.chat_id:
        chat = store.load_chat(viewing_id) or active
        read_only = True
    else:
        chat = active
        read_only = False

    st.markdown(f"#### 🤖 Chief Engineer Copilot — *{chat.title}*")
    if read_only:
        st.info("Viewing an archived chat — read only. Click 🟢 active chat "
                "above to resume, or ➕ New chat to start fresh.")

    _render_messages(chat)
    _render_debug_strip()

    if read_only:
        return

    # ------------------------------------------------------------ input
    question = st.chat_input("Ask the copilot — 'do I sign?', 'show me the "
                             "flow chart', 'why A02?', 'draft LOP'…")
    if not question:
        return
    with st.spinner("Copilot thinking…"):
        try:
            result = run_stage4_chat_turn(chat, question, session, report, package)
            st.session_state["_copilot_last_result"] = {
                "tool_calls": [tc.get("name") for tc in result.get("tool_calls") or []],
                "usage": result.get("_usage", {}),
                "error": result.get("error"),
                "session_id": session.session_id,
            }
        except Exception as e:
            chat.append("assistant",
                        {"text": f"⚠️ Copilot error: {type(e).__name__}: {e}"})
            st.session_state["_copilot_last_result"] = {"exception": str(e)}
    st.rerun()


def _render_debug_strip() -> None:
    """Always-on diagnostic strip — shows what the last turn actually did.

    If this shows ``tool_calls: []`` after a 'plot' / 'verdict' question, the
    tools didn't reach the API — that's the bug, not the model.
    """
    last = st.session_state.get("_copilot_last_result")
    if not last:
        return
    with st.expander("🔧 Last turn diagnostics", expanded=False):
        st.json(last)


# ---------------------------------------------------------------- bubbles

def _render_messages(chat: Chat) -> None:
    """Walk the transcript and render bubbles + inline tool artifacts."""
    if not chat.messages:
        st.caption("Start by asking *'Do I sign this?'* — the copilot will "
                   "lead with the verdict and bring the proof to the chat.")
        return

    pending_tools: list[dict] = []
    for msg in chat.messages:
        if msg.role == "user":
            _flush_tool_artifacts(pending_tools)
            with st.chat_message("user"):
                st.markdown(msg.content.get("text", ""))
        elif msg.role == "tool":
            pending_tools.append(msg.content)
        elif msg.role == "assistant":
            with st.chat_message("assistant"):
                _flush_tool_artifacts(pending_tools)
                text = msg.content.get("text", "")
                if text:
                    st.markdown(text)
    _flush_tool_artifacts(pending_tools)


def _flush_tool_artifacts(pending: list[dict]) -> None:
    """Render whatever artifacts the tool calls produced, inline."""
    for tc in pending:
        name = tc.get("name")
        result = tc.get("result") or {}
        if result.get("error"):
            st.caption(f"⚠️ `{name}` → {result['error']}")
            continue

        if name == "show_chart":
            path = result.get("path")
            if path and Path(path).exists():
                st.image(path, caption=result.get("caption") or name,
                         width="stretch")
        elif name == "generate_evidence_pdf":
            pdf = result.get("pdf_path")
            if pdf and Path(pdf).exists():
                with open(pdf, "rb") as f:
                    st.download_button(
                        "📄 Download evidence PDF", f.read(),
                        file_name=Path(pdf).name, mime="application/pdf",
                        key=f"dl_{pdf}")
        elif name == "draft_lop":
            body = result.get("body")
            if body:
                with st.expander("📝 Letter of Protest draft", expanded=False):
                    st.code(body, language="markdown")
        elif name == "get_verdict_brief":
            _render_verdict_brief(result)
        elif name == "show_anomaly":
            _render_anomaly_card(result)
        elif name == "cite":
            with st.expander(f"📚 {result.get('rule_id')} — "
                             f"{result.get('name')}"):
                st.markdown(f"**Basis:** {result.get('regulatory_basis')}")
                st.markdown(f"*{result.get('citation')}*")
        elif name == "open_tab":
            st.caption(f"↪️ Focused tab: **{result.get('label')}**")
        elif name == "mark_action_done":
            st.caption(f"✅ Action ticked: `{result.get('action_key')}`")
        else:
            with st.expander(f"🔧 {name}"):
                st.json(result)
    pending.clear()


def _render_verdict_brief(r: dict) -> None:
    verdict = r.get("verdict") or "—"
    color = {
        "SIGN": "🟢", "SIGN_WITH_NOTES": "🟡",
        "SIGN_WITH_LOP": "🟠", "REFUSE_TO_SIGN": "🔴",
        "INSUFFICIENT_DATA": "⚪",
    }.get(verdict, "⚪")
    st.markdown(
        f"### {color} {verdict.replace('_', ' ')}  ·  "
        f"score **{r.get('risk_score', '—')}/100**  "
        f"({r.get('category', '—')})"
    )
    if r.get("headline"):
        st.markdown(f"_{r['headline']}_")
    top = r.get("top_reasons") or []
    if top:
        st.markdown("**Top findings**")
        for t in top:
            st.markdown(f"- **{t.get('rule_id')}** · {t.get('name')} "
                        f"({t.get('severity')}): {t.get('one_line')}")
    checklist = r.get("checklist") or []
    if checklist:
        st.markdown("**Do this now**")
        for c in checklist:
            st.markdown(f"- ⬜ {c.get('text')}")


def _render_anomaly_card(r: dict) -> None:
    sev_emoji = {"CRITICAL": "🔴", "HIGH": "🟠",
                 "MEDIUM": "🟡", "LOW": "🟢"}.get(r.get("severity"), "⚪")
    st.markdown(f"**{sev_emoji} {r.get('rule_id')} · {r.get('name')}**")
    st.markdown(r.get("description", ""))
    if r.get("measured") is not None and r.get("reference") is not None:
        unit = r.get("unit") or ""
        dev = f" ({r['deviation_pct']:+.2f}%)" if r.get("deviation_pct") is not None else ""
        st.markdown(f"measured **{r['measured']}{unit}** vs expected "
                    f"**{r['reference']}{unit}**{dev}")
    if r.get("regulatory_basis"):
        st.caption(r["regulatory_basis"])
