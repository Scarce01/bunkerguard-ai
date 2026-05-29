"""Formal evidence report PDF (A4).

Intended for PSC inspections, legal disputes, insurance claims, MPA audits.
Takes the ``ViewBundle`` produced by ``outputs._extract.extract_view``.

Required: reportlab.
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING, Optional

from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_JUSTIFY
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

from ._pdfutil import paragraph_text, xml_escape
from .config import BRAND, PDF_MARGIN, SEVERITY_COLORS, VERDICT_COLORS, session_dir

if TYPE_CHECKING:
    from ._extract import ViewBundle

BLUE = HexColor(BRAND["color_primary"])
CYAN = HexColor(BRAND["color_accent"])
RED = HexColor(BRAND["color_danger"])
ORANGE = HexColor(BRAND["color_warning"])
YELLOW = HexColor(BRAND["color_caution"])
GREEN = HexColor(BRAND["color_success"])
GRAY = HexColor(BRAND["color_gray"])
LIGHT_GRAY = HexColor(BRAND["color_table_alt"])
DARK = HexColor("#1A1A2E")

_SEV_HEX = {k: HexColor(v) for k, v in SEVERITY_COLORS.items()}
_VERDICT_HEX = {k: HexColor(v) for k, v in VERDICT_COLORS.items()}


def generate_evidence_report(
    view: "ViewBundle",
    *,
    chart_paths: Optional[dict] = None,
    output_dir: Optional[Path] = None,
) -> Path:
    """Build the multi-section evidence PDF.

    Args:
        view: ViewBundle from ``outputs._extract.extract_view``.
        chart_paths: optional dict like
            ``{"quantity_comparison": Path, "risk_breakdown": Path,
                "supplier_history": Path, "mfm_flow": Path, "qr_code": Path}``.
        output_dir: defaults to a fresh ``session_dir(view.session_id)``.

    Returns:
        Path to the generated PDF.
    """
    out_dir = output_dir or session_dir(view.session_id)
    filepath = out_dir / f"EvidenceReport_{view.session_id}.pdf"

    doc = SimpleDocTemplate(
        str(filepath), pagesize=A4,
        leftMargin=PDF_MARGIN, rightMargin=PDF_MARGIN,
        topMargin=PDF_MARGIN, bottomMargin=PDF_MARGIN,
    )
    styles = _build_styles()
    chart_paths = chart_paths or {}

    elements: list = []
    elements.extend(_section_header(view, styles))
    elements.extend(_section_verdict_banner(view, styles))
    elements.extend(_section_quantity(view, styles, chart_paths))
    elements.extend(_section_bdn_fields(view, styles))
    elements.extend(_section_anomalies(view, styles))
    elements.extend(_section_ai_analysis(view, styles))
    elements.extend(_section_risk_breakdown(view, styles, chart_paths))
    elements.extend(_section_blockchain(view, styles, chart_paths))
    elements.extend(_section_footer(styles))

    doc.build(elements)
    return filepath


# ---------- internal builders ----------

def _build_styles() -> dict:
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        "BG_Title", parent=styles["Title"],
        fontSize=22, textColor=BLUE, spaceAfter=6, fontName="Helvetica-Bold",
    ))
    styles.add(ParagraphStyle(
        "BG_Subtitle", parent=styles["Normal"],
        fontSize=14, textColor=GRAY, spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        "BG_H2", parent=styles["Heading2"],
        fontSize=13, textColor=BLUE, spaceBefore=16, spaceAfter=8,
        fontName="Helvetica-Bold",
    ))
    styles.add(ParagraphStyle(
        "BG_Body", parent=styles["Normal"],
        fontSize=9, leading=13, textColor=DARK,
        fontName="Helvetica", alignment=TA_JUSTIFY,
    ))
    styles.add(ParagraphStyle(
        "BG_Small", parent=styles["Normal"],
        fontSize=7, leading=10, textColor=GRAY, fontName="Helvetica",
    ))
    return styles


def _section_header(view: "ViewBundle", styles) -> list:
    bdn = view.bdn
    header_data = [
        ["Session ID", view.session_id, "Date", bdn["date"]],
        ["Vessel", f"{bdn['vessel_name']} (IMO {bdn['vessel_imo']})", "Port", bdn["port"]],
        ["Supplier", bdn["supplier_name"], "Barge", bdn["barge_name"]],
        ["Grade", bdn["product_grade"], "Generated", view.generated_at],
    ]
    ht = Table(header_data, colWidths=[70, 170, 60, 170])
    ht.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 0), (0, -1), GRAY),
        ("TEXTCOLOR", (2, 0), (2, -1), GRAY),
        ("TEXTCOLOR", (1, 0), (1, -1), DARK),
        ("TEXTCOLOR", (3, 0), (3, -1), DARK),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
    ]))
    return [
        Paragraph("BUNKERGUARD AI", styles["BG_Title"]),
        Paragraph("Evidence Report", styles["BG_Subtitle"]),
        HRFlowable(width="100%", thickness=2, color=BLUE),
        Spacer(1, 8),
        ht,
        Spacer(1, 12),
    ]


def _section_verdict_banner(view: "ViewBundle", styles) -> list:
    risk = view.risk
    color = _VERDICT_HEX.get(risk["verdict"], GRAY)
    impact = risk.get("financial_impact")
    impact_str = f"${impact:,.2f}" if impact is not None else "N/A"
    data = [[
        f"RISK SCORE: {risk['risk_score']}/100",
        f"CATEGORY: {risk['category']}",
        f"VERDICT: {risk['verdict'].replace('_', ' ')}",
        f"IMPACT: USD {impact_str}",
    ]]
    vt = Table(data, colWidths=[120, 110, 140, 120])
    vt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), color),
        ("TEXTCOLOR", (0, 0), (-1, -1), white),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("BOX", (0, 0), (-1, -1), 1, color),
    ]))
    return [vt, Spacer(1, 16)]


def _section_quantity(view: "ViewBundle", styles, chart_paths: dict) -> list:
    bdn, mfm = view.bdn, view.mfm
    qty_diff = mfm["cumulative_mass"] - bdn["quantity_mt"]
    qty_pct = (qty_diff / bdn["quantity_mt"]) * 100 if bdn["quantity_mt"] else 0.0
    data = [
        ["Source", "Quantity (MT)", "Difference (MT)", "Difference (%)"],
        ["BDN Declared", f"{bdn['quantity_mt']:.1f}", "-", "-"],
        ["MFM Recorded", f"{mfm['cumulative_mass']:.1f}",
         f"{qty_diff:+.1f}", f"{qty_pct:+.2f}%"],
    ]
    qt = Table(data, colWidths=[120, 100, 100, 100])
    qt.setStyle(_table_style_header())
    el = [Paragraph("1. Quantity Comparison", styles["BG_H2"]), qt]
    if chart_paths.get("quantity_comparison"):
        el += [Spacer(1, 8), Image(str(chart_paths["quantity_comparison"]),
                                    width=400, height=200)]
    el.append(Spacer(1, 12))
    return el


def _section_bdn_fields(view: "ViewBundle", styles) -> list:
    bdn, mfm = view.bdn, view.mfm
    qty_pct = ((mfm["cumulative_mass"] - bdn["quantity_mt"]) / bdn["quantity_mt"]) * 100 if bdn["quantity_mt"] else 0.0
    bdn_density_diff = (
        abs(bdn["density_15c"] - mfm["density_15c"])
        if mfm.get("density_15c") is not None else 0.0
    )

    rows = [
        ["Field", "BDN Value", "Validation", "Status"],
        ["Vessel Name", bdn["vessel_name"], "AIS cross-check", "PASS"],
        ["IMO Number", str(bdn["vessel_imo"]), "Registry + checksum", "PASS"],
        ["Supplier", bdn["supplier_name"], "MPA registry lookup", "PASS"],
        ["Grade", bdn["product_grade"], "BRF match", "PASS"],
        ["Sulphur %", f"{bdn['sulphur_pct']:.3f}%", "<= 0.50% MARPOL",
         "PASS" if bdn["sulphur_pct"] <= 0.50 else "FAIL"],
        ["Flash Point", f"{bdn['flash_point']:.1f} C", ">= 60 C SOLAS",
         "PASS" if bdn["flash_point"] >= 60 else "FAIL"],
        ["Density @15C", f"{bdn['density_15c']:.1f} kg/m3",
         f"MFM: {mfm['density_15c']:.1f}" if mfm.get("density_15c") else "MFM: N/A",
         "PASS" if bdn_density_diff <= 2.0 else "WARN"],
        ["Quantity", f"{bdn['quantity_mt']:.1f} MT",
         f"MFM: {mfm['cumulative_mass']:.1f} MT",
         "PASS" if abs(qty_pct) <= 0.5 else "FAIL"],
        ["Supplier Signed", "Yes" if bdn["supplier_signed"] else "No",
         "Required", "PASS" if bdn["supplier_signed"] else "FAIL"],
        ["Officer Signed", "Yes" if bdn["officer_signed"] else "No",
         "Required", "PASS" if bdn["officer_signed"] else "FAIL"],
        ["Sample Seal", str(bdn["sample_seal_no"]), "Chain of custody",
         "PASS" if bdn["sample_seal_no"] != "N/A" else "WARN"],
        ["eBDN Status", bdn["ebdn_status"], "Digital signature",
         "PASS" if bdn["ebdn_status"] == "VERIFIED" else "FAIL"],
    ]
    bt = Table(rows, colWidths=[90, 120, 120, 50])

    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("GRID", (0, 0), (-1, -1), 0.5, GRAY),
        ("ALIGN", (3, 0), (3, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, LIGHT_GRAY]),
    ]
    for i, row in enumerate(rows[1:], start=1):
        status = row[3]
        if status == "FAIL":
            style_cmds.append(("BACKGROUND", (3, i), (3, i), RED))
            style_cmds.append(("TEXTCOLOR", (3, i), (3, i), white))
        elif status == "WARN":
            style_cmds.append(("BACKGROUND", (3, i), (3, i), YELLOW))
        elif status == "PASS":
            style_cmds.append(("BACKGROUND", (3, i), (3, i), GREEN))
            style_cmds.append(("TEXTCOLOR", (3, i), (3, i), white))
    bt.setStyle(TableStyle(style_cmds))
    return [
        Paragraph("2. BDN Field Validation", styles["BG_H2"]),
        bt,
        Spacer(1, 12),
    ]


def _section_anomalies(view: "ViewBundle", styles) -> list:
    el: list = [Paragraph("3. Anomaly Report", styles["BG_H2"])]
    if not view.anomalies:
        el.append(Paragraph("No anomalies detected. All rules passed.",
                            styles["BG_Body"]))
        el.append(Spacer(1, 12))
        return el

    rows = [["Rule", "Severity", "Description", "Evidence / Basis"]]
    for a in view.anomalies:
        rows.append([
            a["rule_id"],
            a["severity"],
            a["name"],
            (a.get("regulatory_basis") or a["description"])[:80],
        ])
    at = Table(rows, colWidths=[40, 60, 150, 230])
    cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("GRID", (0, 0), (-1, -1), 0.5, GRAY),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, LIGHT_GRAY]),
    ]
    for i, a in enumerate(view.anomalies, start=1):
        sc = _SEV_HEX.get(a["severity"], GRAY)
        cmds.append(("BACKGROUND", (1, i), (1, i), sc))
        cmds.append(("TEXTCOLOR", (1, i), (1, i), white))
    at.setStyle(TableStyle(cmds))
    el.append(at)
    el.append(Spacer(1, 12))
    return el


def _section_ai_analysis(view: "ViewBundle", styles) -> list:
    llm = view.llm_analysis or {}
    el: list = [Paragraph("4. AI Analysis (Claude Copilot)", styles["BG_H2"])]
    if not llm or llm.get("error"):
        el.append(Paragraph(
            f"AI analysis unavailable: {xml_escape(llm.get('error', 'not run'))}",
            styles["BG_Body"]))
        el.append(Spacer(1, 12))
        return el

    if llm.get("summary"):
        el.append(Paragraph(paragraph_text(llm["summary"]), styles["BG_Body"]))

    for c in llm.get("concerns", []) or []:
        sev = c.get("severity", "MEDIUM")
        sc = _SEV_HEX.get(sev, GRAY)
        el.append(Spacer(1, 6))
        el.append(Paragraph(
            f'<font color="{sc.hexval()}">[{xml_escape(sev)}]</font> '
            f'<b>{xml_escape(c.get("title", ""))}</b>',
            styles["BG_Body"]))
        if c.get("evidence"):
            el.append(Paragraph(
                f'Evidence: {xml_escape(c["evidence"])}', styles["BG_Small"]))

    if llm.get("recommendation"):
        el.append(Spacer(1, 6))
        el.append(Paragraph(
            f"<b>Recommendation:</b> {paragraph_text(llm['recommendation'])}",
            styles["BG_Body"]))
    el.append(Spacer(1, 12))
    return el


def _section_risk_breakdown(view: "ViewBundle", styles, chart_paths: dict) -> list:
    el = [Paragraph("5. Risk Score Breakdown", styles["BG_H2"])]
    risk = view.risk

    # Chart (if available) — visual summary of the four weighted components.
    if chart_paths.get("risk_breakdown"):
        el.append(Image(str(chart_paths["risk_breakdown"]), width=350, height=200))
        el.append(Spacer(1, 8))
    else:
        # Tabular fallback when no chart was rendered.
        comp = risk["components"]
        w = risk["weighted"]
        rows = [
            ["Component", "Weight", "Raw Score", "Weighted"],
            ["Anomaly Severity", "40%", f"{comp['severity_score']:.1f}", f"{w['anomaly_x40']:.1f}"],
            ["Supplier History", "25%", f"{comp['supplier_score']:.1f}", f"{w['supplier_x25']:.1f}"],
            ["Doc Completeness", "15%", f"{comp['doc_score']:.1f}", f"{w['doc_x15']:.1f}"],
            ["Realtime Deviation", "20%", f"{comp['realtime_score']:.1f}", f"{w['realtime_x20']:.1f}"],
            ["RAW WEIGHTED", "-", "-", f"{risk['raw_weighted_sum']:.1f}"],
            ["AFTER FLOORS", "-", "-", f"{risk['final_score_after_floor']:.1f}"],
        ]
        rt = Table(rows, colWidths=[120, 60, 80, 80])
        rt.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), BLUE),
            ("TEXTCOLOR", (0, 0), (-1, 0), white),
            ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTNAME", (0, -2), (-1, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, GRAY),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
            ("BACKGROUND", (0, -1), (-1, -1), LIGHT_GRAY),
        ]))
        el.append(rt)

    # Floor triggers are independent of the chart — always render when present.
    if risk.get("floor_triggers"):
        el.append(Spacer(1, 6))
        el.append(Paragraph("Floors triggered (max wins):", styles["BG_Body"]))
        for ft in risk["floor_triggers"]:
            el.append(Paragraph(
                f"  - <b>{xml_escape(ft['code'])}</b> "
                f"(forced min {ft['forced_min_score']}): "
                f"{xml_escape(ft['reason'])}",
                styles["BG_Small"]))
    el.append(Spacer(1, 12))
    return el


def _section_blockchain(view: "ViewBundle", styles, chart_paths: dict) -> list:
    chain = view.chain
    el: list = [Paragraph("6. Blockchain Notarization", styles["BG_H2"])]
    rows = [
        ["Field", "Value"],
        ["Chain", "Ethereum Sepolia (or mock)"],
        ["BDN Hash (sha256)", chain.get("anomaly_parent_sha256", "N/A") or "N/A"],
        ["Risk Payload Hash", chain.get("payload_sha256") or "N/A"],
        ["Parent Hash", chain.get("parent_sha256") or "N/A"],
    ]
    bct = Table(rows, colWidths=[100, 380])
    bct.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("FONTNAME", (0, 0), (-1, -1), "Courier"),
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("GRID", (0, 0), (-1, -1), 0.5, GRAY),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, LIGHT_GRAY]),
    ]))
    el.append(bct)
    if chart_paths.get("qr_code"):
        el.append(Spacer(1, 8))
        el.append(Image(str(chart_paths["qr_code"]), width=80, height=80))
    return el


def _section_footer(styles) -> list:
    return [
        Spacer(1, 20),
        HRFlowable(width="100%", thickness=1, color=GRAY),
        Paragraph(
            f"Generated by {BRAND['name']} v{BRAND['version']} | "
            f"{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')} | "
            f"This report is auto-generated and should be verified by a "
            f"qualified officer.",
            styles["BG_Small"],
        ),
    ]


def _table_style_header() -> TableStyle:
    return TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, GRAY),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, LIGHT_GRAY]),
    ])
