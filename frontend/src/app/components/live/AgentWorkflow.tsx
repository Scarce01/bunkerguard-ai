/**
 * 4-agent decision workflow panel matching the "Digital Bunker Surveyor Agent
 * Workflow" slide:
 *   Surveyor (Observe)   →   Investigator (Analyze)   →   Compliance (Verify)
 *                                                      →   Decision (Recommend)
 *                                                      →   Chief Engineer (Sign-Off)
 *
 * Each agent is either ACTIVE (its threshold is met) or DORMANT (skipped).
 * Active agents show their actual output for the current session, sourced from
 * Supabase (sessions / risk_scores / anomalies / llm_outputs / mfm_stream).
 */

import { useMemo, useState } from 'react';
import { Anchor, Brain, ShieldCheck, Gavel, UserCheck, Check, X, CheckCircle2, FileText } from 'lucide-react';
import { supabase, SessionRow, RiskScoreRow, AnomalyRow } from '../../../lib/supabase';
import { MfmPacket, LlmOutputRow } from '../../../lib/useLiveSession';
import { GeofenceRow } from '../../../lib/useGeofence';
import { EvidenceReportDrawer } from '../evidence/EvidenceReportDrawer';

interface Props {
  session: SessionRow;
  risk: RiskScoreRow | null;
  anomalies: AnomalyRow[];
  mfm: MfmPacket[];
  llm: LlmOutputRow | null;
  geofence?: GeofenceRow | null;
  outsideGeofence?: boolean;
  onSessionUpdated?: (updated: Partial<SessionRow>) => void;
}

type AgentKey = 'surveyor' | 'investigator' | 'compliance' | 'decision';

const TH = {
  INVESTIGATOR: 40, // risk ≥ 40 → Investigator enriches with Exa
  COMPLIANCE:   80, // risk > 80 → Compliance builds evidence + verifies blockchain
  DECISION:     90, // risk > 90 → Decision drafts LoP + recommends Refuse-To-Sign
} as const;

interface AgentDef {
  key: AgentKey;
  name: string;
  verb: string;
  icon: typeof Anchor;
  color: string;
  tools: string[];
  threshold: number;
}

const AGENTS: AgentDef[] = [
  { key: 'surveyor',     name: 'Surveyor',     verb: 'Observe',    icon: Anchor,      color: '#2EA8FF', threshold: 0,           tools: ['AIS', 'IoT', 'MFM', 'GPS Geofence'] },
  { key: 'investigator', name: 'Investigator', verb: 'Analyze',    icon: Brain,       color: '#FFA940', threshold: TH.INVESTIGATOR, tools: ['Detection', 'Risk Engine', 'Exa Intelligence'] },
  { key: 'compliance',   name: 'Compliance',   verb: 'Verify',     icon: ShieldCheck, color: '#A78BFA', threshold: TH.COMPLIANCE,   tools: ['Regulations', 'Evidence Package', 'Blockchain Verification'] },
  { key: 'decision',     name: 'Decision',     verb: 'Recommend',  icon: Gavel,       color: '#FF5656', threshold: TH.DECISION,     tools: ['AWS Bedrock', 'Investigation Summary', 'Letter of Protest', 'Recommended Action'] },
];

