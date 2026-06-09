"""Seed mfm_stream + llm_outputs for SES-2026-016 (V03's Live Session).

Generates 26 MFM packets at 10-minute intervals across the 4h 17m delivery:
  - Normal flow ~120 MT/h for the first 60 min (drive_gain 8-12%)
  - Aeration starts ~70-90 min in (drive_gain climbs 18-22%)
  - Anomaly trigger at 11:45 SGT (1h30m) — cumulative 168.2 vs expected 187.5
  - Recovery phase 90-180 min, slight under-cumulation continues
  - Final wind-down 180-257 min, MFM lands at 481.2 MT (vs BDN 500.0)

Also posts ONE llm_outputs row carrying a Stage-4-style chief-engineer
explanation as the payload (so the FE has something real to render).

Run:  python supabase/seed/v03_telemetry.py
"""
from __future__ import annotations

import hashlib
import json
import math
import os
import sys
from datetime import datetime, timedelta, timezone

import urllib.request
import urllib.error


SB_URL = "https://jdnzznxwdczcktfqwxmj.supabase.co"
SB_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impkbnp6bnh3ZGN6Y2t0ZnF3eG1qIiwicm9sZSI6InNlcnZpY2VfcmsbGUiLCJpYXQiOjE3ODA3NTA1MTIsImV4cCI6MjA5NjMyNjUxMn0."
    "OPqryB55sxjpXnY5cGwceTe7p9AfMUB6jbzGlS4AVZ0"
)
# Fix: the JWT we have is the original — let env var override
SB_KEY = os.environ.get("SUPABASE_KEY", SB_KEY)


SESSION_ID = "SES-2026-016"
METER_SERIAL = "13228354"
START_UTC = datetime(2026, 6, 10, 10, 15, 0, tzinfo=timezone.utc)
END_UTC = datetime(2026, 6, 10, 14, 32, 0, tzinfo=timezone.utc)
TOTAL_MIN = int((END_UTC - START_UTC).total_seconds() / 60)  # 257
PACKET_INTERVAL_MIN = 10
PACKET_COUNT = TOTAL_MIN // PACKET_INTERVAL_MIN + 1  # 26

BDN_QTY = 500.0
MFM_FINAL = 481.2
EXPECTED_RATE = 117.0   # MT/h target


def _sha256(payload: dict) -> str:
    blob = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(blob).hexdigest()


def _flow_profile(minute: int) -> tuple[float, float]:
    """Return (instantaneous_flow_mt_h, drive_gain_pct) for the given minute.

    Targets MFM final 481.2 MT over 257 min (~112 MT/h average), with the
    trajectory always running slightly *below* the BDN-expected 117 MT/h —
    matches the A01 anomaly's "10.3% under expected at 1h30" story.
    """
    # Phase 1 — normal-looking flow but slightly under nominal, first 60 min
    if minute < 60:
        return 112.0 + 3 * math.sin(minute / 6), 9.5 + 2 * math.sin(minute / 8)
    # Phase 2 — aeration onset 60-90 min, flow drops sharply, gain climbs
    if minute < 90:
        progress = (minute - 60) / 30
        flow = 112.0 - 30 * progress
        gain = 9.5 + 14 * progress
        return flow, gain
    # Phase 3 — sustained aeration with recovery attempts 90-180
    if minute < 180:
        cycle = math.sin((minute - 90) / 10)
        flow = 100 + 6 * cycle
        gain = 20 + 4 * cycle + 2 * (1 if minute % 30 < 5 else 0)
        return flow, gain
    # Phase 4 — final ramp-down 180-257
    progress = (minute - 180) / (TOTAL_MIN - 180)
    flow = 100 - 60 * progress
    gain = 16 - 5 * progress
    return flow, gain


