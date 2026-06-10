import { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Play, RotateCcw } from 'lucide-react';
import { EvidenceReportDrawer } from '../evidence/EvidenceReportDrawer';
import { KiroGhostBadge, AGENT_AVATAR_SRC } from '../ai/KiroGhost';
import { useChiefEngineerSignOff, type ChiefEngineerSignOff } from '../../../lib/useChiefEngineerSignOff';

type AgentKey = 'surveyor' | 'investigator' | 'compliance' | 'decision' | 'chief';

const AGENT_META: Record<AgentKey, { glyph: string; name: string; color: string }> = {
  surveyor:     { glyph: 'SV', name: 'Surveyor',       color: '#2EA8FF' },
  investigator: { glyph: 'IV', name: 'Investigator',   color: '#A36CFF' },
  compliance:   { glyph: 'CP', name: 'Compliance',     color: '#FFB84D' },
  decision:     { glyph: 'DC', name: 'Decision',       color: '#34C98C' },
  chief:        { glyph: 'CE', name: 'Chief Engineer', color: '#BFD7F7' },
};

interface Message {
  from: AgentKey;
  to?: AgentKey;
  kind: 'observation' | 'correlation' | 'verdict' | 'broadcast' | 'sign-off';
  body: string;
  payload?: { label: string; value: string; color?: string }[];
  delayMs: number;          // delay BEFORE this message appears (gap after previous)
}

/** Scripted conversation for SES-2026-016 — MAERSK HONAM, Supplier Gamma.
 *  Same session referenced everywhere else in the demo. The first FOUR
 *  messages are AI-agent-to-agent — they auto-play on mount. The fifth
 *  ("Chief Engineer") is NOT scripted — it's derived from the real
 *  `llm_outputs.stage=5` row written by the APPROVE / OVERRIDE buttons
 *  on the Live Session tab, so the demo lands by switching tabs:
 *
 *    1. Show Intelligence → conversation auto-plays through msg 4, pauses
 *       at "Awaiting Chief Engineer sign-off…"
 *    2. Switch to Live Session → hit APPROVE VERDICT (or OVERRIDE)
 *    3. Switch back to Intelligence → Realtime push appends message 5
 *       with the actual action, signer, and timestamp from Supabase.
 */
const AI_TRANSCRIPT: Message[] = [
  {
    from: 'surveyor', to: 'investigator', kind: 'observation', delayMs: 600,
    body: 'MFM Final reads 481.2 MT for SES-2026-016. BDN declares 500.0 MT.',
    payload: [
      { label: 'Δ', value: '−18.8 MT', color: '#E84E4E' },
      { label: 'deviation', value: '3.76%', color: '#E84E4E' },
      { label: 'AIS', value: 'in-zone · stable', color: '#34C98C' },
    ],
  },
  {
    from: 'investigator', to: 'compliance', kind: 'correlation', delayMs: 1400,
    body: 'Cross-ref: Supplier Gamma — 9 of last 22 deliveries flagged. Pattern matches "systematic underfueling".',
    payload: [
      { label: 'pattern match', value: '94%', color: '#A36CFF' },
      { label: 'prior incidents', value: '#012 · #019 · #021', color: '#7FA5D3' },
      { label: 'Exa news', value: 'MPA notice 2026-06-10', color: '#E0A020' },
    ],
  },
  {
    from: 'compliance', to: 'decision', kind: 'verdict', delayMs: 1600,
    body: 'MARPOL Annex VI tolerance 2.00% exceeded (actual 3.76%). ISO 8217 fuel params within spec.',
    payload: [
      { label: 'MARPOL', value: 'FAIL', color: '#E84E4E' },
      { label: 'MPA tolerance', value: 'FAIL', color: '#E84E4E' },
      { label: 'ISO 8217', value: 'PASS', color: '#34C98C' },
    ],
  },
  {
    from: 'decision', to: 'chief', kind: 'broadcast', delayMs: 1500,
    body: 'VERDICT: REFUSE_TO_SIGN BDN. Issue Letter of Protest. Escalate to MPA. Awaiting Chief Engineer sign-off.',
    payload: [
      { label: 'risk score', value: '78 / 100', color: '#E84E4E' },
      { label: 'exposure', value: 'USD 11,280', color: '#E84E4E' },
      { label: 'action', value: 'REFUSE_TO_SIGN', color: '#E84E4E' },
    ],
  },
];

