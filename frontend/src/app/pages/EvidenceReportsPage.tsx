import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import {
  FileText, Anchor, RefreshCw, ChevronRight, AlertTriangle,
  ExternalLink, Download, Loader2,
} from 'lucide-react';
import { useEvidenceReports, type EvidenceReportRow } from '../../lib/useEvidenceReports';
import {
  useGeneratedReports, saveReportPdf,
  type GeneratedReport, PDF_SCHEMA_VERSION,
} from '../../lib/useGeneratedReports';
import { PdfMeta } from '../../lib/pdfBuilder';
import { PortCopilot } from '../components/PortCopilot';
import { PdfThumbnail } from '../components/reports/PdfThumbnail';

/* ── Design tokens shared with the rest of the app ─────────────── */
const CARD: React.CSSProperties = {
  background: 'linear-gradient(180deg, #102033 0%, #0E1C2D 100%)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 8,
};
const LABEL: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#5A8AB4', marginBottom: 6,
};

/** Shared palette → matches the on-screen card AND the PDF cover, so the
 *  visual the user sees IS the document's first page. */
function verdictColor(verdict: string): string {
  const v = (verdict || '').toUpperCase();
  if (v.startsWith('REFUSE'))            return '#FF5656';
  if (v === 'APPROVED' || v.startsWith('SIGN')) return '#34C98C';
  if (v === 'OVERRIDDEN')                return '#FFA940';
  if (v.startsWith('REVIEW'))            return '#FFA940';
  return '#7FA5D3';
}
function verdictRgb(verdict: string): [number, number, number] {
  const v = (verdict || '').toUpperCase();
  if (v.startsWith('REFUSE'))             return [159, 42, 31];
  if (v === 'APPROVED' || v.startsWith('SIGN')) return [22, 119, 78];
  if (v === 'OVERRIDDEN' || v.startsWith('REVIEW')) return [184, 110, 30];
  return [92, 83, 64];
}

/** Build the PdfMeta for an evidence_report row — content mirrors the
 *  MPA-format reference at outputs/SES-2026-016_report_v4.pdf: 3-stat
 *  banner, 8 numbered sections (Delivery Particulars → Acknowledgement),
 *  and Appendix A Letter of Protest. */
