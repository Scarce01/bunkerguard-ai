"""
BDN Image OCR Engine.

Takes a photo / scan of a physical Bunker Delivery Note and returns a
populated SessionBDN dataclass ready for the Stage 1 → 6 pipeline.

Usage
─────
  from ingestion.bdn_ocr import extract_bdn_from_image

  bdn = extract_bdn_from_image("scans/bdn_001.jpg")
  # → SessionBDN(bdn_ref='BDN-2026-001', sulphur_pct=0.026, ...)

Supported formats: JPEG, PNG, GIF, WEBP
For PDFs: convert page to image first (e.g. pdf2image or pymupdf).

Environment variables
─────────────────────
  ANTHROPIC_API_KEY   required
  BDN_DEFAULT_PORT    fallback port name if not found in image (default "UNKNOWN")
  BDN_SESSION_PREFIX  prefix for auto-generated session IDs (default "SES")
"""
from __future__ import annotations

import base64
import datetime
import json
import mimetypes
import os
import re
import uuid
from pathlib import Path
from typing import Optional

# anthropic is imported lazily inside _call_claude_vision to avoid a hard
# dependency at import time (lets normalise.py and tests load without it).

from dataclasses import dataclass, field

from contracts.stage1_session_input import SessionBDN
from ingestion.normalise import (
    clean_str,
    normalise_date,
    normalise_grade,
    normalise_sulphur,
    normalise_time,
    to_bool,
    to_float,
    to_int,
)


# ── Prompt ────────────────────────────────────────────────────────────────────

_SYSTEM = (
    "You are a maritime document digitisation expert. "
    "Extract structured data from Bunker Delivery Note (BDN) images with high precision. "
    "Return ONLY a JSON object — no markdown fences, no commentary."
)

_EXTRACTION_PROMPT = """Extract all available fields from this Bunker Delivery Note image.

Return a JSON object with these exact keys (use null for any field that is
illegible, absent, or explicitly marked as omitted). The first three keys
are about your own read of the document — be honest about uncertainty.

{
  "is_bdn":              "<true if this is a marine Bunker Delivery Note, false otherwise>",
  "parsing_confidence":  "<YOUR self-rated confidence in the extraction as a decimal in [0, 1] — based on image legibility, field coverage, and visible damage. NOT a constant.>",
  "parsing_notes":       "<one short sentence explaining the confidence: what's clear, what's missing or smudged>",
  "bdn_ref":        "<BDN number / reference>",
  "vessel":         "<vessel name>",
  "imo":            "<IMO number — digits only>",
  "supplier":       "<bunker supplier / barge company name>",
  "licence":        "<supplier MPA or local licence number, or null>",
  "barge":          "<barge name>",
  "barge_imo":      "<barge IMO or ID — alphanumeric>",
  "port":           "<port name>",
  "berth":          "<berth or anchorage name, or null>",
  "date":           "<delivery date — any format found on the document>",
  "time_start":     "<delivery start time — e.g. '1820' or '18:20'>",
  "time_end":       "<delivery finish/end time, or null if not shown>",
  "grade":          "<fuel grade — e.g. IFO 380, VLSFO, MGO, HFO>",
  "sulphur_pct":    "<sulphur content as a decimal number — e.g. 0.026 NOT '0.026%'>",
  "density_15c":    "<density at 15°C in kg/m³ — numeric only>",
  "viscosity_50c":  "<kinematic viscosity at 50°C in cSt — numeric only>",
  "flash_point":    "<flash point in °C — numeric only>",
  "qty_mt":         "<metric tonnes delivered — numeric only>",
  "sample_seal":    "<sample seal number or label, or null>",
  "supp_signed":    "<true if supplier/barge signature box is signed/stamped, else false>",
  "officer_signed": "<true if chief officer/engineer signature box is signed, else false>",
  "biofuel_pct":    "<biofuel blend percentage as decimal (e.g. 0.0 if not mentioned)>",
  "customer":       "<customer / vessel operator name, or null>"
}

Important extraction rules:
- Sulphur: read as-is from the % m/m field — do NOT convert (0.026 stays 0.026).
- Density: if shown as 0.8597, keep as-is; if shown as 859.7 kg/m³, keep as 859.7.
- Flash point: °C numeric value only.
- Times: include both 4-digit (1820) and HH:MM (18:20) formats — output whichever you see.
- Signatures: true if the signature line/box appears filled, stamped, or ticked.
- If a field is circled, struck out, or says 'omitted', set it to null.
- BDN ref: look for 'BDN Number', 'B/N No.', 'Doc No.', or a prominent reference number.
- parsing_confidence MUST reflect the actual document. A pristine, fully-filled
  BDN with a clear digital QR can be 0.95+. A faded, partially-cropped scan
  with several illegible fields should be 0.6 or lower. NEVER return a fixed
  value like 0.98 unless that genuinely matches what you saw.
"""


# ── Image loading ─────────────────────────────────────────────────────────────

