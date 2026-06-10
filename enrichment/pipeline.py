"""Parallel Exa enrichment for supplier, vessel, barge, and port entities."""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from typing import Any

from .exa_search import search


def _has_risk_terms(result: dict, terms: tuple[str, ...]) -> bool:
    text = " ".join(
        f"{hit.get('title', '')} {' '.join(hit.get('highlights') or [])}"
        for hit in result.get("hits", [])
    ).lower()
    return any(term in text for term in terms)


def enrich_entities(extracted: dict[str, Any]) -> dict[str, Any]:
    supplier = extracted.get("supplier_name") or "Unknown supplier"
    vessel = extracted.get("vessel_name") or "Unknown vessel"
    imo = extracted.get("imo_number") or ""
    barge = extracted.get("barge_name") or "Unknown barge"
    port = extracted.get("port") or "Unknown port"
    queries = {
        "supplier_profile": f'"{supplier}" company profile bunker supplier ownership',
        "supplier_adverse": f'"{supplier}" sanctions litigation fraud dispute negative news compliance',
        "vessel_history": f'"{vessel}" IMO {imo} ownership history port state detention incident',
        "vessel_risk": f'"{vessel}" IMO {imo} casualty sanctions high risk maritime pattern',
        "barge": f'"{barge}" bunker barge incident ownership compliance',
        "port": f'"{port}" bunkering dispute operational risk compliance alert',
    }
    with ThreadPoolExecutor(max_workers=6) as pool:
        results = dict(zip(queries, pool.map(lambda item: search(item[1]), queries.items())))

    adverse = results["supplier_adverse"]
    vessel_risk = results["vessel_risk"]
    port_risk = results["port"]
    return {
        "supplier": {
            "supplier_name": supplier,
            "company_profile": results["supplier_profile"],
            "sanctions_check": "POTENTIAL_MATCH_REVIEW" if _has_risk_terms(adverse, ("sanction", "watchlist")) else "NO_MATCH_IN_SEARCH_RESULTS",
            "litigation_history": adverse,
            "fraud_indicators": _has_risk_terms(adverse, ("fraud", "short delivery", "under-delivery")),
            "negative_news": adverse,
            "compliance_findings": [
                "External search context requires officer verification before use."
            ],
        },
        "vessel": {
            "vessel_name": vessel,
            "imo_number": str(imo),
            "vessel_history": results["vessel_history"],
            "ownership": results["vessel_history"],
            "previous_incidents": vessel_risk,
            "high_risk_patterns": _has_risk_terms(vessel_risk, ("detention", "casualty", "sanction", "incident")),
        },
        "barge": {"barge_name": barge, "intelligence": results["barge"]},
        "port": {
            "port": port,
            "operational_risk": port_risk,
            "known_bunkering_disputes": port_risk,
            "regional_compliance_alerts": port_risk,
        },
        "source": "exa",
        "supplementary_only": True,
    }
