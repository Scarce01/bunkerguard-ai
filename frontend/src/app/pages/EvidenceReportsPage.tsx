import { useState } from 'react';
import { useNavigate } from 'react-router';
import { FileText, Anchor, Download, Copy, X, RefreshCw, ChevronRight, ExternalLink, AlertTriangle } from 'lucide-react';
import { useEvidenceReports, type EvidenceReportRow } from '../../lib/useEvidenceReports';
import { PortCopilot } from '../components/PortCopilot';

/* ── Design tokens shared with the rest of the app ─────────────── */
const CARD: React.CSSProperties = {
  background: 'linear-gradient(180deg, #102033 0%, #0E1C2D 100%)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 8,
};
const LABEL: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#5A8AB4', marginBottom: 6,
};

function verdictColor(verdict: string): string {
  const v = (verdict || '').toUpperCase();
  if (v.startsWith('REFUSE')) return '#FF5656';
  if (v.startsWith('SIGN'))   return '#34C98C';
  if (v.startsWith('REVIEW')) return '#FFA940';
  return '#7FA5D3';
}

/* ─────────────────────────────────────────────────────────────────
 *  Evidence Reports Page — list of stored reports + viewer drawer
 * ───────────────────────────────────────────────────────────────── */
export function EvidenceReportsPage() {
  const { reports, loading, error, refresh } = useEvidenceReports();
  const [openReport, setOpenReport] = useState<EvidenceReportRow | null>(null);
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>

      {/* Header */}
      <div style={{ padding: '28px 32px 16px', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(4,10,20,0.7)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#EAF4FF', lineHeight: 1, letterSpacing: '-0.02em', margin: 0, marginBottom: 6 }}>Generated Evidence Reports</h1>
            <div style={{ fontSize: 11, color: '#7FA5D3' }}>
              Signed, hash-chained packages produced by the 4-agent workflow. Stored in
              <code style={{ background: 'rgba(46,168,255,0.10)', color: '#2EA8FF', padding: '1px 5px', borderRadius: 3, marginLeft: 5 }}>public.evidence_reports</code>.
            </div>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px',
              borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
              background: 'rgba(46,168,255,0.10)', border: '1px solid rgba(46,168,255,0.30)', color: '#2EA8FF',
            }}>
            <RefreshCw className="w-3 h-3" style={{ animation: loading ? 'spin 1s linear infinite' : undefined }} />
            Refresh
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 32px' }}>
        {loading && reports.length === 0 && (
          <div style={{ color: '#7FA5D3', fontSize: 12 }}>Loading reports…</div>
        )}

        {error && (
          <div style={{ ...CARD, padding: '14px 18px', borderColor: 'rgba(255,86,86,0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#FF5656', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              <AlertTriangle className="w-4 h-4" /> Failed to load reports
            </div>
            <div style={{ fontSize: 11, color: '#D8E8F8', lineHeight: 1.5, fontFamily: "'JetBrains Mono', monospace" }}>{error}</div>
            <div style={{ fontSize: 11, color: '#7FA5D3', marginTop: 10, lineHeight: 1.5 }}>
              The <code>evidence_reports</code> table may not exist yet. Run the migration in Supabase Studio:
              <code style={{ display: 'block', marginTop: 6, padding: '6px 8px', background: 'rgba(4,10,18,0.7)', borderRadius: 4, color: '#BFD7F7' }}>frontend/supabase/migrations/20260610_evidence_reports.sql</code>
            </div>
          </div>
        )}

        {!loading && !error && reports.length === 0 && (
          <div style={{ ...CARD, padding: '36px 28px', textAlign: 'center' }}>
            <FileText style={{ width: 36, height: 36, color: '#5A8AB4', margin: '0 auto 14px' }} />
            <div style={{ fontSize: 14, fontWeight: 700, color: '#EAF4FF', marginBottom: 6 }}>No reports yet</div>
            <div style={{ fontSize: 11, color: '#7FA5D3', marginBottom: 14, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
              Open a session and click <strong style={{ color: '#2EA8FF' }}>Generate Evidence Report</strong> — once the Python pipeline finishes,
              the new row will land here.
            </div>
            <button
              onClick={() => navigate('/sessions')}
              style={{
                padding: '8px 16px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: 'rgba(46,168,255,0.14)', border: '1px solid rgba(46,168,255,0.32)', color: '#2EA8FF',
              }}>
              Browse sessions →
            </button>
          </div>
        )}

        {reports.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {reports.map((r) => {
              const v = r.sign_off_status;
              const vc = verdictColor(v);
              const score = r.report_json?.risk_assessment?.final_score ?? '—';
              const cat   = r.report_json?.risk_assessment?.risk_category ?? '—';
              const vessel = r.report_json?.header?.vessel_name ?? '—';
              const supplier = r.report_json?.header?.supplier_name ?? '—';
              const impact = r.report_json?.quantity_comparison?.financial_impact_usd;
              const dev = r.report_json?.quantity_comparison?.discrepancy_pct;
              return (
                <div
                  key={r.report_id}
                  onClick={() => setOpenReport(r)}
                  style={{
                    ...CARD,
                    padding: '14px 18px',
                    cursor: 'pointer',
                    transition: 'all 140ms',
                    display: 'grid',
                    gridTemplateColumns: '1.5fr 1fr 1fr 100px 90px 36px',
                    gap: 16,
                    alignItems: 'center',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(46,168,255,0.35)'; e.currentTarget.style.background = 'rgba(46,168,255,0.04)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.background = 'linear-gradient(180deg, #102033 0%, #0E1C2D 100%)' as any; }}
                >
                  {/* Session + vessel */}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#EAF4FF' }}>{r.session_id}</div>
                    <div style={{ fontSize: 10, color: '#7FA5D3', marginTop: 2 }}>{vessel}</div>
                  </div>
                  {/* Supplier */}
                  <div>
                    <div style={LABEL}>Supplier</div>
                    <div style={{ fontSize: 11, color: '#BFD7F7', fontWeight: 600 }}>{supplier}</div>
                  </div>
                  {/* Risk score + category */}
                  <div>
                    <div style={LABEL}>Risk</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontSize: 16, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: vc }}>{score}</span>
                      <span style={{ fontSize: 9, color: '#7FA5D3' }}>/ 100</span>
                      <span style={{ fontSize: 9, fontWeight: 700, color: vc, marginLeft: 4 }}>{cat}</span>
                    </div>
                  </div>
                  {/* Impact */}
                  <div>
                    <div style={LABEL}>Impact</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: impact ? '#FF5656' : '#7FA5D3', fontFamily: "'JetBrains Mono', monospace" }}>
                      {impact ? `$${Number(impact).toLocaleString()}` : '—'}
                    </div>
                    {dev != null && (
                      <div style={{ fontSize: 9, color: '#7FA5D3' }}>{Number(dev).toFixed(2)}%</div>
                    )}
                  </div>
                  {/* Verdict pill */}
                  <div>
                    <span style={{
                      display: 'inline-block', padding: '4px 8px', borderRadius: 4,
                      fontSize: 9, fontWeight: 800, color: vc,
                      background: `${vc}1A`, border: `1px solid ${vc}50`,
                      letterSpacing: '0.05em', whiteSpace: 'nowrap',
                    }}>{v.replace(/_/g, ' ')}</span>
                    <div style={{ fontSize: 9, color: '#5A8AB4', marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>
                      {new Date(r.generated_at).toLocaleDateString()}
                    </div>
                  </div>
                  {/* Open arrow */}
                  <ChevronRight style={{ width: 18, height: 18, color: '#5A8AB4', justifySelf: 'end' }} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <PortCopilot />

      {/* Viewer drawer */}
      {openReport && <EvidenceReportViewer report={openReport} onClose={() => setOpenReport(null)} />}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
 *  Viewer drawer — read-only render of a stored report. Mirrors the
 *  generation drawer's layout but skips the 6-step pipeline since the
 *  report is already finalised + hashed.
 * ───────────────────────────────────────────────────────────────── */
function EvidenceReportViewer({ report, onClose }: { report: EvidenceReportRow; onClose: () => void }) {
  const r = report.report_json ?? {};
  const vc = verdictColor(report.sign_off_status);
  const hash = report.report_hash ?? r.report_hash ?? '';
  const tx = report.anchor_tx ?? '';

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${report.report_id}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  const copy = (s: string) => navigator.clipboard?.writeText(s).catch(() => {});

  // Close on Esc
  if (typeof window !== 'undefined') {
    window.onkeydown = (e: any) => { if (e.key === 'Escape') onClose(); };
  }

  return (
    <div
      style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(680px, 95vw)', zIndex: 80,
        background: 'rgba(10,23,38,0.94)',
        backdropFilter: 'blur(22px) saturate(140%)',
        borderLeft: '1px solid rgba(46,168,255,0.32)',
        boxShadow: '-10px 0 40px rgba(0,0,0,0.55)',
        display: 'flex', flexDirection: 'column',
        animation: 'copilotSlideIn 220ms ease-out',
        overflow: 'hidden',
      }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: 'linear-gradient(135deg, rgba(46,168,255,0.22), rgba(0,217,142,0.22))', border: '1px solid rgba(46,168,255,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Anchor style={{ width: 17, height: 17, color: '#2EA8FF' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#EAF4FF', letterSpacing: '0.05em' }}>EVIDENCE REPORT</div>
          <div style={{ fontSize: 10, color: '#7FA5D3', fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
            {report.session_id} · {hash ? `hash ${hash.slice(0, 18)}…` : 'unhashed'}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#7FA5D3', cursor: 'pointer', padding: 6 }}>
          <X className="w-5 h-5" />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Verdict */}
        <div style={{ padding: '14px 16px', borderRadius: 8, background: `${vc}10`, border: `1px solid ${vc}50` }}>
          <div style={LABEL}>Sign-off Status</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: vc, letterSpacing: '-0.02em' }}>
            {(report.sign_off_status || '').replace(/_/g, ' ')}
          </div>
          {r.risk_assessment && (
            <div style={{ fontSize: 11, color: '#BFD7F7', marginTop: 6 }}>
              Final risk score <strong style={{ color: vc }}>{r.risk_assessment.final_score} / 100</strong>
              {' · '}{r.risk_assessment.risk_category}
              {r.risk_assessment.recommended_verdict && <> · verdict <strong>{r.risk_assessment.recommended_verdict.replace(/_/g, ' ')}</strong></>}
            </div>
          )}
        </div>

        {/* Header / quantity */}
        {(r.header || r.quantity_comparison) && (
          <div style={{ ...CARD, padding: '14px 16px' }}>
            <div style={LABEL}>Delivery</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
              {r.header?.vessel_name      && <Field label="Vessel"   value={r.header.vessel_name} />}
              {r.header?.supplier_name    && <Field label="Supplier" value={r.header.supplier_name} />}
              {r.header?.barge_name       && <Field label="Barge"    value={r.header.barge_name} />}
              {r.header?.port             && <Field label="Port"     value={r.header.port} />}
              {r.header?.fuel_grade       && <Field label="Fuel"     value={r.header.fuel_grade} />}
              {r.header?.bdn_reference    && <Field label="BDN"      value={r.header.bdn_reference} mono />}
              {r.quantity_comparison?.bdn_declared_mt != null && (
                <Field label="BDN qty"      value={`${r.quantity_comparison.bdn_declared_mt} MT`} mono />
              )}
              {r.quantity_comparison?.mfm_measured_mt != null && (
                <Field label="MFM measured" value={`${r.quantity_comparison.mfm_measured_mt} MT`} mono />
              )}
              {r.quantity_comparison?.discrepancy_mt != null && (
                <Field label="Discrepancy" value={`${r.quantity_comparison.discrepancy_mt} MT (${r.quantity_comparison.discrepancy_pct?.toFixed?.(2) ?? r.quantity_comparison.discrepancy_pct}%)`}  warn mono />
              )}
              {r.quantity_comparison?.financial_impact_usd != null && (
                <Field label="Impact (USD)" value={`$${Number(r.quantity_comparison.financial_impact_usd).toLocaleString()}`} warn mono />
              )}
            </div>
          </div>
        )}

        {/* AI Narrative */}
        {r.ai_narrative && (
          <div style={{ ...CARD, padding: '14px 16px' }}>
            <div style={LABEL}>AI Narrative</div>
            <div style={{ fontSize: 12, color: '#D8E8F8', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{r.ai_narrative}</div>
          </div>
        )}

        {/* Recommended Actions */}
        {Array.isArray(r.recommended_actions) && r.recommended_actions.length > 0 && (
          <div style={{ ...CARD, padding: '14px 16px' }}>
            <div style={LABEL}>Recommended Actions</div>
            <ol style={{ paddingLeft: 18, margin: 0, color: '#D8E8F8', fontSize: 12, lineHeight: 1.55, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {r.recommended_actions.map((a: string, i: number) => (
                <li key={i}>{a.replace(/^\d+\.\s*/, '')}</li>
              ))}
            </ol>
          </div>
        )}

        {/* Anomaly summary */}
        {r.anomaly_summary && (
          <div style={{ ...CARD, padding: '14px 16px' }}>
            <div style={LABEL}>Anomalies</div>
            <div style={{ fontSize: 11, color: '#BFD7F7' }}>
              {r.anomaly_summary.total_anomalies} total
              {' · '}<span style={{ color: '#FF5656', fontWeight: 700 }}>{r.anomaly_summary.critical_count} critical</span>
              {' · '}<span style={{ color: '#FFA940', fontWeight: 700 }}>{r.anomaly_summary.high_count} high</span>
            </div>
            {Array.isArray(r.anomaly_summary.anomalies) && r.anomaly_summary.anomalies.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {r.anomaly_summary.anomalies.map((a: any, i: number) => (
                  <div key={i} style={{ padding: '8px 10px', borderRadius: 6, background: 'rgba(4,10,18,0.55)', border: '1px solid rgba(255,255,255,0.06)', borderLeft: `3px solid ${a.severity === 'CRITICAL' ? '#FF5656' : '#FFA940'}` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#EAF4FF', marginBottom: 2 }}>{a.rule_id} · {a.rule_name}</div>
                    <div style={{ fontSize: 10, color: '#7FA5D3', lineHeight: 1.5 }}>{a.description}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Letter of Protest */}
        {r.lop_draft && (
          <div style={{ ...CARD, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={LABEL}>Letter of Protest (Draft)</div>
              <button
                onClick={() => copy(r.lop_draft)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: '#BFD7F7' }}>
                <Copy className="w-3 h-3" /> Copy
              </button>
            </div>
            <pre style={{
              margin: 0, padding: '12px 14px', borderRadius: 6,
              background: 'rgba(4,10,18,0.7)', border: '1px solid rgba(255,255,255,0.06)',
              fontSize: 11, lineHeight: 1.6, color: '#BFD7F7',
              maxHeight: 320, overflowY: 'auto', whiteSpace: 'pre-wrap',
              fontFamily: "'JetBrains Mono', monospace",
            }}>{r.lop_draft}</pre>
          </div>
        )}

        {/* Compliance flags */}
        {r.compliance_flags && (
          <div style={{ ...CARD, padding: '14px 16px' }}>
            <div style={LABEL}>Compliance Flags</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {Object.entries(r.compliance_flags).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#BFD7F7' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: v ? '#34C98C' : '#FF5656' }} />
                  <span>{k.replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Anchor / hash */}
        <div style={{ ...CARD, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={LABEL}>Cryptographic Anchor</div>
          {hash && (
            <FieldCopy label="SHA-256 hash" value={hash} onCopy={() => copy(hash)} />
          )}
          {tx && (
            <FieldCopy
              label="Ethereum tx"
              value={tx}
              onCopy={() => copy(tx)}
              extra={
                <a href={`https://etherscan.io/tx/${tx}`} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, color: '#2EA8FF', textDecoration: 'none' }}>
                  Etherscan <ExternalLink className="w-3 h-3" />
                </a>
              }
            />
          )}
          {report.generated_at && (
            <div style={{ fontSize: 10, color: '#7FA5D3' }}>Generated {new Date(report.generated_at).toLocaleString()}</div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 10 }}>
        <button onClick={downloadJson} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 14px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'rgba(46,168,255,0.14)', border: '1px solid rgba(46,168,255,0.32)', color: '#2EA8FF' }}>
          <Download className="w-4 h-4" /> Download JSON
        </button>
        <button onClick={() => copy(hash)} disabled={!hash} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 14px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: hash ? 'pointer' : 'not-allowed', opacity: hash ? 1 : 0.5, background: 'rgba(0,217,142,0.10)', border: '1px solid rgba(0,217,142,0.32)', color: '#34C98C' }}>
          <Copy className="w-4 h-4" /> Copy hash
        </button>
        <button onClick={() => copy(tx)} disabled={!tx} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 14px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: tx ? 'pointer' : 'not-allowed', opacity: tx ? 1 : 0.5, background: 'rgba(163,108,255,0.12)', border: '1px solid rgba(163,108,255,0.32)', color: '#A36CFF' }}>
          <Copy className="w-4 h-4" /> Copy tx
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, warn, mono }: { label: string; value: React.ReactNode; warn?: boolean; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 2 }}>{label}</div>
      <div style={{
        fontSize: 11, color: warn ? '#FF5656' : '#D8E8F8', fontWeight: warn ? 700 : 500,
        fontFamily: mono ? "'JetBrains Mono', monospace" : undefined,
      }}>{value}</div>
    </div>
  );
}

function FieldCopy({ label, value, onCopy, extra }: { label: string; value: string; onCopy: () => void; extra?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 9, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 1 }}>{label}</div>
        <div style={{ fontSize: 10, color: '#BFD7F7', fontFamily: "'JetBrains Mono', monospace", wordBreak: 'break-all' }}>{value}</div>
      </div>
      {extra}
      <button onClick={onCopy} style={{ background: 'transparent', border: 'none', color: '#7FA5D3', cursor: 'pointer', padding: 4 }}>
        <Copy className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