def _load_image_as_base64(path: str) -> tuple[str, str]:
    """Return (base64_data, media_type) for a local image file."""
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Image not found: {path}")

    media_type, _ = mimetypes.guess_type(str(path))
    if media_type not in ("image/jpeg", "image/png", "image/gif", "image/webp"):
        # Default to JPEG for unknown types
        media_type = "image/jpeg"

    with open(path, "rb") as f:
        data = base64.standard_b64encode(f.read()).decode("utf-8")

    return data, media_type


# ── Claude API call ───────────────────────────────────────────────────────────

def _call_claude_vision(image_data: str, media_type: str) -> dict:
    import anthropic  # lazy import — only needed at call time
    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        system=[{"type": "text", "text": _SYSTEM, "cache_control": {"type": "ephemeral"}}],
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": media_type,
                        "data": image_data,
                    },
                },
                {
                    "type": "text",
                    "text": _EXTRACTION_PROMPT,
                },
            ],
        }],
    )
    raw = "".join(b.text for b in response.content if b.type == "text")
    cleaned = raw.replace("```json", "").replace("```", "").strip()
    return json.loads(cleaned)


# ── Raw dict → SessionBDN ─────────────────────────────────────────────────────

def _make_session_id(bdn_ref: str) -> str:
    prefix = os.environ.get("BDN_SESSION_PREFIX", "SES")
    year = datetime.date.today().year
    slug = re.sub(r"[^A-Z0-9]", "", (bdn_ref or "").upper())[:8] or uuid.uuid4().hex[:6].upper()
    return f"{prefix}-{year}-{slug}"


def _dict_to_bdn(raw: dict) -> SessionBDN:
    """Coerce the raw Claude extraction dict into a typed SessionBDN."""
    bdn_ref = clean_str(raw.get("bdn_ref"), default=f"BDN-{uuid.uuid4().hex[:8].upper()}")
    session_id = _make_session_id(bdn_ref)

    # Port: prefer explicit port field, fall back to berth, then env default
    port_val = (
        clean_str(raw.get("port"))
        or clean_str(raw.get("berth"))
        or os.environ.get("BDN_DEFAULT_PORT", "UNKNOWN")
    )

    start_time = normalise_time(raw.get("time_start"))
    end_time   = normalise_time(raw.get("time_end"))

    # Barge IMO may be alphanumeric on some BDNs (e.g. "0786A")
    barge_imo = clean_str(raw.get("barge_imo"), default="UNKNOWN")

    return SessionBDN(
        bdn_ref=bdn_ref,
        session_id=session_id,
        vessel=clean_str(raw.get("vessel"), default="UNKNOWN"),
        imo=to_int(raw.get("imo"), default=0),
        supplier=clean_str(raw.get("supplier") or raw.get("customer"), default="UNKNOWN"),
        licence=clean_str(raw.get("licence"), default="UNKNOWN"),
        barge=clean_str(raw.get("barge"), default="UNKNOWN"),
        barge_imo=barge_imo,
        port=port_val,
        date=normalise_date(raw.get("date")),
        start=start_time or "00:00",
        end=end_time,
        grade=normalise_grade(raw.get("grade")),
        sulphur_pct=normalise_sulphur(raw.get("sulphur_pct")),
        density_15c=to_float(raw.get("density_15c"), default=0.0),
        viscosity_50c=to_float(raw.get("viscosity_50c"), default=0.0),
        flash_point=to_float(raw.get("flash_point"), default=0.0),
        qty_mt=to_float(raw.get("qty_mt"), default=0.0),
        sample_seal=clean_str(raw.get("sample_seal"), default=""),
        supp_signed=to_bool(raw.get("supp_signed"), default=False),
        officer_signed=to_bool(raw.get("officer_signed"), default=False),
        biofuel_pct=to_float(raw.get("biofuel_pct"), default=0.0),
    )


# ── Public API ────────────────────────────────────────────────────────────────

def extract_bdn_from_image(image_path: str) -> SessionBDN:
    """
    Extract a SessionBDN from a BDN image file.

    Args:
        image_path: Path to JPEG, PNG, GIF, or WEBP image.

    Returns:
        SessionBDN populated from the image.

    Raises:
        FileNotFoundError: if the image does not exist.
        json.JSONDecodeError: if Claude returns malformed JSON (rare).
    """
    image_data, media_type = _load_image_as_base64(image_path)
    raw = _call_claude_vision(image_data, media_type)
    return _dict_to_bdn(raw)


def extract_bdn_from_bytes(image_bytes: bytes, media_type: str = "image/jpeg") -> SessionBDN:
    """
    Extract a SessionBDN from raw image bytes (e.g. from an API upload).

    Args:
        image_bytes: Raw image bytes.
        media_type:  MIME type — 'image/jpeg', 'image/png', etc.

    Returns:
        SessionBDN populated from the image.
    """
    image_data = base64.standard_b64encode(image_bytes).decode("utf-8")
    raw = _call_claude_vision(image_data, media_type)
    return _dict_to_bdn(raw)


