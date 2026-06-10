import jsPDF from 'jspdf';

/** Bump this whenever the structural layout / content of a PDF kind
 *  changes (new sections, reordered banner, different stamp behaviour).
 *  useGeneratedReports compares the saved version against this constant
 *  and auto-regenerates any stale entries on next mount — old cached
 *  PDFs from prior versions are silently replaced. */
export const PDF_SCHEMA_VERSION = 'v4-mpa-structure-2026-06-10';

/**
 * App-wide PDF generator.
 *
 * Every report kind the app produces (Evidence Report, Chief Engineer
 * Sign-Off Audit, Anomaly Bundle, Supplier Dossier, …) goes through this
 * single styled-document builder. The output keeps the existing paper
 * visual style — cream paper, dark header band, rotated verdict stamp on
 * the cover — but the structural CONTENT mirrors the MPA-format reference
 * at `outputs/SES-2026-016_report_v4.pdf`:
 *
 *   Cover band                BUNKER DELIVERY · Evidence Report · Report ID
 *   Verdict bar               full-width pill across the page
 *   Stat trio                 RISK · QUANTITY DEVIATION · ANOMALIES
 *   § 1 Delivery Particulars  numbered key-value
 *   § 2 Risk Assessment
 *   § 3 Quantity Comparison
 *   § 4 AI Narrative
 *   § 5 Detected Anomalies    multi-column table with severity styling
 *   § 6 Compliance Checklist  PASS/FAIL table
 *   § 7 Recommended Actions   numbered list
 *   § 8 Acknowledgement       signature blocks
 *   Appendix A                Letter of Protest (Draft) — formal letter
 *
 * Section types are pluggable so other report kinds (e.g. Sign-Off Audit)
 * pick the subset they need.
 */

export interface PdfMeta {
  kind: string;
  /** Big serif title on the cover, e.g. "Evidence Report". */
  title: string;
  /** Subtitle line under the title — vessel / supplier. */
  subtitle?: string;
  /** Report-ID line below the title, e.g. "Report ID RPT-… · Issued 2026-…" */
  reference?: string;
  sessionId?: string;
  generatedAt?: string;
  hash?: string;
  /** Top eyebrow above the title, e.g. "BUNKER DELIVERY". */
  eyebrow?: string;
  /** Full-width verdict bar between title and stat trio. */
  verdict?: {
    label: string;
    color?: [number, number, number];
  };
  /** Three-column highlight strip under the verdict bar. */
  stats?: Array<{
    label: string;
    value: string;
    sub?: string;
    color?: [number, number, number];
  }>;
  /** Body sections, rendered in order after the cover banner. */
  sections?: PdfSection[];
  /** Optional cover-page key-facts table (used by smaller reports
   *  like Sign-Off Audit that don't need the full 8-section structure). */
  facts?: Array<{ label: string; value: string; warn?: boolean }>;
}

export type PdfSection =
  | { type: 'paragraph';  heading?: string; numbered?: string; text: string }
  | { type: 'bullets';    heading?: string; numbered?: string; items: string[] }
  | { type: 'code';       heading?: string; numbered?: string; text: string }
  | { type: 'kv';         heading?: string; numbered?: string; rows: Array<{ k: string; v: string; warn?: boolean }> }
  | { type: 'table';      heading?: string; numbered?: string; columns: string[]; colWidths?: number[]; rows: TableRow[] }
  | { type: 'signatures'; heading?: string; numbered?: string; intro?: string; signers: Array<{ role: string }> }
  | { type: 'letter';     heading?: string; numbered?: string; title: string; body: string };

export type TableRow = Array<TableCell | string>;
export interface TableCell {
  text: string;
  /** Severity badge styling for the cell (CRITICAL/HIGH/MEDIUM/PASS/FAIL). */
  badge?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'PASS' | 'FAIL';
  bold?: boolean;
  mono?: boolean;
}

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN_X = 18;
const MARGIN_Y = 18;
const CONTENT_W = PAGE_W - 2 * MARGIN_X;