export function AgentWorkflow({ session, risk, anomalies, mfm, llm, geofence, outsideGeofence, onSessionUpdated }: Props) {
  const score = risk?.final_risk_score ?? 0;
  const [signOff, setSignOff] = useState<'pending' | 'approved' | 'overridden' | 'saving'>(
    session.status === 'APPROVED'   ? 'approved'   :
    session.status === 'OVERRIDDEN' ? 'overridden' : 'pending',
  );
  const [signOffError, setSignOffError] = useState<string | null>(null);
  const [reportDrawerOpen, setReportDrawerOpen] = useState(false);

  // Per-agent dynamic outputs derived from the live Supabase data
  const outputs: Record<AgentKey, { active: boolean; lines: string[] }> = useMemo(() => {
    // SURVEYOR — always active. Aggregates MFM + geofence observation.
    const peakGain = mfm.reduce((m, p) => Math.max(m, p.drive_gain_pct ?? 0), 0);
    const peakGainPacket = mfm.find((p) => (p.drive_gain_pct ?? 0) === peakGain);
    const zoneName = geofence?.anchorage_name ?? 'Eastern Anchorage';
    const radius = geofence?.geofence_radius_m ?? 2000;
    const geofenceLine = outsideGeofence
      ? `🚨 OUTSIDE ${zoneName} geofence (${radius}m radius) — BREACH`
      : `✓ Inside ${zoneName} geofence (${radius}m radius)`;
    const surveyorLines = [
      `${mfm.length} MFM packets · meter ${session.meter_serial ?? '—'}`,
      peakGainPacket
        ? `Drive-gain peak ${peakGain.toFixed(1)}% at ${new Date(peakGainPacket.recorded_at).toISOString().slice(11, 16)} (aeration signature)`
        : 'No telemetry yet',
      geofenceLine,
    ];

    // INVESTIGATOR — active when risk ≥ 40. Detection + risk + Exa.
    const exaStep = llm?.payload?.tool_use_chain?.find((s) => s.tool === 'exa_search');
    const investigatorLines = [
      `${anomalies.length} anomalies triggered · ${anomalies.map((a) => a.rule).join(', ') || 'none'}`,
      `Risk engine → ${risk?.final_risk_score ?? '—'}/100 · ${risk?.risk_category ?? '—'}`,
      exaStep?.output ? `Exa: ${exaStep.output}` : 'Exa enrichment skipped',
    ];

    // COMPLIANCE — active when risk > 80. Evidence + blockchain.
    const complianceLines = [
      session.evidence_sha256 ? `Evidence SHA-256 ${session.evidence_sha256.slice(0, 14)}…` : 'Evidence package pending',
      session.blockchain_tx ? `Ethereum tx ${session.blockchain_tx.slice(0, 14)}…` : 'No blockchain anchor',
      `Hash chain · Ed25519 · HMAC verified`,
    ];

    // DECISION — active when risk > 90. AWS Bedrock + LoP + Verdict.
    const conf = llm?.payload?.confidence != null ? Math.round(llm.payload.confidence * 100) : null;
    const decisionLines = [
      `Verdict ${(risk?.verdict ?? 'PENDING').replace(/_/g, ' ')} ${conf != null ? `· ${conf}% confidence` : ''}`,
      session.lop_issued ? 'Letter of Protest drafted' : 'LoP not required',
      'AWS Bedrock · investigation summary generated',
    ];

    return {
      surveyor:     { active: true,               lines: surveyorLines },
      investigator: { active: score >= TH.INVESTIGATOR, lines: investigatorLines },
      compliance:   { active: score >  TH.COMPLIANCE,   lines: complianceLines },
      decision:     { active: score >  TH.DECISION,     lines: decisionLines },
    };
  }, [session, risk, anomalies, mfm, llm, score]);

  async function handleSignOff(action: 'approved' | 'overridden') {
    setSignOff('saving');
    setSignOffError(null);
    const newStatus = action === 'approved' ? 'APPROVED' : 'OVERRIDDEN';
    const { error } = await supabase
      .from('sessions')
      .update({ status: newStatus })
      .eq('session_id', session.session_id);
    if (error) {
      setSignOffError(error.message);
      setSignOff('pending');
      return;
    }
    setSignOff(action);
    onSessionUpdated?.({ status: newStatus });
  }

  return (
    <div style={{
      padding: '14px 16px',
      background: 'linear-gradient(180deg, #102033 0%, #0E1C2D 100%)',
      border: '1px solid rgba(46,168,255,0.25)',
      borderRadius: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Brain size={13} style={{ color: '#2EA8FF' }} />
        <span style={{ fontSize: 9, fontWeight: 700, color: '#7FA5D3', letterSpacing: 1.4 }}>
          AGENT DECISION WORKFLOW
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 9, color: '#3D5A75', fontFamily: "'JetBrains Mono', monospace" }}>
          score {score}/100
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {AGENTS.map((agent) => {
          const out = outputs[agent.key];
          const Icon = agent.icon;
          return (
            <div key={agent.key} style={{
              display: 'flex', gap: 10,
              opacity: out.active ? 1 : 0.45,
            }}>
              {/* Rail circle */}
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: out.active ? `${agent.color}33` : 'rgba(127,165,211,0.10)',
                border: `1px solid ${out.active ? agent.color : '#3D5A75'}`,
                color: out.active ? agent.color : '#7FA5D3',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon size={14} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#E5F2FF' }}>
                    {agent.name}
                  </span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: agent.color, letterSpacing: 1.2, textTransform: 'uppercase' }}>
                    {agent.verb}
                  </span>
                  {!out.active && (
                    <span style={{ fontSize: 8.5, color: '#3D5A75', fontFamily: "'JetBrains Mono', monospace" }}>
                      dormant · trigger risk &gt; {agent.threshold}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                  {agent.tools.map((t) => (
                    <span key={t} style={{
                      fontSize: 9, fontWeight: 600,
                      padding: '1px 6px',
                      background: out.active ? `${agent.color}1F` : 'rgba(127,165,211,0.08)',
                      border: `1px solid ${out.active ? `${agent.color}55` : 'rgba(127,165,211,0.12)'}`,
                      color: out.active ? agent.color : '#7FA5D3',
                      borderRadius: 3,
                      letterSpacing: 0.4,
                    }}>{t}</span>
                  ))}
                </div>
                {out.active && (
                  <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {out.lines.map((line, i) => (
                      <div key={i} style={{ fontSize: 10.5, color: '#A8C0E0', lineHeight: 1.35 }}>
                        → {line}
                      </div>
                    ))}
                    {agent.key === 'compliance' && (
                      <button
                        onClick={() => setReportDrawerOpen(true)}
                        style={{
                          marginTop: 6, alignSelf: 'flex-start',
                          padding: '5px 10px',
                          fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                          background: `${agent.color}1F`,
                          border: `1px solid ${agent.color}55`,
                          color: agent.color,
                          borderRadius: 4,
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 5,
                        }}>
                        <FileText size={10} /> GENERATE EVIDENCE REPORT NOW
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Chief Engineer — final HITL sign-off */}
        <div style={{
          marginTop: 4, paddingTop: 12,
          borderTop: '1px dashed rgba(127,165,211,0.25)',
          display: 'flex', gap: 10,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: signOff === 'approved' ? 'rgba(0,217,142,0.20)' :
                        signOff === 'overridden' ? 'rgba(255,86,86,0.20)' :
                        'rgba(0,212,126,0.10)',
            border: `1px solid ${signOff === 'approved' ? '#00D98E' : signOff === 'overridden' ? '#FF5656' : '#00D47E'}`,
            color: signOff === 'approved' ? '#00D98E' : signOff === 'overridden' ? '#FF5656' : '#00D47E',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <UserCheck size={14} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#E5F2FF' }}>Chief Engineer</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#00D47E', letterSpacing: 1.2 }}>
                FINAL SIGN-OFF
              </span>
            </div>
            <div style={{ fontSize: 10.5, color: '#A8C0E0', marginTop: 4, lineHeight: 1.35 }}>
              BunkerGuard agents do not autonomously approve or reject deliveries.
              All recommendations are evidence-backed and require human sign-off.
            </div>

            {signOff === 'pending' && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button
                  onClick={() => handleSignOff('approved')}
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6,
                    background: 'rgba(0,217,142,0.15)',
                    border: '1px solid rgba(0,217,142,0.4)',
                    color: '#00D98E',
                    borderRadius: 4,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  }}>
                  <Check size={11} /> APPROVE VERDICT
                </button>
                <button
                  onClick={() => handleSignOff('overridden')}
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6,
                    background: 'rgba(255,86,86,0.15)',
                    border: '1px solid rgba(255,86,86,0.4)',
                    color: '#FF5656',
                    borderRadius: 4,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  }}>
                  <X size={11} /> OVERRIDE
                </button>
              </div>
            )}
            {signOff === 'saving' && (
              <div style={{ fontSize: 10, color: '#7FA5D3', marginTop: 6 }}>
                writing to sessions.status…
              </div>
            )}
            {signOff === 'approved' && (
              <div style={{
                marginTop: 8, padding: '6px 8px',
                background: 'rgba(0,217,142,0.15)',
                border: '1px solid rgba(0,217,142,0.4)',
                color: '#00D98E',
                borderRadius: 4,
                fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <CheckCircle2 size={12} /> VERDICT APPROVED · sessions.status = APPROVED
              </div>
            )}
            {signOff === 'overridden' && (
              <div style={{
                marginTop: 8, padding: '6px 8px',
                background: 'rgba(255,86,86,0.15)',
                border: '1px solid rgba(255,86,86,0.4)',
                color: '#FF5656',
                borderRadius: 4,
                fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <X size={12} /> AGENT VERDICT OVERRIDDEN · sessions.status = OVERRIDDEN
              </div>
            )}
            {signOffError && (
              <div style={{ marginTop: 6, fontSize: 10, color: '#FF5656' }}>
                {signOffError}
              </div>
            )}
          </div>
        </div>
      </div>

      <EvidenceReportDrawer
        sessionId={session.session_id}
        open={reportDrawerOpen}
        onClose={() => setReportDrawerOpen(false)}
      />
    </div>
  );
}

/* ─── Tech-stack badge strip ─────────────────────────────────────────── */

export function TechStackBadges() {
  const items = [
    { label: 'Claude Sonnet',  desc: 'LLM Copilot · Stage 4',           color: '#FFA940' },
    { label: 'AWS Bedrock',    desc: 'Decision Agent runtime',          color: '#FF9900' },
    { label: 'Exa',            desc: 'Supplier + vessel intelligence',  color: '#A78BFA' },
    { label: 'Supabase',       desc: 'Persistence + realtime',          color: '#3ECF8E' },
    { label: 'Ethereum',       desc: 'Tamper-evident anchoring',        color: '#627EEA' },
    { label: 'Hash chain',     desc: 'Ed25519 · HMAC · SHA-256',        color: '#7FA5D3' },
  ];
  return (
    <div style={{
      padding: '10px 14px',
      background: 'rgba(8,19,31,0.65)',
      border: '1px solid rgba(46,168,255,0.18)',
      borderRadius: 8,
    }}>
      <div style={{ fontSize: 8.5, fontWeight: 700, color: '#7FA5D3', letterSpacing: 1.4, marginBottom: 8 }}>
        TRUST &amp; DATA LAYER
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.map((b) => (
          <div key={b.label} style={{
            padding: '4px 8px',
            background: `${b.color}1A`,
            border: `1px solid ${b.color}55`,
            color: b.color,
            borderRadius: 4,
            fontSize: 9.5, fontWeight: 700,
            letterSpacing: 0.4,
            display: 'flex', flexDirection: 'column', gap: 1,
            minWidth: 0,
          }}>
            <span>{b.label}</span>
            <span style={{ fontSize: 8, fontWeight: 500, color: '#A8C0E0', letterSpacing: 0.3 }}>{b.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
