"""Real BDN document extraction for images and text-based PDFs."""
from __future__ import annotations

import base64
import json
import os
import re
from io import BytesIO
from typing import Any
from urllib import error, request

from llm.claude_client import call_text

FIELDS = (
    "bdn_reference", "vessel_name", "imo_number", "supplier_name",
    "barge_name", "barge_imo", "fuel_grade", "quantity_mt", "port",
    "delivery_date", "licence_number", "start_time", "end_time",
    "sulphur_pct", "density_15c", "viscosity_50c", "flash_point_c",
    "sample_seal", "supplier_signed", "officer_signed",
)

PROMPT = """Extract the Bunker Delivery Note into JSON with exactly these keys:
bdn_reference, vessel_name, imo_number, supplier_name, barge_name, barge_imo,
fuel_grade, quantity_mt, port, delivery_date, licence_number, start_time,
end_time, sulphur_pct, density_15c, viscosity_50c, flash_point_c, sample_seal,
supplier_signed, officer_signed. Use null when absent. Do not infer values.
Return JSON only."""


def _parse_json(text: str) -> dict[str, Any]:
    cleaned = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    result = json.loads(cleaned)
    return {field: result.get(field) for field in FIELDS}


def _openrouter_image(document: bytes, media_type: str) -> tuple[dict, dict]:
    api_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is required for image OCR fallback")
    model = os.environ.get("OPENROUTER_MODEL", "anthropic/claude-sonnet-4.6")
    payload = {
        "model": model,
        "max_tokens": 900,
        "temperature": 0,
        "messages": [{"role": "user", "content": [
            {"type": "text", "text": PROMPT},
            {"type": "image_url", "image_url": {
                "url": f"data:{media_type};base64,{base64.b64encode(document).decode()}"
            }},
        ]}],
    }
    req = request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=90) as response:
            data = json.loads(response.read().decode())
    except error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")[:500]
        raise RuntimeError(f"OpenRouter OCR failed with HTTP {exc.code}: {detail}") from exc
    return _parse_json(data["choices"][0]["message"]["content"]), {
        "provider": "openrouter", "model": model, "usage": data.get("usage", {})
    }


def _anthropic_document(document: bytes, media_type: str) -> tuple[dict, dict]:
    import anthropic

    model = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6")
    block_type = "document" if media_type == "application/pdf" else "image"
    response = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"]).messages.create(
        model=model,
        max_tokens=900,
        temperature=0,
        system="You are a maritime document OCR extraction service. Never invent missing values.",
        messages=[{"role": "user", "content": [
            {
                "type": block_type,
                "source": {
                    "type": "base64",
                    "media_type": media_type,
                    "data": base64.b64encode(document).decode(),
                },
            },
            {"type": "text", "text": PROMPT},
        ]}],
    )
    text = "".join(block.text for block in response.content if block.type == "text")
    return _parse_json(text), {
        "provider": "anthropic",
        "model": getattr(response, "model", model),
        "usage": {
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
        },
    }


def _pdf_text(document: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(BytesIO(document))
    return "\n".join(page.extract_text() or "" for page in reader.pages).strip()


def _confidence(fields: dict[str, Any]) -> tuple[float, dict[str, float]]:
    critical = ("bdn_reference", "vessel_name", "imo_number", "supplier_name", "fuel_grade", "quantity_mt", "port", "delivery_date")
    field_scores = {field: 1.0 if fields.get(field) not in (None, "", 0) else 0.0 for field in FIELDS}
    critical_score = sum(field_scores[field] for field in critical) / len(critical)
    overall = round((critical_score * 0.8 + sum(field_scores.values()) / len(FIELDS) * 0.2) * 100, 1)
    return overall, field_scores


def extract_bdn_document(document: bytes, media_type: str, filename: str) -> dict[str, Any]:
    if media_type == "application/pdf" or filename.lower().endswith(".pdf"):
        text = _pdf_text(document)
        if len(text) < 40 and os.environ.get("ANTHROPIC_API_KEY"):
            fields, provider = _anthropic_document(document, "application/pdf")
        elif len(text) >= 40:
            response = call_text(
                "You are a maritime document OCR extraction service. Never invent missing values.",
                [{"role": "user", "content": f"{PROMPT}\n\nDOCUMENT TEXT:\n{text[:30000]}"}],
                max_tokens=900,
            )
            fields = _parse_json(response["text"])
            provider = {"provider": response["provider_used"], "model": response["model"], "usage": response["_usage"]}
        else:
            raise ValueError("Scanned PDF OCR requires ANTHROPIC_API_KEY; alternatively upload a PNG or JPEG")
    elif media_type in {"image/jpeg", "image/png", "image/webp", "image/gif"}:
        if os.environ.get("ANTHROPIC_API_KEY"):
            fields, provider = _anthropic_document(document, media_type)
        else:
            fields, provider = _openrouter_image(document, media_type)
    else:
        raise ValueError(f"Unsupported BDN content type: {media_type}")

    confidence, field_confidence = _confidence(fields)
    return {
        "fields": fields,
        "parsing_confidence": confidence,
        "field_confidence": field_confidence,
        "provider": provider,
    }
