import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { Bot, Send, Sparkles, X, Command } from 'lucide-react';
import { useCopilotContext } from '../../lib/useCopilotContext';
import { useCopilotSessions } from '../../lib/useCopilotSessions';

const RAIL_WIDTH_PX = 380;
const OVERLAY_BREAKPOINT_PX = 1100;

interface ToolCall {
  name: string;
  args?: Record<string, any>;
  result?: Record<string, any>;
}

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCall[];
}

const SUGGESTIONS = [
  'Do I sign this BDN?',
  'Plot the cumulative flow.',
  'Why is the score this high?',
  'Draft the LOP.',
];

const SYSTEM_PROMPT = `You are BunkerGuard Copilot, an assistant for a Chief Engineer monitoring marine bunkering operations in Singapore. The user is at the dashboard looking at live sessions, suppliers, and anomalies. Be terse, concrete, and back every claim with the specific session_id, supplier name, rule code, or risk number from the CONTEXT block below. If the user asks something not covered by the context, say so plainly. Never invent vessel names, numbers, or verdicts. Format multi-line answers with short markdown bullets.`;

interface PortCopilotProps {
  /** Force the copilot into tool-mode for this session, regardless of route.
   *  Mounted pages that already have a focused session (Dashboard's top-risk
   *  card, EvidenceCenter, etc.) should pass it here. */
  sessionId?: string;
}

