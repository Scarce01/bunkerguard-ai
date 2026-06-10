"""Deterministic carbon exposure calculations.

Carbon metrics are supplementary intelligence. They must not alter fraud risk,
session verdicts, or sign-off recommendations.
"""
from __future__ import annotations

from typing import Any

EMISSION_FACTORS_TCO2E_PER_MT = {
    "VLSFO": 3.114,
    "HSFO": 3.114,
    "MGO": 3.206,
    "LNG": 2.750,
    "BIOFUEL BLEND": 2.100,
}
DEFAULT_FUEL_GRADE = "VLSFO"
CARBON_MONITORING_THRESHOLD_TCO2E = 5000.0


def normalize_fuel_grade(fuel_grade: str | None) -> tuple[str, bool]:
    raw = (fuel_grade or "").strip().upper()
    if "BIO" in raw:
        return "BIOFUEL BLEND", False
    if "LNG" in raw:
        return "LNG", False
    if "MGO" in raw or raw in {"DMA", "DMZ"}:
        return "MGO", False
    if "HSFO" in raw or "HFO" in raw:
        return "HSFO", False
    if "VLSFO" in raw:
        return "VLSFO", False
    return DEFAULT_FUEL_GRADE, True


def carbon_risk_level(total_tco2e: float) -> str:
    if total_tco2e >= 10000:
        return "CRITICAL"
    if total_tco2e >= CARBON_MONITORING_THRESHOLD_TCO2E:
        return "HIGH"
    if total_tco2e >= 2500:
        return "MODERATE"
    return "LOW"


def calculate_carbon_exposure(
    quantity_mt: float | int | None,
    fuel_grade: str | None,
    supplier_total_tco2e: float | int | None = None,
) -> dict[str, Any]:
    """Calculate carbon exposure from delivered quantity and fuel grade."""
    quantity = max(0.0, float(quantity_mt or 0))
    normalized_grade, used_fallback = normalize_fuel_grade(fuel_grade)
    factor = EMISSION_FACTORS_TCO2E_PER_MT[normalized_grade]
    estimated = round(quantity * factor, 3)
    supplier_total = round(float(supplier_total_tco2e or estimated), 3)
    return {
        "fuel_grade": normalized_grade,
        "emission_factor": factor,
        "estimated_tco2e": estimated,
        "carbon_risk_level": carbon_risk_level(supplier_total),
        "supplier_total_tco2e": supplier_total,
        "used_fallback_fuel_grade": used_fallback,
    }


def aggregate_supplier_carbon(sessions: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    totals: dict[str, dict[str, Any]] = {}
    for session in sessions:
        supplier = str(session.get("supplier_name") or "Unknown supplier")
        quantity = session.get("total_fuel_mt")
        if quantity is None:
            quantity = session.get("mfm_qty_mt") or session.get("bdn_qty_mt") or 0
        carbon = calculate_carbon_exposure(quantity, session.get("fuel_grade"))
        item = totals.setdefault(
            supplier,
            {"supplier_name": supplier, "total_fuel_mt": 0.0, "supplier_total_tco2e": 0.0},
        )
        item["total_fuel_mt"] += float(quantity or 0)
        item["supplier_total_tco2e"] += carbon["estimated_tco2e"]

    for item in totals.values():
        item["total_fuel_mt"] = round(item["total_fuel_mt"], 3)
        item["supplier_total_tco2e"] = round(item["supplier_total_tco2e"], 3)
        item["carbon_risk_level"] = carbon_risk_level(item["supplier_total_tco2e"])
    return totals
