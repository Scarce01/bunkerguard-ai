"""Smoke test: prove the new copilot calls show_chart and returns a PNG path.

Run:  python scripts/test_copilot_plot.py SES-2026-016

Expects ANTHROPIC_API_KEY in env. Prints the tool-call transcript so you
can see exactly which tools fired and whether show_chart returned a path.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "_other_stages"))

from anomaly import detect
from ingest import load_sessions
from llm import Chat, run_stage4_chat_turn
from risk import score as risk_score


def main(session_id: str) -> None:
    sessions = {s.session_id: s for s in load_sessions()}
    if session_id not in sessions:
        print(f"unknown session_id: {session_id}")
        print(f"available: {list(sessions)[:5]}…")
        sys.exit(1)

    session = sessions[session_id]
    report = detect.run(session)
    pkg = risk_score.run(report, session)

    chat = Chat(chat_id="test-plot", vessel_session_id=session_id)
    result = run_stage4_chat_turn(
        chat,
        "Plot the cumulative flow vs BDN target and tell me the verdict.",
        session, report, pkg,
    )

    print("\n=== TOOL CALLS ===")
    for tc in result.get("tool_calls", []):
        name = tc.get("name")
        args = tc.get("args")
        res = tc.get("result") or {}
        if "path" in res:
            print(f"  {name}({args}) -> path={res['path']}")
        elif "error" in res:
            print(f"  {name}({args}) -> ERROR {res['error']}")
        else:
            preview = str(res)[:120]
            print(f"  {name}({args}) -> {preview}")

    print("\n=== ANSWER ===")
    print(result.get("answer") or result.get("error"))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "SES-2026-016")
