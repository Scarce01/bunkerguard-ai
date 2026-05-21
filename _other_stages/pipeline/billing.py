"""Recovery-as-a-Service billing model.

We don't sell software. We collect 5% of recovered fraud value.
- No detection → no charge.
- Detection upheld in dispute → 5% of the recovery.
- Below-threshold MEDIUM/LOW → flat audit-trail fee (we still produced evidence).
"""
from __future__ import annotations

from dataclasses import dataclass

from contracts import RiskCategory, RiskPackage, Verdict


# Default rate card — easy to A/B in pitch deck.
RECOVERY_RATE = 0.05            # 5% of recovered fraud value
AUDIT_TRAIL_FEE_USD = 250.0     # flat fee for evidenced clean delivery
NO_CHARGE_CATEGORIES = {RiskCategory.LOW}


@dataclass
class FeeQuote:
    base_recovery_usd: float
    rate_pct: float
    fee_usd: float
    customer_keeps_usd: float
    rationale: str


def compute_fee(pkg: RiskPackage) -> FeeQuote:
    """Quote a recovery fee for a closed-out risk package.

    Logic:
      • CRITICAL / HIGH with USD impact → 5% of impact
      • MODERATE with USD impact      → 5% of impact (still a billable save)
      • LOW                            → no charge, audit cost absorbed
      • INSUFFICIENT_DATA              → flat audit-trail fee (we still chained evidence)
    """
    cat = pkg.risk_category
    impact = pkg.estimated_impact_usd or 0.0

    if cat == RiskCategory.LOW:
        return FeeQuote(0.0, 0.0, 0.0, 0.0,
                        "Clean delivery — service free under Recovery-as-a-Service plan.")

    if cat == RiskCategory.INSUFFICIENT_DATA:
        return FeeQuote(0.0, 0.0, AUDIT_TRAIL_FEE_USD, 0.0,
                        f"Data incomplete — flat audit-trail fee USD {AUDIT_TRAIL_FEE_USD:,.0f} "
                        f"covers chained evidence preservation for future dispute.")

    if impact <= 0:
        return FeeQuote(0.0, 0.0, AUDIT_TRAIL_FEE_USD, 0.0,
                        "Risk flagged but no quantifiable USD exposure — audit-trail fee only.")

    fee = round(impact * RECOVERY_RATE, 2)
    keeps = round(impact - fee, 2)
    return FeeQuote(
        base_recovery_usd=impact,
        rate_pct=RECOVERY_RATE * 100,
        fee_usd=fee,
        customer_keeps_usd=keeps,
        rationale=(f"Recovery-as-a-Service: 5% of USD {impact:,.0f} recoverable exposure. "
                   f"Customer net benefit: USD {keeps:,.0f}. "
                   f"No save, no fee — billed only on enforced LOP/refusal."),
    )
