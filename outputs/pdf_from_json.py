"""Professional evidence report PDF renderer.

Renders directly from the ``report_json`` shape persisted in Supabase
``evidence_reports.report_json``. Bypasses the typed-contract pipeline so any
stored report can be re-rendered without re-running stages 1-4.

Layout:
- MPA Singapore letterhead on every page (logo + classification banner).
- Numbered sections, branded section rules.
- Verdict pill on the cover, quantity & risk summary cards.
- Anomalies and compliance tables with severity coloring.
- Appendix A: Letter of Protest (draft) on its own page.
- Footer with report id, session id, and "Page X of Y" on every page.

Logo: drop a PNG at ``outputs/assets/mpa_logo.png`` to use it. If absent, a
vector approximation is drawn so the document still looks finished.

CLI:
    python -m outputs.pdf_from_json --in outputs/SES-2026-016_report.json --open
    python -m outputs.pdf_from_json --session SES-2026-016 --open
    python -m outputs.pdf_from_json --latest --open
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfgen import canvas as canvas_mod
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

# ── brand ────────────────────────────────────────────────────────────────────
NAVY        = colors.HexColor("#0a2a55")
NAVY_DARK   = colors.HexColor("#06183a")
INK         = colors.HexColor("#1c1c1c")
MUTED       = colors.HexColor("#6a6f78")
RULE        = colors.HexColor("#cfd4dc")
BAND        = colors.HexColor("#eef2f7")
MPA_GREEN   = colors.HexColor("#2aa84a")
MPA_BLUE    = colors.HexColor("#1f6fb2")

SEVERITY_COLOR = {
    "CRITICAL": colors.HexColor("#a4161a"),
    "HIGH":     colors.HexColor("#bc6c25"),
    "MEDIUM":   colors.HexColor("#a07a00"),
    "LOW":      colors.HexColor("#2e7d32"),
}
VERDICT_COLOR = {
    "REFUSE_TO_SIGN": colors.HexColor("#a4161a"),
    "SIGN_WITH_LOP":  colors.HexColor("#bc6c25"),
    "SIGN_OFF":       colors.HexColor("#2e7d32"),
}

ASSETS_DIR = Path(__file__).parent / "assets"
LOGO_PATH  = ASSETS_DIR / "mpa_logo.png"

PAGE_W, PAGE_H = A4
MARGIN_L = 18 * mm
MARGIN_R = 18 * mm
MARGIN_T = 30 * mm   # leaves room for letterhead
MARGIN_B = 22 * mm   # leaves room for footer


# ── styles ───────────────────────────────────────────────────────────────────
def _styles() -> dict[str, ParagraphStyle]:
    ss = getSampleStyleSheet()
    return {
        "cover_title":  ParagraphStyle("cover_title", parent=ss["Title"],
                                       fontName="Helvetica-Bold", fontSize=22,
                                       textColor=NAVY, leading=26, spaceAfter=4),
        "cover_sub":    ParagraphStyle("cover_sub",   parent=ss["Normal"],
                                       fontSize=10, textColor=MUTED, leading=14),
        "h2":           ParagraphStyle("h2", parent=ss["Heading2"],
                                       fontName="Helvetica-Bold", fontSize=11.5,
                                       textColor=NAVY, leading=14,
                                       spaceBefore=12, spaceAfter=4),
        "h2_num":       ParagraphStyle("h2_num", parent=ss["Heading2"],
                                       fontName="Helvetica-Bold", fontSize=11.5,
                                       textColor=NAVY, leading=14,
                                       spaceBefore=12, spaceAfter=4),
        "body":         ParagraphStyle("body", parent=ss["BodyText"],
                                       fontName="Helvetica", fontSize=9.5,
                                       textColor=INK, leading=13, spaceAfter=2),
        "kv_k":         ParagraphStyle("kv_k", parent=ss["BodyText"],
                                       fontName="Helvetica-Bold", fontSize=9,
                                       textColor=MUTED, leading=12),
        "kv_v":         ParagraphStyle("kv_v", parent=ss["BodyText"],
                                       fontName="Helvetica", fontSize=9.5,
                                       textColor=INK, leading=12),
        "lop":          ParagraphStyle("lop", parent=ss["BodyText"],
                                       fontName="Helvetica", fontSize=10,
                                       textColor=INK, leading=14, spaceAfter=4),
        "lop_title":    ParagraphStyle("lop_title", parent=ss["BodyText"],
                                       fontName="Helvetica-Bold", fontSize=12,
                                       textColor=NAVY, alignment=1, spaceAfter=8),
        "mono":         ParagraphStyle("mono", parent=ss["Code"],
                                       fontName="Courier", fontSize=7.5,
                                       textColor=MUTED, leading=10),
        "caption":      ParagraphStyle("caption", parent=ss["Normal"],
                                       fontName="Helvetica-Oblique", fontSize=8.5,
                                       textColor=MUTED, leading=11),
        "verdict":      ParagraphStyle("verdict", parent=ss["BodyText"],
                                       fontName="Helvetica-Bold", fontSize=12,
                                       textColor=colors.white, alignment=1,
                                       leading=14),
    }


# ── logo ─────────────────────────────────────────────────────────────────────
def _draw_logo(c: canvas_mod.Canvas, x: float, y: float, w: float, h: float) -> None:
    """Draw the MPA logo. Uses outputs/assets/mpa_logo.png if present;
    otherwise draws a vector approximation (waves + chevrons + wordmark)."""
    if LOGO_PATH.exists():
        try:
            c.drawImage(str(LOGO_PATH), x, y, w, h,
                        preserveAspectRatio=True, mask="auto")
            return
        except Exception:
            pass  # fall through to vector

    # Vector fallback ----------------------------------------------------------
    c.saveState()
    # logical units inside (w x h) box, top-half = mark, bottom-half = text
    mark_h = h * 0.62
    mark_y = y + h - mark_h
    # 3 wavy lines (blue) on the left half of the mark
    c.setLineWidth(max(1.4, h * 0.045))
    c.setStrokeColor(MPA_BLUE)
    wave_x = x + w * 0.04
    wave_w = w * 0.42
    for i in range(3):
        yy = mark_y + mark_h * (0.78 - i * 0.22)
        path = c.beginPath()
        path.moveTo(wave_x, yy)
        steps = 24
        amp = h * 0.03
        for s in range(1, steps + 1):
            xx = wave_x + wave_w * (s / steps)
            offset = amp if (s % 2) else -amp
            path.lineTo(xx, yy + offset)
        c.drawPath(path, stroke=1, fill=0)
    # 3 chevron arrows (green) on the right
    c.setFillColor(MPA_GREEN)
    c.setStrokeColor(MPA_GREEN)
    chev_x = x + w * 0.48
    chev_w = w * 0.50
    for i in range(3):
        yy = mark_y + mark_h * (0.78 - i * 0.22)
        ah = h * 0.10
        p = c.beginPath()
        p.moveTo(chev_x,                yy + ah * 0.6)
        p.lineTo(chev_x + chev_w * 0.55, yy + ah * 0.6)
        p.lineTo(chev_x + chev_w * 0.72, yy)
        p.lineTo(chev_x + chev_w * 0.55, yy - ah * 0.6)
        p.lineTo(chev_x,                yy - ah * 0.6)
        p.lineTo(chev_x + chev_w * 0.17, yy)
        p.close()
        c.drawPath(p, stroke=0, fill=1)
    # Wordmark
    c.setFillColor(NAVY_DARK)
    c.setFont("Helvetica-Bold", h * 0.22)
    c.drawCentredString(x + w / 2, y + h * 0.05, "MPA")
    c.setFont("Helvetica", h * 0.10)
    c.setFillColor(MUTED)
    c.drawCentredString(x + w / 2, y - h * 0.04, "SINGAPORE")
    c.restoreState()


# ── header / footer ──────────────────────────────────────────────────────────
def _draw_header(c: canvas_mod.Canvas, meta: dict) -> None:
    # Top color band
    c.setFillColor(NAVY)
    c.rect(0, PAGE_H - 6 * mm, PAGE_W, 6 * mm, stroke=0, fill=1)

    # Logo block
    logo_w, logo_h = 22 * mm, 14 * mm
    logo_y = PAGE_H - 6 * mm - logo_h - 2 * mm
    _draw_logo(c, MARGIN_L, logo_y, logo_w, logo_h)

    # Reserve right column for meta (id + date). Right-align both lines,
    # measure their widths so the title block can be clipped before it
    # collides with them.
    rx = PAGE_W - MARGIN_R
    ty = PAGE_H - 13 * mm
    rid = str(meta.get("report_id", ""))
    rdt = str(meta.get("generated_at", ""))
    rid_font, rid_size = "Helvetica-Bold", 8
    rdt_font, rdt_size = "Helvetica", 7.5
    rid_w = pdfmetrics.stringWidth(rid, rid_font, rid_size)
    rdt_w = pdfmetrics.stringWidth(rdt, rdt_font, rdt_size)
    right_col_w = max(rid_w, rdt_w)
    right_col_left = rx - right_col_w

    c.setFillColor(INK)
    c.setFont(rid_font, rid_size)
    c.drawRightString(rx, ty, rid)
    c.setFillColor(MUTED)
    c.setFont(rdt_font, rdt_size)
    c.drawRightString(rx, ty - 4 * mm, rdt)

    # Title block — fits in the gap between logo and right column.
    tx = MARGIN_L + logo_w + 5 * mm
    title_max_w = right_col_left - tx - 4 * mm  # 4mm gutter
    title = "MARITIME AND PORT AUTHORITY OF SINGAPORE"
    title_font, title_size = "Helvetica-Bold", 10
    # Shrink the title until it fits the available width (floor 7.5pt).
    while title_size > 7.5 and pdfmetrics.stringWidth(title, title_font, title_size) > title_max_w:
        title_size -= 0.5
    c.setFillColor(NAVY_DARK)
    c.setFont(title_font, title_size)
    c.drawString(tx, ty, title)

    subtitle = "Bunker Delivery Evidence Report"
    sub_font, sub_size = "Helvetica", 8
    while sub_size > 6.5 and pdfmetrics.stringWidth(subtitle, sub_font, sub_size) > title_max_w:
        sub_size -= 0.5
    c.setFillColor(MUTED)
    c.setFont(sub_font, sub_size)
    c.drawString(tx, ty - 4 * mm, subtitle)

    # Separator rule
    c.setStrokeColor(RULE)
    c.setLineWidth(0.6)
    c.line(MARGIN_L, PAGE_H - MARGIN_T + 4 * mm, PAGE_W - MARGIN_R, PAGE_H - MARGIN_T + 4 * mm)


def _draw_footer(c: canvas_mod.Canvas, meta: dict, page_num: int, page_total: int) -> None:
    # Rule
    c.setStrokeColor(RULE)
    c.setLineWidth(0.6)
    c.line(MARGIN_L, MARGIN_B - 6 * mm, PAGE_W - MARGIN_R, MARGIN_B - 6 * mm)

    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7.5)
    c.drawString(MARGIN_L, MARGIN_B - 10 * mm,
                 f"Session {meta.get('session_id','')}  •  "
                 f"Hash {str(meta.get('report_hash',''))[:16]}…")
    c.drawCentredString(PAGE_W / 2, MARGIN_B - 10 * mm,
                        "CONFIDENTIAL — For Authorised Personnel Only")
    c.drawRightString(PAGE_W - MARGIN_R, MARGIN_B - 10 * mm,
                      f"Page {page_num} of {page_total}")


class _PageDecorator(canvas_mod.Canvas):
    """Canvas subclass that tracks page count for 'Page X of Y'."""
    def __init__(self, *a, meta=None, **kw):
        super().__init__(*a, **kw)
        self._pages: list[dict] = []
        self._meta = meta or {}

    def showPage(self):
        self._pages.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self._pages) + 1  # current page not yet flushed
        for state in self._pages:
            self.__dict__.update(state)
            _draw_header(self, self._meta)
            _draw_footer(self, self._meta, self.getPageNumber(), total)
            canvas_mod.Canvas.showPage(self)
        # last page
        _draw_header(self, self._meta)
        _draw_footer(self, self._meta, self.getPageNumber(), total)
        canvas_mod.Canvas.save(self)


# ── content helpers ──────────────────────────────────────────────────────────
def _kv_table(rows: list[tuple[str, Any]], k_w: float = 50 * mm,
              v_w: float = 115 * mm) -> Table:
    S = _styles()
    data = [[Paragraph(k, S["kv_k"]), Paragraph("" if v is None else str(v), S["kv_v"])]
            for k, v in rows]
    t = Table(data, colWidths=[k_w, v_w])
    t.setStyle(TableStyle([
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 4),
        ("TOPPADDING",    (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LINEBELOW",     (0, 0), (-1, -2), 0.25, RULE),
    ]))
    return t


def _section(num: str, title: str) -> Table:
    box_w = 10 * mm
    gutter = 4 * mm
    title_w = (PAGE_W - MARGIN_L - MARGIN_R) - box_w - gutter

    badge_style = ParagraphStyle(
        "_badge", fontName="Helvetica-Bold", fontSize=12,
        textColor=colors.white, alignment=1, leading=14)
    box = Table([[Paragraph(num, badge_style)]],
                colWidths=[box_w], rowHeights=[8 * mm])
    box.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), NAVY),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    title_p = Paragraph(title, ParagraphStyle(
        "_t", fontName="Helvetica-Bold", fontSize=12,
        textColor=NAVY, leading=14))

    row = Table([[box, "", title_p]],
                colWidths=[box_w, gutter, title_w])
    row.setStyle(TableStyle([
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ("LINEBELOW",     (0, 0), (-1, -1), 0.8, NAVY),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
    ]))
    return row


def _verdict_pill(verdict: str) -> Table:
    S = _styles()
    color = VERDICT_COLOR.get(verdict, NAVY)
    p = Paragraph(f"VERDICT &nbsp;·&nbsp; {verdict}", S["verdict"])
    t = Table([[p]], colWidths=[100 * mm], rowHeights=[10 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), color),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
    ]))
    return t


def _summary_cards(report: dict) -> Table:
    """Three summary cards: Risk, Quantity, Anomalies."""
    S = _styles()
    r = report.get("risk_assessment", {}) or {}
    q = report.get("quantity_comparison", {}) or {}
    a = report.get("anomaly_summary", {}) or {}

    def _card(label: str, big: str, sub: str, color) -> Table:
        big_p = Paragraph(
            f'<font color="{color.hexval()}"><b>{big}</b></font>',
            ParagraphStyle("_b", fontName="Helvetica-Bold", fontSize=18,
                           leading=20, alignment=1))
        lbl_p = Paragraph(label, ParagraphStyle("_l", fontName="Helvetica-Bold",
                          fontSize=8, textColor=MUTED, alignment=1, leading=10))
        sub_p = Paragraph(sub, ParagraphStyle("_s", fontName="Helvetica",
                          fontSize=8.5, textColor=INK, alignment=1, leading=11))
        c = Table([[lbl_p], [big_p], [sub_p]], colWidths=[53 * mm])
        c.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), BAND),
            ("BOX",           (0, 0), (-1, -1), 0.5, RULE),
            ("TOPPADDING",    (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING",   (0, 0), (-1, -1), 6),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
        ]))
        return c

    risk_color = {
        "CRITICAL": SEVERITY_COLOR["CRITICAL"],
        "HIGH":     SEVERITY_COLOR["HIGH"],
        "MEDIUM":   SEVERITY_COLOR["MEDIUM"],
        "LOW":      SEVERITY_COLOR["LOW"],
    }.get(str(r.get("risk_category", "")).upper(), NAVY)

    qty_color = SEVERITY_COLOR["CRITICAL"] if (q.get("discrepancy_pct") or 0) <= -1.0 \
        else SEVERITY_COLOR["LOW"]

    cards = [[
        _card("RISK", f"{r.get('final_score','—')}/100",
              str(r.get("risk_category", "—")), risk_color),
        _card("QUANTITY DEVIATION",
              f"{q.get('discrepancy_pct','—')}%",
              f"{q.get('discrepancy_mt','—')} MT  ·  USD {q.get('financial_impact_usd','—')}",
              qty_color),
        _card("ANOMALIES",
              str(a.get("total_anomalies", 0)),
              f"crit {a.get('critical_count',0)}  ·  high {a.get('high_count',0)}  ·  med {a.get('medium_count',0)}",
              SEVERITY_COLOR["CRITICAL"] if a.get("critical_count", 0) else NAVY),
    ]]
    t = Table(cards, colWidths=[55 * mm, 55 * mm, 55 * mm])
    t.setStyle(TableStyle([
        ("LEFTPADDING",  (0, 0), (-1, -1), 1),
        ("RIGHTPADDING", (0, 0), (-1, -1), 1),
        ("VALIGN",       (0, 0), (-1, -1), "TOP"),
    ]))
    return t


def _anomalies_table(anomalies: list[dict]) -> Table:
    S = _styles()
    rows: list[list[Any]] = [["#", "Rule", "Severity", "Timestamp", "Description"]]
    for i, an in enumerate(anomalies, 1):
        rows.append([
            str(i),
            Paragraph(f"<b>{an.get('rule_id','')}</b><br/>"
                      f"<font color='{MUTED.hexval()}'>{an.get('rule_name','')}</font>",
                      S["body"]),
            an.get("severity", ""),
            an.get("timestamp", ""),
            Paragraph(an.get("description", ""), S["body"]),
        ])
    tbl = Table(rows, colWidths=[8 * mm, 42 * mm, 20 * mm, 32 * mm, 63 * mm], repeatRows=1)
    style = [
        ("FONT",       (0, 0), (-1, 0), "Helvetica-Bold", 9),
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR",  (0, 0), (-1, 0), colors.white),
        ("ALIGN",      (0, 0), (-1, 0), "LEFT"),
        ("FONT",       (0, 1), (-1, -1), "Helvetica", 8.5),
        ("VALIGN",     (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, BAND]),
        ("GRID",       (0, 0), (-1, -1), 0.25, RULE),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    for i, an in enumerate(anomalies, start=1):
        sc = SEVERITY_COLOR.get(str(an.get("severity", "")).upper())
        if sc:
            style.append(("TEXTCOLOR", (2, i), (2, i), sc))
            style.append(("FONT",      (2, i), (2, i), "Helvetica-Bold", 8.5))
    tbl.setStyle(TableStyle(style))
    return tbl


def _flags_table(flags: dict) -> Table:
    rows: list[list[Any]] = [["Check", "Status"]]
    for k, v in flags.items():
        rows.append([k.replace("_", " ").title(), "PASS" if v else "FAIL"])
    tbl = Table(rows, colWidths=[125 * mm, 40 * mm], repeatRows=1)
    style = [
        ("FONT",       (0, 0), (-1, 0), "Helvetica-Bold", 9),
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR",  (0, 0), (-1, 0), colors.white),
        ("FONT",       (0, 1), (-1, -1), "Helvetica", 9),
        ("GRID",       (0, 0), (-1, -1), 0.25, RULE),
        ("ALIGN",      (1, 1), (1, -1), "CENTER"),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    for i, (_, v) in enumerate(flags.items(), start=1):
        col = colors.HexColor("#2e7d32") if v else colors.HexColor("#a4161a")
        style.append(("TEXTCOLOR", (1, i), (1, i), col))
        style.append(("FONT",      (1, i), (1, i), "Helvetica-Bold", 9))
    tbl.setStyle(TableStyle(style))
    return tbl


def _signature_block() -> Table:
    S = _styles()

    def _sig_cell(role: str) -> Table:
        line = Paragraph(
            '<para align="left">'
            '<font color="#bcbcbc">________________________________</font></para>',
            S["body"])
        lbl = Paragraph(role, ParagraphStyle("_r", fontName="Helvetica-Bold",
                       fontSize=8.5, textColor=MUTED, leading=11))
        date_lbl = Paragraph("Date: ____________________",
                             ParagraphStyle("_d", fontName="Helvetica",
                                            fontSize=8, textColor=MUTED, leading=10))
        c = Table([[line], [lbl], [Spacer(1, 4)], [date_lbl]], colWidths=[80 * mm])
        c.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0)]))
        return c

    t = Table([[_sig_cell("Chief Engineer / Master"),
                _sig_cell("Supplier Representative")]],
              colWidths=[82 * mm, 82 * mm])
    t.setStyle(TableStyle([
        ("VALIGN",      (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING",  (0, 0), (-1, -1), 12),
    ]))
    return t


# ── builder ──────────────────────────────────────────────────────────────────
def build_pdf(report: dict, out_path: Path) -> Path:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    S = _styles()

    meta = {
        "report_id":    report.get("report_id", ""),
        "session_id":   report.get("session_id", ""),
        "generated_at": report.get("generated_at", ""),
        "report_hash":  report.get("report_hash", ""),
    }

    doc = BaseDocTemplate(
        str(out_path), pagesize=A4,
        leftMargin=MARGIN_L, rightMargin=MARGIN_R,
        topMargin=MARGIN_T, bottomMargin=MARGIN_B,
        title=f"MPA Evidence Report {meta['report_id']}",
        author="Maritime and Port Authority of Singapore",
        subject="Bunker Delivery Evidence Report",
    )
    frame = Frame(MARGIN_L, MARGIN_B,
                  PAGE_W - MARGIN_L - MARGIN_R,
                  PAGE_H - MARGIN_T - MARGIN_B,
                  leftPadding=0, rightPadding=0,
                  topPadding=0, bottomPadding=0, id="body")
    doc.addPageTemplates([PageTemplate(id="branded", frames=[frame])])

    story: list = []

    # ── Cover ────────────────────────────────────────────────────────────────
    story.append(Paragraph("BUNKER DELIVERY", S["cover_sub"]))
    story.append(Paragraph("Evidence Report", S["cover_title"]))
    story.append(Paragraph(
        f"Report ID <b>{meta['report_id']}</b> &nbsp; · &nbsp; "
        f"Issued <b>{meta['generated_at']}</b>", S["cover_sub"]))
    story.append(Spacer(1, 10))
    story.append(_verdict_pill(str(report.get("sign_off_status", "—"))))
    story.append(Spacer(1, 12))
    story.append(_summary_cards(report))
    story.append(Spacer(1, 14))

    # ── 1. Delivery particulars ──────────────────────────────────────────────
    h = report.get("header", {}) or {}
    story.append(_section("1", "Delivery Particulars"))
    story.append(_kv_table([
        ("BDN reference",     h.get("bdn_reference")),
        ("Delivery date",     h.get("delivery_date")),
        ("Delivery window",   f"{h.get('delivery_start','')} – {h.get('delivery_end','')}"),
        ("Port",              h.get("port")),
        ("Receiving vessel",  f"{h.get('vessel_name','')} (IMO {h.get('vessel_imo','')})"),
        ("Delivering barge",  h.get("barge_name")),
        ("Supplier",          h.get("supplier_name")),
        ("Supplier licence",  h.get("supplier_licence")),
        ("Fuel grade",        h.get("fuel_grade")),
    ]))

    # ── 2. Risk assessment ───────────────────────────────────────────────────
    r = report.get("risk_assessment", {}) or {}
    story.append(_section("2", "Risk Assessment"))
    story.append(_kv_table([
        ("Final risk score",         f"{r.get('final_score','—')} / 100"),
        ("Risk category",            r.get("risk_category")),
        ("Recommended verdict",      r.get("recommended_verdict")),
        ("Similar incidents (30d)",  r.get("similar_incidents_30d")),
    ]))

    # ── 3. Quantity comparison ───────────────────────────────────────────────
    q = report.get("quantity_comparison", {}) or {}
    if q:
        story.append(_section("3", "Quantity Comparison"))
        story.append(_kv_table([
            ("BDN declared (MT)",       q.get("bdn_declared_mt")),
            ("MFM measured (MT)",       q.get("mfm_measured_mt")),
            ("Discrepancy (MT)",        q.get("discrepancy_mt")),
            ("Discrepancy (%)",         q.get("discrepancy_pct")),
            ("VLSFO spot (USD/MT)",     q.get("vlsfo_spot_price_per_mt")),
            ("Estimated financial impact (USD)", q.get("financial_impact_usd")),
        ]))

    # ── 4. AI narrative ──────────────────────────────────────────────────────
    if report.get("ai_narrative"):
        story.append(_section("4", "AI Narrative"))
        story.append(Paragraph(str(report["ai_narrative"]), S["body"]))

    # ── 5. Anomalies ─────────────────────────────────────────────────────────
    a = report.get("anomaly_summary", {}) or {}
    anomalies = a.get("anomalies", []) or []
    if anomalies:
        story.append(_section("5", "Detected Anomalies"))
        story.append(Paragraph(
            f"Total {a.get('total_anomalies', len(anomalies))} — "
            f"<font color='{SEVERITY_COLOR['CRITICAL'].hexval()}'><b>"
            f"{a.get('critical_count',0)} critical</b></font>, "
            f"<font color='{SEVERITY_COLOR['HIGH'].hexval()}'>"
            f"{a.get('high_count',0)} high</font>, "
            f"<font color='{SEVERITY_COLOR['MEDIUM'].hexval()}'>"
            f"{a.get('medium_count',0)} medium</font>.", S["caption"]))
        story.append(Spacer(1, 4))
        story.append(_anomalies_table(anomalies))

    # ── 6. Compliance flags ──────────────────────────────────────────────────
    c = report.get("compliance_flags", {}) or {}
    if c:
        story.append(_section("6", "Compliance Checklist"))
        story.append(_flags_table(c))

    # ── 7. Recommended actions ───────────────────────────────────────────────
    actions = report.get("recommended_actions") or []
    if actions:
        story.append(_section("7", "Recommended Actions"))
        for line in actions:
            story.append(Paragraph(str(line), S["body"]))

    # ── Signatures ───────────────────────────────────────────────────────────
    story.append(Spacer(1, 14))
    story.append(_section("8", "Acknowledgement"))
    story.append(Paragraph(
        "The undersigned acknowledge receipt and review of this evidence "
        "report. Signatures confirm understanding of the findings; they do "
        "not constitute acceptance of liability.", S["body"]))
    story.append(_signature_block())

    # ── Appendix A: LoP ──────────────────────────────────────────────────────
    if report.get("lop_draft"):
        story.append(PageBreak())
        story.append(_section("A", "Appendix — Letter of Protest (Draft)"))
        story.append(Spacer(1, 4))
        story.append(Paragraph("LETTER OF PROTEST", S["lop_title"]))
        for para in str(report["lop_draft"]).split("\n\n"):
            # Skip the all-caps title that's usually the first paragraph
            if para.strip().upper().startswith("LETTER OF PROTEST"):
                continue
            story.append(Paragraph(para.replace("\n", "<br/>"), S["lop"]))

    doc.build(story,
              canvasmaker=lambda *a, **kw: _PageDecorator(*a, meta=meta, **kw))
    return out_path


# ── data sources ─────────────────────────────────────────────────────────────
def fetch_from_supabase(session_id: str | None) -> dict:
    """Pull the most recent ``report_json`` for a session_id from Supabase.
    If session_id is None, fetch the most recent row overall."""
    import urllib.parse
    import urllib.request

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY")
    if not (url and key):
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_KEY) must be set.")

    qs = {
        "select": "report_json,generated_at",
        "order":  "generated_at.desc",
        "limit":  "1",
    }
    if session_id:
        qs["session_id"] = f"eq.{session_id}"
    full = f"{url.rstrip('/')}/rest/v1/evidence_reports?{urllib.parse.urlencode(qs)}"
    req = urllib.request.Request(full, headers={
        "apikey":        key,
        "Authorization": f"Bearer {key}",
    })
    with urllib.request.urlopen(req, timeout=20) as resp:
        rows = json.loads(resp.read().decode())
    if not rows:
        raise RuntimeError(f"No evidence_reports row found (session_id={session_id!r}).")
    return rows[0]["report_json"]


def _open(path: Path) -> None:
    if sys.platform.startswith("win"):
        os.startfile(str(path))  # type: ignore[attr-defined]
    elif sys.platform == "darwin":
        subprocess.run(["open", str(path)], check=False)
    else:
        subprocess.run(["xdg-open", str(path)], check=False)


# ── CLI ──────────────────────────────────────────────────────────────────────
def main() -> None:
    ap = argparse.ArgumentParser(description="Render an evidence report PDF from report_json.")
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--in",      dest="in_path", help="Path to a report_json file.")
    src.add_argument("--session", dest="session_id", help="Session id to pull latest from Supabase.")
    src.add_argument("--latest",  action="store_true", help="Pull the most recent Supabase row.")
    ap.add_argument("--out",  dest="out_path", help="Output PDF path. Default: outputs/<session>_report.pdf")
    ap.add_argument("--open", dest="do_open", action="store_true", help="Open the PDF when done.")
    args = ap.parse_args()

    if args.in_path:
        report = json.loads(Path(args.in_path).read_text(encoding="utf-8"))
    else:
        report = fetch_from_supabase(args.session_id if args.session_id else None)

    sid = report.get("session_id", "report")
    out = Path(args.out_path) if args.out_path else Path("outputs") / f"{sid}_report.pdf"
    build_pdf(report, out)
    print(f"wrote {out}")
    if args.do_open:
        _open(out)


if __name__ == "__main__":
    main()