const COL_PAPER  = [244, 236, 216] as const;
const COL_INK    = [31, 26, 18]    as const;
const COL_DIM    = [92, 83, 64]    as const;
const COL_RULE   = [188, 173, 138] as const;
const COL_WARN   = [159, 42, 31]   as const;
const COL_ACCENT = [22, 64, 117]   as const;  // navy used for section numerals
const COL_PASS   = [22, 119, 78]   as const;
const COL_FAIL   = [159, 42, 31]   as const;
const COL_HIGH   = [184, 110, 30]  as const;
const COL_MED    = [54, 110, 175]  as const;

function setColor(doc: jsPDF, c: readonly [number, number, number], where: 'fill' | 'text' | 'draw') {
  if (where === 'fill') doc.setFillColor(c[0], c[1], c[2]);
  if (where === 'text') doc.setTextColor(c[0], c[1], c[2]);
  if (where === 'draw') doc.setDrawColor(c[0], c[1], c[2]);
}

function paperBackground(doc: jsPDF) {
  setColor(doc, COL_PAPER, 'fill');
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
  setColor(doc, COL_INK, 'fill');
  doc.rect(0, 0, PAGE_W, 8, 'F');
}

export function buildReportPdf(meta: PdfMeta): { blob: Blob; bytes: Uint8Array; pageCount: number } {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const generatedAt = meta.generatedAt ?? new Date().toISOString();

  // ─── Cover page background ──────────────────────────────────────────
  setColor(doc, COL_PAPER, 'fill');
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');

  // Header band — kept dark to match the on-screen card style.
  setColor(doc, COL_INK, 'fill');
  doc.rect(0, 0, PAGE_W, 14, 'F');
  setColor(doc, COL_PAPER, 'text');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('BUNKERGUARD AI  ·  MARITIME INTELLIGENCE', MARGIN_X, 9);
  doc.setFontSize(7);
  doc.text(meta.kind.toUpperCase(), PAGE_W - MARGIN_X, 9, { align: 'right' });

  let y = 28;

  // Eyebrow + Title + Subtitle (newspaper headline block)
  if (meta.eyebrow) {
    setColor(doc, COL_DIM, 'text');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(meta.eyebrow.toUpperCase(), MARGIN_X, y);
    y += 8;
  }
  setColor(doc, COL_INK, 'text');
  doc.setFont('times', 'bold');
  doc.setFontSize(26);
  doc.text(meta.title, MARGIN_X, y);
  y += 8;
  if (meta.reference) {
    setColor(doc, COL_DIM, 'text');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(meta.reference, MARGIN_X, y);
    y += 5;
  }
  if (meta.subtitle) {
    setColor(doc, COL_DIM, 'text');
    doc.setFont('times', 'italic');
    doc.setFontSize(11);
    doc.text(meta.subtitle, MARGIN_X, y);
    y += 6;
  }
  setColor(doc, COL_RULE, 'draw');
  doc.setLineWidth(0.4);
  doc.line(MARGIN_X, y + 2, PAGE_W - MARGIN_X, y + 2);
  y += 8;

  // Verdict bar — full-width pill replaces the corner stamp from earlier
  // designs (matches the v4 reference layout).
  if (meta.verdict) {
    const vcol = meta.verdict.color ?? COL_WARN;
    setColor(doc, vcol, 'fill');
    doc.roundedRect(MARGIN_X, y, CONTENT_W, 12, 2, 2, 'F');
    setColor(doc, [255, 255, 255], 'text');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(`VERDICT  ·  ${meta.verdict.label}`, PAGE_W / 2, y + 8, { align: 'center' });
    y += 17;
  }

  // Stat trio — three highlight cards on the cover (RISK / DEV / ANOMS)
  if (meta.stats && meta.stats.length) {
    const cardW = (CONTENT_W - 2 * 4) / meta.stats.length;
    for (let i = 0; i < meta.stats.length; i++) {
      const s = meta.stats[i];
      const x = MARGIN_X + i * (cardW + 4);
      const col = s.color ?? COL_INK;
      setColor(doc, [232, 222, 200], 'fill');
      doc.roundedRect(x, y, cardW, 28, 2, 2, 'F');
      setColor(doc, COL_DIM, 'text');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(s.label.toUpperCase(), x + cardW / 2, y + 6, { align: 'center' });
      setColor(doc, col, 'text');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text(s.value, x + cardW / 2, y + 17, { align: 'center' });
      if (s.sub) {
        setColor(doc, COL_DIM, 'text');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(s.sub, x + cardW / 2, y + 24, { align: 'center' });
      }
    }
    y += 33;
  }

  // Cover-page facts (legacy / Sign-Off Audit)
  if (meta.facts && meta.facts.length) {
    y = drawKvBlock(doc, y, meta.facts.map((f) => ({ k: f.label, v: f.value, warn: f.warn })));
    y += 4;
  }

  // ─── Body sections (numbered) ───────────────────────────────────────
  for (const s of meta.sections ?? []) {
    y = ensureSpace(doc, y, 24);
    y = drawHeading(doc, y, s);
    switch (s.type) {
      case 'paragraph': y = drawParagraph(doc, y, s.text); break;
      case 'bullets':   y = drawNumberedList(doc, y, s.items); break;
      case 'code':      y = drawCode(doc, y, s.text); break;
      case 'kv':        y = drawKvBlock(doc, y, s.rows); break;
      case 'table':     y = drawTable(doc, y, s.columns, s.rows, s.colWidths); break;
      case 'signatures':y = drawSignatures(doc, y, s.intro, s.signers); break;
      case 'letter':    y = drawLetter(doc, y, s.title, s.body); break;
    }
    y += 6;
  }

  // ─── Footers on every page ──────────────────────────────────────────
  const total = (doc as any).getNumberOfPages?.() ?? 1;
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    setColor(doc, COL_RULE, 'draw');
    doc.setLineWidth(0.2);
    doc.line(MARGIN_X, PAGE_H - 14, PAGE_W - MARGIN_X, PAGE_H - 14);
    setColor(doc, COL_DIM, 'text');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const left = meta.sessionId
      ? `Session ${meta.sessionId} · CONFIDENTIAL — For Authorised Personnel Only`
      : `CONFIDENTIAL — For Authorised Personnel Only`;
    doc.text(left, MARGIN_X, PAGE_H - 9);
    if (meta.hash) {
      doc.setFont('courier', 'normal');
      doc.setFontSize(7);
      doc.text(`Hash ${meta.hash.slice(0, 24)}…`, PAGE_W / 2, PAGE_H - 9, { align: 'center' });
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(`Page ${i} / ${total}`, PAGE_W - MARGIN_X, PAGE_H - 9, { align: 'right' });
  }

  const bytes = doc.output('arraybuffer');
  const u8 = new Uint8Array(bytes);
  const blob = new Blob([u8], { type: 'application/pdf' });
  return { blob, bytes: u8, pageCount: total };
}

