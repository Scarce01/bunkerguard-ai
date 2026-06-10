"""Prompt + JSON schema for Claude-driven BDN ingestion.

The ingestion layer used to be CSV-hardcoded (see _other_stages/ingest/__init__.py).
For real uploads we hand the document straight to Claude and ask it to:

  1. Decide whether the document is in fact a Bunker Delivery Note (BDN) at all,
     not a cargo manifest / charter party / arbitrary scan. This is the
     "clarify is it bdn or not" half of the requirement.
  2. If it is a BDN, extract the typed fields BunkerGuard's downstream
     pipeline already understands — so the LLM output can drop straight into
     a `BDNDoc` without per-supplier templating.

Keep the schema tight: every field marked nullable so Claude can return
`null` rather than hallucinating, and `additionalProperties: false` so the
structured-output enforcement actually bites.
"""
from __future__ import annotations


BDN_INGEST_SYSTEM = """\
You are BunkerGuard's document intake analyst.

You will be shown ONE document that an officer has uploaded as a Bunker
Delivery Note (BDN). Two jobs:

A) CLASSIFY — decide if the document really is a marine BDN.
   A BDN must, at minimum, identify:
     - the receiving vessel (name and/or IMO)
     - the supplier/barge
     - a delivered fuel grade (VLSFO / HSFO / MGO / LSMGO / B24 / B30 / …)
     - a delivered quantity in metric tonnes
     - delivery date and port
   Cargo manifests, charter parties, sample lab certificates, invoices,
   blank templates, photos of a screen, or anything unrelated → NOT a BDN.
   When unsure, lean towards `is_bdn=false` with a clear reason.

B) EXTRACT — if and only if is_bdn=true, pull the typed fields BunkerGuard
   needs. Use null for any field that is genuinely absent or illegible — do
   NOT invent values, do NOT round.

Rules:
- Respond with the JSON object the schema asks for. No prose, no fences.
- Output a SINGLE top-level object with these keys exactly:
    is_bdn, confidence, reasoning, document_type, red_flags, extracted
  All BDN field values MUST live inside `extracted` — never at the top
  level. Even if some fields are null, the `extracted` object must be
  present with every field key. An example shape (values illustrative):
    {
      "is_bdn": true,
      "confidence": 0.93,
      "reasoning": "Has BDN number, vessel IMO, qty in MT, fuel grade…",
      "document_type": "BDN",
      "red_flags": [],
      "extracted": {
        "bdn_ref": "1111",
        "vessel_name": "XPRESS NUPTSE",
        "vessel_imo": "9678630",
        "supplier_name": "Lanka Marine Services (Pvt) Ltd",
        "barge_name": "LMN",
        "barge_imo": null,
        "port": "Colombo",
        "delivery_date": "2019-08-11",
        "time_start": "21:42",
        "time_end": "23:30",
        "grade": "HSFO RMG 380",
        "qty_mt": 299.913,
        "density_15c_kg_m3": 984.8,
        "viscosity_50c_cst": 358.5,
        "sulphur_pct": 2.81,
        "flash_point_c": 94,
        "biofuel_pct": 0,
        "sample_seal": "LMS 014251",
        "supplier_signed": true,
        "officer_signed": true,
        "ebdn_status": "MISSING"
      }
    }
- `confidence` ∈ [0,1] is YOUR self-rated confidence in the classification.
- Quantities are metric tonnes. Density is kg/m³ at 15°C. Viscosity is cSt
  at 50°C. Sulphur and biofuel are percentages (not fractions).
- `ebdn_status` is the QR/digital-signature verification result printed on
  the document, NOT your guess. Use "MISSING" if not present.
- `bdn_ref` is the supplier's BDN serial (e.g. "BDN-2026-XYZ-001").
- `red_flags` lists anything visually suspicious: altered numbers, mismatched
  signatures, photocopied stamps, conflicting dates, etc. Empty list if none.
"""


BDN_INGEST_SCHEMA: dict = {
    "type": "object",
    "additionalProperties": False,
    "required": ["is_bdn", "confidence", "reasoning", "document_type", "extracted", "red_flags"],
    "properties": {
        "is_bdn": {
            "type": "boolean",
            "description": "True only if this document is a genuine marine Bunker Delivery Note.",
        },
        "confidence": {
            "type": "number",
            "description": "Self-rated classification confidence in [0, 1].",
        },
        "reasoning": {
            "type": "string",
            "description": "One-paragraph explanation of the classification decision, citing visible evidence.",
        },
        "document_type": {
            "type": "string",
            "description": "Short label: 'BDN', 'cargo_manifest', 'invoice', 'sample_certificate', 'charter_party', 'unknown', etc.",
        },
        "red_flags": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Visual / consistency warnings the officer should review. Empty list when nothing stands out.",
        },
        "extracted": {
            "type": "object",
            "additionalProperties": False,
            "required": [
                "bdn_ref", "vessel_name", "vessel_imo", "supplier_name",
                "barge_name", "barge_imo", "port", "delivery_date",
                "time_start", "time_end", "grade", "qty_mt",
                "density_15c_kg_m3", "viscosity_50c_cst", "sulphur_pct",
                "flash_point_c", "biofuel_pct", "sample_seal",
                "supplier_signed", "officer_signed", "ebdn_status",
            ],
            "properties": {
                "bdn_ref": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                "vessel_name": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                "vessel_imo": {"anyOf": [{"type": "string"}, {"type": "null"}],
                               "description": "7-digit IMO as a string. Null if missing."},
                "supplier_name": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                "barge_name": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                "barge_imo": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                "port": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                "delivery_date": {"anyOf": [{"type": "string"}, {"type": "null"}],
                                  "description": "ISO date YYYY-MM-DD."},
                "time_start": {"anyOf": [{"type": "string"}, {"type": "null"}],
                               "description": "HH:MM 24h, UTC if printed."},
                "time_end": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                "grade": {"anyOf": [{"type": "string"}, {"type": "null"}],
                          "description": "Normalised grade label, e.g. 'VLSFO RMG 380', 'HSFO RMG 380', 'MGO DMA', 'LSMGO DMA', 'B24-VLSFO', 'B30-VLSFO'."},
                "qty_mt": {"anyOf": [{"type": "number"}, {"type": "null"}]},
                "density_15c_kg_m3": {"anyOf": [{"type": "number"}, {"type": "null"}]},
                "viscosity_50c_cst": {"anyOf": [{"type": "number"}, {"type": "null"}]},
                "sulphur_pct": {"anyOf": [{"type": "number"}, {"type": "null"}]},
                "flash_point_c": {"anyOf": [{"type": "number"}, {"type": "null"}]},
                "biofuel_pct": {"anyOf": [{"type": "number"}, {"type": "null"}]},
                "sample_seal": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                "supplier_signed": {"anyOf": [{"type": "boolean"}, {"type": "null"}]},
                "officer_signed": {"anyOf": [{"type": "boolean"}, {"type": "null"}]},
                "ebdn_status": {
                    "anyOf": [{"type": "string"}, {"type": "null"}],
                    "description": "One of: VERIFIED, INVALID_SIGNATURE, MISMATCH, MISSING, EXPIRED_CERT.",
                },
            },
        },
    },
}


__all__ = ["BDN_INGEST_SYSTEM", "BDN_INGEST_SCHEMA"]