function evidenceReportToPdfMeta(row: EvidenceReportRow): PdfMeta {
  const r = row.report_json ?? {};
  const verdictLabel = (row.sign_off_status || r.risk_assessment?.recommended_verdict || 'PENDING');
  const qc  = r.quantity_comparison ?? {};
  const ras = r.risk_assessment ?? {};
  const ano = r.anomaly_summary ?? {};
  const hdr = r.header ?? {};
  const cf  = r.compliance_flags ?? {};
  const reportId = row.report_id ?? r.report_id ?? '';
  const issued   = row.generated_at ?? r.generated_at ?? new Date().toISOString();

  // ─── Cover stat trio ──────────────────────────────────────────────
  const risk = ras.final_score ?? '—';
  const riskCat = ras.risk_category ?? '—';
  const dev = qc.discrepancy_pct;
  const devMt = qc.discrepancy_mt;
  const impact = qc.financial_impact_usd;
  const totalAno = ano.total_anomalies ?? 0;
  const critCount = ano.critical_count ?? 0;
  const highCount = ano.high_count ?? 0;
  const medCount  = ano.medium_count ?? 0;

  // ─── 5: Detected Anomalies table ──────────────────────────────────
  const anomalies = Array.isArray(ano.anomalies) ? ano.anomalies : [];
  const anomalyRows = anomalies.map((a: any, i: number) => [
    String(i + 1),
    { text: `${a.rule_id ?? ''}${a.rule_name ? '\n' + a.rule_name : ''}`, bold: true },
    { text: a.severity ?? '—', badge: a.severity as any },
    { text: a.timestamp ?? '—', mono: true },
    a.description ?? '—',
  ]);

  // ─── 6: Compliance Checklist table ────────────────────────────────
  const complianceRows = Object.entries(cf).map(([k, v]) => [
    k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    { text: v ? 'PASS' : 'FAIL', badge: (v ? 'PASS' : 'FAIL') as 'PASS' | 'FAIL', bold: true },
  ]);

  // ─── 7: Recommended Actions ──────────────────────────────────────
  const actions: string[] = Array.isArray(r.recommended_actions) ? r.recommended_actions : [];

  // ─── A: Letter of Protest (Draft) — strip the literal "LETTER OF
  //       PROTEST" header from the body since the section's own title
  //       already says it. Preserves all other body lines including the
  //       three trailing signature placeholders. ─────────────────────
  let lopBody: string = '';
  if (typeof r.lop_draft === 'string') {
    lopBody = r.lop_draft.replace(/^\s*LETTER OF PROTEST\s*\n+/, '').trim();
  }

  return {
    kind: 'Evidence Report',
    eyebrow: 'Bunker Delivery',
    title: 'Evidence Report',
    subtitle: [hdr.vessel_name, hdr.supplier_name].filter(Boolean).join('  ·  '),
    reference: reportId && issued
      ? `Report ID ${reportId}  ·  Issued ${issued}`
      : reportId || undefined,
    sessionId: row.session_id,
    generatedAt: issued,
    hash: row.report_hash ?? r.report_hash,
    verdict: { label: verdictLabel.replace(/_/g, '_'), color: verdictRgb(verdictLabel) },
    stats: [
      {
        label: 'Risk',
        value: `${risk}/100`,
        sub: String(riskCat),
        color: verdictRgb(verdictLabel),
      },
      {
        label: 'Quantity Deviation',
        value: dev != null ? `${Number(dev).toFixed(2)}%` : '—',
        sub: devMt != null
          ? `${Number(devMt).toFixed(1)} MT · USD ${impact ? Number(impact).toLocaleString() : '—'}`
          : undefined,
        color: dev != null && Math.abs(Number(dev)) > 0.5 ? [159, 42, 31] : undefined,
      },
      {
        label: 'Anomalies',
        value: String(totalAno),
        sub: `crit ${critCount} · high ${highCount} · med ${medCount}`,
        color: critCount > 0 ? [159, 42, 31] : highCount > 0 ? [184, 110, 30] : undefined,
      },
    ],
    sections: [
      // § 1 Delivery Particulars
      {
        type: 'kv',
        numbered: '1',
        heading: 'Delivery Particulars',
        rows: [
          hdr.bdn_reference   && { k: 'BDN reference',    v: String(hdr.bdn_reference) },
          hdr.delivery_date   && { k: 'Delivery date',    v: String(hdr.delivery_date) },
          (hdr.delivery_start || hdr.delivery_end) && {
            k: 'Delivery window',
            v: `${hdr.delivery_start ?? '—'} – ${hdr.delivery_end ?? '—'}`,
          },
          hdr.port            && { k: 'Port',             v: String(hdr.port) },
          (hdr.vessel_name || hdr.vessel_imo) && {
            k: 'Receiving vessel',
            v: `${hdr.vessel_name ?? '—'}${hdr.vessel_imo ? ' (IMO ' + hdr.vessel_imo + ')' : ''}`,
          },
          hdr.barge_name      && { k: 'Delivering barge', v: String(hdr.barge_name) },
          hdr.supplier_name   && { k: 'Supplier',         v: String(hdr.supplier_name) },
          hdr.supplier_licence&& { k: 'Supplier licence', v: String(hdr.supplier_licence) },
          hdr.fuel_grade      && { k: 'Fuel grade',       v: String(hdr.fuel_grade) },
        ].filter(Boolean) as any,
      },
      // § 2 Risk Assessment
      {
        type: 'kv',
        numbered: '2',
        heading: 'Risk Assessment',
        rows: [
          { k: 'Final risk score',      v: `${ras.final_score ?? '—'} / 100` },
          { k: 'Risk category',         v: String(ras.risk_category ?? '—') },
          { k: 'Recommended verdict',   v: String(ras.recommended_verdict ?? '—'), warn: /REFUSE/i.test(String(ras.recommended_verdict ?? '')) },
          { k: 'Similar incidents (30d)', v: String(ras.similar_incidents_30d ?? '—') },
        ],
      },
      // § 3 Quantity Comparison
      {
        type: 'kv',
        numbered: '3',
        heading: 'Quantity Comparison',
        rows: [
          qc.bdn_declared_mt        != null && { k: 'BDN declared (MT)',    v: String(qc.bdn_declared_mt) },
          qc.mfm_measured_mt        != null && { k: 'MFM measured (MT)',    v: String(qc.mfm_measured_mt) },
          qc.discrepancy_mt         != null && { k: 'Discrepancy (MT)',     v: String(qc.discrepancy_mt), warn: true },
          qc.discrepancy_pct        != null && { k: 'Discrepancy (%)',      v: String(qc.discrepancy_pct), warn: true },
          qc.vlsfo_spot_price_per_mt!= null && { k: 'VLSFO spot (USD/MT)',  v: String(qc.vlsfo_spot_price_per_mt) },
          qc.financial_impact_usd   != null && { k: 'Estimated financial impact (USD)', v: String(qc.financial_impact_usd), warn: true },
        ].filter(Boolean) as any,
      },
      // § 4 AI Narrative
      r.ai_narrative && {
        type: 'paragraph',
        numbered: '4',
        heading: 'AI Narrative',
        text: String(r.ai_narrative),
      },
      // § 5 Detected Anomalies (table)
      anomalies.length > 0 && {
        type: 'table',
        numbered: '5',
        heading: 'Detected Anomalies',
        columns: ['#', 'Rule', 'Severity', 'Timestamp', 'Description'],
        colWidths: [8, 35, 22, 45, 64],
        rows: anomalyRows as any,
      },
      // § 6 Compliance Checklist (table)
      complianceRows.length > 0 && {
        type: 'table',
        numbered: '6',
        heading: 'Compliance Checklist',
        columns: ['Check', 'Status'],
        colWidths: [134, 40],
        rows: complianceRows as any,
      },
      // § 7 Recommended Actions
      actions.length > 0 && {
        type: 'bullets',
        numbered: '7',
        heading: 'Recommended Actions',
        items: actions,
      },
      // § 8 Acknowledgement
      {
        type: 'signatures',
        numbered: '8',
        heading: 'Acknowledgement',
        intro: 'The undersigned acknowledge receipt and review of this evidence report. Signatures confirm understanding of the findings; they do not constitute acceptance of liability.',
        signers: [
          { role: 'Chief Engineer / Master' },
          { role: 'Supplier Representative' },
        ],
      },
      // Appendix A — Letter of Protest (Draft)
      lopBody && {
        type: 'letter',
        numbered: 'A',
        heading: 'Appendix — Letter of Protest (Draft)',
        title: 'LETTER OF PROTEST',
        body: lopBody,
      },
    ].filter(Boolean) as PdfMeta['sections'],
  };
}