/* ─── Layout helpers ───────────────────────────────────────────────── */

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed < PAGE_H - 20) return y;
  doc.addPage();
  paperBackground(doc);
  return MARGIN_Y + 4;
}

/** Numbered section heading — coloured square with the section number
 *  on the left, bold title text on the right (matches v4 reference). */
function drawHeading(doc: jsPDF, yIn: number, s: PdfSection): number {
  if (!s.heading && !s.numbered) return yIn;
  let y = yIn;
  const boxSize = 7;
  if (s.numbered) {
    setColor(doc, COL_ACCENT, 'fill');
    doc.rect(MARGIN_X, y - boxSize + 1.5, boxSize, boxSize, 'F');
    setColor(doc, [255, 255, 255], 'text');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(s.numbered, MARGIN_X + boxSize / 2, y - 0.7, { align: 'center' });
  }
  setColor(doc, COL_ACCENT, 'text');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  const headingText = s.heading ?? '';
  doc.text(headingText, MARGIN_X + (s.numbered ? boxSize + 3.5 : 0), y);
  y += 2;
  setColor(doc, COL_RULE, 'draw');
  doc.setLineWidth(0.3);
  doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
  return y + 6;
}

function drawKvBlock(doc: jsPDF, yIn: number, rows: Array<{ k: string; v: string; warn?: boolean }>): number {
  let y = yIn;
  for (const row of rows) {
    y = ensureSpace(doc, y, 6);
    setColor(doc, COL_INK, 'text');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(row.k, MARGIN_X, y);
    setColor(doc, row.warn ? COL_WARN : COL_INK, 'text');
    doc.setFont('helvetica', row.warn ? 'bold' : 'normal');
    doc.setFontSize(9.5);
    doc.text(row.v, MARGIN_X + 64, y);
    setColor(doc, COL_RULE, 'draw');
    doc.setLineWidth(0.1);
    doc.setLineDashPattern([0.5, 0.5], 0);
    doc.line(MARGIN_X, y + 1.5, PAGE_W - MARGIN_X, y + 1.5);
    doc.setLineDashPattern([], 0);
    y += 6;
  }
  return y;
}

