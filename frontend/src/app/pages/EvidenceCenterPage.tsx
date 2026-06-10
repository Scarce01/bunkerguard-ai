import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { FileText, Shield, Download, CheckCircle2, AlertTriangle, Sparkles, X, Send, ChevronRight } from 'lucide-react';

/* ── Design tokens ───────────────────────────────────────────────── */
const CARD: React.CSSProperties = {
  background: 'linear-gradient(180deg, #102033 0%, #0E1C2D 100%)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 8,
};

const LABEL: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.14em', color: '#5A8AB4', marginBottom: 6,
};

/* ── Types ───────────────────────────────────────────────────────── */
type Tab = 'investigation' | 'evidence' | 'protest';

type InvestigationCase = {
  id: number;
  sessionNumber: number;
  vesselName: string;
  supplier: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'MODERATE';
  shortageMT: number;
  deviationPercent: number;
  port: string;
  riskScore: number;
  status: 'Evidence Verified' | 'Evidence Collecting' | 'Pending Review' | 'Under Review';
  issue: string;
};

const INVESTIGATION_CASES: InvestigationCase[] = [
  { id: 1, sessionNumber: 16, vesselName: 'MAERSK HONAM', supplier: 'Supplier Gamma', severity: 'CRITICAL', shortageMT: 18.8, deviationPercent: 3.76, port: 'Singapore Eastern Anchorage', riskScore: 78, status: 'Evidence Verified', issue: 'A02 Quantity Final Mismatch' },
  { id: 2, sessionNumber: 12, vesselName: 'CMA CGM ANTOINE DE SAINT EXUPERY', supplier: 'Supplier Gamma', severity: 'CRITICAL', shortageMT: 20.4, deviationPercent: 3.14, port: 'Singapore Eastern Anchorage', riskScore: 85, status: 'Evidence Verified', issue: 'A02 Quantity Final Mismatch' },
  { id: 3, sessionNumber: 19, vesselName: 'MSC OSCAR', supplier: 'Supplier Gamma', severity: 'HIGH', shortageMT: 3.7, deviationPercent: 3.06, port: 'Singapore Western Anchorage', riskScore: 67, status: 'Evidence Collecting', issue: 'A01 Quantity Trajectory Deviation' },
  { id: 4, sessionNumber: 21, vesselName: 'EVER GIVEN', supplier: 'Supplier Gamma', severity: 'CRITICAL', shortageMT: 1.95, deviationPercent: 3.75, port: 'Singapore Western Anchorage', riskScore: 85, status: 'Pending Review', issue: 'A02 Quantity Final Mismatch' },
  { id: 5, sessionNumber: 22, vesselName: 'MAERSK HONAM', supplier: 'Supplier Beta', severity: 'CRITICAL', shortageMT: 3.3, deviationPercent: 2.64, port: 'Singapore Eastern Anchorage', riskScore: 72, status: 'Under Review', issue: 'A02 Quantity Final Mismatch' },
];