export function PortCopilot({ sessionId: sessionIdProp }: PortCopilotProps = {}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [providerLabel, setProviderLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { text: contextText, loading: ctxLoading } = useCopilotContext();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Tool-mode resolution priority:
  //   1. user override via the picker chip (manualSessionId)
  //   2. explicit prop from the parent page (Dashboard top-risk card etc.)
  //   3. /sessions/:sessionId route param
  //   4. top-risk session from Supabase (so the bar is *always* tool-mode)
  const params = useParams<{ sessionId?: string }>();
  const { sessions: pickerSessions } = useCopilotSessions(12);
  const [manualSessionId, setManualSessionId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const sessionId =
    manualSessionId ?? sessionIdProp ?? params.sessionId ?? pickerSessions[0]?.session_id;
  const toolMode = Boolean(sessionId);
  const focusedSession = pickerSessions.find((s) => s.session_id === sessionId);

  // Rail vs overlay — wide viewports push content left; small viewports overlay
  // so the dashboard isn't crushed.
  const [isWide, setIsWide] = useState(() =>
    typeof window === 'undefined' ? true : window.innerWidth >= OVERLAY_BREAKPOINT_PX,
  );
  useEffect(() => {
    const onResize = () => setIsWide(window.innerWidth >= OVERLAY_BREAKPOINT_PX);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Push the dashboard content left while the rail is open (wide viewport only).
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const body = document.body;
    if (open && isWide) {
      body.style.transition = 'padding-right 220ms ease-out';
      body.style.paddingRight = `${RAIL_WIDTH_PX}px`;
    } else {
      body.style.paddingRight = '';
    }
    return () => { body.style.paddingRight = ''; };
  }, [open, isWide]);

  // Cmd/Ctrl + K toggles. Esc closes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  async function send(prompt: string) {
    const text = prompt.trim();
    if (!text || busy) return;
    setError(null);
    const next: ChatMsg[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setBusy(true);

    try {
      if (toolMode && sessionId) {
        // Tool-mode: backend runs Claude with the 8-tool surface.
        const history = messages.flatMap((m) => {
          const turns: any[] = [{ role: m.role, content: { text: m.content } }];
          for (const tc of m.toolCalls ?? []) {
            turns.push({ role: 'tool', content: tc });
          }
          return turns;
        });
        const res = await fetch('/api/copilot-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId, question: text, history }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.ok === false) {
          throw new Error(data?.error ?? `chat proxy ${res.status}`);
        }
        setProviderLabel(`Anthropic · ${data?.usage?.model ?? 'tool-mode'}`);
        setMessages([...next, {
          role: 'assistant',
          content: data.answer || '(empty)',
          toolCalls: data.tool_calls ?? [],
        }]);
      } else {
        // Fallback: multi-session text-context chat (the original path).
        const sys = `${SYSTEM_PROMPT}\n\n## CONTEXT — live Supabase snapshot\n${contextText}`;
        const res = await fetch('/api/copilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ system: sys, messages: next, maxTokens: 700 }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? `proxy ${res.status}`);
        }
        const data = await res.json();
        setProviderLabel(data?.provider ?? null);
        setMessages([...next, { role: 'assistant', content: data.text ?? '(empty)' }]);
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setMessages([...next, {
        role: 'assistant',
        content: '⚠ Copilot proxy unavailable — set ANTHROPIC_API_KEY in your environment and restart Vite. Falling back to the live context snapshot only.',
      }]);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed', bottom: 22, right: 22, zIndex: 60,
          padding: '10px 14px',
          borderRadius: 28,
          background: 'linear-gradient(135deg, rgba(46,168,255,0.95), rgba(111,91,255,0.95))',
          border: '1px solid rgba(255,255,255,0.18)',
          boxShadow: '0 6px 24px rgba(46,168,255,0.45)',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
          backdropFilter: 'blur(10px)',
        }}
        title="BunkerGuard Copilot — Cmd/Ctrl + K"
      >
        <Bot size={18} />
        <span>Copilot</span>
        <kbd style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9.5, fontWeight: 700,
          padding: '1px 5px',
          background: 'rgba(255,255,255,0.18)',
          border: '1px solid rgba(255,255,255,0.25)',
          borderRadius: 3,
          color: '#fff',
        }}>⌘K</kbd>
      </button>
    );
  }

  const railStyle: React.CSSProperties = isWide
    ? {
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: RAIL_WIDTH_PX,
        borderRadius: 0,
        borderLeft: '1px solid rgba(46,168,255,0.32)',
        boxShadow: '-8px 0 30px rgba(0,0,0,0.45)',
        animation: 'copilotSlideIn 220ms ease-out',
      }
    : {
        position: 'fixed', bottom: 16, right: 16, top: 80, left: 16,
        borderRadius: 12,
        border: '1px solid rgba(46,168,255,0.40)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
        animation: 'copilotSlideIn 220ms ease-out',
      };

  return (
    <div style={{
      zIndex: 70,
      ...railStyle,
      background: 'rgba(10,23,38,0.78)',
      backdropFilter: 'blur(22px) saturate(140%)',
      WebkitBackdropFilter: 'blur(22px) saturate(140%)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes copilotSlideIn {
          from { transform: translateX(20px); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
      `}</style>
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid rgba(46,168,255,0.18)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: 'linear-gradient(135deg, #2EA8FF, #6F5BFF)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Bot size={16} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#E5F2FF' }}>BunkerGuard Copilot</div>
          <div style={{ fontSize: 9, color: '#7FA5D3', letterSpacing: 0.6 }}>
            {providerLabel ?? 'Provider: Anthropic / AWS Bedrock (swappable)'}
            {ctxLoading ? ' · loading context…' : ` · ${contextText.length} chars context`}
          </div>
        </div>
        <kbd
          title="Toggle with Cmd/Ctrl + K · Close with Esc"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9, fontWeight: 700,
            padding: '2px 6px',
            background: 'rgba(46,168,255,0.10)',
            border: '1px solid rgba(46,168,255,0.30)',
            borderRadius: 3,
            color: '#7FA5D3',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <Command size={9} /> K
        </kbd>
        <button
          onClick={() => setOpen(false)}
          title="Close (Esc)"
          style={{
            background: 'transparent', border: 'none', color: '#7FA5D3', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Session selector chip — lets the officer switch the focused session
          on any page without leaving it. The label shows the active vessel
          so it's obvious which session the next answer applies to. */}
      <div style={{
        padding: '8px 14px',
        borderBottom: '1px solid rgba(46,168,255,0.12)',
        position: 'relative',
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 11, color: '#7FA5D3',
      }}>
        <span style={{ letterSpacing: 0.6 }}>FOCUS</span>
        <button
          onClick={() => setPickerOpen((v) => !v)}
          style={{
            padding: '4px 10px',
            background: 'rgba(46,168,255,0.10)',
            border: '1px solid rgba(46,168,255,0.35)',
            borderRadius: 999,
            color: '#E5F2FF', fontSize: 11, fontWeight: 600,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
          {sessionId ? (
            <>
              <span>{sessionId}</span>
              {focusedSession?.vessel_name && (
                <span style={{ color: '#7FA5D3', fontWeight: 500 }}>
                  · {focusedSession.vessel_name}
                </span>
              )}
            </>
          ) : (
            <span style={{ color: '#7FA5D3' }}>no session — pick one</span>
          )}
          <span style={{ color: '#7FA5D3' }}>▾</span>
        </button>
        {pickerOpen && pickerSessions.length > 0 && (
          <div style={{
            position: 'absolute', top: 36, left: 14, right: 14,
            maxHeight: 260, overflowY: 'auto',
            background: 'rgba(10,23,38,0.96)',
            border: '1px solid rgba(46,168,255,0.30)',
            borderRadius: 8, zIndex: 5,
            boxShadow: '0 10px 30px rgba(0,0,0,0.55)',
          }}>
            {pickerSessions.map((s) => (
              <button key={s.session_id}
                onClick={() => {
                  setManualSessionId(s.session_id);
                  setPickerOpen(false);
                  setMessages([]);  // fresh chat per session
                }}
                style={{
                  width: '100%', textAlign: 'left',
                  padding: '8px 10px',
                  background: s.session_id === sessionId
                    ? 'rgba(46,168,255,0.18)'
                    : 'transparent',
                  border: 'none',
                  borderBottom: '1px solid rgba(46,168,255,0.08)',
                  color: '#E5F2FF', fontSize: 11,
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', gap: 2,
                }}>
                <span><b>{s.session_id}</b> · {s.vessel_name ?? '—'}</span>
                <span style={{ fontSize: 10, color: '#7FA5D3' }}>
                  {s.supplier_name ?? '—'} · risk {s.risk_score ?? '—'}/100 ·{' '}
                  {s.verdict ?? '—'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 && (
          <>
            <div style={{ fontSize: 11, color: '#7FA5D3', lineHeight: 1.5 }}>
              I'm watching the live <strong style={{ color: '#E5F2FF' }}>sessions</strong>, <strong style={{ color: '#E5F2FF' }}>anomalies</strong>, and <strong style={{ color: '#E5F2FF' }}>suppliers</strong> tables in Supabase. Ask me anything about the current port state, or try one of these:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              {SUGGESTIONS.map((s) => (
                <button key={s}
                  onClick={() => send(s)}
                  style={{
                    textAlign: 'left',
                    padding: '8px 10px',
                    fontSize: 11, fontWeight: 500,
                    background: 'rgba(46,168,255,0.10)',
                    border: '1px solid rgba(46,168,255,0.28)',
                    color: '#E5F2FF',
                    borderRadius: 6,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                  <Sparkles size={11} style={{ color: '#2EA8FF' }} />
                  {s}
                </button>
              ))}
            </div>
          </>
        )}

        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '92%',
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <div style={{
              padding: '8px 12px',
              background: m.role === 'user' ? 'rgba(46,168,255,0.20)' : 'rgba(127,165,211,0.10)',
              border: `1px solid ${m.role === 'user' ? 'rgba(46,168,255,0.45)' : 'rgba(127,165,211,0.25)'}`,
              borderRadius: 8,
              fontSize: 12, lineHeight: 1.45,
              color: '#E5F2FF',
              whiteSpace: 'pre-wrap',
            }}>
              {m.content}
            </div>
            {(m.toolCalls ?? []).map((tc, j) => (
              <ToolArtifact key={j} call={tc} onPrompt={send} />
            ))}
          </div>
        ))}

        {busy && (
          <div style={{
            alignSelf: 'flex-start',
            padding: '8px 12px',
            background: 'rgba(127,165,211,0.08)',
            border: '1px solid rgba(127,165,211,0.2)',
            borderRadius: 8,
            fontSize: 11, color: '#7FA5D3',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#2EA8FF', animation: 'livePulse 1.2s ease-in-out infinite' }} />
            thinking…
          </div>
        )}

        {error && (
          <div style={{ fontSize: 10, color: '#FF7B7B', padding: '4px 0' }}>
            {error}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        style={{
          padding: 10, display: 'flex', gap: 6,
          borderTop: '1px solid rgba(46,168,255,0.18)',
        }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about a session, supplier, or rule…"
          style={{
            flex: 1,
            padding: '8px 10px',
            background: 'rgba(8,19,31,0.6)',
            border: '1px solid rgba(46,168,255,0.25)',
            borderRadius: 6,
            color: '#E5F2FF',
            fontSize: 12,
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          style={{
            padding: '0 12px',
            background: 'linear-gradient(135deg, #2EA8FF, #6F5BFF)',
            border: 'none',
            borderRadius: 6,
            color: '#fff',
            cursor: busy || !input.trim() ? 'not-allowed' : 'pointer',
            opacity: busy || !input.trim() ? 0.45 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}

/**
 * Renders one tool-call result inline below the assistant bubble.
 * Per-tool rendering: show_chart → <img>, generate_evidence_pdf → download
 * link, draft_lop → collapsible markdown, get_verdict_brief → styled card,
 * show_anomaly → measured vs expected card, cite → quote, errors → caption.
 */
function ToolArtifact({
  call,
  onPrompt,
}: {
  call: ToolCall;
  onPrompt: (prompt: string) => void;
}) {
  const r = call.result ?? {};
  if (r.error) {
    const availAnoms: Array<{ rule_id: string; name: string; severity: string }> =
      Array.isArray(r.available_anomalies) ? r.available_anomalies : [];
    const availKinds: Array<{ kind: string; label: string; desc: string }> =
      Array.isArray(r.available_kinds) ? r.available_kinds : [];
    return (
      <div style={{
        fontSize: 11, color: '#FFD2D2',
        padding: 10,
        background: 'rgba(255,123,123,0.08)',
        border: '1px solid rgba(255,123,123,0.30)',
        borderLeft: '3px solid #FF7B7B',
        borderRadius: 8,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div>
          ⚠ <code style={{ color: '#FFB8B8' }}>{call.name}</code> · {String(r.error)}
        </div>
        {r.hint && (
          <div style={{ color: '#E5F2FF', fontSize: 11, opacity: 0.85 }}>
            {String(r.hint)}
          </div>
        )}
        {/* show_chart fallback — one-click jump to the chart that DOES work */}
        {r.fallback_kind && (
          <button
            onClick={() => onPrompt(`Show the ${r.fallback_kind} chart.`)}
            style={chipStyle('action')}>
            ▶ {String(r.fallback_label || `Show ${r.fallback_kind}`)}
          </button>
        )}
        {/* show_anomaly fallback — chips of every rule that DID fire */}
        {availAnoms.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {availAnoms.map((a) => (
              <button key={a.rule_id}
                onClick={() => onPrompt(`Why ${a.rule_id}?`)}
                title={a.name}
                style={chipStyle(sevTone(a.severity))}>
                {a.rule_id} · {a.severity}
              </button>
            ))}
          </div>
        )}
        {/* show_chart "unknown kind" — chips for the valid kinds */}
        {availKinds.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {availKinds.map((k) => (
              <button key={k.kind}
                onClick={() => onPrompt(`Show the ${k.kind} chart.`)}
                title={k.desc}
                style={chipStyle('action')}>
                {k.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
  const assetSrc = r.asset_relpath
    ? `/api/copilot-asset/${r.asset_relpath}`
    : null;

  if (call.name === 'show_chart' && assetSrc) {
    return (
      <figure style={{
        margin: 0, padding: 6,
        background: 'rgba(8,19,31,0.55)',
        border: '1px solid rgba(46,168,255,0.25)',
        borderRadius: 8,
      }}>
        <img src={assetSrc} alt={r.caption ?? call.name}
             style={{ width: '100%', borderRadius: 4, display: 'block' }} />
        {r.caption && (
          <figcaption style={{ fontSize: 10, color: '#7FA5D3', marginTop: 4 }}>
            {String(r.caption)}
          </figcaption>
        )}
      </figure>
    );
  }
  if (call.name === 'generate_evidence_pdf' && assetSrc) {
    return (
      <a href={assetSrc} target="_blank" rel="noopener noreferrer"
         style={{
           fontSize: 11, color: '#2EA8FF', textDecoration: 'none',
           padding: '6px 10px',
           background: 'rgba(46,168,255,0.10)',
           border: '1px solid rgba(46,168,255,0.30)',
           borderRadius: 6,
           display: 'inline-flex', alignItems: 'center', gap: 6,
         }}>
        📄 Download evidence PDF
      </a>
    );
  }
  if (call.name === 'draft_lop' && r.body) {
    return (
      <details style={{
        fontSize: 11, color: '#E5F2FF',
        padding: '6px 10px',
        background: 'rgba(244,194,13,0.06)',
        border: '1px solid rgba(244,194,13,0.30)',
        borderRadius: 6,
      }}>
        <summary style={{ cursor: 'pointer', color: '#F4C20D' }}>📝 Letter of Protest draft</summary>
        <pre style={{ marginTop: 8, fontSize: 11, whiteSpace: 'pre-wrap' }}>
          {String(r.body)}
        </pre>
      </details>
    );
  }
  if (call.name === 'get_verdict_brief') {
    const v = String(r.verdict ?? '—');
    const tone =
      v === 'SIGN' ? '#2ECC71' :
      v === 'SIGN_WITH_NOTES' ? '#F4C20D' :
      v === 'SIGN_WITH_LOP' ? '#FF7F0E' :
      v === 'REFUSE_TO_SIGN' ? '#E84118' : '#9AA0A6';
    return (
      <div style={{
        fontSize: 11, padding: 10,
        background: 'rgba(8,19,31,0.55)',
        border: `1px solid ${tone}80`,
        borderLeft: `4px solid ${tone}`,
        borderRadius: 8,
        color: '#E5F2FF',
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: tone }}>
          {v.replace(/_/g, ' ')} · {r.risk_score ?? '—'}/100
        </div>
        {r.headline && <div style={{ marginTop: 4 }}>{String(r.headline)}</div>}
        {Array.isArray(r.top_reasons) && r.top_reasons.length > 0 && (
          <ul style={{ margin: '6px 0 0', paddingLeft: 16, color: '#C4D8EE' }}>
            {r.top_reasons.map((t: any, i: number) => (
              <li key={i}><b>{t.rule_id}</b> · {t.name} ({t.severity})</li>
            ))}
          </ul>
        )}
        {Array.isArray(r.checklist) && r.checklist.length > 0 && (
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 9, color: '#7FA5D3', letterSpacing: 0.4 }}>DO THIS NOW</div>
            {r.checklist.map((c: any, i: number) => (
              <div key={i} style={{ fontSize: 11 }}>⬜ {c.text}</div>
            ))}
          </div>
        )}
      </div>
    );
  }
  if (call.name === 'show_anomaly') {
    return (
      <div style={{
        fontSize: 11, padding: 8,
        background: 'rgba(8,19,31,0.55)',
        border: '1px solid rgba(127,165,211,0.30)',
        borderRadius: 6,
        color: '#E5F2FF',
      }}>
        <div style={{ fontWeight: 700 }}>
          {String(r.rule_id ?? '—')} · {String(r.name ?? '')} ({String(r.severity ?? '')})
        </div>
        {r.description && <div style={{ marginTop: 4 }}>{String(r.description)}</div>}
        {r.measured != null && r.reference != null && (
          <div style={{ marginTop: 4, color: '#C4D8EE' }}>
            measured <b>{String(r.measured)}{r.unit}</b> vs expected{' '}
            <b>{String(r.reference)}{r.unit}</b>
            {r.deviation_pct != null && ` (${Number(r.deviation_pct).toFixed(2)}%)`}
          </div>
        )}
        {r.regulatory_basis && (
          <div style={{ fontSize: 10, color: '#7FA5D3', marginTop: 4 }}>
            {String(r.regulatory_basis)}
          </div>
        )}
      </div>
    );
  }
  if (call.name === 'cite') {
    return (
      <blockquote style={{
        margin: 0, padding: '8px 10px',
        fontSize: 11, color: '#E5F2FF',
        background: 'rgba(46,168,255,0.06)',
        borderLeft: '3px solid #2EA8FF',
        borderRadius: 4,
      }}>
        <div style={{ fontWeight: 700 }}>{String(r.rule_id)} — {String(r.name)}</div>
        <div style={{ fontSize: 10, color: '#7FA5D3', marginTop: 2 }}>{String(r.regulatory_basis)}</div>
        <div style={{ marginTop: 4, fontStyle: 'italic' }}>{String(r.citation)}</div>
      </blockquote>
    );
  }
  // Fallback: compact JSON
  return (
    <details style={{
      fontSize: 10, color: '#7FA5D3',
      padding: '4px 8px',
      background: 'rgba(127,165,211,0.05)',
      border: '1px solid rgba(127,165,211,0.20)',
      borderRadius: 6,
    }}>
      <summary style={{ cursor: 'pointer' }}>🔧 {call.name}</summary>
      <pre style={{ marginTop: 6, fontSize: 10, whiteSpace: 'pre-wrap' }}>
        {JSON.stringify(r, null, 2)}
      </pre>
    </details>
  );
}

/** Tone palette for the inline chips inside tool-error cards. */
function chipStyle(tone: 'action' | 'critical' | 'high' | 'medium' | 'low'): React.CSSProperties {
  const palette = {
    action:   { bg: 'rgba(46,168,255,0.15)', bd: 'rgba(46,168,255,0.45)', fg: '#E5F2FF' },
    critical: { bg: 'rgba(232,65,24,0.18)',  bd: 'rgba(232,65,24,0.55)',  fg: '#FFD2D2' },
    high:     { bg: 'rgba(255,127,14,0.18)', bd: 'rgba(255,127,14,0.55)', fg: '#FFE3C0' },
    medium:   { bg: 'rgba(244,194,13,0.18)', bd: 'rgba(244,194,13,0.55)', fg: '#FFEFB8' },
    low:      { bg: 'rgba(46,204,113,0.18)', bd: 'rgba(46,204,113,0.55)', fg: '#D4F5E1' },
  }[tone];
  return {
    padding: '4px 9px',
    background: palette.bg,
    border: `1px solid ${palette.bd}`,
    color: palette.fg,
    borderRadius: 999,
    fontSize: 10.5, fontWeight: 600,
    cursor: 'pointer',
  };
}

function sevTone(sev?: string): 'critical' | 'high' | 'medium' | 'low' {
  switch ((sev || '').toUpperCase()) {
    case 'CRITICAL': return 'critical';
    case 'HIGH':     return 'high';
    case 'MEDIUM':   return 'medium';
    default:         return 'low';
  }
}
