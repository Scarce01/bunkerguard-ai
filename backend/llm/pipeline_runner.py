"""End-to-end pipeline runner — Stage 1 → 2 → 3 → 4 → 5 → 6.

Stages 1–3 are deterministic Python (existing ``anomaly`` / ``risk`` modules).
Stages 4–6 use the Claude API.

Usage:
    PYTHONPATH=. python -m llm.pipeline_runner --session contracts/examples/session_input_example.json
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import anomaly
import risk
from contracts import SessionInput

from .stage4_copilot import run_stage4
from .stage5_report import run_stage5
from .stage6_reputation import run_stage6

REPO_ROOT = Path(__file__).resolve().parent.parent


def run_full_pipeline(
    session_path: Path,
    *,
    history_path: Optional[Path] = None,
    output_dir: Optional[Path] = None,
    verbose: bool = True,
    skip_llm: bool = False,
    generate_outputs: bool = True,
) -> dict:
    """Load a SessionInput JSON and run the full pipeline.

    Args:
        session_path: path to a Stage 1 SessionInput JSON.
        history_path: optional path to a supplier history JSON list. Each item
            should be {session, date, qty_bdn, qty_mfm, pct}. Missing → [].
        output_dir: where to save the result JSON. Default: ``pipeline_out/``.
        skip_llm: dry-run Stages 1-3 only. Useful for smoke tests offline.
    """
    def log(msg: str, stage: Optional[int] = None) -> None:
        if not verbose:
            return
        prefix = f"[Stage {stage}]" if stage else "[Pipeline]"
        print(f"{prefix} {msg}")

    start = time.time()
    results: dict = {"session_path": str(session_path)}

    log(f"loading session from {session_path.name}", 1)
    session_dict = json.loads(session_path.read_text(encoding="utf-8"))
    session = SessionInput.model_validate(session_dict)
    results["session_id"] = session.session_id
    log(f"session {session.session_id} - vessel {session.vessel.name}", 1)

    log("running 26 anomaly rules", 2)
    report = anomaly.run(session)
    log(
        f"{len(report.anomalies)} anomalies - "
        f"crit={report.critical_count} high={report.high_count} "
        f"med={report.medium_count} low={report.low_count}",
        2,
    )
    for a in report.anomalies:
        rule = a.rule.value if hasattr(a.rule, "value") else a.rule
        sev = a.severity.value if hasattr(a.severity, "value") else a.severity
        log(f"  - {rule:<10} {sev:<8} {a.rule_name}", 2)
    results["stage2"] = report.model_dump(mode="json")

    log("computing risk score", 3)
    package = risk.run(report, session)
    verdict = package.verdict.value if hasattr(package.verdict, "value") else package.verdict
    cat = package.risk_category.value if hasattr(package.risk_category, "value") else package.risk_category
    log(f"score={package.risk_score}/100 ({cat}) -> {verdict}", 3)
    log(f"USD impact: {package.estimated_impact_usd}", 3)
    results["stage3"] = package.model_dump(mode="json")

    history = _load_history(history_path)

    if skip_llm:
        log("--skip-llm set, stopping after Stage 3 (LLM stages skipped)")
        if generate_outputs:
            _maybe_generate_outputs(
                session, report, package,
                llm_analysis=None, blockchain=None,
                supplier_history=history, results=results, log=log,
            )
        return _save(results, output_dir, session.session_id, start, log)

    log("calling Claude for Chief Engineer summary", 4)
    llm_analysis = run_stage4(session, report, package)
    if "error" in llm_analysis:
        log(f"  WARN: stage 4 LLM error: {llm_analysis['error']}", 4)
    else:
        log(f"  action: {llm_analysis.get('recommended_action')} (conf {llm_analysis.get('confidence')})", 4)
        log(f"  summary: {(llm_analysis.get('summary') or '')[:160]}...", 4)
    results["stage4"] = llm_analysis

    log("generating evidence report + hash chain", 5)
    evidence_report = run_stage5(session, report, package, llm_analysis)
    if "error" in evidence_report:
        log(f"  WARN: stage 5 LLM error: {evidence_report['error']}", 5)
    bc = evidence_report.get("blockchain", {})
    log(f"  tx: {bc.get('tx_hash', 'N/A')} ({bc.get('chain', '?')})", 5)
    results["stage5"] = evidence_report

    log(f"updating supplier reputation ({len(history)} historical sessions)", 6)
    reputation = run_stage6(session, package, history)
    if "error" in reputation:
        log(f"  WARN: stage 6 LLM error: {reputation['error']}", 6)
    else:
        log(f"  new reputation: {reputation.get('new_reputation_score')}/100 ({reputation.get('trend')})", 6)
        if reputation.get("alert_type") not in (None, "NONE"):
            log(f"  >> ALERT: {reputation['alert_type']} - {reputation.get('alert_message','')}", 6)
    results["stage6"] = reputation

    if generate_outputs:
        _maybe_generate_outputs(
            session, report, package,
            llm_analysis=llm_analysis,
            blockchain=evidence_report.get("blockchain"),
            supplier_history=history, results=results, log=log,
        )

    return _save(results, output_dir, session.session_id, start, log)


def _maybe_generate_outputs(
    session, report, package, *,
    llm_analysis, blockchain, supplier_history, results, log,
) -> None:
    """Run outputs.report_bundle.generate_all and stash paths in results."""
    log("generating report bundle (PDF + charts + exports)", 7)
    try:
        from outputs.report_bundle import generate_all
    except ImportError as e:
        log(f"  SKIP: outputs module not importable ({e})", 7)
        return

    try:
        files = generate_all(
            session, report, package,
            llm_analysis=llm_analysis,
            blockchain=blockchain,
            supplier_history=supplier_history,
            verbose=False,
        )
        results["outputs"] = files
        for k, v in files.items():
            if v and k != "output_dir":
                log(f"  {k}: {v}", 7)
        log(f"  output_dir: {files.get('output_dir')}", 7)
    except Exception as e:
        log(f"  WARN: output generation failed: {type(e).__name__}: {e}", 7)


def _load_history(history_path: Optional[Path]) -> list[dict]:
    if history_path is None or not history_path.exists():
        return []
    data = json.loads(history_path.read_text(encoding="utf-8"))
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        # support {supplier_name: [rows]} shape too
        for v in data.values():
            if isinstance(v, list):
                return v
    return []


def _save(results: dict, output_dir: Optional[Path], session_id: str,
          start: float, log) -> dict:
    elapsed = time.time() - start
    out_dir = output_dir or (REPO_ROOT / "pipeline_out")
    out_dir.mkdir(parents=True, exist_ok=True)
    fname = f"{session_id}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.json"
    out_path = out_dir / fname
    out_path.write_text(json.dumps(results, indent=2, default=str), encoding="utf-8")
    log(f"complete in {elapsed:.1f}s - saved to {out_path}")
    return results


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="BunkerGuard 6-stage pipeline runner")
    parser.add_argument(
        "--session",
        default=str(REPO_ROOT / "contracts/examples/session_input_example.json"),
        help="Path to SessionInput JSON",
    )
    parser.add_argument(
        "--history",
        default=None,
        help="Optional path to supplier history JSON list",
    )
    parser.add_argument(
        "--output-dir",
        default=None,
        help="Directory for output JSON (default: pipeline_out/)",
    )
    parser.add_argument("--quiet", action="store_true")
    parser.add_argument(
        "--skip-llm",
        action="store_true",
        help="Run only Stages 1-3 (deterministic) - no Claude calls",
    )
    parser.add_argument(
        "--no-outputs",
        action="store_true",
        help="Skip the PDF / chart / export generation step",
    )
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")

    session_path = Path(args.session)
    if not session_path.exists():
        print(f"error: session file not found: {session_path}", file=sys.stderr)
        return 2

    history_path = Path(args.history) if args.history else None
    output_dir = Path(args.output_dir) if args.output_dir else None

    run_full_pipeline(
        session_path,
        history_path=history_path,
        generate_outputs=not args.no_outputs,
        output_dir=output_dir,
        verbose=not args.quiet,
        skip_llm=args.skip_llm,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