function drawParagraph(doc: jsPDF, yIn: number, text: string): number {
  setColor(doc, COL_INK, 'text');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(text.replace(/\s+/g, ' ').trim(), CONTENT_W);
  let y = yIn;
  for (const line of lines) {
    y = ensureSpace(doc, y, 5);
    doc.text(line, MARGIN_X, y);
    y += 5;
  }
  return y;
}

/** Numbered list — items already start with "1. ", "2. " preserved if
 *  present, otherwise we add them. Matches v4's Recommended Actions style. */
function drawNumberedList(doc: jsPDF, yIn: number, items: string[]): number {
  let y = yIn;
  setColor(doc, COL_INK, 'text');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  for (let i = 0; i < items.length; i++) {
    const raw = items[i].replace(/^\d+\.\s*/, '');
    const numbered = `${i + 1}. ${raw}`;
    const lines = doc.splitTextToSize(numbered, CONTENT_W);
    for (let j = 0; j < lines.length; j++) {
      y = ensureSpace(doc, y, 5);
      doc.text(lines[j], MARGIN_X, y);
      y += 5;
    }
    y += 1.5;
  }
  return y;
}

function drawCode(doc: jsPDF, yIn: number, text: string): number {
  setColor(doc, COL_INK, 'text');
  doc.setFont('courier', 'normal');
  doc.setFontSize(8.5);
  const lines = doc.splitTextToSize(text, CONTENT_W);
  let y = yIn + 1;
  doc.setFillColor(228, 220, 199);
  doc.rect(MARGIN_X - 1, y - 3, CONTENT_W + 2, lines.length * 4 + 4, 'F');
  setColor(doc, COL_INK, 'text');
  for (const line of lines) {
    y = ensureSpace(doc, y, 4);
    doc.text(line, MARGIN_X + 1, y);
    y += 4;
  }
  return y + 1;
}

function badgeColor(b?: TableCell['badge']): readonly [number, number, number] {
  switch (b) {
    case 'CRITICAL': return COL_FAIL;
    case 'HIGH':     return COL_HIGH;
    case 'MEDIUM':   return COL_MED;
    case 'LOW':      return COL_PASS;
    case 'PASS':     return COL_PASS;
    case 'FAIL':     return COL_FAIL;
    default:         return COL_INK;
  }
}

/** Multi-column table with a coloured header row and alternating
 *  background rows. Cells can carry a badge for severity / pass-fail
 *  styling. Used for Detected Anomalies + Compliance Checklist. */
