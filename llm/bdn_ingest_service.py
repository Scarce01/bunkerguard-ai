"""Claude-driven BDN ingestion — replaces hardcoded CSV loading for uploads.

Given an uploaded file (PDF, image, or plain text), ask Claude to:
  1. Decide whether it is a Bunker Delivery Note at all.
  2. If so, extract the typed BDN fields BunkerGuard already understands.

The result is shape-compatible with `BDNDoc` so the downstream anomaly /
risk pipeline can keep treating extracted uploads and CSV fixtures the same
way. Nothing here ever silently invents fields — missing data comes back as
null and the officer is told.

Env:
    ANTHROPIC_API_KEY — required (see llm.claude_client).
"""
from __future__ import annotations

import base64
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

from .claude_client import _get_client, _sanitize_schema, _try_parse_json
from .prompts.bdn_ingest_prompt import BDN_INGEST_SCHEMA, BDN_INGEST_SYSTEM

log = logging.getLogger("bunkerguard.llm.bdn_ingest")

MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 2048

_SUPPORTED_IMAGE_MIMES = {"image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"}
_PDF_MIME = "application/pdf"


@dataclass
class BDNIngestResult:
    """Verdict + structured extraction returned to the dashboard."""
    is_bdn: bool
    confidence: float
    reasoning: str
    document_type: str
    red_flags: list[str] = field(default_factory=list)
    extracted: dict[str, Any] = field(default_factory=dict)
    usage: dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "is_bdn": self.is_bdn,
            "confidence": self.confidence,
            "reasoning": self.reasoning,
            "document_type": self.document_type,
            "red_flags": list(self.red_flags),
            "extracted": dict(self.extracted),
            "usage": dict(self.usage),
            "error": self.error,
        }


def _guess_mime(filename: str, fallback: str) -> str:
    name = (filename or "").lower()
    if name.endswith(".pdf"):
        return _PDF_MIME
    if name.endswith(".png"):
        return "image/png"
    if name.endswith((".jpg", ".jpeg")):
        return "image/jpeg"
    if name.endswith(".gif"):
        return "image/gif"
    if name.endswith(".webp"):
        return "image/webp"
    if name.endswith((".txt", ".csv", ".md")):
        return "text/plain"
    return fallback or "application/octet-stream"


def _build_user_content(
    file_bytes: bytes,
    mime_type: str,
    text_hint: Optional[str],
) -> list[dict[str, Any]]:
    """Wrap the raw upload in the right Anthropic content block."""
    instruction = (
        "Classify this uploaded document and, if it is a marine Bunker Delivery "
        "Note, extract the fields per the schema. If it is not a BDN, set "
        "is_bdn=false and leave every extracted field as null."
    )
    if text_hint:
        instruction += f"\n\nOfficer note: {text_hint}"

    blocks: list[dict[str, Any]] = []

    if mime_type == _PDF_MIME:
        blocks.append({
            "type": "document",
            "source": {
                "type": "base64",
                "media_type": _PDF_MIME,
                "data": base64.standard_b64encode(file_bytes).decode("ascii"),
            },
        })
    elif mime_type in _SUPPORTED_IMAGE_MIMES:
        blocks.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": mime_type,
                "data": base64.standard_b64encode(file_bytes).decode("ascii"),
            },
        })
    else:
        # Plain-text fallback — OCR text the officer pasted, or .txt upload.
        try:
            text = file_bytes.decode("utf-8", errors="replace")
        except Exception:
            text = ""
        blocks.append({
            "type": "text",
            "text": f"Document content (text):\n\n{text[:60_000]}",
        })

    blocks.append({"type": "text", "text": instruction})
    return blocks


def analyze_bdn_upload(
    file_bytes: bytes,
    *,
    filename: str = "upload.bin",
    mime_type: Optional[str] = None,
    text_hint: Optional[str] = None,
    persist: bool = True,
    uploaded_by: Optional[str] = None,
) -> BDNIngestResult:
    """Send the upload to Claude and return a typed classification + extraction.

    Args:
        file_bytes: raw bytes of the uploaded file.
        filename: original filename — used only to guess mime if not given.
        mime_type: explicit content-type; auto-detected from filename otherwise.
        text_hint: optional officer-provided context (e.g. "received from PetroSpark
            barge at Eastern Anchorage on 2026-05-10").

    Returns:
        BDNIngestResult. On any unrecoverable failure (network, quota, malformed
        response), `error` is populated and `is_bdn=False`.
    """
    if not file_bytes:
        return BDNIngestResult(
            is_bdn=False, confidence=0.0,
            reasoning="Empty upload — no document to analyse.",
            document_type="unknown", error="empty_file",
        )

    mime = mime_type or _guess_mime(filename, "application/octet-stream")

    try:
        client = _get_client()
    except RuntimeError as e:
        return BDNIngestResult(
            is_bdn=False, confidence=0.0,
            reasoning="Claude SDK unavailable — see ANTHROPIC_API_KEY setup.",
            document_type="unknown", error=str(e),
        )

    user_content = _build_user_content(file_bytes, mime, text_hint)

    system_block = [{
        "type": "text",
        "text": BDN_INGEST_SYSTEM,
        "cache_control": {"type": "ephemeral"},
    }]

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=system_block,
            messages=[{"role": "user", "content": user_content}],
            output_config={
                "format": {
                    "type": "json_schema",
                    "schema": _sanitize_schema(BDN_INGEST_SCHEMA),
                },
            },
        )
    except Exception as e:  # network/auth/quota all bubble up here
        log.exception("bdn_ingest_call_failed")
        return BDNIngestResult(
            is_bdn=False, confidence=0.0,
            reasoning=f"Claude call failed: {type(e).__name__}",
            document_type="unknown", error=f"{type(e).__name__}: {e}",
        )

    text = "".join(b.text for b in response.content if getattr(b, "type", None) == "text")
    usage = {
        "input_tokens": response.usage.input_tokens,
        "output_tokens": response.usage.output_tokens,
        "cache_read_input_tokens": getattr(response.usage, "cache_read_input_tokens", 0),
        "cache_creation_input_tokens": getattr(response.usage, "cache_creation_input_tokens", 0),
        "model": MODEL,
    }

    parsed = _try_parse_json(text)
    if parsed is None:
        log.warning("bdn_ingest_parse_failed", extra={"preview": text[:200]})
        return BDNIngestResult(
            is_bdn=False, confidence=0.0,
            reasoning="Could not parse Claude response as JSON.",
            document_type="unknown",
            usage=usage, error="json_parse_failed",
        )

    extracted = parsed.get("extracted") or {}
    result = BDNIngestResult(
        is_bdn=bool(parsed.get("is_bdn", False)),
        confidence=float(parsed.get("confidence", 0.0) or 0.0),
        reasoning=str(parsed.get("reasoning", "")).strip(),
        document_type=str(parsed.get("document_type", "unknown")).strip() or "unknown",
        red_flags=list(parsed.get("red_flags") or []),
        extracted=extracted,
        usage=usage,
    )

    # Log every analysis — including is_bdn=false rejections — to Supabase
    # so the frontend can render Claude's real reasoning + confidence
    # instead of falling back to a hardcoded "98%" pill.
    if persist:
        try:
            from .supabase_sync import persist_upload  # local import: avoids cycle at boot
            persist_upload(
                result,
                filename=filename,
                mime_type=mime,
                size_bytes=len(file_bytes),
                uploaded_by=uploaded_by,
            )
        except Exception:
            log.exception("bdn_upload_persist_failed")

    return result


