import { useState, useRef, useEffect } from 'react';
import { SectionPanel } from '../components/dashboard/SectionPanel';
import { StatusPill } from '../components/dashboard/StatusPill';
import { mockEvidenceReports } from '../../data/mockEvidence';
import { FileText, Download, Copy, ChevronRight, Send } from 'lucide-react';

/* ─── AI corpus ─────────────────────────────────────────────────── */
const AI_INV_RESPONSES: Record<string, string> = {
  default:
    'Quantity mismatch likely caused by mass flow meter deviation during active transfer. MFM stream shows progressive drift from T+47min, consistent with controlled suppression. Supplier history corroborates pattern.',
  supplier:
    'MegaFuel Pte Ltd (Licence MPA-BKR-2024-0042) holds a reputation score of 58/100. Three of six monitored sessions in the past 90 days triggered shortage anomalies. Session #11 resulted in a Letter of Protest. MPA has flagged this supplier for enhanced monitoring.',
  mismatch:
    'MFM cumulative reading: 481.2 MT. BDN declared: 500.0 MT. Deviation: 18.8 MT (3.76%). MPA tolerance threshold is 2.0%. Deviation onset at T+47min suggests systematic suppression rather than calibration drift. Rule A02 is triggered at 2% sustained deviation.',
  history:
    'Historical analysis across 6 MegaFuel sessions: mean shortage 14.3 MT, mean deviation 2.9%. Session #16 is the highest deviation recorded. Sessions #9, #11, and #14 also exceeded the 2% MPA threshold. The pattern is statistically inconsistent with random measurement error.',
  evidence:
    'Evidence chain: BDN-2026-06-10-00016 → MFM stream hash 0xA3F8C2D1...B2C1 → Deviation log R-A02-16 → Blockchain block #4,892,341 on Polygon network. All hashes verified. MFM seal intact. Sample reference: SMP-16-A through SMP-16-D.',
  protest:
    'Protest letter should reference: MPA regulation §14.2 (quantity tolerance), MARPOL Annex VI, ISO 8217, BDN reference BDN-2026-06-10-00016. State time of discovery, MFM readings, and formal refusal to countersign. Retain copy within 4 hours of bunkering completion.',
  action:
    'Recommended sequence: (1) Do not countersign BDN. (2) Issue Letter of Protest within 4 hours. (3) Notify Chief Officer and Fleet Manager. (4) Retain MFM logs, seal BDN samples A–D. (5) Notify MPA BunkerNet within 24 hours. (6) Escalate to P&I Club if >$50K exposure.',
};

function getInvResponse(input: string): string {
  const q = input.toLowerCase();
  if (q.includes('supplier') || q.includes('megafuel') || q.includes('flagged') || q.includes('reputation')) return AI_INV_RESPONSES.supplier;
  if (q.includes('mismatch') || q.includes('quantity') || q.includes('shortage') || q.includes('meter')) return AI_INV_RESPONSES.mismatch;
  if (q.includes('history') || q.includes('historical') || q.includes('compare') || q.includes('previous')) return AI_INV_RESPONSES.history;
  if (q.includes('evidence') || q.includes('chain') || q.includes('blockchain') || q.includes('hash')) return AI_INV_RESPONSES.evidence;
  if (q.includes('protest') || q.includes('letter') || q.includes('lop') || q.includes('summary')) return AI_INV_RESPONSES.protest;
  if (q.includes('action') || q.includes('next') || q.includes('should') || q.includes('officer') || q.includes('do')) return AI_INV_RESPONSES.action;
  return AI_INV_RESPONSES.default;
}

const CHIPS = [
  'Why was supplier flagged?',
  'Explain quantity mismatch',
  'Compare with historical sessions',
  'Generate protest summary',
  'Show evidence chain',
  'What should officer do next?',
];

interface InvMessage { role: 'assistant'; text: string; timestamp: string; }