function generateProtestLetter(caseData: InvestigationCase): string {
  const bdnQuantity = caseData.sessionNumber === 16 ? 500.0 :
                      caseData.sessionNumber === 12 ? 650.0 :
                      caseData.sessionNumber === 19 ? 121.0 :
                      caseData.sessionNumber === 21 ? 52.0 : 125.0;
  const mfmQuantity = (bdnQuantity - caseData.shortageMT).toFixed(1);

  return `TO: ${caseData.supplier}
FROM: BDN Officer — ${caseData.vesselName}
DATE: 10 June 2026 · 14:32 SGT
RE: Letter of Protest — Session SES-2026-0${caseData.sessionNumber} · BDN-2026-06-10-000${caseData.sessionNumber}

Dear Sir / Madam,

We hereby lodge our formal Letter of Protest regarding the bunkering operation completed on 10 June 2026 aboard ${caseData.vesselName} at ${caseData.port}.

QUANTITY DISCREPANCY
The mass flow meter (MFM) system recorded a cumulative delivery of ${mfmQuantity} MT of VLSFO RMG 380 (ISO 8217). The Bunker Delivery Note (BDN) ref. BDN-2026-06-10-000${caseData.sessionNumber} declares a quantity of ${bdnQuantity.toFixed(1)} MT, constituting a shortfall of ${caseData.shortageMT} MT (${caseData.deviationPercent}%).

This deviation exceeds the MPA-mandated tolerance threshold of 2.0% and triggers Anomaly Rule ${caseData.issue.split(' ')[0]} under the BunkerGuard AI monitoring protocol.

EVIDENCE BASIS
— MFM stream hash: 0xA3F8C2D1...B2C1
— BDN reference: BDN-2026-06-10-000${caseData.sessionNumber}
— Blockchain verification: Polygon block #4,892,341
— Deviation log: R-A02-${caseData.sessionNumber}
— Fuel samples retained: SMP-${caseData.sessionNumber}-A, SMP-${caseData.sessionNumber}-B, SMP-${caseData.sessionNumber}-C, SMP-${caseData.sessionNumber}-D

REGULATORY BASIS
This protest is issued pursuant to:
— MPA Bunkering regulations §14.2 (quantity tolerance)
— MARPOL Annex VI, Regulation 18
— ISO 8217:2017 fuel quality standards
— Singapore Port Authority circular MPA-BKR-2024

ACTIONS
We hereby formally refuse to countersign the BDN in its current state. All MFM logs have been sealed. Independent survey has been requested. This matter will be escalated to our P&I Club and reported to MPA BunkerNet within 24 hours.

Signed,
BDN Officer
${caseData.vesselName} · Port of Singapore`;
}

/* ── Copilot Drawer ──────────────────────────────────────────────── */
type ChatMessage = { role: 'user' | 'ai'; text: string };

const COPILOT_RESPONSES: Record<string, string> = {
  'Why was this flagged?': 'MFM recorded 481.2 MT while the BDN declares 500.0 MT — an 18.8 MT (3.76%) shortage. This exceeds MPA\'s 2.0% tolerance, triggering Rule A02. BunkerGuard Demo Supplier Gamma Pte Ltd has been flagged in 9 of 22 recent sessions, with systematic underfueling pattern confirmed. MPA notification issued on 2026-06-10.',
  'Summarize evidence': 'Evidence package is complete: MFM data stream verified, BDN document hash-matched, AIS position confirmed at Zone B4, and 4 fuel samples retained. All records committed to Polygon block #186543219 with 128+ confirmations. Chain of custody is intact. Related sessions: SES-2026-012, 016, 019, 021.',
  'Show similar incidents': 'AI matched 4 historical precedents from Supplier Gamma: SES-2026-012 (94% match, CMA CGM ANTOINE — 20.4 MT shortage, 3.14%), SES-2026-019 (89% match, MSC OSCAR — 3.7 MT shortage, 3.06%), SES-2026-021 (88% match, EVER GIVEN — 1.95 MT shortage, 3.75%). Total exposure: USD 32,405. Pattern is systematic.',
  'Generate executive summary': 'EXECUTIVE SUMMARY — Session SES-2026-016, MAERSK HONAM: BunkerGuard AI detected a 18.8 MT quantity shortfall (3.76%) from BunkerGuard Demo Supplier Gamma Pte Ltd at Singapore Eastern Anchorage on 10 June 2026. AI confidence: 94%. Verdict: REFUSE TO SIGN BDN. Evidence package verified and blockchain-anchored. Systematic underfueling pattern confirmed across 4 critical incidents. Immediate escalation to MPA and P&I Club mandatory.',
};

