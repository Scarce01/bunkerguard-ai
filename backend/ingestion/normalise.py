"""
Field normalisation helpers.

Claude extracts raw strings from the image; these functions coerce them
into the exact types that SessionBDN expects.
"""
from __future__ import annotations

import re
import datetime
from typing import Optional


# ── Numbers ───────────────────────────────────────────────────────────────────

def to_float(raw: str | float | int | None, default: float = 0.0) -> float:
    if raw is None:
        return default
    if isinstance(raw, (int, float)):
        return float(raw)
    cleaned = re.sub(r"[^\d.\-]", "", str(raw))
    try:
        return float(cleaned)
    except ValueError:
        return default


def to_int(raw: str | float | int | None, default: int = 0) -> int:
    return int(round(to_float(raw, float(default))))


def to_bool(raw: str | bool | None, default: bool = False) -> bool:
    if raw is None:
        return default
    if isinstance(raw, bool):
        return raw
    return str(raw).strip().lower() in ("true", "yes", "1", "signed", "y", "tick", "✓", "x")


# ── Sulphur ───────────────────────────────────────────────────────────────────

def normalise_sulphur(raw: str | float | None) -> float:
    """
    BDNs express sulphur as % m/m.  Values like "0.026" and "0.47" are
    already decimal-fractions (not divided by 100).
    Guard against entries like "2.6%" which means 0.026 % m/m (rare but seen).
    """
    val = to_float(raw, 0.0)
    # If someone accidentally wrote a whole-number percent (e.g. 4.5 meaning 4.5%)
    # that still passes through — it'll trigger the MARPOL anomaly correctly.
    return round(val, 4)


# ── Dates & times ─────────────────────────────────────────────────────────────

_DATE_FMTS = [
    "%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d",
    "%d/%m/%y", "%d-%m-%y",
    "%d %b %Y", "%d %B %Y",
    "%b %d, %Y", "%B %d, %Y",
]

def normalise_date(raw: str | None) -> str:
    """Return ISO date string 'YYYY-MM-DD', or today's date if unparseable."""
    if not raw:
        return datetime.date.today().isoformat()
    raw = raw.strip()
    for fmt in _DATE_FMTS:
        try:
            return datetime.datetime.strptime(raw, fmt).date().isoformat()
        except ValueError:
            pass
    # Last resort — return as-is if it already looks like ISO
    if re.match(r"\d{4}-\d{2}-\d{2}", raw):
        return raw[:10]
    return datetime.date.today().isoformat()


def normalise_time(raw: str | None) -> Optional[str]:
    """
    Normalise a time value to 'HH:MM'.
    Handles: '1820', '18:20', '18.20', '1820 Hours', None.
    Returns None if raw is None (used for delivery_end when still in progress).
    """
    if raw is None:
        return None
    raw = re.sub(r"[Hh]ours?|[Hh]rs?", "", str(raw)).strip()
    raw = re.sub(r"[\s.]", "", raw)  # remove spaces and dots
    raw = raw.replace(":", "")
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 3:
        digits = "0" + digits   # e.g. "820" → "0820"
    if len(digits) >= 4:
        return f"{digits[:2]}:{digits[2:4]}"
    return None


# ── Grade & grade normalisation ───────────────────────────────────────────────

_GRADE_ALIASES: dict[str, str] = {
    "ifo":    "IFO 380",
    "ifo380": "IFO 380",
    "ifo180": "IFO 180",
    "hfo":    "HFO",
    "vlsfo":  "VLSFO",
    "ulsfo":  "ULSFO",
    "mgo":    "MGO",
    "mdo":    "MDO",
    "lsfo":   "LSFO",
}

def normalise_grade(raw: str | None) -> str:
    if not raw:
        return "UNKNOWN"
    key = re.sub(r"[\s\-_]", "", raw).lower()
    return _GRADE_ALIASES.get(key, raw.strip().upper())


# ── String cleanup ────────────────────────────────────────────────────────────

def clean_str(raw: str | None, default: str = "") -> str:
    if raw is None:
        return default
    return str(raw).strip()
