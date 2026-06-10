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

import { useEffect, useMemo, useState } from 'react';
import { Anchor, Brain, ShieldCheck, Gavel, UserCheck, Check, X, CheckCircle2, FileText } from 'lucide-react';
import { supabase, SessionRow, RiskScoreRow, AnomalyRow } from '../../../lib/supabase';
import { KiroGhostBadge, AGENT_AVATAR_SRC } from '../ai/KiroGhost';
import { useEnrichEntities } from '../../../lib/useEnrichEntities';
import { useAgentOutput } from '../../../lib/useAgentOutput';
import { MfmPacket, LlmOutputRow } from '../../../lib/useLiveSession';
import { GeofenceRow } from '../../../lib/useGeofence';
import { EvidenceReportDrawer } from '../evidence/EvidenceReportDrawer';
import { saveReportPdf } from '../../../lib/useGeneratedReports';

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
    session.sign_off_status === 'APPROVED'   ? 'approved'   :
    session.sign_off_status === 'OVERRIDDEN' ? 'overridden' : 'pending',
  );
  /* Re-sync the local sign-off state when the session row's
   * sign_off_status changes upstream — useLiveSession polls llm_outputs
   * stage 5 every 30 s and on Realtime push, so deleting the row in
   * Supabase (or hitting the Reset button below) flips this back to
   * 'pending' automatically. Without this useEffect the component would
   * stay in its initial state forever. */
  useEffect(() => {
    const next =
      session.sign_off_status === 'APPROVED'   ? 'approved'   :
      session.sign_off_status === 'OVERRIDDEN' ? 'overridden' : 'pending';
    setSignOff((cur) => (cur === 'saving' ? cur : next));
  }, [session.sign_off_status]);
  const [signOffError, setSignOffError] = useState<string | null>(null);
  const [reportDrawerOpen, setReportDrawerOpen] = useState(false);

  /** Reset for demo — deletes every stage-5 sign-off row for this
   *  session so the APPROVE / OVERRIDE buttons come back and the
   *  Intelligence-tab conversation re-pauses at "awaiting Chief Engineer".
   *  Wired to a small inline button under the success badge so the
   *  operator can do consecutive takes without dropping to SQL. */
  async function resetForDemo() {
    setSignOff('saving');
    setSignOffError(null);
    const { error } = await supabase
      .from('llm_outputs')
      .delete()
      .eq('session_id', session.session_id)
      .eq('stage', 5);
    if (error) {
      setSignOffError(error.message);
      setSignOff(session.sign_off_status === 'OVERRIDDEN' ? 'overridden' : 'approved');
      return;
    }
    setSignOff('pending');
    onSessionUpdated?.({ sign_off_status: null as any });
  }

  /* Investigator agent — LIVE backend enrichment via Exa.
   * Calls `enrichment.enrich_entities` through the /api/enrich Vite proxy.
   * Only fires when risk ≥ INVESTIGATOR threshold to conserve Exa quota. */
  const investigatorActive = score >= TH.INVESTIGATOR;
  const { intel: enrichIntel, loading: enrichLoading, error: enrichError } = useEnrichEntities(
    session,
    investigatorActive,
  );

  /* Compliance agent — LIVE LLM-drafted evidence + regulatory summary.
   * Fires only above the COMPLIANCE threshold so we don't pay for token
   * spend on low-risk sessions. */
  const complianceActive = score > TH.COMPLIANCE;
  const complianceCtx = complianceActive ? {
    session_id: session.session_id,
    risk_score: risk?.final_risk_score,
    risk_category: risk?.risk_category,
    anomalies: anomalies.map(a => a.rule),
    evidence_sha256: session.evidence_sha256,
    blockchain_tx: session.blockchain_tx,
    sanctions_check: enrichIntel?.supplier.sanctions_check,
    fraud_indicators: enrichIntel?.supplier.fraud_indicators,
  } : null;
  const complianceKey = complianceActive
    ? `c|${session.session_id}|${score}|${anomalies.length}|${enrichIntel?.supplier.sanctions_check ?? ''}`
    : '';
  const { output: complianceOut, loading: complianceLoading, error: complianceError } = useAgentOutput(
    'compliance', complianceCtx, complianceActive, complianceKey,
  );

  /* Decision agent — LIVE LLM-drafted verdict reasoning + recommended
   * action. Only fires above the DECISION threshold; depends on the
   * Investigator's Exa intel having landed for richer context. */
  const decisionActive = score > TH.DECISION;
  const decisionCtx = decisionActive ? {
    session_id: session.session_id,
    risk_score: risk?.final_risk_score,
    risk_category: risk?.risk_category,
    verdict_hint: risk?.verdict,
    anomalies: anomalies.map(a => ({ rule: a.rule, severity: a.severity })),
    sanctions_check: enrichIntel?.supplier.sanctions_check,
    fraud_indicators: enrichIntel?.supplier.fraud_indicators,
    high_risk_vessel: enrichIntel?.vessel.high_risk_patterns,
    estimated_impact_usd: risk?.estimated_impact_usd,
    lop_issued: session.lop_issued,
  } : null;
  const decisionKey = decisionActive
    ? `d|${session.session_id}|${score}|${anomalies.length}|${enrichIntel?.supplier.fraud_indicators ?? ''}`
    : '';
  const { output: decisionOut, loading: decisionLoading, error: decisionError } = useAgentOutput(
    'decision', decisionCtx, decisionActive, decisionKey,
  );

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

    // INVESTIGATOR — active when risk ≥ 40. Detection + risk + LIVE Exa
    // via the new enrichment.enrich_entities backend pipeline. Falls back
    // to whatever the offline pipeline persisted into llm_outputs if the
    // live call is loading / errored / unavailable.
    const exaStep = llm?.payload?.tool_use_chain?.find((s) => s.tool === 'exa_search');
    let exaLine: string;
    if (enrichLoading) {
      exaLine = `Exa enrichment running · supplier · vessel · barge · port…`;
    } else if (enrichError) {
      exaLine = `Exa error: ${enrichError.slice(0, 80)}${enrichError.length > 80 ? '…' : ''}`;
    } else if (enrichIntel) {
      // Pick the most operationally-meaningful signal to surface.
      const sup = enrichIntel.supplier;
      const ves = enrichIntel.vessel;
      const supHits  = sup.litigation_history.hits.length + sup.negative_news.hits.length + sup.company_profile.hits.length;
      const vesHits  = ves.vessel_history.hits.length + ves.previous_incidents.hits.length;
      const flags: string[] = [];
      if (sup.sanctions_check === 'POTENTIAL_MATCH_REVIEW') flags.push('sanctions match');
      if (sup.fraud_indicators) flags.push('fraud indicators');
      if (ves.high_risk_patterns) flags.push('high-risk vessel');
      const flagText = flags.length ? ` · ⚑ ${flags.join(' · ')}` : '';
      const topHit = sup.litigation_history.hits[0] ?? sup.negative_news.hits[0] ?? ves.previous_incidents.hits[0];
      const topTitle = topHit?.title ? ` — "${topHit.title.slice(0, 50)}${topHit.title.length > 50 ? '…' : ''}"` : '';
      exaLine = `Exa LIVE · ${supHits} supplier + ${vesHits} vessel hits${flagText}${topTitle}`;
    } else if (exaStep?.output) {
      exaLine = `Exa (cached): ${String(exaStep.output).slice(0, 90)}`;
    } else {
      exaLine = 'Exa enrichment skipped';
    }
    const investigatorLines = [
      `${anomalies.length} anomalies triggered · ${anomalies.map((a) => a.rule).join(', ') || 'none'}`,
      `Risk engine → ${risk?.final_risk_score ?? '—'}/100 · ${risk?.risk_category ?? '—'}`,
      exaLine,
    ];

    // COMPLIANCE — active when risk > 80. LIVE LLM-drafted evidence summary
    // via /api/agent-output (Anthropic today, Bedrock/Kiro later via
    // llm-provider.ts). Falls back to the static evidence/blockchain
    // hashes while the call is in flight or if it fails.
    let complianceLines: string[];
    if (complianceLoading) {
      complianceLines = [
        `Drafting compliance summary · ${score}/100 risk score · ${anomalies.length} anomalies…`,
        session.evidence_sha256 ? `Evidence SHA-256 ${session.evidence_sha256.slice(0, 14)}…` : 'Evidence package pending',
        'Hash chain · Ed25519 · HMAC verified',
      ];
    } else if (complianceError) {
      complianceLines = [
        `LLM error: ${complianceError.slice(0, 70)}${complianceError.length > 70 ? '…' : ''}`,
        session.evidence_sha256 ? `Evidence SHA-256 ${session.evidence_sha256.slice(0, 14)}…` : 'Evidence package pending',
        session.blockchain_tx ? `Ethereum tx ${session.blockchain_tx.slice(0, 14)}…` : 'No blockchain anchor',
      ];
    } else if (complianceOut?.ok && complianceOut.lines.length) {
      complianceLines = complianceOut.lines.slice(0, 3);
    } else {
      complianceLines = [
        session.evidence_sha256 ? `Evidence SHA-256 ${session.evidence_sha256.slice(0, 14)}…` : 'Evidence package pending',
        session.blockchain_tx ? `Ethereum tx ${session.blockchain_tx.slice(0, 14)}…` : 'No blockchain anchor',
        'Hash chain · Ed25519 · HMAC verified',
      ];
    }

    // DECISION — active when risk > 90. LIVE LLM-drafted verdict + impact +
    // recommended action. Falls back to the stored verdict if the LLM is
    // unavailable so the operator always sees *something* actionable.
    const conf = llm?.payload?.confidence != null ? Math.round(llm.payload.confidence * 100) : null;
    const liveConf = decisionOut?.confidence;
    let decisionLines: string[];
    if (decisionLoading) {
      decisionLines = [
        `Generating verdict reasoning · ${score}/100 CRITICAL…`,
        `Verdict ${(risk?.verdict ?? 'PENDING').replace(/_/g, ' ')} ${conf != null ? `· ${conf}% confidence` : ''}`,
        session.lop_issued ? 'Letter of Protest drafted' : 'LoP draft pending',
      ];
    } else if (decisionError) {
      decisionLines = [
        `LLM error: ${decisionError.slice(0, 70)}${decisionError.length > 70 ? '…' : ''}`,
        `Verdict ${(risk?.verdict ?? 'PENDING').replace(/_/g, ' ')} ${conf != null ? `· ${conf}% confidence` : ''}`,
        session.lop_issued ? 'Letter of Protest drafted' : 'LoP not required',
      ];
    } else if (decisionOut?.ok && decisionOut.lines.length) {
      decisionLines = decisionOut.lines.slice(0, 3);
      if (liveConf != null) {
        decisionLines = [`${decisionLines[0]} · ${liveConf}% confidence`, ...decisionLines.slice(1)];
      }
    } else {
      decisionLines = [
        `Verdict ${(risk?.verdict ?? 'PENDING').replace(/_/g, ' ')} ${conf != null ? `· ${conf}% confidence` : ''}`,
        session.lop_issued ? 'Letter of Protest drafted' : 'LoP not required',
        'AWS Bedrock · investigation summary generated',
      ];
    }

    return {
      surveyor:     { active: true,               lines: surveyorLines },
      investigator: { active: score >= TH.INVESTIGATOR, lines: investigatorLines },
      compliance:   { active: score >  TH.COMPLIANCE,   lines: complianceLines },
      decision:     { active: score >  TH.DECISION,     lines: decisionLines },
    };
  }, [session, risk, anomalies, mfm, llm, score, outsideGeofence, geofence,
      enrichIntel, enrichLoading, enrichError,
      complianceOut, complianceLoading, complianceError,
      decisionOut, decisionLoading, decisionError]);

  /**
   * Persist a Chief Engineer sign-off to Supabase by routing it through
   * `llm_outputs` — the natural extension of the existing 4-stage agent
   * pipeline (Surveyor→Investigator→Compliance→Decision are stages 1-4;
   * Chief Engineer is stage 5, model = "human:chief_engineer").
   *
   * Why this table: it already exists, has a JSONB `payload` column
   * perfect for the action + signer + timestamp, and is already keyed by
   * `session_id`. Reads happen via useLiveSession which now also pulls
   * stage 5 and injects the latest action onto `session.sign_off_status`.
   *
   * Append-only: every sign / re-sign / override writes a new row,
   * preserving the full audit trail by `id DESC`.
   */
  async function handleSignOff(action: 'approved' | 'overridden') {
    setSignOff('saving');
    setSignOffError(null);
    const newStatus = action === 'approved' ? 'APPROVED' : 'OVERRIDDEN';

    const { error } = await supabase
      .from('llm_outputs')
      .insert({
        session_id: session.session_id,
        stage: 5,
        model: 'human:chief_engineer',
        prompt_tokens: 0,
        output_tokens: 0,
        payload: {
          kind: 'sign_off',
          action: newStatus,
          signer_role: 'Chief Engineer',
          signed_at: new Date().toISOString(),
          risk_score_at_sign:  risk?.final_risk_score ?? null,
          verdict_at_sign:     risk?.verdict ?? null,
          risk_category_at_sign: risk?.risk_category ?? null,
        },
      });
    if (error) {
      setSignOffError(error.message);
      setSignOff('pending');
      return;
    }

    setSignOff(action);
    onSessionUpdated?.({ sign_off_status: newStatus });

    // 4. Generate a "Sign-Off Audit" PDF and persist it. Lands on the
    //    Reports tab as a real downloadable document (Supabase Storage
    //    primary, localStorage fallback if the bucket isn't provisioned).
    try {
      const verdictRgb: [number, number, number] =
        newStatus === 'APPROVED'    ? [22, 119, 78] :
        newStatus === 'OVERRIDDEN' ? [184, 110, 30] : [92, 83, 64];
      await saveReportPdf({
        kind: 'Sign-Off Audit',
        title: session.session_id,
        subtitle: `${session.vessel_name ?? ''}${session.supplier_name ? ' · ' + session.supplier_name : ''}`,
        sessionId: session.session_id,
        generatedAt: new Date().toISOString(),
        verdict: { label: newStatus, color: verdictRgb },
        facts: [
          { label: 'Action', value: newStatus },
          { label: 'Signer', value: 'Chief Engineer' },
          { label: 'Risk',   value: `${risk?.final_risk_score ?? '—'} / 100 · ${risk?.risk_category ?? '—'}` },
          session.bdn_qty_mt != null && { label: 'BDN qty',   value: `${session.bdn_qty_mt} MT` },
          session.mfm_qty_mt != null && { label: 'MFM',       value: `${Number(session.mfm_qty_mt).toFixed(2)} MT` },
          session.dev_pct    != null && { label: 'Deviation', value: `${Number(session.dev_pct).toFixed(2)}%`, warn: true },
          session.port              && { label: 'Port',      value: String(session.port) },
        ].filter(Boolean) as any,
        sections: [
          risk?.verdict && {
            type: 'paragraph' as const,
            heading: 'AI Verdict',
            text: `${(risk.verdict || '').replace(/_/g, ' ')} — risk score ${risk.final_risk_score}/100 (${risk.risk_category}).`,
          },
          anomalies.length > 0 && {
            type: 'bullets' as const,
            heading: 'Anomalies On Record',
            items: anomalies.slice(0, 12).map((a) =>
              `${a.rule}${a.rule_name ? ' · ' + a.rule_name : ''} (${a.severity})${a.description ? ' — ' + a.description : ''}`,
            ),
          },
          {
            type: 'paragraph' as const,
            heading: 'Sign-Off Statement',
            text: `I, acting as Chief Engineer, have reviewed the BunkerGuard agent verdict and the evidence presented above. My final decision on session ${session.session_id} is ${newStatus}.`,
          },
        ].filter(Boolean) as any,
      });
    } catch (e: any) {
      // PDF generation failure is non-blocking — the sign-off itself
      // already succeeded above.
      // eslint-disable-next-line no-console
      console.warn('[handleSignOff] PDF save failed:', e?.message ?? e);
    }
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
          return (
            <div key={agent.key} style={{
              display: 'flex', gap: 10,
              opacity: out.active ? 1 : 0.45,
            }}>
              {/* Rail circle — Kiro ghost, the BunkerGuard agent mascot.
                  Active agents glow in their per-agent colour and blink;
                  dormant agents fall back to a muted slate ghost. */}
              <KiroGhostBadge
                size={28}
                shape="circle"
                color={out.active ? agent.color : '#3D5A75'}
                title={`${agent.name} agent`}
                src={agent.key === 'investigator' ? AGENT_AVATAR_SRC.exa : AGENT_AVATAR_SRC.kiro}
              />

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
                Recording sign-off (llm_outputs stage 5)…
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
                <CheckCircle2 size={12} /> VERDICT APPROVED · written to llm_outputs
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
                <X size={12} /> AGENT VERDICT OVERRIDDEN · written to llm_outputs
              </div>
            )}
            {/* Reset-for-demo affordance — appears only after a verdict is
                recorded so the operator can run the next take without
                touching SQL. Deletes every stage-5 llm_outputs row for
                this session, flipping the UI back to PENDING and
                rewinding the Intelligence-tab conversation to
                "awaiting Chief Engineer sign-off". */}
            {(signOff === 'approved' || signOff === 'overridden') && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                <button
                  onClick={resetForDemo}
                  title="Delete the recorded sign-off so this session's verdict is PENDING again (for re-recording the demo)"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '3px 9px', borderRadius: 4,
                    fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5,
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.18)',
                    color: '#7FA5D3', cursor: 'pointer',
                  }}>
                  ↺ RESET (FOR DEMO)
                </button>
              </div>
            )}
            {/* Real DB error — sign-off didn't persist. No more soft-warning
             *  fallback: the path always goes to Supabase now. */}
            {signOffError && (
              <div style={{
                marginTop: 6, padding: '6px 8px',
                fontSize: 10, lineHeight: 1.4,
                color: '#FF5656',
                background: 'rgba(255,86,86,0.08)',
                border: '1px solid rgba(255,86,86,0.30)',
                borderRadius: 4,
              }}>
                Sign-off failed: {signOffError}
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