function CopilotDrawer({ open, onClose, caseData }: { open: boolean; onClose: () => void; caseData: InvestigationCase }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'ai', text: `I've reviewed the evidence for Session #${caseData.sessionNumber}. What would you like to know?` }
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  const sendMessage = (text: string) => {
    const userMsg: ChatMessage = { role: 'user', text };
    setMessages(m => [...m, userMsg]);
    setInput('');
    setTyping(true);
    setTimeout(() => {
      const response = COPILOT_RESPONSES[text] || `Analyzing ${text.toLowerCase()}... Based on the evidence for Session #${caseData.sessionNumber}, the AI flagged a ${caseData.deviationPercent}% deviation. All evidence has been verified and blockchain-anchored.`;
      setTyping(false);
      setMessages(m => [...m, { role: 'ai', text: response }]);
    }, 900);
  };

  const suggestions = ['Why was this flagged?', 'Summarize evidence', 'Show similar incidents', 'Generate executive summary'];

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, zIndex: 199, background: 'rgba(0,0,0,0.3)' }}
        />
      )}
      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 400, zIndex: 200,
        background: '#08131F',
        borderLeft: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '-12px 0 40px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 260ms cubic-bezier(0.32, 0, 0.12, 1)',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg, #1A3A6B 0%, #0E2447 100%)', border: '1px solid rgba(74,158,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles style={{ width: 13, height: 13, color: '#4A9EFF' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#EAF4FF', lineHeight: 1 }}>Port Copilot</div>
            <div style={{ fontSize: 10, color: '#5A8AB4', marginTop: 2 }}>AI Investigation Assistant</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#5A8AB4', display: 'flex', alignItems: 'center' }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Context badge */}
        <div style={{ padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(74,158,255,0.04)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#7FA5D3' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4A9EFF' }} />
            Context: Session #{caseData.sessionNumber} · {caseData.vesselName} · {caseData.severity}
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', gap: 8, alignItems: 'flex-start' }}>
              {msg.role === 'ai' && (
                <div style={{ width: 22, height: 22, borderRadius: 5, background: 'rgba(74,158,255,0.15)', border: '1px solid rgba(74,158,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <Sparkles style={{ width: 10, height: 10, color: '#4A9EFF' }} />
                </div>
              )}
              <div style={{
                maxWidth: '82%', padding: '10px 13px', borderRadius: msg.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                background: msg.role === 'user' ? 'rgba(74,158,255,0.14)' : '#0E1C2D',
                border: msg.role === 'user' ? '1px solid rgba(74,158,255,0.22)' : '1px solid rgba(255,255,255,0.08)',
                fontSize: 12, color: '#BFD7F7', lineHeight: 1.6,
              }}>
                {msg.text}
              </div>
            </div>
          ))}
          {typing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 22, height: 22, borderRadius: 5, background: 'rgba(74,158,255,0.15)', border: '1px solid rgba(74,158,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles style={{ width: 10, height: 10, color: '#4A9EFF' }} />
              </div>
              <div style={{ padding: '10px 14px', borderRadius: '10px 10px 10px 2px', background: '#0E1C2D', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 4, alignItems: 'center' }}>
                {[0, 1, 2].map(d => (
                  <div key={d} style={{ width: 5, height: 5, borderRadius: '50%', background: '#4A9EFF', opacity: 0.5, animation: `pulse 1s ${d * 0.25}s infinite` }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Suggestion chips */}
        {messages.length < 3 && (
          <div style={{ padding: '0 20px 12px', flexShrink: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {suggestions.map(s => (
                <button key={s} onClick={() => sendMessage(s)} style={{ padding: '6px 11px', borderRadius: 6, background: '#0E1C2D', border: '1px solid rgba(74,158,255,0.2)', color: '#7FA5D3', fontSize: 11, cursor: 'pointer', fontWeight: 500, transition: 'all 140ms' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(74,158,255,0.08)'; e.currentTarget.style.color = '#4A9EFF'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#0E1C2D'; e.currentTarget.style.color = '#7FA5D3'; }}
                >{s}</button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div style={{ padding: '12px 20px 20px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8, background: '#0E1C2D', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '2px 6px 2px 12px', alignItems: 'center' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && input.trim() && sendMessage(input.trim())}
              placeholder="Ask about this investigation..."
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 12, color: '#BFD7F7', padding: '8px 0', fontFamily: 'inherit' }}
            />
            <button
              onClick={() => input.trim() && sendMessage(input.trim())}
              style={{ width: 28, height: 28, borderRadius: 6, background: input.trim() ? 'rgba(74,158,255,0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${input.trim() ? 'rgba(74,158,255,0.35)' : 'rgba(255,255,255,0.08)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() ? 'pointer' : 'default', transition: 'all 150ms', flexShrink: 0 }}
            >
              <Send style={{ width: 11, height: 11, color: input.trim() ? '#4A9EFF' : '#5A8AB4' }} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Tab 1: Investigation ────────────────────────────────────────── */
function InvestigationTab({ caseData }: { caseData: InvestigationCase }) {
  const navigate = useNavigate();
  const mfmRecorded = (500 - caseData.shortageMT).toFixed(1);

  const metricCards = [
    { label: 'MFM Recorded', value: `${mfmRecorded} MT`, sub: 'Certified MFM reading', color: '#BFD7F7' },
    { label: 'BDN Declared', value: '500.0 MT', sub: 'Supplier declaration', color: '#BFD7F7' },
    { label: 'Discrepancy', value: `${caseData.shortageMT} MT`, sub: `${caseData.deviationPercent}% deviation`, color: '#D94040' },
    { label: 'Rule Triggered', value: 'A02', sub: 'MPA tolerance exceeded', color: '#FFA940' },
    { label: 'Supplier History', value: '3 of 6', sub: 'Recent sessions flagged', color: '#FFA940' },
    { label: 'Historical Match', value: '94%', sub: 'AI similarity score', color: '#4A9EFF' },
  ];

  const incidents = [
    { id: 18, type: 'Quantity Shortage', match: 94 },
    { id: 14, type: 'Quantity Shortage', match: 88 },
    { id: 21, type: 'Supplier Dispute', match: 71 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* SECTION A — AI Investigation Summary */}
      <div style={{ ...CARD, padding: '22px 26px', background: 'linear-gradient(180deg, #0F2235 0%, #0D1B2C 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #1A3A6B 0%, #0E2447 100%)', border: '1px solid rgba(74,158,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles style={{ width: 14, height: 14, color: '#4A9EFF' }} />
            </div>
            <div>
              <div style={{ ...LABEL, marginBottom: 2 }}>AI Investigation Summary</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#EAF4FF', lineHeight: 1 }}>Session #{caseData.sessionNumber} · {caseData.vesselName}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ ...LABEL, marginBottom: 3 }}>AI Confidence</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#4A9EFF', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>92%</div>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ ...LABEL, marginBottom: 3 }}>Risk Level</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: caseData.severity === 'CRITICAL' ? '#D94040' : '#FFA940', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{caseData.severity}</div>
            </div>
          </div>
        </div>

        {/* AI Verdict */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 8, background: 'rgba(10,16,28,0.7)', border: '1px solid rgba(255,255,255,0.09)', marginBottom: 14 }}>
          <div>
            <div style={{ ...LABEL, marginBottom: 3 }}>AI Verdict</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#D94040', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.02em' }}>REFUSE BDN</div>
          </div>
          <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {[
              `${caseData.shortageMT} MT shortage detected`,
              'MFM and BDN mismatch confirmed',
              `Supplier flagged in 3 of 6 recent sessions`,
            ].map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 style={{ width: 10, height: 10, color: '#00D98E', flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: '#BFD7F7' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION B — Why AI Flagged This */}
      <div>
        <div style={{ ...LABEL, marginBottom: 10 }}>Why AI Flagged This</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {metricCards.map(card => (
            <div key={card.label} style={{ ...CARD, padding: '14px 16px' }}>
              <div style={{ ...LABEL, marginBottom: 6 }}>{card.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: card.color, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1, marginBottom: 4 }}>{card.value}</div>
              <div style={{ fontSize: 10, color: '#5A8AB4' }}>{card.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION C — Similar Incidents */}
      <div>
        <div style={{ ...LABEL, marginBottom: 10 }}>Similar Incidents · AI Pattern Match</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {incidents.map(inc => (
            <div key={inc.id} onClick={() => navigate('/sessions/' + inc.id)} style={{ ...CARD, padding: '14px 16px', cursor: 'pointer', transition: 'border-color 150ms' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(74,158,255,0.3)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)')}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#5A8AB4', fontFamily: "'JetBrains Mono', monospace" }}>#{inc.id}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: inc.match >= 90 ? '#4A9EFF' : '#7FA5D3', fontFamily: "'JetBrains Mono', monospace" }}>{inc.match}%</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#BFD7F7', marginBottom: 2 }}>{inc.type}</div>
              <div style={{ fontSize: 9, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.07em' }}>AI Match</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Tab 2: Evidence ─────────────────────────────────────────────── */
function EvidenceTab({ caseData }: { caseData: InvestigationCase }) {
  const evidenceItems = [
    { label: 'MFM Data Stream', detail: `${(500 - caseData.shortageMT).toFixed(1)} MT · Hash verified`, status: 'Verified' },
    { label: 'BDN Document', detail: `BDN-2026-06-10-000${caseData.sessionNumber} · Signed`, status: 'Verified' },
    { label: 'AIS Vessel Data', detail: 'Position confirmed · Zone B4 · MMSI 123456789', status: 'Verified' },
    { label: 'Fuel Sample Records', detail: `SMP-${caseData.sessionNumber}-A/B/C/D · 4 samples retained`, status: 'Retained' },
  ];

  const custodyRows = [
    { label: 'Verified', detail: 'Cryptographic hash validated', icon: CheckCircle2, color: '#00D98E' },
    { label: 'Signed', detail: 'MFM officer digital signature', icon: CheckCircle2, color: '#00D98E' },
    { label: 'Timestamped', detail: '2026-06-10 12:34:57 SGT', icon: CheckCircle2, color: '#00D98E' },
    { label: 'Immutable', detail: 'Record cannot be modified', icon: CheckCircle2, color: '#00D98E' },
    { label: 'Blockchain Anchored', detail: 'Polygon PoS · 128+ confirmations', icon: Shield, color: '#4A9EFF' },
  ];

  const blockchainData = [
    { label: 'Network', value: 'Polygon PoS' },
    { label: 'Block', value: '#4,892,341' },
    { label: 'Confirmations', value: '128' },
    { label: 'Tx Hash', value: '0xA3F8...B2C1' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* SECTION A — Evidence Package */}
      <div>
        <div style={{ ...LABEL, marginBottom: 10 }}>Evidence Package</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {evidenceItems.map(item => (
            <div key={item.label} style={{ ...CARD, padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(0,217,142,0.1)', border: '1px solid rgba(0,217,142,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CheckCircle2 style={{ width: 13, height: 13, color: '#00D98E' }} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#EAF4FF', marginBottom: 3 }}>{item.label}</div>
                <div style={{ fontSize: 10, color: '#7FA5D3', marginBottom: 5 }}>{item.detail}</div>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#00D98E', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '2px 7px', borderRadius: 3, background: 'rgba(0,217,142,0.1)', border: '1px solid rgba(0,217,142,0.2)' }}>{item.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION B — Chain of Custody */}
      <div>
        <div style={{ ...LABEL, marginBottom: 10 }}>Chain of Custody</div>
        <div style={{ ...CARD, overflow: 'hidden' }}>
          {custodyRows.map((row, i) => {
            const Icon = row.icon;
            return (
              <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px', borderBottom: i < custodyRows.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none', background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                <Icon style={{ width: 13, height: 13, color: row.color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#EAF4FF' }}>{row.label}</span>
                </div>
                <span style={{ fontSize: 11, color: '#7FA5D3' }}>{row.detail}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION C — Blockchain Verification */}
      <div>
        <div style={{ ...LABEL, marginBottom: 10 }}>Blockchain Verification</div>
        <div style={{ ...CARD, padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <Shield style={{ width: 14, height: 14, color: '#4A9EFF' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#EAF4FF' }}>Polygon PoS — Evidence Anchored</span>
            <span style={{ marginLeft: 'auto', padding: '3px 8px', borderRadius: 4, background: 'rgba(0,217,142,0.1)', border: '1px solid rgba(0,217,142,0.2)', fontSize: 9, fontWeight: 700, color: '#00D98E', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Immutable</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {blockchainData.map(d => (
              <div key={d.label} style={{ padding: '10px 12px', borderRadius: 6, background: 'rgba(10,16,28,0.6)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ ...LABEL, marginBottom: 4 }}>{d.label}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#4A9EFF', fontFamily: "'JetBrains Mono', monospace" }}>{d.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Tab 3: Protest Report ───────────────────────────────────────── */
function ProtestTab({ caseData }: { caseData: InvestigationCase }) {
  const complianceItems = [
    { label: 'Protest Issued', done: true },
    { label: 'MPA Notification', done: true },
    { label: 'Surveyor Requested', done: true },
    { label: 'P&I Pending', done: false },
  ];

  const letter = generateProtestLetter(caseData);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, alignItems: 'start' }}>

      {/* LEFT — Letter of Protest */}
      <div style={{ ...CARD, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileText style={{ width: 13, height: 13, color: '#4A9EFF' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#EAF4FF', flex: 1 }}>Generated Letter of Protest</span>
          <span style={{ padding: '3px 8px', borderRadius: 4, background: 'rgba(0,217,142,0.1)', border: '1px solid rgba(0,217,142,0.2)', fontSize: 9, fontWeight: 700, color: '#00D98E', textTransform: 'uppercase', letterSpacing: '0.07em' }}>AI-Generated</span>
        </div>
        <div style={{ padding: '24px 28px', background: 'rgba(4,10,18,0.4)', maxHeight: 540, overflowY: 'auto' }}>
          <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 12, color: '#C4D9F0', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>
            {letter.split('\n\n').map((paragraph, i) => {
              const isHeader = paragraph.startsWith('TO:') || paragraph.startsWith('FROM:') || paragraph.startsWith('DATE:') || paragraph.startsWith('RE:');
              const isSectionTitle = ['QUANTITY DISCREPANCY', 'EVIDENCE BASIS', 'REGULATORY BASIS', 'ACTIONS'].includes(paragraph.trim());
              if (isHeader) return <div key={i} style={{ marginBottom: 8, fontSize: 11, color: '#7FA5D3', fontFamily: "'JetBrains Mono', monospace" }}>{paragraph}</div>;
              if (isSectionTitle) return <div key={i} style={{ marginTop: 18, marginBottom: 10, fontSize: 11, fontWeight: 700, color: '#4A9EFF', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{paragraph}</div>;
              return <div key={i} style={{ marginBottom: 12 }}>{paragraph}</div>;
            })}
          </div>
        </div>
      </div>

      {/* RIGHT — Compliance Actions */}
      <div style={{ ...CARD, padding: '18px 20px' }}>
        <div style={{ ...LABEL, marginBottom: 14 }}>Compliance Actions</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {complianceItems.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 13px', borderRadius: 6, background: item.done ? 'rgba(0,217,142,0.05)' : 'rgba(255,255,255,0.02)', border: `1px solid ${item.done ? 'rgba(0,217,142,0.18)' : 'rgba(255,255,255,0.07)'}` }}>
              <div style={{ width: 16, height: 16, borderRadius: 4, background: item.done ? 'rgba(0,217,142,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${item.done ? 'rgba(0,217,142,0.4)' : 'rgba(255,255,255,0.12)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {item.done && <span style={{ fontSize: 10, color: '#00D98E', fontWeight: 800 }}>✓</span>}
              </div>
              <span style={{ fontSize: 12, color: item.done ? '#BFD7F7' : '#7FA5D3', fontWeight: item.done ? 600 : 400 }}>{item.label}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: '12px 14px', borderRadius: 6, background: 'rgba(74,158,255,0.05)', border: '1px solid rgba(74,158,255,0.15)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4A9EFF', marginBottom: 3 }}>3 / 4 complete</div>
          <div style={{ fontSize: 10, color: '#7FA5D3' }}>P&I Club notification pending</div>
        </div>
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ ...LABEL, marginBottom: 10 }}>AI Completed</div>
          <div style={{ fontSize: 10, color: '#7FA5D3', lineHeight: 1.7 }}>
            BunkerGuard AI completed the investigation, generated this protest letter, and submitted MPA notification automatically.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────────── */
export function EvidenceCenterPage() {
  const [activeTab, setActiveTab] = useState<Tab>('investigation');
  const [selectedCaseId, setSelectedCaseId] = useState<number>(1);
  const [copilotOpen, setCopilotOpen] = useState(false);

  const selectedCase = INVESTIGATION_CASES.find(c => c.id === selectedCaseId) || INVESTIGATION_CASES[0];
  const sevColor = (s: string) => s === 'CRITICAL' ? '#D94040' : s === 'HIGH' ? '#FFA940' : '#4A9EFF';

  const TABS: { id: Tab; label: string; icon: typeof Shield }[] = [
    { id: 'investigation', label: 'Investigation', icon: Shield },
    { id: 'evidence',      label: 'Evidence',       icon: CheckCircle2 },
    { id: 'protest',       label: 'Protest Report',  icon: FileText },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

      {/* Header */}
      <div style={{ padding: '18px 32px 0', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(4,10,20,0.7)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#FFFFFF', lineHeight: 1, letterSpacing: '-0.01em', margin: 0, marginBottom: 3 }}>Evidence Center</h1>
            <div style={{ fontSize: 9, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700 }}>Evidence · Compliance · Verification</div>
          </div>
          {/* Top-right actions */}
          <div style={{ display: 'flex', gap: 8, paddingBottom: 2 }}>
            <button onClick={() => alert('Evidence Report exported as PDF: Session_' + caseData.sessionNumber + '_Evidence_Package.pdf')} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#BFD7F7', transition: 'all 150ms' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
            >
              <Download style={{ width: 13, height: 13 }} />Export Report
            </button>
            <button
              onClick={() => setActiveTab('protest')}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#BFD7F7', transition: 'all 150ms' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
            >
              <FileText style={{ width: 13, height: 13 }} />Generate Protest
            </button>
            <button
              onClick={() => setCopilotOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'rgba(74,158,255,0.1)', border: '1px solid rgba(74,158,255,0.25)', color: '#4A9EFF', transition: 'all 150ms' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(74,158,255,0.16)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(74,158,255,0.1)'; }}
            >
              <Sparkles style={{ width: 13, height: 13 }} />Ask Copilot
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2 }}>
          {TABS.map((tab, idx) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '9px 20px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  background: isActive ? 'rgba(74,158,255,0.1)' : 'transparent',
                  color: isActive ? '#4A9EFF' : '#7FA5D3',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #4A9EFF' : '2px solid transparent',
                  borderRadius: '8px 8px 0 0',
                  transition: 'all 150ms',
                  position: 'relative',
                }}
              >
                <Icon style={{ width: 13, height: 13 }} />
                {tab.label}
                <span style={{ fontSize: 9, fontWeight: 700, color: '#5A8AB4', marginLeft: 2 }}>0{idx + 1}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Case Summary Bar */}
      <div style={{
        padding: '10px 24px', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: '#08131F',
        borderLeft: `3px solid ${sevColor(selectedCase.severity)}${selectedCase.severity === 'CRITICAL' ? 'B0' : '90'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Case selector — compact row of session pills */}
          {INVESTIGATION_CASES.map(c => {
            const isSelected = c.id === selectedCaseId;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedCaseId(c.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 10px', borderRadius: 6, background: isSelected ? 'rgba(74,158,255,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isSelected ? 'rgba(74,158,255,0.3)' : 'rgba(255,255,255,0.07)'}`, cursor: 'pointer', transition: 'all 140ms' }}
              >
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: sevColor(c.severity), flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: isSelected ? 700 : 500, color: isSelected ? '#EAF4FF' : '#7FA5D3', fontFamily: "'JetBrains Mono', monospace" }}>#{c.sessionNumber}</span>
              </button>
            );
          })}

          {/* Selected case info */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#BFD7F7' }}>{selectedCase.vesselName}</div>
              <div style={{ fontSize: 9, color: '#5A8AB4' }}>{selectedCase.supplier} · {selectedCase.port}</div>
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              {[
                { label: 'Risk', value: selectedCase.riskScore, color: sevColor(selectedCase.severity) },
                { label: 'Deviation', value: `${selectedCase.deviationPercent}%`, color: '#D94040' },
                { label: 'Shortage', value: `${selectedCase.shortageMT} MT`, color: '#D94040' },
              ].map(m => (
                <div key={m.label}>
                  <div style={{ fontSize: 8, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 1 }}>{m.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: m.color, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{m.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tab Content — page-level scroll handled by <main> in AppLayout. */}
      <div style={{ flex: 1, minHeight: 0, padding: '20px 32px' }}>
        {activeTab === 'investigation' && <InvestigationTab caseData={selectedCase} />}
        {activeTab === 'evidence' && <EvidenceTab caseData={selectedCase} />}
        {activeTab === 'protest' && <ProtestTab caseData={selectedCase} />}
      </div>

      {/* Copilot Drawer */}
      <CopilotDrawer open={copilotOpen} onClose={() => setCopilotOpen(false)} caseData={selectedCase} />
    </div>
  );
}