/* ─────────────────────────────────────────────────────────────────
 *  Reports Page — universal store of every PDF the app generated.
 *  Cover cards open the actual stored PDF in a new tab.
 * ───────────────────────────────────────────────────────────────── */
export function EvidenceReportsPage() {
  const { reports: pdfs, loading: loadingPdfs, bucketAvailable, refresh } = useGeneratedReports();
  const { reports: jsonReports, loading: loadingJson } = useEvidenceReports();
  const navigate = useNavigate();

  /* AUTO-BACKFILL — on first visit, regenerate any Evidence Report PDFs
   * that are either MISSING from the cache or were saved under an older
   * schema version (e.g. before the v4 numbered-section rewrite). A
   * cached entry is treated as fresh only when its `schemaVersion`
   * matches the current PDF_SCHEMA_VERSION constant. That lets pdfBuilder
   * changes propagate automatically — the operator never sees a stale
   * document, and we never silently keep an outdated PDF in storage. */
  const backfilledRef = useRef(false);
  const [backfilling, setBackfilling] = useState(false);
  useEffect(() => {
    if (backfilledRef.current) return;
    if (loadingPdfs || loadingJson) return;
    const completeJson = jsonReports.filter((r) => !!r.report_json?.header);
    // Index the existing PDFs by their natural key. The freshness check
    // is "exists AND was rendered with the current schema version".
    const pdfByKey = new Map<string, GeneratedReport>();
    for (const p of pdfs) {
      pdfByKey.set(`${p.kind}:${p.sessionId}:${p.generatedAt}`, p);
    }
    const toBackfill = completeJson.filter((j) => {
      const key = `Evidence Report:${j.session_id}:${j.generated_at}`;
      const existing = pdfByKey.get(key);
      if (!existing) return true;
      return existing.schemaVersion !== PDF_SCHEMA_VERSION;
    });
    if (toBackfill.length === 0) { backfilledRef.current = true; return; }
    backfilledRef.current = true;
    (async () => {
      setBackfilling(true);
      for (const row of toBackfill) {
        try { await saveReportPdf(evidenceReportToPdfMeta(row)); }
        catch (e) { /* ignore individual failures, demo keeps going */ }
      }
      setBackfilling(false);
      refresh();
    })();
  }, [loadingPdfs, loadingJson, jsonReports, pdfs, refresh]);

  /* Sign-Off audit PDFs are written by AgentWorkflow.handleSignOff into
   * localStorage too — they appear in `pdfs` automatically via the
   * useGeneratedReports merge. */

  // Group by kind for the section headers
  const grouped = useMemo(() => {
    const g = new Map<string, GeneratedReport[]>();
    for (const r of pdfs) {
      const k = r.kind || 'Other';
      const arr = g.get(k) ?? []; arr.push(r); g.set(k, arr);
    }
    return Array.from(g.entries());
  }, [pdfs]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative' }}>

      {/* Header */}
      <div style={{ padding: '28px 32px 16px', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(4,10,20,0.7)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#EAF4FF', lineHeight: 1, letterSpacing: '-0.02em', margin: 0, marginBottom: 6 }}>Generated Reports</h1>
            <div style={{ fontSize: 11, color: '#7FA5D3', maxWidth: 720, lineHeight: 1.55 }}>
              Every PDF the app produces — Evidence Reports, Chief Engineer Sign-Off Audits, Anomaly Bundles, Supplier Dossiers. Stored in
              <code style={{ background: 'rgba(46,168,255,0.10)', color: '#2EA8FF', padding: '1px 5px', borderRadius: 3, marginLeft: 5 }}>storage://app-reports</code>
              {' '}(Supabase Storage), with a localStorage fallback so the demo works before the bucket is provisioned.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={refresh}
              disabled={loadingPdfs}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px',
                borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: loadingPdfs ? 'wait' : 'pointer',
                background: 'rgba(46,168,255,0.10)', border: '1px solid rgba(46,168,255,0.30)', color: '#2EA8FF',
              }}>
              <RefreshCw className="w-3 h-3" style={{ animation: loadingPdfs ? 'spin 1s linear infinite' : undefined }} />
              Refresh
            </button>
          </div>
        </div>
        {!bucketAvailable && (
          <div style={{
            marginTop: 12, padding: '8px 12px', borderRadius: 6,
            background: 'rgba(255,169,64,0.08)', border: '1px solid rgba(255,169,64,0.30)',
            color: '#FFA940', fontSize: 11, lineHeight: 1.5,
          }}>
            ⚠ Supabase Storage bucket <code>app-reports</code> not found — saves are landing in localStorage instead.
            Create the bucket in Supabase Studio (Storage → New bucket → name <code>app-reports</code>, public read) to enable
            server-side persistence. The UI is identical either way.
          </div>
        )}
        {backfilling && (
          <div style={{
            marginTop: 12, padding: '8px 12px', borderRadius: 6,
            background: 'rgba(46,168,255,0.08)', border: '1px solid rgba(46,168,255,0.28)',
            color: '#2EA8FF', fontSize: 11, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Loader2 className="w-3 h-3" style={{ animation: 'spin 1s linear infinite' }} />
            Generating PDFs for existing evidence reports…
          </div>
        )}
      </div>

      {/* Content */}
      {/* No inner overflowY — page scroll is handled by <main> in AppLayout
          so the whole page (header + grid) moves as one column on a 13" laptop. */}
      <div style={{ flex: 1, padding: '20px 32px' }}>
        {loadingPdfs && pdfs.length === 0 && (
          <div style={{ color: '#7FA5D3', fontSize: 12 }}>Loading reports…</div>
        )}

        {!loadingPdfs && pdfs.length === 0 && !backfilling && (
          <EmptyState onBrowse={() => navigate('/sessions')} />
        )}

        {/* Grouped grid of cover cards per kind */}
        {grouped.map(([kind, items]) => (
          <div key={kind} style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
              <span style={LABEL}>{kind}</span>
              <span style={{ fontSize: 10, color: '#5A8AB4', fontFamily: "'JetBrains Mono', monospace" }}>{items.length}</span>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 18,
            }}>
              {items.map((p) => <PdfCoverCard key={p.id} report={p} />)}
            </div>
          </div>
        ))}
      </div>

      <PortCopilot />
    </div>
  );
}

