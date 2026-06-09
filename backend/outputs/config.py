"""Output configuration — paths, branding, constants."""
from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path

# Output root. Override with $env:BUNKERGUARD_OUTPUT.
OUTPUT_DIR = Path(os.getenv("BUNKERGUARD_OUTPUT", "./output"))


def session_dir(session_id: str) -> Path:
    """One sub-directory per session-run, suffixed with UTC timestamp."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    d = OUTPUT_DIR / f"{session_id}_{ts}"
    d.mkdir(parents=True, exist_ok=True)
    return d


# Branding (hex strings for both reportlab + matplotlib).
BRAND = {
    "name": "BunkerGuard AI",
    "tagline": "Intelligent Bunkering Operations Platform",
    "version": "1.0",
    "color_primary": "#1B4F72",   # deep blue
    "color_accent": "#00D4FF",    # cyan
    "color_danger": "#DC2626",    # red
    "color_warning": "#EA580C",   # orange
    "color_caution": "#CA8A04",   # yellow
    "color_success": "#16A34A",   # green
    "color_gray": "#7A8998",
    "color_dark_bg": "#0C1220",
    "color_panel": "#111827",
    "color_grid": "#1A2A44",
    "color_text": "#C8D8F0",
    "color_axis": "#5A7898",
    "color_table_alt": "#F2F3F4",
}

# Spot prices for financial-impact calculation. Match
# ``policy.FUEL_PRICE_USD_PER_MT`` shape so we can swap in policy values if
# the caller prefers. Keys must include the FuelGrade enum's ``.value``.
FUEL_PRICE = {
    "VLSFO RMG 380": 585.0,
    "HSFO RMG 380": 420.0,
    "MGO DMA": 780.0,
    "RME 180": 560.0,
    "LSMGO": 760.0,
    "ULSFO": 620.0,
}

# Severity -> color (hex, ASCII keys only)
SEVERITY_COLORS = {
    "CRITICAL": BRAND["color_danger"],
    "HIGH": BRAND["color_warning"],
    "MEDIUM": BRAND["color_caution"],
    "LOW": BRAND["color_success"],
}

# Verdict -> color
VERDICT_COLORS = {
    "REFUSE_TO_SIGN": BRAND["color_danger"],
    "SIGN_WITH_LOP": BRAND["color_warning"],
    "SIGN_WITH_NOTES": BRAND["color_caution"],
    "SIGN": BRAND["color_success"],
    "INSUFFICIENT_DATA": BRAND["color_gray"],
}

# PDF page geometry (A4 in points).
PDF_MARGIN = 50
PDF_PAGE_W = 595.27
PDF_PAGE_H = 841.89