/* ─── AI Copilot drawer ─────────────────────────────────────────── */
function AICopilotDrawer({ report }: { report: ReturnType<typeof mockEvidenceReports>[0] }) {
  const [messages, setMessages] = useState<InvMessage[]>([
    {
      role: 'assistant',
      text: 'Quantity mismatch likely caused by mass flow meter deviation. Supplier history indicates repeated shortage incidents across 3 of 6 recent sessions. Evidence chain is fully verified on-chain.',
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  function send(text: string) {
    if (!text.trim()) return;
    setInput('');
    setTyping(true);
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'assistant', text: getInvResponse(text), timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) }]);
      setTyping(false);
    }, 780);
  }

  return (
    <div style={{ width: 340, flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.06)', background: 'rgba(9,23,40,0.97)', display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#2EA8FF', boxShadow: '0 0 6px rgba(46,168,255,0.5)', animation: 'livePulse 3s ease-in-out infinite' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#EEF3F8' }}>AI Investigation Copilot</span>
          </div>
          <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, background: 'rgba(255,90,90,0.1)', border: '1px solid rgba(255,90,90,0.2)', color: '#FF5A5A', fontWeight: 700 }}>92% conf.</span>
        </div>
        <div style={{ fontSize: 10, color: '#4E6D8C' }}>Session #{report.session.sessionNumber} · {report.session.vesselName}</div>
      </div>

      {/* AI summary card — compact */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(7,20,35,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 9, color: '#4E6D8C', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, fontWeight: 700 }}>AI Summary</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[
              { label: 'Deviation', value: `${report.session.mismatchMT.toFixed(1)} MT (${report.session.mismatchPercent.toFixed(2)}%)` },
              { label: 'Rule triggered', value: 'A02 · MFM suppression' },
              { label: 'Supplier score', value: '58/100 — Enhanced monitoring' },
              { label: 'Blockchain', value: '✓ Block #4,892,341 verified' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                <span style={{ color: '#6B88A8' }}>{row.label}</span>
                <span style={{ color: row.label === 'Blockchain' ? '#00D47E' : '#C9D4E0', fontWeight: 600 }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Prompt chips — compact 2-col grid */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        <div style={{ fontSize: 9, color: '#4E6D8C', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 7 }}>Suggested Queries</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {CHIPS.map(chip => (
            <button
              key={chip}
              onClick={() => send(chip)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 8px', borderRadius: 5, cursor: 'pointer', background: 'rgba(7,20,35,0.5)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'left', transition: 'all 150ms', width: '100%' }}
            >
              <ChevronRight style={{ width: 9, height: 9, color: '#2EA8FF', flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: '#C9D4E0', lineHeight: 1.3 }}>{chip}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Conversation */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#3DA8FF', opacity: 0.7 }} />
              <span style={{ fontSize: 9, fontWeight: 700, color: '#3DA8FF', textTransform: 'uppercase', letterSpacing: '0.09em' }}>Copilot</span>
              <span style={{ fontSize: 9, color: '#7A96B8', marginLeft: 'auto' }}>{msg.timestamp}</span>
            </div>
            <div style={{ padding: '10px 13px', borderRadius: 8, background: 'rgba(7,20,35,0.6)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p style={{ fontSize: 12, color: '#CBD5E1', lineHeight: 1.6, margin: 0 }}>{msg.text}</p>
            </div>
          </div>
        ))}
        {typing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#3DA8FF', opacity: 0.7 }} />
              <span style={{ fontSize: 9, fontWeight: 700, color: '#3DA8FF', textTransform: 'uppercase', letterSpacing: '0.09em' }}>Copilot</span>
            </div>
            <div style={{ padding: '10px 13px', borderRadius: 8, background: 'rgba(7,20,35,0.6)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 5, alignItems: 'center' }}>
              {[0, 1, 2].map(n => (
                <div key={n} style={{ width: 5, height: 5, borderRadius: '50%', background: '#3DA8FF', opacity: 0.5, animation: `livePulse 1.2s ease-in-out ${n * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={chatEnd} />
      </div>

      {/* Enterprise prompt field */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(7,20,35,0.7)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send(input)}
            placeholder="Ask Copilot..."
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: '#F1F5F9', caretColor: '#3DA8FF' }}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim()}
            style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() ? 'pointer' : 'default', background: input.trim() ? 'rgba(61,168,255,0.15)' : 'transparent', border: '1px solid rgba(61,168,255,0.15)', transition: 'all 150ms' }}
          >
            <Send style={{ width: 12, height: 12, color: input.trim() ? '#3DA8FF' : '#7A96B8' }} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main page ─────────────────────────────────────────────────── */
export function EvidenceReportsPage() {
  const report = mockEvidenceReports[0];

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* Main content — scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#F1F5F9', marginBottom: 4 }}>Evidence Reports</h1>
            <p style={{ fontSize: 13, color: '#7A96B8' }}>Generated evidence documentation</p>
          </div>
          <button style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'rgba(61,168,255,0.12)', border: '1px solid rgba(61,168,255,0.24)', color: '#3DA8FF', transition: 'all 150ms' }}>
            <FileText style={{ width: 14, height: 14 }} />
            Generate New Report
          </button>
        </div>

        {report && (
          <SectionPanel title={`Evidence Report — Session #${report.session.sessionNumber}`}>
            <div className="space-y-6">
              {/* Header */}
              <div className="grid grid-cols-3 gap-6 pb-6 border-b border-border">
                <div>
                  <div className="text-xs text-foreground-muted mb-1">GENERATED</div>
                  <div className="text-sm text-foreground">{new Date(report.generatedAt).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-foreground-muted mb-1">SESSION ID</div>
                  <div className="font-mono text-sm text-foreground">#{report.sessionId}</div>
                </div>
                <div>
                  <div className="text-xs text-foreground-muted mb-1">STATUS</div>
                  <StatusPill status={report.session.verdict} size="sm" />
                </div>
              </div>

              {/* BDN Summary */}
              <div>
                <h3 className="text-base font-semibold text-foreground mb-4">BDN Summary</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'BDN Reference', value: report.session.bdnRecord.reference },
                    { label: 'Vessel Name', value: report.session.bdnRecord.vesselName },
                    { label: 'Vessel IMO', value: report.session.bdnRecord.vesselIMO },
                    { label: 'Supplier', value: report.session.bdnRecord.supplierName },
                    { label: 'Supplier Licence', value: report.session.bdnRecord.supplierLicence },
                    { label: 'Barge Name', value: report.session.bdnRecord.bargeName },
                    { label: 'Barge IMO', value: report.session.bdnRecord.bargeIMO },
                    { label: 'Port', value: report.session.bdnRecord.port },
                    { label: 'Product Grade', value: report.session.bdnRecord.productGrade },
                    { label: 'Sulphur %', value: report.session.bdnRecord.sulphurPercent },
                    { label: 'Density @ 15°C', value: report.session.bdnRecord.density15C },
                    { label: 'Flash Point', value: `${report.session.bdnRecord.flashPoint}°C` },
                    { label: 'Quantity', value: `${report.session.bdnRecord.quantityMT} MT` },
                    { label: 'Sample Seal', value: report.session.bdnRecord.sampleSeal },
                    { label: 'Validation', value: report.session.bdnRecord.validationStatus },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between py-2 border-b border-border">
                      <span className="text-sm text-foreground-muted">{item.label}</span>
                      <span className="text-sm font-medium text-foreground">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quantity Comparison */}
              <div>
                <h3 className="text-base font-semibold text-foreground mb-4">Quantity Comparison</h3>
                <div className="bg-background-secondary border border-border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="border-b border-border">
                      <tr className="text-left text-xs text-foreground-muted uppercase">
                        <th className="px-4 py-3">Source</th>
                        <th className="px-4 py-3 text-right">Quantity (MT)</th>
                        <th className="px-4 py-3 text-right">Difference</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      <tr>
                        <td className="px-4 py-3 text-sm text-foreground">BDN Declared</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-foreground">{report.session.bdnQuantity.toFixed(1)}</td>
                        <td className="px-4 py-3 text-right text-sm text-foreground-muted">—</td>
                        <td className="px-4 py-3"><StatusPill status="MISMATCH" size="sm" /></td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm text-foreground">MFM Recorded</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-foreground">{report.session.mfmQuantity.toFixed(1)}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-critical">
                          −{report.session.mismatchMT.toFixed(1)} ({report.session.mismatchPercent.toFixed(2)}%)
                        </td>
                        <td className="px-4 py-3"><StatusPill status="CRITICAL" size="sm" /></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* AI Analysis */}
              <div>
                <h3 className="text-base font-semibold text-foreground mb-4">AI Analysis</h3>
                <div className="space-y-4">
                  <div className="p-4 bg-background-secondary border border-border rounded-lg">
                    <div className="text-xs text-foreground-muted mb-2">SUMMARY</div>
                    <div className="text-sm text-foreground">{report.aiAnalysis.summary}</div>
                  </div>
                  <div className="p-4 bg-background-secondary border border-border rounded-lg">
                    <div className="text-xs text-foreground-muted mb-2">SPECIFIC CONCERNS</div>
                    <ul className="space-y-2">
                      {report.aiAnalysis.concerns.map((concern, i) => (
                        <li key={i} className="text-sm text-foreground flex items-start gap-2">
                          <span className="text-critical">•</span>
                          <span>{concern}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-4 bg-critical/10 border border-critical/20 rounded-lg">
                    <div className="text-xs text-foreground-muted mb-2">RECOMMENDATION</div>
                    <div className="text-sm font-semibold text-critical mb-2">{report.aiAnalysis.recommendation}</div>
                    <div className="text-xs text-critical/90">Confidence: {report.aiAnalysis.confidence}%</div>
                  </div>
                </div>
              </div>

              {/* LoP Draft */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-foreground">Letter of Protest Draft</h3>
                  <div className="flex gap-2">
                    <button className="flex items-center gap-2 px-3 py-1.5 bg-background-secondary border border-border rounded-lg text-sm hover:bg-surface-secondary transition-colors">
                      <Copy className="w-4 h-4" />Copy
                    </button>
                    <button className="flex items-center gap-2 px-3 py-1.5 bg-background-secondary border border-border rounded-lg text-sm hover:bg-surface-secondary transition-colors">
                      <Download className="w-4 h-4" />Download
                    </button>
                  </div>
                </div>
                <div className="p-6 bg-background-secondary border border-border rounded-lg">
                  <pre className="text-xs text-foreground-secondary whitespace-pre-wrap font-mono">{report.lopDraft}</pre>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-6 border-t border-border">
                <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                  <Download className="w-4 h-4" />Download PDF
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-background-secondary border border-border rounded-lg hover:bg-surface-secondary transition-colors">
                  <Copy className="w-4 h-4" />Copy Summary
                </button>
              </div>
            </div>
          </SectionPanel>
        )}
      </div>

      {/* Right: AI Investigation Copilot drawer */}
      {report && <AICopilotDrawer report={report} />}
    </div>
  );
}