function EmptyState({ onBrowse }: { onBrowse: () => void }) {
  return (
    <div style={{ ...CARD, padding: '36px 28px', textAlign: 'center' }}>
      <FileText style={{ width: 36, height: 36, color: '#5A8AB4', margin: '0 auto 14px' }} />
      <div style={{ fontSize: 14, fontWeight: 700, color: '#EAF4FF', marginBottom: 6 }}>No reports yet</div>
      <div style={{ fontSize: 11, color: '#7FA5D3', marginBottom: 14, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
        Any PDF the app generates lands here — Evidence Reports, Sign-Off Audits, Anomaly Bundles.
        Open a session and click <strong style={{ color: '#2EA8FF' }}>Generate Evidence Report</strong>, or sign off a verdict
        as the Chief Engineer, to populate this view.
      </div>
      <button
        onClick={onBrowse}
        style={{
          padding: '8px 16px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
          background: 'rgba(46,168,255,0.14)', border: '1px solid rgba(46,168,255,0.32)', color: '#2EA8FF',
        }}>
        Browse sessions →
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
 *  PdfCoverCard — true preview of the stored PDF. Page 1 is rendered
 *  via PDF.js into a canvas-backed <img>; what you see IS the actual
 *  document, not a mockup. Click opens the full PDF in a new tab.
 *  A slim metadata strip below the preview keeps kind / verdict /
 *  hash / CLOUD–LOCAL tag / download button reachable without
 *  competing with the document for screen real estate.
 * ───────────────────────────────────────────────────────────────── */
function PdfCoverCard({ report }: { report: GeneratedReport }) {
  const vc = verdictColor(report.verdict?.label || '');
  const openPdf = () => window.open(report.url, '_blank', 'noopener,noreferrer');
  const downloadPdf = (e: React.MouseEvent) => {
    e.stopPropagation();
    const a = document.createElement('a');
    a.href = report.url;
    a.download = `${report.id}.pdf`;
    a.click();
  };

  return (
    <div
      onClick={openPdf}
      title={`${report.kind} · ${report.title}`}
      style={{
        position: 'relative',
        cursor: 'pointer',
        borderRadius: 6,
        background: '#0E1C2D',
        boxShadow:
          '0 1px 0 rgba(255,255,255,0.04) inset,' +
          '0 10px 24px rgba(0,0,0,0.45),' +
          '0 2px 4px rgba(0,0,0,0.30)',
        transition: 'transform 180ms ease, box-shadow 180ms ease',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow =
          '0 1px 0 rgba(255,255,255,0.04) inset,' +
          '0 16px 32px rgba(0,0,0,0.55),' +
          '0 3px 6px rgba(0,0,0,0.35)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow =
          '0 1px 0 rgba(255,255,255,0.04) inset,' +
          '0 10px 24px rgba(0,0,0,0.45),' +
          '0 2px 4px rgba(0,0,0,0.30)';
      }}
    >
      {/* THE PDF — page 1 rasterised via PDF.js. A4 portrait aspect. */}
      <PdfThumbnail
        url={report.url}
        pixelWidth={720}
        style={{
          width: '100%',
          // Subtle paper-edge shadow so the document feels lifted off
          // the dark card frame.
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)',
        }}
        fallback={
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <FileText style={{ width: 22, height: 22, opacity: 0.7 }} />
            <span>Loading {report.kind.toLowerCase()}…</span>
          </div>
        }
      />

      {/* Metadata strip — slim, on the dark frame below the document. */}
      <div style={{
        padding: '8px 12px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'rgba(4,10,20,0.55)',
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 9, letterSpacing: 1.2, fontWeight: 800, color: '#5A8AB4', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {report.kind} · {report.title}
          </div>
          <div style={{ fontSize: 9, color: '#7FA5D3', marginTop: 1, fontFamily: "'JetBrains Mono', monospace" }}>
            {new Date(report.generatedAt).toLocaleString()} · {report.pageCount}p · {(report.sizeBytes / 1024).toFixed(1)} KB
          </div>
        </div>
        {report.verdict && (
          <span style={{
            fontSize: 8.5, fontWeight: 800, letterSpacing: 0.8,
            padding: '2px 6px', borderRadius: 3,
            color: vc,
            background: `${vc}1A`,
            border: `1px solid ${vc}50`,
            whiteSpace: 'nowrap',
          }}>
            {report.verdict.label}
          </span>
        )}
        <span title={report.persistedSupabase ? 'Stored in Supabase Storage' : 'Local-only (Supabase bucket pending)'}
          style={{
            fontSize: 8, fontWeight: 800, letterSpacing: 0.8,
            padding: '2px 5px', borderRadius: 3,
            color: report.persistedSupabase ? '#16774E' : '#B86E1E',
            background: report.persistedSupabase ? 'rgba(22,119,78,0.12)' : 'rgba(184,110,30,0.12)',
            border: `1px solid ${report.persistedSupabase ? 'rgba(22,119,78,0.30)' : 'rgba(184,110,30,0.30)'}`,
          }}>
          {report.persistedSupabase ? 'CLOUD' : 'LOCAL'}
        </span>
        <button
          onClick={downloadPdf}
          title="Download PDF"
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'transparent', border: '1px solid rgba(255,255,255,0.10)',
            color: '#A8C8E8', fontSize: 9, fontWeight: 800,
            padding: '3px 7px', borderRadius: 3,
            cursor: 'pointer', letterSpacing: 0.5,
          }}>
          <Download style={{ width: 9, height: 9 }} />
        </button>
        <ExternalLink style={{ width: 12, height: 12, color: '#5A8AB4' }} />
      </div>
    </div>
  );
}