def extract_raw_fields(image_path: str) -> dict:
    """
    Return the raw extraction dict from Claude without normalisation.
    Useful for debugging or building a review UI before committing to SessionBDN.
    """
    image_data, media_type = _load_image_as_base64(image_path)
    return _call_claude_vision(image_data, media_type)


# ── Structured result for upload UI (real confidence, not hardcoded) ──────────


@dataclass
class BDNExtractionResult:
    """What the upload UI should bind to.

    Replaces the frontend-hardcoded "98%" parsing-confidence pill with a real
    number sourced from the model + a structural field-coverage check.
    """
    bdn: SessionBDN
    is_bdn: bool
    parsing_confidence: float       # 0..1, model-reported (clamped, derated)
    parsing_notes: str
    field_coverage: float           # 0..1, share of critical fields populated
    vessel_identified: bool
    supplier_identified: bool
    quantity_extracted: bool
    fuel_grade_extracted: bool
    raw: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "is_bdn": self.is_bdn,
            "parsing_confidence": self.parsing_confidence,
            "parsing_confidence_pct": round(self.parsing_confidence * 100, 1),
            "parsing_notes": self.parsing_notes,
            "field_coverage": self.field_coverage,
            "checks": {
                "vessel_identified":     self.vessel_identified,
                "supplier_identified":   self.supplier_identified,
                "quantity_extracted":    self.quantity_extracted,
                "fuel_grade_extracted":  self.fuel_grade_extracted,
            },
            "extracted_bdn": self.bdn.__dict__ if hasattr(self.bdn, "__dict__") else dict(self.bdn),
            "raw": self.raw,
        }


# Keys whose presence the upload UI prominently displays as ticks.
_CRITICAL_FIELDS = (
    "vessel", "imo", "supplier", "qty_mt", "grade",
    "port", "date", "bdn_ref", "density_15c", "sulphur_pct",
)


def _field_present(raw: dict, key: str) -> bool:
    v = raw.get(key)
    if v is None:
        return False
    if isinstance(v, str) and v.strip().upper() in ("", "UNKNOWN", "N/A", "NULL"):
        return False
    if isinstance(v, (int, float)) and float(v) == 0.0 and key in ("qty_mt", "density_15c"):
        # Quantity / density of literal zero almost always means "not read".
        return False
    return True


def _compose_confidence(raw: dict) -> tuple[float, float, str]:
    """Return (parsing_confidence, field_coverage, notes).

    We combine two signals:
      * `parsing_confidence` self-reported by Claude (clamped to [0, 1]).
      * `field_coverage` — fraction of critical fields actually populated.

    Final confidence is the MIN of the two — a model that claims 0.99 but
    failed to read half the fields should not display 99%. This is exactly
    the case the user flagged: a constant 98% regardless of what was on
    screen.
    """
    try:
        model_conf = float(raw.get("parsing_confidence", 0.0) or 0.0)
    except (TypeError, ValueError):
        model_conf = 0.0
    model_conf = max(0.0, min(1.0, model_conf))

    present = sum(1 for k in _CRITICAL_FIELDS if _field_present(raw, k))
    coverage = present / len(_CRITICAL_FIELDS)

    final = min(model_conf, coverage) if (model_conf and coverage) else (model_conf or coverage)
    notes = (raw.get("parsing_notes") or "").strip()
    if not notes:
        notes = f"{present}/{len(_CRITICAL_FIELDS)} critical fields extracted."
    return round(final, 3), round(coverage, 3), notes


def _build_result(raw: dict) -> BDNExtractionResult:
    is_bdn = bool(raw.get("is_bdn", True))  # legacy path: assume yes if absent
    conf, coverage, notes = _compose_confidence(raw)
    bdn = _dict_to_bdn(raw) if is_bdn else _dict_to_bdn({})
    return BDNExtractionResult(
        bdn=bdn,
        is_bdn=is_bdn,
        parsing_confidence=conf,
        parsing_notes=notes,
        field_coverage=coverage,
        vessel_identified=_field_present(raw, "vessel"),
        supplier_identified=_field_present(raw, "supplier") or _field_present(raw, "customer"),
        quantity_extracted=_field_present(raw, "qty_mt"),
        fuel_grade_extracted=_field_present(raw, "grade"),
        raw=raw,
    )


def extract_bdn_with_meta(image_bytes: bytes, media_type: str = "image/jpeg") -> BDNExtractionResult:
    """Upload-flow entry point: returns the BDN + real parsing confidence.

    Use this from the upload API instead of `extract_bdn_from_bytes` so the
    frontend can render an honest "Parsing confidence: X%" pill and the
    per-field ✓ ticks (Vessel / Supplier / Quantity / Fuel Grade) without
    making numbers up.
    """
    image_data = base64.standard_b64encode(image_bytes).decode("utf-8")
    raw = _call_claude_vision(image_data, media_type)
    return _build_result(raw)


def extract_bdn_with_meta_from_path(image_path: str) -> BDNExtractionResult:
    """File-path variant of `extract_bdn_with_meta`."""
    image_data, media_type = _load_image_as_base64(image_path)
    raw = _call_claude_vision(image_data, media_type)
    return _build_result(raw)