function drawTable(
  doc: jsPDF, yIn: number,
  columns: string[],
  rows: TableRow[],
  colWidths?: number[],
): number {
  let y = yIn;
  const widths = colWidths ?? columns.map(() => CONTENT_W / columns.length);
  const rowH = 7;

  // Header band
  setColor(doc, COL_ACCENT, 'fill');
  doc.rect(MARGIN_X, y, CONTENT_W, rowH, 'F');
  setColor(doc, [255, 255, 255], 'text');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  let x = MARGIN_X + 2;
  for (let i = 0; i < columns.length; i++) {
    doc.text(columns[i], x, y + 5);
    x += widths[i];
  }
  y += rowH;

  // Body rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    // Compute row height based on longest wrapped cell
    let maxLines = 1;
    const wrapped: string[][] = [];
    for (let c = 0; c < columns.length; c++) {
      const cell = row[c];
      const txt = typeof cell === 'string' ? cell : cell.text;
      const lines = doc.splitTextToSize(txt, widths[c] - 4);
      wrapped.push(lines);
      if (lines.length > maxLines) maxLines = lines.length;
    }
    const h = Math.max(rowH, 3 + maxLines * 4);
    y = ensureSpace(doc, y, h + 3);

    if (r % 2 === 1) {
      setColor(doc, [232, 222, 200], 'fill');
      doc.rect(MARGIN_X, y, CONTENT_W, h, 'F');
    }
    x = MARGIN_X + 2;
    for (let c = 0; c < columns.length; c++) {
      const cell = row[c];
      const isObj = typeof cell !== 'string';
      const badge = isObj ? cell.badge : undefined;
      const bold  = isObj && cell.bold;
      const mono  = isObj && cell.mono;
      const color = badge ? badgeColor(badge) : COL_INK;
      setColor(doc, color, 'text');
      doc.setFont(mono ? 'courier' : 'helvetica', bold || badge ? 'bold' : 'normal');
      doc.setFontSize(9);
      const lines = wrapped[c];
      for (let li = 0; li < lines.length; li++) {
        doc.text(lines[li], x, y + 5 + li * 4);
      }
      x += widths[c];
    }
    y += h;
    setColor(doc, COL_RULE, 'draw');
    doc.setLineWidth(0.1);
    doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
  }
  return y + 1;
}

/** Signature block — section 8 of the v4 reference. Each signer gets a
 *  horizontal line + role label + "Date: ____" line. Two-column layout
 *  for compactness when ≥ 2 signers. */
function drawSignatures(
  doc: jsPDF, yIn: number,
  intro: string | undefined,
  signers: Array<{ role: string }>,
): number {
  let y = yIn;
  if (intro) {
    y = drawParagraph(doc, y, intro);
    y += 4;
  }
  const cols = signers.length >= 2 ? 2 : 1;
  const colW = CONTENT_W / cols - 6;
  const startY = y + 6;
  for (let i = 0; i < signers.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const blockH = 18;
    const yy = startY + row * (blockH + 6);
    const xx = MARGIN_X + col * (colW + 12);
    y = ensureSpace(doc, yy, blockH + 6);
    setColor(doc, COL_INK, 'draw');
    doc.setLineWidth(0.4);
    doc.line(xx, yy, xx + colW, yy);
    setColor(doc, COL_INK, 'text');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(signers[i].role, xx, yy + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Date: ____________________', xx, yy + 11);
  }
  return startY + Math.ceil(signers.length / cols) * 24;
}

/** Letter of Protest — formal letter block. Centered bold title,
 *  body paragraphs, three signature lines at the bottom. */
function drawLetter(
  doc: jsPDF, yIn: number,
  title: string,
  body: string,
): number {
  let y = yIn + 2;
  setColor(doc, COL_INK, 'text');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(title, PAGE_W / 2, y, { align: 'center' });
  y += 8;
  // Body — preserve newlines
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const paragraphs = body.split(/\n\s*\n/);
  for (const para of paragraphs) {
    const lines = doc.splitTextToSize(para.replace(/\s+/g, ' ').trim(), CONTENT_W);
    for (const line of lines) {
      y = ensureSpace(doc, y, 5);
      doc.text(line, MARGIN_X, y);
      y += 5;
    }
    y += 3;
  }
  return y;
}