/** Build the Chief Engineer's reply from the real sign-off row. Body +
 *  payload colours flip depending on action. */
function buildChiefMessage(signOff: ChiefEngineerSignOff): Message {
  const isApproved = signOff.action === 'APPROVED';
  const actionColor = isApproved ? '#34C98C' : '#E0A020';
  const verb = isApproved ? 'released BDN for filing' : 'overrode the AI verdict';
  const bodyTail = isApproved
    ? 'Generating evidence package for archive.'
    : 'Override recorded. Audit trail preserved; generating evidence package.';
  const timeStr = (() => {
    try { return new Date(signOff.signed_at).toISOString().slice(11, 19) + 'Z'; }
    catch { return 'just now'; }
  })();
  return {
    from: 'chief', kind: 'sign-off', delayMs: 0,
    body: `${signOff.signer_role} signed off — ${signOff.action}. ${verb}. ${bodyTail}`,
    payload: [
      { label: 'action',  value: signOff.action, color: actionColor },
      { label: 'signed',  value: timeStr,         color: '#7FA5D3' },
      { label: 'signer',  value: signOff.signer_role, color: '#BFD7F7' },
      ...(signOff.risk_score_at_sign != null
        ? [{ label: 'risk at sign', value: `${signOff.risk_score_at_sign}/100`, color: '#7FA5D3' }]
        : []),
    ],
  };
}

interface Props {
  /** session_id passed to the evidence-report drawer when the CTA fires. */
  sessionId: string;
  /** Notify parent so the network edges can light up in sync. */
  onActiveEdgeChange?: (edge: { from: AgentKey; to?: AgentKey } | null) => void;
}