def to_bdn_doc(extracted: dict[str, Any]):
    """Best-effort map of LLM output → a `BDNDoc` instance.

    Used when the officer accepts the extraction and wants to feed it into
    the existing anomaly / risk engine. Missing or unparseable fields fall
    back to safe defaults so a partially-readable BDN can still produce a
    SessionInput (downstream rules will flag the gaps).
    """
    from contracts import BDNDoc, EBDNStatus, FuelGrade  # local import: avoid hard dep on import-time

    def _grade(raw: Optional[str]) -> FuelGrade:
        s = (raw or "").strip().upper()
        table = {
            "VLSFO RMG 380": FuelGrade.VLSFO_RMG_380,
            "HSFO RMG 380":  FuelGrade.HSFO_RMG_380,
            "MGO DMA":       FuelGrade.MGO_DMA,
            "LSMGO DMA":     FuelGrade.LSMGO_DMA,
            "B24-VLSFO":     FuelGrade.B24_VLSFO,
            "B30-VLSFO":     FuelGrade.B30_VLSFO,
        }
        if s in table:
            return table[s]
        if "B30" in s: return FuelGrade.B30_VLSFO
        if "B24" in s: return FuelGrade.B24_VLSFO
        if "HSFO" in s: return FuelGrade.HSFO_RMG_380
        if "LSMGO" in s: return FuelGrade.LSMGO_DMA
        if "MGO" in s: return FuelGrade.MGO_DMA
        return FuelGrade.VLSFO_RMG_380

    def _ebdn(raw: Optional[str]) -> EBDNStatus:
        s = (raw or "").strip().upper()
        return {
            "VERIFIED": EBDNStatus.VERIFIED,
            "INVALID_SIGNATURE": EBDNStatus.INVALID_SIGNATURE,
            "MISMATCH": EBDNStatus.MISMATCH,
            "MISSING": EBDNStatus.MISSING,
            "EXPIRED_CERT": EBDNStatus.EXPIRED_CERT,
        }.get(s, EBDNStatus.MISSING)

    def _dt(date_s: Optional[str], time_s: Optional[str]) -> datetime:
        d = (date_s or "").strip()
        t = (time_s or "").strip() or "00:00"
        if not d:
            return datetime.now(timezone.utc)
        try:
            return datetime.fromisoformat(f"{d}T{t}").replace(tzinfo=timezone.utc)
        except ValueError:
            return datetime.now(timezone.utc)

    start = _dt(extracted.get("delivery_date"), extracted.get("time_start"))
    end = _dt(extracted.get("delivery_date"), extracted.get("time_end") or extracted.get("time_start"))

    return BDNDoc(
        bdn_ref=(extracted.get("bdn_ref") or "BDN-UNKNOWN").strip(),
        grade=_grade(extracted.get("grade")),
        qty_mt=float(extracted.get("qty_mt") or 0.0),
        density_15c_kg_m3=float(extracted.get("density_15c_kg_m3") or 0.0),
        viscosity_50c_cst=float(extracted.get("viscosity_50c_cst") or 0.0),
        sulphur_pct=float(extracted.get("sulphur_pct") or 0.0),
        flash_point_c=float(extracted.get("flash_point_c") or 0.0),
        biofuel_pct=float(extracted.get("biofuel_pct") or 0.0),
        sample_seal=(extracted.get("sample_seal") or None),
        supplier_signed=bool(extracted.get("supplier_signed") or False),
        officer_signed=bool(extracted.get("officer_signed") or False),
        ebdn_status=_ebdn(extracted.get("ebdn_status")),
        ebdn_qr_sha256=None,
        start_ts=start,
        end_ts=end,
    )


__all__ = ["BDNIngestResult", "analyze_bdn_upload", "to_bdn_doc"]
