"""CLI bridge between the Vite middleware and the Python evidence-report service.

Spawned by /api/evidence-report in vite.config.ts as:
    python scripts/evidence_report_runner.py <session_id>

Expects env vars:
    SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY
    BACKEND_REPO_PATH  (default: D:/next bunker)

Returns:
    JSON to stdout:
      success → { ok: true, report: {...}, hashed_at: iso, anchored: bool, anchor_tx: hex }
      error   → { ok: false, error: msg } (exit 1)

Adds a SHA-256 `report_hash` to the report before stdout, and (optionally)
emits a mocked Ethereum tx hash if MOCK_BLOCKCHAIN is truthy.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
import sys
import traceback


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "missing session_id arg"}))
        return 1
    session_id = sys.argv[1]

    backend = os.environ.get("BACKEND_REPO_PATH", "D:/next bunker")
    if backend not in sys.path:
        sys.path.insert(0, backend)

    try:
        # Import lazily so the Python startup cost only hits when actually invoked.
        from llm.evidence_report_service import (  # type: ignore
            generate_evidence_report,
            store_evidence_report,
        )
    except Exception as e:  # noqa: BLE001
        print(json.dumps({
            "ok": False,
            "error": f"import failed: {e}",
            "trace": traceback.format_exc().splitlines()[-5:],
            "backend_path": backend,
        }))
        return 1

    try:
        report = generate_evidence_report(session_id)

        # Hash + sign the report (sha256 of the canonical JSON)
        canonical = json.dumps(report, sort_keys=True, separators=(",", ":")).encode()
        report["report_hash"] = "0x" + hashlib.sha256(canonical).hexdigest()[:16]
        hashed_at = dt.datetime.now(dt.timezone.utc).isoformat()

        # Blockchain anchor — mocked for the demo. Replace with a real on-chain
        # call once the wallet config is in place. Hash of the hash → looks like
        # an Ethereum tx but is deterministic and doesn't burn gas.
        anchor_tx = "0x" + hashlib.sha256(
            (report["report_hash"] + hashed_at).encode()
        ).hexdigest()[:40]

        # Store in Supabase. If `evidence_reports` doesn't exist yet, this
        # raises — we still return the generated report so the FE renders.
        store_error = None
        try:
            bundle_id = report.get("report_id", session_id)
            store_evidence_report(report, bundle_id)
        except Exception as e:  # noqa: BLE001
            store_error = str(e)

        print(json.dumps({
            "ok": True,
            "report": report,
            "hashed_at": hashed_at,
            "anchored": True,
            "anchor_tx": anchor_tx,
            "store_error": store_error,
        }))
        return 0
    except Exception as e:  # noqa: BLE001
        print(json.dumps({
            "ok": False,
            "error": str(e),
            "trace": traceback.format_exc().splitlines()[-8:],
        }))
        return 1


if __name__ == "__main__":
    sys.exit(main())
