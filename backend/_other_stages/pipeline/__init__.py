"""BunkerGuard end-to-end pipeline orchestrator.

Usage:
    python3 -m pipeline                       # run all 11 sessions, write artifacts
    python3 -m pipeline --session SES-2026-012

Outputs (under out/):
    out/sessions/<sid>/stage1_input.json     # signed SessionInput
    out/sessions/<sid>/stage2_report.json    # signed AnomalyReport
    out/sessions/<sid>/stage3_package.json   # signed RiskPackage
    out/batch_manifest.json                  # Merkle root + per-session leaves
    out/pipeline_run.log                     # newline-delimited JSON events

The batch manifest is what Stage 5 anchors on-chain — one transaction proves
the integrity of EVERY session in the batch (Merkle tree).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Tuple

# Stage 2/3 owners' code lives at repo root; ingest (Stage 1) is a sibling.
# When this module is invoked via `python3 -m pipeline` from inside
# _other_stages/, neither root nor sibling are auto-on-path. Inject them.
_HERE = Path(__file__).resolve().parent           # .../_other_stages/pipeline
_OTHER = _HERE.parent                              # .../_other_stages
_ROOT = _OTHER.parent                              # .../NEXT
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))
if str(_OTHER) not in sys.path:
    sys.path.insert(0, str(_OTHER))

import anomaly
import risk
from contracts import (
    AnomalyReport,
    RiskPackage,
    SessionInput,
    canonical_json,
    compute_payload_sha256,
    load_or_create_keypair,
    sha256_hex,
    sign_payload,
)
from ingest import load_sessions
from policy import POLICY_VERSION, snapshot as policy_snapshot

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "out"


# ---------------------------------------------------------------- logging
class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        base = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        for k, v in record.__dict__.items():
            if k in ("args", "msg", "levelname", "name", "exc_info", "exc_text", "stack_info",
                     "lineno", "funcName", "created", "msecs", "relativeCreated", "thread",
                     "threadName", "processName", "process", "pathname", "filename", "module",
                     "levelno"):
                continue
            base[k] = v
        return json.dumps(base, default=str)


def _setup_logging(log_file: Path) -> None:
    log_file.parent.mkdir(parents=True, exist_ok=True)
    handler = logging.FileHandler(log_file, mode="w")
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(logging.INFO)


# ---------------------------------------------------------------- Merkle tree
def _merkle_root(leaves: List[str]) -> str:
    """Standard binary Merkle (duplicate last on odd count). Returns hex root."""
    if not leaves:
        return ""
    layer = [bytes.fromhex(h) for h in leaves]
    while len(layer) > 1:
        if len(layer) % 2 == 1:
            layer.append(layer[-1])
        layer = [hashlib.sha256(layer[i] + layer[i + 1]).digest()
                 for i in range(0, len(layer), 2)]
    return layer[0].hex()


# ---------------------------------------------------------------- signing helpers
def _sign(payload: dict, key_name: str) -> dict:
    priv, _ = load_or_create_keypair(key_name)
    payload["signed_by"] = key_name
    payload["signature"] = sign_payload(priv, payload)
    return payload


def _write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, default=str))


# ---------------------------------------------------------------- per-session
def run_session(session: SessionInput, out_dir: Path) -> Tuple[dict, dict, dict]:
    s_dict = json.loads(canonical_json(session.model_dump(mode="json")).decode())
    s_dict = _sign(s_dict, "stage1")
    _write_json(out_dir / "stage1_input.json", s_dict)

    report: AnomalyReport = anomaly.run(session)
    r_dict = json.loads(canonical_json(report.model_dump(mode="json")).decode())
    r_dict["parent_sha256"] = compute_payload_sha256(s_dict)
    r_dict = _sign(r_dict, "stage2")
    _write_json(out_dir / "stage2_report.json", r_dict)

    package: RiskPackage = risk.run(report, session)
    p_dict = json.loads(canonical_json(package.model_dump(mode="json")).decode())
    p_dict["parent_sha256"] = compute_payload_sha256(r_dict)
    p_dict["payload_sha256"] = compute_payload_sha256(p_dict)
    p_dict = _sign(p_dict, "stage3")
    _write_json(out_dir / "stage3_package.json", p_dict)

    return s_dict, r_dict, p_dict


# ---------------------------------------------------------------- batch
def run_batch(filter_sid: str | None = None) -> dict:
    OUT.mkdir(exist_ok=True)
    _setup_logging(OUT / "pipeline_run.log")

    sessions = load_sessions()
    if filter_sid:
        sessions = [s for s in sessions if s.session_id == filter_sid]
        if not sessions:
            raise SystemExit(f"Unknown session: {filter_sid}")

    leaves: List[str] = []
    summary: List[dict] = []

    for session in sessions:
        out_dir = OUT / "sessions" / session.session_id
        s_dict, r_dict, p_dict = run_session(session, out_dir)

        leaf = sha256_hex(
            compute_payload_sha256(s_dict)
            + compute_payload_sha256(r_dict)
            + p_dict["payload_sha256"]
        )
        leaves.append(leaf)

        summary.append({
            "session_id": session.session_id,
            "vessel": session.vessel.name,
            "grade": session.bdn.grade.value,
            "deviation_pct": session.deviation_pct,
            "in_flight": session.in_flight,
            "anomalies": [a["rule"] for a in r_dict["anomalies"]],
            "critical": r_dict["critical_count"],
            "high": r_dict["high_count"],
            "data_quality_insufficient": r_dict["data_quality"]["insufficient_data"],
            "risk_score": p_dict["risk_score"],
            "risk_category": p_dict["risk_category"],
            "verdict": p_dict["verdict"],
            "estimated_impact_usd": p_dict["estimated_impact_usd"],
            "merkle_leaf": leaf,
        })

    manifest = {
        "schema_version": "0.1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "policy_version": POLICY_VERSION,
        "policy_snapshot": policy_snapshot(),
        "session_count": len(sessions),
        "merkle_root": _merkle_root(leaves),
        "merkle_algo": "SHA-256 binary tree, duplicate-last on odd count",
        "leaves": [{"session_id": s["session_id"], "leaf": s["merkle_leaf"]} for s in summary],
        "summary": summary,
    }
    _write_json(OUT / "batch_manifest.json", manifest)
    return manifest


# ---------------------------------------------------------------- pretty
def print_summary(manifest: dict) -> None:
    print(f"\nBunkerGuard pipeline — {manifest['session_count']} session(s)  "
          f"policy={manifest['policy_version']}")
    print(f"Merkle root: {manifest['merkle_root']}")
    print(f"{'-' * 110}")
    print(f"{'SESSION':<14} {'GRADE':<14} {'DEV%':>7} {'ANOMALIES':<32} {'SCORE':>6} {'CATEGORY':<18} {'VERDICT':<18} {'IMPACT USD':>11}")
    print(f"{'-' * 110}")
    for s in manifest["summary"]:
        dev = f"{s['deviation_pct']:+.2f}" if s['deviation_pct'] is not None else "  --  "
        anoms = ",".join(s["anomalies"]) or "—"
        score = str(s["risk_score"]) if s["risk_score"] is not None else "—"
        impact = f"${s['estimated_impact_usd']:>10,.0f}" if s["estimated_impact_usd"] else "          —"
        print(f"{s['session_id']:<14} {s['grade']:<14} {dev:>7} {anoms[:32]:<32} "
              f"{score:>6} {s['risk_category']:<18} {s['verdict']:<18} {impact:>11}")
    print(f"{'-' * 110}")


# ---------------------------------------------------------------- CLI
def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--session", help="Run only this session_id")
    args = p.parse_args()
    manifest = run_batch(args.session)
    print_summary(manifest)
    return 0


if __name__ == "__main__":
    sys.exit(main())
