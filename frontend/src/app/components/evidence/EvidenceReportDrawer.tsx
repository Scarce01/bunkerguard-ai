import { useEffect } from 'react';
import { X, Download, Anchor, Copy, RotateCw, Loader2, Check } from 'lucide-react';
import { useEvidenceReport, type GenStep } from '../../../lib/useEvidenceReport';

const STEPS: Array<{ key: GenStep; label: string }> = [
  { key: 'fetch',     label: 'Fetch session + bdn + risk + mfm packets' },
  { key: 'mfm',       label: 'Derive MFM summary (peak gain, deviation)' },
  { key: 'anomalies', label: 'Cross-reference anomalies + supplier history' },
  { key: 'claude',    label: 'Claude — drafting executive summary' },
  { key: 'hash',      label: 'Hash chain (SHA-256) + Ethereum anchor' },
  { key: 'store',     label: 'Store in Supabase (evidence_reports)' },
];

interface Props {
  sessionId: string;
  open: boolean;
  onClose: () => void;
}

export function EvidenceReportDrawer({ sessionId, open, onClose }: Props) {
  const { state, generate, reset } = useEvidenceReport();

  // Auto-start generation the first time the drawer opens for a session.
  useEffect(() => {
    if (open && state.status === 'idle') {
      generate(sessionId);
    }
  }, [open, sessionId, state.status, generate]);

  // Close on Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isGenerating = state.status === 'generating';
  const isComplete   = state.status === 'complete';
  const isError      = state.status === 'error';
  const report = state.report;

  return (
    <div
      style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(580px, 92vw)',
        zIndex: 80,
        background: 'rgba(10,23,38,0.92)',
        backdropFilter: 'blur(22px) saturate(140%)',
        WebkitBackdropFilter: 'blur(22px) saturate(140%)',
        borderLeft: '1px solid rgba(46,168,255,0.32)',
        boxShadow: '-10px 0 40px rgba(0,0,0,0.55)',
        display: 'flex', flexDirection: 'column',
        animation: 'copilotSlideIn 220ms ease-out',
        overflow: 'hidden',
      }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid rgba(46,168,255,0.18)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 6,
          background: 'linear-gradient(135deg, #2EA8FF, #00D98E)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Anchor size={15} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#E5F2FF', letterSpacing: 0.3 }}>
            EVIDENCE REPORT
          </div>
          <div style={{ fontSize: 10, color: '#7FA5D3', fontFamily: "'JetBrains Mono', monospace", marginTop: 1 }}>
            {sessionId}
            {isComplete && state.report?.report_hash && (
              <> · hash <span style={{ color: '#00D98E' }}>{state.report.report_hash}</span></>
            )}
          </div>
        </div>
        {isComplete && (
          <button
            onClick={() => { reset(); generate(sessionId); }}
            title="Regenerate"
            style={{
              background: 'transparent', border: 'none', color: '#7FA5D3', cursor: 'pointer',
              padding: 4, display: 'flex', alignItems: 'center',
            }}>
            <RotateCw size={14} />
          </button>
        )}
        <button
          onClick={onClose}
          title="Close (Esc)"
          style={{
            background: 'transparent', border: 'none', color: '#7FA5D3', cursor: 'pointer',
            padding: 4, display: 'flex', alignItems: 'center',
          }}>
          <X size={16} />
        </button>
      </div>

      {/* Pipeline indicator */}
      <div style={{
        padding: '12px 18px',
        borderBottom: '1px solid rgba(127,165,211,0.12)',
      }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#7FA5D3', letterSpacing: 1.4, marginBottom: 8 }}>
          GENERATION PIPELINE
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {STEPS.map((s, idx) => {
            const status = state.steps[s.key];
            const isActive = status === 'active';
            const isDone   = status === 'done';
            const color =
              isError && status === 'active' ? '#FF5656' :
              isDone   ? '#00D98E' :
              isActive ? '#2EA8FF' : '#3D5A75';
            return (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 16, height: 16, borderRadius: 8,
                  background: isDone ? 'rgba(0,217,142,0.18)' : isActive ? 'rgba(46,168,255,0.18)' : 'rgba(127,165,211,0.08)',
                  border: `1px solid ${color}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color,
                  flexShrink: 0,
                }}>
                  {isDone ? <Check size={9} /> : isActive ? <Loader2 size={9} className="animate-spin" /> : <span style={{ fontSize: 9 }}>{idx + 1}</span>}
                </div>
                <span style={{
                  fontSize: 10.5,
                  color: isDone ? '#A8C0E0' : isActive ? '#E5F2FF' : '#7FA5D3',
                  fontWeight: isActive ? 600 : 500,
                }}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Report preview */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
        {isError && (
          <div style={{
            padding: '10px 12px',
            background: 'rgba(255,86,86,0.10)',
            border: '1px solid rgba(255,86,86,0.40)',
            borderRadius: 6,
            color: '#FF7B7B',
            fontSize: 11,
          }}>
            <strong>Generation failed</strong>
            <div style={{ marginTop: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>
              {state.error}
            </div>
            <div style={{ marginTop: 8, fontSize: 10, color: '#A8C0E0' }}>
              Make sure <code>python</code> is on PATH, the env vars
              (<code>SUPABASE_URL</code>, <code>SUPABASE_SERVICE_KEY</code>, <code>ANTHROPIC_API_KEY</code>)
              are set, and <code>BACKEND_REPO_PATH</code> points to your Python repo. Then click ↻ to retry.
            </div>
          </div>
        )}

        {isGenerating && !isError && (
          <div style={{ fontSize: 11, color: '#7FA5D3', lineHeight: 1.5 }}>
            Composing report from <strong style={{ color: '#E5F2FF' }}>6 Supabase tables</strong> + <strong style={{ color: '#E5F2FF' }}>Claude Sonnet</strong>.
            <br />Tokens billed to your Anthropic key. Report will be hashed (SHA-256), anchored on Ethereum, and stored in <code style={{ color: '#A8C0E0' }}>evidence_reports</code>.
          </div>
        )}

        {isComplete && report && (
          <div style={{ color: '#D8E8F8', fontSize: 12, lineHeight: 1.55 }}>
            <ReportPreview report={report} />

            {state.anchored && state.anchorTx && (
              <div style={{
                marginTop: 16, padding: '10px 12px',
                background: 'rgba(0,217,142,0.08)',
                border: '1px solid rgba(0,217,142,0.30)',
                borderRadius: 6,
                fontSize: 10.5,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#00D98E', fontWeight: 700, letterSpacing: 0.6 }}>
                  <Anchor size={11} /> ANCHORED ON ETHEREUM
                </div>
                <div style={{ marginTop: 4, fontFamily: "'JetBrains Mono', monospace", color: '#A8C0E0', wordBreak: 'break-all' }}>
                  tx {state.anchorTx}
                </div>
                <div style={{ marginTop: 2, fontSize: 9.5, color: '#7FA5D3' }}>
                  Hashed at {state.hashedAt ? new Date(state.hashedAt).toLocaleString() : '—'}
                </div>
              </div>
            )}

            {state.storeError && (
              <div style={{
                marginTop: 10, padding: '8px 10px',
                background: 'rgba(255,169,64,0.10)',
                border: '1px solid rgba(255,169,64,0.30)',
                borderRadius: 6,
                fontSize: 10, color: '#FFA940',
              }}>
                Generated successfully but Supabase upsert failed: {state.storeError}.
                Likely <code>evidence_reports</code> table doesn't exist yet.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer actions */}
      {isComplete && (
        <div style={{
          padding: '10px 14px',
          borderTop: '1px solid rgba(46,168,255,0.18)',
          display: 'flex', gap: 6,
        }}>
          <button
            onClick={() => downloadJson(report, sessionId)}
            style={footerBtn('#2EA8FF')}>
            <Download size={12} /> Download JSON
          </button>
          {state.report?.report_hash && (
            <button
              onClick={() => navigator.clipboard.writeText(state.report!.report_hash!)}
              style={footerBtn('#00D98E')}>
              <Copy size={12} /> Copy hash
            </button>
          )}
          {state.anchorTx && (
            <button
              onClick={() => navigator.clipboard.writeText(state.anchorTx!)}
              style={footerBtn('#A78BFA')}>
              <Anchor size={12} /> Copy tx
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function footerBtn(color: string): React.CSSProperties {
  return {
    flex: 1,
    padding: '7px 10px',
    fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5,
    background: `${color}1F`,
    border: `1px solid ${color}55`,
    color,
    borderRadius: 4,
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
  };
}

function downloadJson(report: any, sessionId: string) {
  if (!report) return;
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `evidence-report-${sessionId}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Renders whatever the Python service returns. We don't know the exact key
 *  shape ahead of time (depends on the Claude prompt), so we iterate over
 *  known fields first and then dump anything else. */
function ReportPreview({ report }: { report: any }) {
  const blocks: Array<{ heading: string; body: any }> = [];

  if (report.executive_summary)
    blocks.push({ heading: 'Executive Summary', body: report.executive_summary });
  if (report.session_identification)
    blocks.push({ heading: 'Session Identification', body: report.session_identification });
  if (report.delivery_data)
    blocks.push({ heading: 'Delivery Data', body: report.delivery_data });
  if (report.anomalies_detected)
    blocks.push({ heading: 'Anomalies Detected', body: report.anomalies_detected });
  if (report.risk_assessment)
    blocks.push({ heading: 'Risk Assessment', body: report.risk_assessment });
  if (report.environmental_impact)
    blocks.push({ heading: 'Environmental Impact', body: report.environmental_impact });
  if (report.recommended_actions)
    blocks.push({ heading: 'Recommended Actions', body: report.recommended_actions });
  if (report.llm_explanation)
    blocks.push({ heading: 'Chief Engineer Narrative', body: report.llm_explanation });

  // Catch-all for any unexpected keys
  const known = new Set([
    'executive_summary', 'session_identification', 'delivery_data', 'anomalies_detected',
    'risk_assessment', 'environmental_impact', 'recommended_actions', 'llm_explanation',
    'report_id', 'session_id', 'generated_at', 'sign_off_status', 'report_hash',
  ]);
  Object.keys(report).forEach((k) => {
    if (!known.has(k) && report[k] != null) {
      blocks.push({ heading: k.replace(/_/g, ' '), body: report[k] });
    }
  });

  return (
    <>
      {blocks.length === 0 && (
        <pre style={{ fontSize: 11, color: '#A8C0E0', whiteSpace: 'pre-wrap' }}>
          {JSON.stringify(report, null, 2)}
        </pre>
      )}
      {blocks.map((b, i) => (
        <div key={i} style={{ marginBottom: 14 }}>
          <div style={{
            fontSize: 9.5, fontWeight: 700, color: '#2EA8FF',
            letterSpacing: 1.3, textTransform: 'uppercase', marginBottom: 6,
          }}>
            {b.heading}
          </div>
          <RenderBody body={b.body} />
        </div>
      ))}
    </>
  );
}

function RenderBody({ body }: { body: any }) {
  if (typeof body === 'string') {
    return <div style={{ whiteSpace: 'pre-wrap' }}>{body}</div>;
  }
  if (Array.isArray(body)) {
    return (
      <ul style={{ paddingLeft: 16, margin: 0 }}>
        {body.map((item, i) => (
          <li key={i} style={{ marginBottom: 4 }}>
            {typeof item === 'string' ? item : <code style={{ fontSize: 10 }}>{JSON.stringify(item)}</code>}
          </li>
        ))}
      </ul>
    );
  }
  if (typeof body === 'object' && body !== null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {Object.entries(body).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: 8 }}>
            <span style={{ minWidth: 130, color: '#7FA5D3', fontSize: 10.5, textTransform: 'capitalize' }}>
              {k.replace(/_/g, ' ')}
            </span>
            <span style={{ flex: 1, color: '#E5F2FF', fontSize: 11 }}>
              {typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
                ? String(v)
                : <code style={{ fontSize: 10 }}>{JSON.stringify(v)}</code>}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return <span>{String(body)}</span>;
}
