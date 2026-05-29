"""Blockchain verification certificate (single-page A4).

The spec listed pdf_certificate.py without providing code. This is a minimal
implementation: hash chain summary + QR code linking to the explorer.

Required: reportlab.
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING, Optional

from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import (
    HRFlowable,
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from .config import BRAND, PDF_MARGIN, session_dir

if TYPE_CHECKING:
    from ._extract import ViewBundle

BLUE = HexColor(BRAND["color_primary"])
CYAN = HexColor(BRAND["color_accent"])
GRAY = HexColor(BRAND["color_gray"])
LIGHT_GRAY = HexColor(BRAND["color_table_alt"])
DARK = HexColor("#1A1A2E")


def generate_certificate(
    view: "ViewBundle",
    *,
    blockchain: Optional[dict] = None,
    qr_path: Optional[Path] = None,
    output_dir: Optional[Path] = None,
) -> Path:
    """Build a one-page certificate PDF.

    Args:
        view: ViewBundle from extract_view.
        blockchain: dict from ``llm.blockchain.write_to_chain`` (tx_hash,
            chain, status, explorer).
        qr_path: optional path to a pre-rendered QR image (linking to the
            explorer URL).
    """
    out_dir = output_dir or session_dir(view.session_id)
    filepath = out_dir / f"BlockchainCertificate_{view.session_id}.pdf"

    doc = SimpleDocTemplate(
        str(filepath), pagesize=A4,
        leftMargin=PDF_MARGIN, rightMargin=PDF_MARGIN,
        topMargin=PDF_MARGIN, bottomMargin=PDF_MARGIN,
    )

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        "C_Title", parent=styles["Title"],
        fontSize=20, textColor=BLUE, alignment=TA_CENTER,
        fontName="Helvetica-Bold", spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        "C_Sub", parent=styles["Normal"],
        fontSize=11, alignment=TA_CENTER, textColor=GRAY, spaceAfter=12,
    ))
    styles.add(ParagraphStyle(
        "C_Body", parent=styles["Normal"],
        fontSize=9, textColor=DARK, leading=13, spaceAfter=8,
    ))
    styles.add(ParagraphStyle(
        "C_Footer", parent=styles["Normal"],
        fontSize=7, textColor=GRAY, alignment=TA_CENTER,
    ))

    bc = blockchain or {}
    chain = view.chain
    tx_hash = bc.get("tx_hash", "N/A")
    explorer = bc.get("explorer") or "N/A (mock transaction — no explorer link)"
    chain_name = bc.get("chain", "Ethereum Sepolia")
    status = bc.get("status", "unknown")

    elements: list = [
        Paragraph("BLOCKCHAIN VERIFICATION CERTIFICATE", styles["C_Title"]),
        Paragraph(
            f"Session {view.session_id} - tamper-evident hash chain anchored on-chain",
            styles["C_Sub"],
        ),
        HRFlowable(width="100%", thickness=2, color=BLUE),
        Spacer(1, 14),

        Paragraph(
            "This certificate attests that the analytical pipeline output for "
            "the bunkering session below was hashed and submitted to the "
            "specified blockchain at the moment of report generation. Any "
            "subsequent modification to the BDN, MFM stream, or risk "
            "evaluation will produce a different hash and break the chain.",
            styles["C_Body"],
        ),
    ]

    summary = [
        ["Session ID", view.session_id],
        ["Vessel", f"{view.bdn['vessel_name']} (IMO {view.bdn['vessel_imo']})"],
        ["Supplier", view.bdn["supplier_name"]],
        ["BDN reference", view.bdn["bdn_ref"]],
        ["Grade / Qty", f"{view.bdn['product_grade']} - {view.bdn['quantity_mt']:.1f} MT BDN"],
        ["Verdict", view.risk["verdict"]],
        ["Generated", view.generated_at],
    ]
    sumt = Table(summary, colWidths=[110, 380])
    sumt.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("TEXTCOLOR", (0, 0), (0, -1), GRAY),
        ("TEXTCOLOR", (1, 0), (1, -1), DARK),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [white, LIGHT_GRAY]),
    ]))
    elements.append(sumt)
    elements.append(Spacer(1, 14))

    elements.append(Paragraph("Hash chain", styles["C_Body"]))
    hash_rows = [
        ["Stage 1 -> 2 parent (SessionInput)", chain.get("anomaly_parent_sha256", "N/A") or "N/A"],
        ["Stage 2 -> 3 parent (AnomalyReport)", chain.get("parent_sha256") or "N/A"],
        ["Stage 3 payload (RiskPackage)", chain.get("payload_sha256") or "N/A"],
    ]
    ht = Table(hash_rows, colWidths=[180, 310])
    ht.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Courier"),
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("GRID", (0, 0), (-1, -1), 0.5, GRAY),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [white, LIGHT_GRAY]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    elements.append(ht)
    elements.append(Spacer(1, 14))

    elements.append(Paragraph("On-chain submission", styles["C_Body"]))
    chain_rows = [
        ["Chain", chain_name],
        ["Status", status],
        ["TX hash", tx_hash],
        ["Explorer", explorer],
    ]
    ct = Table(chain_rows, colWidths=[110, 380])
    ct.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Courier"),
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("GRID", (0, 0), (-1, -1), 0.5, GRAY),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [white, LIGHT_GRAY]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    elements.append(ct)
    elements.append(Spacer(1, 14))

    if qr_path:
        elements.append(Paragraph(
            "Scan to open the on-chain transaction:", styles["C_Body"]))
        elements.append(Image(str(qr_path), width=120, height=120))

    elements.append(Spacer(1, 16))
    elements.append(HRFlowable(width="100%", thickness=1, color=GRAY))
    elements.append(Paragraph(
        f"Issued by {BRAND['name']} v{BRAND['version']} on "
        f"{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}",
        styles["C_Footer"],
    ))

    doc.build(elements)
    return filepath
