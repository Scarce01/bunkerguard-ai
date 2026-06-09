"""Pipeline data exports — JSON / CSV / Excel.

Required for Excel: pandas + openpyxl. JSON and CSV use stdlib only.
"""
from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from ._extract import ViewBundle


def export_json(data: dict, filename: str,
                output_dir: Optional[Path] = None) -> Path:
    """Dump any dict as pretty JSON. Datetimes / pydantic objects -> str."""
    out_dir = output_dir or Path("./output")
    out_dir.mkdir(parents=True, exist_ok=True)
    filepath = out_dir / filename
    filepath.write_text(
        json.dumps(data, indent=2, default=str), encoding="utf-8")
    return filepath


def export_pipeline_json(view: "ViewBundle", *,
                         filename: Optional[str] = None,
                         output_dir: Optional[Path] = None,
                         extra: Optional[dict] = None) -> Path:
    """Dump the ViewBundle (+ optional extras) as one JSON file."""
    payload = {
        "session_id": view.session_id,
        "generated_at": view.generated_at,
        "bdn": view.bdn,
        "mfm_summary": view.mfm,
        "vessel": view.vessel,
        "supplier": view.supplier,
        "barge": view.barge,
        "risk": view.risk,
        "anomalies": view.anomalies,
        "data_quality": view.data_quality,
        "history": view.history,
        "chain": view.chain,
        "llm_analysis": view.llm_analysis,
    }
    if extra:
        payload.update(extra)
    return export_json(payload, filename or f"pipeline_{view.session_id}.json",
                       output_dir)


def export_anomalies_csv(view: "ViewBundle",
                         output_dir: Optional[Path] = None) -> Path:
    """One row per anomaly."""
    out_dir = output_dir or Path("./output")
    out_dir.mkdir(parents=True, exist_ok=True)
    filepath = out_dir / "anomalies.csv"

    keys = ["rule_id", "name", "severity", "description", "regulatory_basis",
            "measured", "reference", "deviation_pct", "unit", "confidence"]

    if not view.anomalies:
        filepath.write_text("rule_id,name,severity,description\n# no anomalies detected\n",
                            encoding="utf-8")
        return filepath

    with filepath.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=keys, extrasaction="ignore")
        writer.writeheader()
        for a in view.anomalies:
            writer.writerow({k: a.get(k, "") for k in keys})
    return filepath


def export_session_excel(view: "ViewBundle",
                         output_dir: Optional[Path] = None) -> Path:
    """Multi-sheet xlsx: BDN, MFM Summary, Anomalies, Risk Score,
    Supplier History, AI Analysis.

    Requires pandas + openpyxl. Raises ImportError otherwise.
    """
    import pandas as pd  # type: ignore[import-not-found]

    out_dir = output_dir or Path("./output")
    out_dir.mkdir(parents=True, exist_ok=True)
    filepath = out_dir / f"session_{view.session_id}.xlsx"

    with pd.ExcelWriter(str(filepath), engine="openpyxl") as writer:
        pd.DataFrame([view.bdn]).to_excel(writer, sheet_name="BDN", index=False)
        pd.DataFrame([view.mfm]).to_excel(writer, sheet_name="MFM Summary", index=False)

        if view.anomalies:
            anom_df = pd.DataFrame([{
                "rule_id": a["rule_id"],
                "name": a["name"],
                "severity": a["severity"],
                "confidence": a["confidence"],
                "deviation_pct": a.get("deviation_pct"),
                "measured": a.get("measured"),
                "reference": a.get("reference"),
                "unit": a.get("unit"),
                "regulatory_basis": a.get("regulatory_basis"),
                "description": a.get("description"),
            } for a in view.anomalies])
            anom_df.to_excel(writer, sheet_name="Anomalies", index=False)

        risk_row = {
            "risk_score": view.risk["risk_score"],
            "category": view.risk["category"],
            "verdict": view.risk["verdict"],
            "verdict_reason": view.risk["verdict_reason"],
            "financial_impact_usd": view.risk.get("financial_impact"),
            "raw_weighted_sum": view.risk["raw_weighted_sum"],
            "final_score_after_floor": view.risk["final_score_after_floor"],
            **view.risk["components"],
            **{f"weighted_{k}": v for k, v in view.risk["weighted"].items()},
        }
        pd.DataFrame([risk_row]).to_excel(writer, sheet_name="Risk Score", index=False)

        rows = view.history.get("rows") or []
        if rows:
            pd.DataFrame(rows).to_excel(writer, sheet_name="Supplier History", index=False)

        llm = view.llm_analysis or {}
        if llm:
            llm_flat = {
                "summary": llm.get("summary", ""),
                "recommendation": llm.get("recommendation", ""),
                "recommended_action": llm.get("recommended_action", ""),
                "confidence": llm.get("confidence", ""),
                "supplier_note": llm.get("supplier_note", ""),
                "error": llm.get("error", ""),
            }
            pd.DataFrame([llm_flat]).to_excel(writer, sheet_name="AI Analysis", index=False)

    return filepath
