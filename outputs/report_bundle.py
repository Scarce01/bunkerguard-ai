"""Single entry point — produce every output file for one session.

Takes the typed pydantic objects (the rest of the codebase's lingua franca),
extracts a flat ``ViewBundle``, then drives the chart / PDF / data-export
modules. Skips gracefully when an output's dep isn't installed.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import TYPE_CHECKING, Optional

from ._extract import ViewBundle, extract_view, mfm_timeline
from .config import session_dir

if TYPE_CHECKING:
    from contracts import AnomalyReport, RiskPackage, SessionInput

log = logging.getLogger("bunkerguard.outputs")


def generate_all(
    session: "SessionInput",
    report: "AnomalyReport",
    package: "RiskPackage",
    *,
    llm_analysis: Optional[dict] = None,
    blockchain: Optional[dict] = None,
    supplier_history: Optional[list[dict]] = None,
    output_dir: Optional[Path] = None,
    verbose: bool = True,
) -> dict:
    """Run every renderer for one session.

    Returns dict of ``{output_type: filepath_str}``. Missing deps for one
    output never block the others — each is wrapped.
    """
    out = output_dir or session_dir(session.session_id)
    view = extract_view(session, report, package,
                        llm_analysis=llm_analysis,
                        supplier_history=supplier_history)
    results: dict = {"output_dir": str(out)}

    # ---------- charts ----------
    chart_paths: dict = {}
    chart_paths["quantity_comparison"] = _safe(
        "chart_quantity_comparison",
        _chart_quantity, view, out, results, verbose,
    )
    chart_paths["risk_breakdown"] = _safe(
        "chart_risk_breakdown",
        _chart_risk, view, out, results, verbose,
    )
    if view.history.get("rows"):
        chart_paths["supplier_history"] = _safe(
            "chart_supplier",
            _chart_supplier, view, out, results, verbose,
        )
    timeline = mfm_timeline(session)
    if timeline:
        chart_paths["mfm_flow"] = _safe(
            "chart_mfm_flow",
            lambda v, o: _chart_mfm(v, timeline, o), view, out, results, verbose,
        )

    explorer_url = (blockchain or {}).get("explorer") or (blockchain or {}).get("tx_hash") or ""
    if explorer_url:
        chart_paths["qr_code"] = _safe(
            "qr_code",
            lambda v, o: _make_qr(explorer_url, o), view, out, results, verbose,
        )

    # ---------- PDFs ----------
    _safe("pdf_report", lambda v, o: _pdf_report(v, chart_paths, o),
          view, out, results, verbose)
    if view.risk["verdict"] in ("SIGN_WITH_LOP", "REFUSE_TO_SIGN"):
        _safe("pdf_lop", _pdf_lop, view, out, results, verbose)
    _safe("pdf_certificate",
          lambda v, o: _pdf_certificate(v, blockchain, chart_paths.get("qr_code"), o),
          view, out, results, verbose)

    # ---------- data exports ----------
    _safe("json_full",
          lambda v, o: _export_json(v, blockchain, o), view, out, results, verbose)
    _safe("csv_anomalies", _export_csv, view, out, results, verbose)
    _safe("excel_session", _export_excel, view, out, results, verbose)

    if verbose:
        print(f"\n[outputs] generated in {out}")
        for k, v in results.items():
            if k == "output_dir":
                continue
            if v:
                print(f"  {k}: {Path(v).name}")

    return results


# ---------- thin wrappers (import the heavy lib inside, so a missing dep only
# breaks the specific output it powers) ----------

def _chart_quantity(view: ViewBundle, out: Path) -> Path:
    from .charts import chart_quantity_comparison
    return chart_quantity_comparison(
        view.bdn["quantity_mt"], view.mfm["cumulative_mass"],
        output_path=out / "chart_quantity.png",
    )


def _chart_risk(view: ViewBundle, out: Path) -> Path:
    from .charts import chart_risk_breakdown
    return chart_risk_breakdown(view.risk, output_path=out / "chart_risk.png")


def _chart_supplier(view: ViewBundle, out: Path) -> Optional[Path]:
    from .charts import chart_supplier_history
    return chart_supplier_history(
        view.bdn["supplier_name"], view.history["rows"],
        output_path=out / "chart_supplier.png",
    )


def _chart_mfm(view: ViewBundle, timeline: list[dict], out: Path) -> Optional[Path]:
    from .charts import chart_mfm_flow_profile
    return chart_mfm_flow_profile(
        timeline, view.bdn["quantity_mt"],
        output_path=out / "chart_mfm_flow.png",
    )


def _make_qr(data: str, out: Path) -> Path:
    from .charts import generate_qr_code
    return generate_qr_code(data, output_path=out / "qr_blockchain.png")


def _pdf_report(view: ViewBundle, chart_paths: dict, out: Path) -> Path:
    from .pdf_report import generate_evidence_report
    return generate_evidence_report(view, chart_paths=chart_paths, output_dir=out)


def _pdf_lop(view: ViewBundle, out: Path) -> Path:
    from .pdf_lop import generate_lop
    return generate_lop(view, output_dir=out)


def _pdf_certificate(view: ViewBundle, blockchain: Optional[dict],
                     qr_path: Optional[Path], out: Path) -> Path:
    from .pdf_certificate import generate_certificate
    return generate_certificate(view, blockchain=blockchain,
                                qr_path=qr_path, output_dir=out)


def _export_json(view: ViewBundle, blockchain: Optional[dict], out: Path) -> Path:
    from .data_export import export_pipeline_json
    extra = {"blockchain": blockchain} if blockchain else None
    return export_pipeline_json(view, output_dir=out, extra=extra)


def _export_csv(view: ViewBundle, out: Path) -> Path:
    from .data_export import export_anomalies_csv
    return export_anomalies_csv(view, output_dir=out)


def _export_excel(view: ViewBundle, out: Path) -> Path:
    from .data_export import export_session_excel
    return export_session_excel(view, output_dir=out)


# ---------- shared error-handling ----------

def _safe(name, fn, view, out, results, verbose):
    try:
        path = fn(view, out)
        results[name] = str(path) if path else None
        return path
    except ImportError as e:
        msg = f"missing dep ({e.name})"
        log.warning("output_skipped", extra={"output": name, "reason": msg})
        if verbose:
            print(f"  [skip {name}] {msg}")
        results[name] = None
        return None
    except Exception as e:
        log.exception("output_failed", extra={"output": name})
        if verbose:
            print(f"  [fail {name}] {type(e).__name__}: {e}")
        results[name] = None
        return None
