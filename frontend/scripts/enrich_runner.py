"""enrich_runner.py — Vite proxy entry point for the new enrichment pipeline.

Usage:
    python enrich_runner.py '{"supplier_name": "...", "vessel_name": "...", ...}'

Reads a single JSON arg, calls enrichment.enrich_entities, and prints the
resulting dict back as JSON on stdout. Errors are printed as JSON on stdout
too (with `ok: false`) so the Vite middleware always gets parseable output.

Env vars required:
    EXA_API_KEY        Exa Search key
    BACKEND_REPO_PATH  Path containing the `enrichment` package (default D:/next bunker)
"""
from __future__ import annotations

import json
import os
import sys
import traceback


def _emit(payload: dict) -> None:
    sys.stdout.write(json.dumps(payload))
    sys.stdout.flush()


def main() -> int:
    try:
        backend = os.environ.get("BACKEND_REPO_PATH", r"D:/next bunker")
        if backend not in sys.path:
            sys.path.insert(0, backend)
        from enrichment import enrich_entities  # type: ignore

        raw = sys.argv[1] if len(sys.argv) > 1 else "{}"
        extracted = json.loads(raw)
        result = enrich_entities(extracted)
        _emit({"ok": True, "result": result})
        return 0
    except Exception as exc:  # noqa: BLE001 - we want to surface any failure
        _emit({
            "ok": False,
            "error": str(exc),
            "type": type(exc).__name__,
            "trace": traceback.format_exc()[-2000:],
        })
        return 1


if __name__ == "__main__":
    sys.exit(main())