export function AgentConversationStream({ sessionId, onActiveEdgeChange }: Props) {
  const [visible, setVisible] = useState<number>(0);   // # of AI msgs revealed (0–4)
  const [aiDone, setAiDone] = useState(false);          // AI chain finished, awaiting sign-off
  const [reportOpen, setReportOpen] = useState(false);
  const [toast, setToast] = useState<{ agent: AgentKey; text: string } | null>(null);
  const timers = useRef<number[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  // Real Chief Engineer sign-off — pushed via Supabase Realtime when
  // AgentWorkflow.handleSignOff fires on the Live Session tab.
  const signOff = useChiefEngineerSignOff(sessionId);
  const chiefMessage = useMemo(
    () => (signOff ? buildChiefMessage(signOff) : null),
    [signOff],
  );
  // `done` = full conversation visible (AI chain + chief reply)
  const done = aiDone && !!chiefMessage;

  const clearTimers = () => { timers.current.forEach(window.clearTimeout); timers.current = []; };

  const play = () => {
    clearTimers();
    setVisible(0);
    setAiDone(false);
    let acc = 0;
    AI_TRANSCRIPT.forEach((m, i) => {
      acc += m.delayMs;
      timers.current.push(window.setTimeout(() => {
        setVisible(i + 1);
        const receiver = m.to ?? m.from;
        setToast({ agent: receiver, text: `${AGENT_META[receiver].name} received` });
        onActiveEdgeChange?.({ from: m.from, to: m.to });
        timers.current.push(window.setTimeout(() => setToast(null), 1100));
        timers.current.push(window.setTimeout(() => {
          listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
        }, 50));
        if (i === AI_TRANSCRIPT.length - 1) {
          timers.current.push(window.setTimeout(() => {
            setAiDone(true);
            onActiveEdgeChange?.(null);
          }, 800));
        }
      }, acc));
    });
  };

  // Auto-play once on mount
  useEffect(() => {
    const t = window.setTimeout(play, 350);
    return () => { window.clearTimeout(t); clearTimers(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the real sign-off arrives AFTER the AI chain has finished, pop
  // the toast and light the Decision→Chief edge briefly so the audience
  // sees the cross-tab update happen.
  useEffect(() => {
    if (!aiDone || !chiefMessage) return;
    setToast({ agent: 'chief', text: chiefMessage.payload?.[0]?.value ?? 'Signed off' });
    onActiveEdgeChange?.({ from: 'decision', to: 'chief' });
    const t1 = window.setTimeout(() => setToast(null), 1400);
    const t2 = window.setTimeout(() => onActiveEdgeChange?.(null), 1800);
    const t3 = window.setTimeout(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }, 80);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); window.clearTimeout(t3); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiDone, chiefMessage?.body]);

  return (
    <div style={{
      background: 'linear-gradient(180deg, #102033 0%, #0E1C2D 100%)',
      border: '1px solid rgba(255,255,255,0.09)',
      borderRadius: 10,
      overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
    }}>
      {/* Header */}
      <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: done ? '#34C98C' : aiDone ? '#FFB84D' : '#2EA8FF', animation: 'livePulse 2s ease-in-out infinite', boxShadow: `0 0 8px ${done ? '#34C98C' : aiDone ? '#FFB84D' : '#2EA8FF'}` }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#EAF4FF' }}>Agent Conversation · {sessionId}</div>
            <div style={{ fontSize: 9, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {done
                ? '5 / 5 messages · chain complete'
                : aiDone
                ? '4 / 5 messages · awaiting Chief Engineer sign-off'
                : `${visible} / ${AI_TRANSCRIPT.length} AI messages · streaming`}
            </div>
          </div>
        </div>
        <button
          onClick={play}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, background: 'rgba(46,168,255,0.10)', border: '1px solid rgba(46,168,255,0.30)', color: '#2EA8FF', fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 140ms' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(46,168,255,0.20)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(46,168,255,0.10)'; }}
        >
          {done ? <><RotateCcw className="w-3 h-3" />Replay</> : <><Play className="w-3 h-3" />Restart</>}
        </button>
      </div>

      {/* Notification toast — pops over the message list */}
      {toast && (
        <div style={{
          position: 'absolute', top: 56, right: 18, zIndex: 5,
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', borderRadius: 7,
          background: `${AGENT_META[toast.agent].color}1C`,
          border: `1px solid ${AGENT_META[toast.agent].color}55`,
          boxShadow: `0 4px 16px ${AGENT_META[toast.agent].color}30`,
          animation: 'fadeInRight 240ms ease-out',
        }}>
          {/* Toast avatar — Kiro ghost (or Exa logo for Investigator). */}
          <KiroGhostBadge
            size={18}
            color={AGENT_META[toast.agent].color}
            shape="rounded"
            src={toast.agent === 'investigator' ? AGENT_AVATAR_SRC.exa : AGENT_AVATAR_SRC.kiro}
          />

          <span style={{ fontSize: 10, fontWeight: 700, color: AGENT_META[toast.agent].color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{toast.text}</span>
        </div>
      )}

      {/* Message list */}
      <div ref={listRef} style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto', minHeight: 200 }}>
        {/* Compose the visible transcript: the first `visible` AI messages
            plus the chief reply once the real sign-off has landed. The
            chief message is intentionally rendered AFTER the AI ones so
            the audience reads top-to-bottom: observation → correlation →
            verdict → broadcast → (real) sign-off. */}
        {([
          ...AI_TRANSCRIPT.slice(0, visible),
          ...(aiDone && chiefMessage ? [chiefMessage] : []),
        ] as Message[]).map((m, i) => {
          const from = AGENT_META[m.from];
          const to = m.to ? AGENT_META[m.to] : null;
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6, animation: 'fadeInUp 280ms ease-out' }}>
              {/* Header line: SV → IV · OBSERVATION · 17:42:0X */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '2px 8px 2px 4px', borderRadius: 4,
                  background: `${from.color}18`, border: `1px solid ${from.color}38`,
                  color: from.color, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
                }}>
                  <KiroGhostBadge size={14} color={from.color} shape="rounded" src={m.from === 'investigator' ? AGENT_AVATAR_SRC.exa : AGENT_AVATAR_SRC.kiro} /> {from.name}
                </span>
                {to && (
                  <>
                    <span style={{ color: '#4E7A9A', fontSize: 12 }}>→</span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '2px 8px 2px 4px', borderRadius: 4,
                      background: `${to.color}18`, border: `1px solid ${to.color}38`,
                      color: to.color, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
                    }}>
                      <KiroGhostBadge size={14} color={to.color} shape="rounded" src={m.to === 'investigator' ? AGENT_AVATAR_SRC.exa : AGENT_AVATAR_SRC.kiro} /> {to.name}
                    </span>
                  </>
                )}
                <span style={{ marginLeft: 'auto', fontSize: 9, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>{m.kind}</span>
              </div>
              {/* Body text */}
              <div style={{
                padding: '10px 12px',
                borderRadius: 7,
                background: 'rgba(4,10,18,0.55)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderLeft: `3px solid ${from.color}`,
                fontSize: 12,
                color: '#EAF4FF',
                lineHeight: 1.5,
              }}>
                {m.body}
                {m.payload && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                    {m.payload.map((p, j) => (
                      <div key={j} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '3px 9px', borderRadius: 12,
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        fontSize: 10,
                      }}>
                        <span style={{ color: '#7FA5D3' }}>{p.label}:</span>
                        <span style={{ color: p.color ?? '#BFD7F7', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{p.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Empty / pending state */}
        {visible === 0 && (
          <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 11, color: '#5A8AB4' }}>
            Streaming agent conversation…
          </div>
        )}

        {/* Awaiting Chief Engineer sign-off — the chain has paused after
            message 4 ("Awaiting Chief Engineer sign-off"). Shown until a
            real llm_outputs.stage=5 row lands via Supabase Realtime. */}
        {aiDone && !chiefMessage && (
          <div style={{
            marginTop: 4,
            padding: '12px 14px',
            borderRadius: 8,
            background: 'linear-gradient(180deg, rgba(255,184,77,0.08), rgba(255,184,77,0.02))',
            border: '1px dashed rgba(255,184,77,0.45)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: '#FFB84D',
              animation: 'livePulse 1.4s ease-in-out infinite',
              boxShadow: '0 0 10px rgba(255,184,77,0.9)',
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#FFB84D', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Awaiting Chief Engineer sign-off
              </div>
              <div style={{ fontSize: 10.5, color: '#BFD7F7', marginTop: 2, lineHeight: 1.4 }}>
                Open <strong style={{ color: '#EAF4FF' }}>Live Session</strong> → click
                <strong style={{ color: '#34C98C' }}> APPROVE VERDICT</strong> or
                <strong style={{ color: '#E84E4E' }}> OVERRIDE</strong>.
                The decision lands here in real-time via <code style={{ color: '#7FA5D3' }}>llm_outputs</code> Realtime.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer — Evidence Report CTA appears after chain completes */}
      {done && (
        <div style={{
          padding: '12px 18px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          background: 'linear-gradient(135deg, rgba(46,168,255,0.06), rgba(0,217,142,0.06))',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#EAF4FF', marginBottom: 2 }}>Conversation closed · ready for evidence package</div>
            <div style={{ fontSize: 10, color: '#7FA5D3' }}>4-agent chain produced verdict + audit trail. Generate signed PDF for MPA filing.</div>
          </div>
          <button
            onClick={() => setReportOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 16px', borderRadius: 7,
              background: 'linear-gradient(135deg, rgba(46,168,255,0.20), rgba(0,217,142,0.20))',
              border: '1px solid rgba(46,168,255,0.50)',
              color: '#2EA8FF', fontSize: 11, fontWeight: 800,
              cursor: 'pointer', whiteSpace: 'nowrap',
              boxShadow: '0 4px 14px rgba(46,168,255,0.18)',
              transition: 'all 160ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 22px rgba(46,168,255,0.30)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(46,168,255,0.18)'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <FileText className="w-4 h-4" /> Generate Evidence Report
          </button>
        </div>
      )}

      {reportOpen && (
        <EvidenceReportDrawer sessionId={sessionId} open={reportOpen} onClose={() => setReportOpen(false)} />
      )}
    </div>
  );
}