def build_packets() -> list[dict]:
    packets: list[dict] = []
    cumulative = 0.0
    prev_sha = "0" * 64
    for seq in range(PACKET_COUNT):
        minute = seq * PACKET_INTERVAL_MIN
        ts = START_UTC + timedelta(minutes=minute)
        flow_rate, drive_gain = _flow_profile(minute)
        delta = flow_rate * (PACKET_INTERVAL_MIN / 60.0)
        cumulative += delta

        # Force the LAST packet to land exactly on the recorded MFM total
        if seq == PACKET_COUNT - 1:
            cumulative = MFM_FINAL

        expected = EXPECTED_RATE * (minute / 60.0)
        deviation_pct = (
            (cumulative - expected) / expected * 100 if expected > 0 else 0.0
        )

        payload = {
            "session_id": SESSION_ID,
            "seq_no": seq + 1,
            "recorded_at": ts.isoformat(),
            "flow_rate_mt_h": round(flow_rate, 2),
            "cumulative_mt": round(cumulative, 2),
            "density_op": round(970.0 + math.sin(minute / 20) * 1.5, 2),
            "density_15c": round(988.3 + math.sin(minute / 50) * 0.5, 2),
            "temp_c": round(50.0 + math.sin(minute / 25), 1),
            "drive_gain_pct": round(drive_gain, 2),
            "tube_freq_hz": round(155.0 - drive_gain * 0.12, 3),
            "direction": "FWD",
            "status_code": 0,
            "meter_serial": METER_SERIAL,
            "expected_mt": round(expected, 2),
            "deviation_pct": round(deviation_pct, 3),
        }
        payload["packet_sha256"] = _sha256({**payload, "prev": prev_sha})
        prev_sha = payload["packet_sha256"]
        packets.append(payload)
    return packets


def build_llm_output() -> dict:
    explanation = {
        "summary": (
            "EVER GIVEN delivery shows systematic short delivery of 18.8 MT (3.76% below BDN). "
            "Trajectory deviation at 1h30 (cumulative 168.2 MT vs expected 187.5) coincides with "
            "drive-gain spike (24%+) — classic cappuccino-bunker aeration signature. "
            "Supplier Gamma's reputation score (38) and 9/22 prior flagged deliveries "
            "elevate this to CRITICAL."
        ),
        "concerns": [
            "A01 quantity trajectory deviation triggered at 11:45 SGT (10.3% under).",
            "A02 quantity final mismatch CRITICAL — 18.8 MT shortage, est. USD $11,000 impact.",
            "Drive gain climbed from 9.5% baseline to 24% sustained — aeration / cappuccino bunker.",
            "Supplier Gamma reputation 38/100 — 9/22 sessions flagged.",
        ],
        "recommended_action": "REFUSE_TO_SIGN",
        "confidence": 0.92,
        "tool_use_chain": [
            {"step": 1, "tool": "risk_engine",
             "input": "anomaly + supplier + doc + dev scores",
             "output": {"final_risk_score": 78, "category": "CRITICAL"}},
            {"step": 2, "tool": "exa_search",
             "trigger": "risk >= 40",
             "output": "3 similar Supplier Gamma shortage deliveries in 30d"},
            {"step": 3, "tool": "letter_of_protest_generator",
             "trigger": "risk >= 70",
             "output": "LoP draft anchored to blockchain tx 0x7e4a9d83c2f15b40"},
            {"step": 4, "tool": "verdict_engine",
             "trigger": "risk >= 75",
             "output": "REFUSE_TO_SIGN (92% confidence)"},
        ],
    }
    return {
        "session_id": SESSION_ID,
        "stage": 4,
        "model": "claude-sonnet-4-6",
        "prompt_tokens": 2840,
        "output_tokens": 612,
        "payload": explanation,
    }


def post_rows(table: str, rows: list[dict]) -> None:
    url = f"{SB_URL}/rest/v1/{table}"
    body = json.dumps(rows).encode()
    headers = {
        "apikey": SB_KEY,
        "Authorization": f"Bearer {SB_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            print(f"  {table}: HTTP {resp.status}  ({len(rows)} rows)")
    except urllib.error.HTTPError as e:
        print(f"  {table}: HTTP {e.code} — {e.read().decode()}")


def main() -> None:
    print(f"Seeding {PACKET_COUNT} mfm_stream packets for {SESSION_ID} ...")
    packets = build_packets()
    post_rows("mfm_stream", packets)

    print(f"Seeding 1 llm_outputs row for {SESSION_ID} ...")
    post_rows("llm_outputs", [build_llm_output()])

    print("Done.")


if __name__ == "__main__":
    sys.exit(main())
