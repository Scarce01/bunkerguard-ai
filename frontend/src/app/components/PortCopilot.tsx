import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { Bot, Send, Sparkles, X, Command } from 'lucide-react';
import { useCopilotContext } from '../../lib/useCopilotContext';
import { useCopilotSessions } from '../../lib/useCopilotSessions';
import { useFocusedSessionContext } from '../../lib/useFocusedSessionContext';
import { apiUrl } from '../../lib/api';

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

const SYSTEM_PROMPT = `You are BunkerGuard Copilot, an assistant for a Chief Engineer monitoring marine bunkering operations in Singapore. The user is at the dashboard looking at live sessions, suppliers, and anomalies. Be terse, concrete, and back every claim with the specific session_id, supplier name, rule code, or risk number from the CONTEXT block below. If the user asks something not covered by the context, say so plainly. Never invent vessel names, numbers, or verdicts. Format multi-line answers with short markdown bullets.

FOCUS RULES — apply when an "ACTIVE SESSION" block is present in CONTEXT:
1. Treat the ACTIVE SESSION as the default investigation target.
2. Answer every interpretive question ("why is the score this high", "do I sign this", "what next") about that session immediately, drawing from its risk breakdown, triggered anomalies, supplier signals, and evidence signals.
3. Do NOT ask the user to specify a session. The focus is already chosen.
4. Switch targets ONLY if the user explicitly names a different session_id.
5. When citing facts, prefix with the active session_id so the source is unambiguous.`;

interface PortCopilotProps {
  /** Force the copilot into tool-mode for this session, regardless of route.
   *  Mounted pages that already have a focused session (Dashboard's top-risk
   *  card, EvidenceCenter, etc.) should pass it here. */
  sessionId?: string;
}

function CopilotLauncher({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      className="bunkerguard-copilot-trigger"
      onClick={onOpen}
      aria-label="Open BunkerGuard Copilot"
      style={{
        position: 'fixed', bottom: 22, right: 22, zIndex: 60,
        width: 92, height: 92,
        padding: 0,
        borderRadius: '50%',
        background: 'transparent',
        border: 0,
        cursor: 'pointer',
        display: 'grid',
        placeItems: 'center',
      }}
      title="BunkerGuard Copilot — Cmd/Ctrl + K"
    >
      <style>{`
        @keyframes copilotOrbitClockwise {
          to { transform: rotate(360deg); }
        }
        @keyframes copilotOrbitCounterClockwise {
          to { transform: rotate(-360deg); }
        }
        @keyframes copilotOrbBreathe {
          0%, 100% {
            opacity: 0.82;
            transform: scale(0.96);
            box-shadow:
              0 0 10px rgba(74, 200, 255, 0.24),
              0 0 24px rgba(74, 200, 255, 0.08);
          }
          50% {
            opacity: 1;
            transform: scale(1);
            box-shadow:
              0 0 14px rgba(74, 200, 255, 0.34),
              0 0 30px rgba(74, 200, 255, 0.12);
          }
        }
        .bunkerguard-copilot-trigger:focus-visible .copilot-core {
          outline: 2px solid rgba(74, 200, 255, 0.72);
          outline-offset: 4px;
        }
        .bunkerguard-copilot-trigger:hover .copilot-core {
          border-color: rgba(74, 200, 255, 0.34);
          background: linear-gradient(145deg, rgba(18, 43, 65, 0.92), rgba(7, 20, 34, 0.96));
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 10px 32px rgba(0, 0, 0, 0.38),
            0 0 24px rgba(74, 200, 255, 0.10);
        }
        @media (prefers-reduced-motion: reduce) {
          .copilot-orbit,
          .copilot-orb {
            animation: none !important;
          }
        }
      `}</style>

      <svg
        className="copilot-orbit"
        aria-hidden="true"
        viewBox="0 0 92 92"
        style={{
          position: 'absolute',
          inset: 0,
          width: 92,
          height: 92,
          animation: 'copilotOrbitClockwise 28s linear infinite',
          transformOrigin: '50% 50%',
          pointerEvents: 'none',
        }}
      >
        <circle
          cx="46"
          cy="46"
          r="42"
          fill="none"
          stroke="rgba(74, 200, 255, 0.18)"
          strokeWidth="1"
          strokeDasharray="6 10"
          strokeLinecap="round"
        />
      </svg>

      <svg
        className="copilot-orbit"
        aria-hidden="true"
        viewBox="0 0 92 92"
        style={{
          position: 'absolute',
          inset: 0,
          width: 92,
          height: 92,
          animation: 'copilotOrbitCounterClockwise 36s linear infinite',
          transformOrigin: '50% 50%',
          pointerEvents: 'none',
        }}
      >
        <circle
          cx="46"
          cy="46"
          r="37"
          fill="none"
          stroke="rgba(74, 200, 255, 0.08)"
          strokeWidth="1"
          strokeDasharray="3 18"
          strokeLinecap="round"
        />
      </svg>

      <span
        className="copilot-core"
        style={{
          width: 76,
          height: 76,
          borderRadius: '50%',
          background: 'linear-gradient(145deg, rgba(15, 36, 56, 0.90), rgba(6, 18, 31, 0.96))',
          border: '1px solid rgba(74, 200, 255, 0.22)',
          boxShadow: `
            inset 0 1px 0 rgba(255, 255, 255, 0.07),
            inset 0 -10px 24px rgba(0, 0, 0, 0.20),
            0 10px 30px rgba(0, 0, 0, 0.34),
            0 0 20px rgba(74, 200, 255, 0.07)
          `,
          backdropFilter: 'blur(18px) saturate(135%)',
          WebkitBackdropFilter: 'blur(18px) saturate(135%)',
          display: 'grid',
          placeItems: 'center',
          transition: 'background 220ms ease, border-color 220ms ease, box-shadow 220ms ease',
        }}
      >
        <span
          className="copilot-orb"
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            background: `
              radial-gradient(circle at 38% 32%,
                rgba(220, 248, 255, 0.96) 0%,
                rgba(100, 211, 255, 0.72) 18%,
                rgba(45, 150, 205, 0.34) 48%,
                rgba(10, 42, 66, 0.18) 72%,
                rgba(5, 20, 34, 0) 100%)
            `,
            border: '1px solid rgba(135, 225, 255, 0.16)',
            display: 'grid',
            placeItems: 'center',
            color: '#BCEEFF',
            animation: 'copilotOrbBreathe 4.8s ease-in-out infinite',
          }}
        >
          <Bot size={17} strokeWidth={1.6} />
        </span>
      </span>
    </button>
  );
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
  // Focused-session block is fetched below once `sessionId` is resolved.

  // Tool-mode focus resolution. The mental model:
  //   * When the user is on a session detail page or a page that explicitly
  //     focuses a session via prop, that wins — the URL/page is the source
  //     of truth. A previous manual pick must NOT override the new page.
  //   * Off-session pages fall back to (a) the user's last manual pick, or
  //     (b) the top-risk session so the bar is always tool-mode.
  const params = useParams<{ sessionId?: string }>();
  const { sessions: pickerSessions } = useCopilotSessions(12);
  const [manualSessionId, setManualSessionId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const routeOrProp = sessionIdProp ?? params.sessionId;
  const sessionId = routeOrProp ?? manualSessionId ?? pickerSessions[0]?.session_id;
  const toolMode = Boolean(sessionId);
  const focusedSession = pickerSessions.find((s) => s.session_id === sessionId);
  const { text: focusText, loading: focusLoading } = useFocusedSessionContext(sessionId);

  // Whenever the route/prop binds a new session, clear any stale manual pick
  // AND reset the chat — a new focus means a new conversation.
  useEffect(() => {
    if (routeOrProp && manualSessionId && routeOrProp !== manualSessionId) {
      setManualSessionId(null);
      setMessages([]);
    }
  }, [routeOrProp, manualSessionId]);

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
      const productionApiConfigured = Boolean(
        (import.meta.env.VITE_API_BASE_URL ?? '').trim(),
      );
      if (toolMode && sessionId && !productionApiConfigured) {
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
        // When a session is focused, prepend it so the model never has to ask
        // which session the question is about.
        const focusBlock = focusText ? `${focusText}\n\n` : '';
        const sys =
          `${SYSTEM_PROMPT}\n\n` +
          `## CONTEXT — live Supabase snapshot\n` +
          `${focusBlock}` +
          `${contextText}`;
        const res = await fetch(apiUrl('/api/copilot'), {
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
    return <CopilotLauncher onOpen={() => setOpen(true)} />;
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
            {sessionId && (focusLoading
              ? ' · loading focus…'
              : focusText ? ` · focus ${sessionId}` : '')}
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

        {messages.map((m, i) => {
          // Suppress the assistant text bubble entirely when it is empty or
          // when every word would just be redundant with the rendered tool
          // artifacts. Keeps the chat visually clean.
          const text = (m.content || '').trim();
          const showText = text.length > 0 && text !== '(empty)';
          return (
            <div key={i} style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '94%',
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              {showText && (
                <div style={{
                  padding: m.role === 'user' ? '7px 12px' : '8px 12px',
                  background: m.role === 'user' ? 'rgba(46,168,255,0.18)' : 'transparent',
                  border: m.role === 'user'
                    ? '1px solid rgba(46,168,255,0.40)'
                    : 'none',
                  borderRadius: 10,
                  fontSize: 12, lineHeight: 1.55,
                  color: '#E5F2FF',
                }}>
                  {m.role === 'assistant' ? renderRichText(text) : text}
                </div>
              )}
              {(m.toolCalls ?? []).map((tc, j) => (
                <ToolArtifact key={j} call={tc} onPrompt={send} />
              ))}
            </div>
          );
        })}

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
    const fname = String(r.path || r.pdf_path || '').split(/[\\/]/).pop() || 'EvidenceReport.pdf';
    return (
      <a href={assetSrc} target="_blank" rel="noopener noreferrer"
         style={{
           display: 'flex', alignItems: 'center', gap: 10,
           padding: '10px 12px',
           background: 'linear-gradient(165deg, rgba(46,168,255,0.18), rgba(46,168,255,0.06))',
           border: '1px solid rgba(46,168,255,0.40)',
           borderRadius: 10, textDecoration: 'none',
         }}>
        <div style={{
          width: 32, height: 38, flexShrink: 0,
          background: '#FF5252', borderRadius: 3,
          color: '#fff', fontSize: 8, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          letterSpacing: 0.5,
        }}>PDF</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#E5F2FF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {String(r.caption || 'Evidence report')}
          </div>
          <div style={{ fontSize: 10, color: '#7FA5D3', marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
            {fname}
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#2EA8FF', fontWeight: 600 }}>↓</div>
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
    const fmtUsd = (n: any) =>
      n == null ? '—' : `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    return (
      <div style={{
        background: 'linear-gradient(165deg, rgba(8,19,31,0.85), rgba(8,19,31,0.6))',
        border: `1px solid ${tone}55`,
        borderRadius: 12,
        overflow: 'hidden',
        color: '#E5F2FF',
      }}>
        {/* Verdict header — accent strip + label + score */}
        <div style={{
          padding: '12px 14px',
          background: `linear-gradient(90deg, ${tone}22, transparent)`,
          borderBottom: `1px solid ${tone}33`,
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 0.3, color: tone }}>
            {v.replace(/_/g, ' ')}
          </div>
          <div style={{ fontSize: 11, color: '#7FA5D3' }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: tone }}>
              {r.risk_score ?? '—'}
            </span>
            <span style={{ marginLeft: 2 }}>/100 · {String(r.category ?? '—')}</span>
          </div>
        </div>

        {/* Stat tiles row — exposure + dispute window */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 1, background: 'rgba(46,168,255,0.10)',
        }}>
          <div style={{ padding: '10px 12px', background: 'rgba(8,19,31,0.85)' }}>
            <div style={{ fontSize: 9, color: '#7FA5D3', letterSpacing: 0.6 }}>EXPOSURE</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>
              {fmtUsd(r.exposure_usd)}
            </div>
          </div>
          <div style={{ padding: '10px 12px', background: 'rgba(8,19,31,0.85)' }}>
            <div style={{ fontSize: 9, color: '#7FA5D3', letterSpacing: 0.6 }}>DISPUTE WINDOW</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>
              {r.dispute_window_hours ?? 72}<span style={{ fontSize: 10, color: '#7FA5D3' }}> h</span>
            </div>
          </div>
        </div>

        {/* Findings — severity dot + rule chip + name, clickable to drill in */}
        {Array.isArray(r.top_reasons) && r.top_reasons.length > 0 && (
          <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(46,168,255,0.10)' }}>
            <div style={{ fontSize: 9, color: '#7FA5D3', letterSpacing: 0.6, marginBottom: 6 }}>
              TOP FINDINGS
            </div>
            {r.top_reasons.map((t: any, i: number) => {
              const sev = sevTone(t.severity);
              const dot = { critical:'#E84118', high:'#FF7F0E', medium:'#F4C20D', low:'#2ECC71' }[sev];
              return (
                <button key={i}
                  onClick={() => onPrompt(`Why ${t.rule_id}?`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', textAlign: 'left',
                    padding: '6px 4px',
                    background: 'transparent', border: 'none',
                    color: '#E5F2FF', fontSize: 11.5,
                    cursor: 'pointer',
                    borderRadius: 4,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(46,168,255,0.08)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0,
                  }} />
                  <span style={{ fontWeight: 700, color: dot, minWidth: 48 }}>{t.rule_id}</span>
                  <span style={{ flex: 1, color: '#E5F2FF' }}>{t.name}</span>
                  <span style={{ fontSize: 9, color: '#7FA5D3', opacity: 0.6 }}>→</span>
                </button>
              );
            })}
          </div>
        )}

        {/* On-deck checklist — clickable rows that fire mark_action_done */}
        {Array.isArray(r.checklist) && r.checklist.length > 0 && (
          <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(46,168,255,0.10)' }}>
            <div style={{ fontSize: 9, color: '#7FA5D3', letterSpacing: 0.6, marginBottom: 6 }}>
              DO THIS NOW
            </div>
            {r.checklist.map((c: any, i: number) => (
              <button key={i}
                onClick={() => onPrompt(`Done — ${c.text}`)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 9,
                  width: '100%', textAlign: 'left',
                  padding: '6px 4px',
                  background: 'transparent', border: 'none',
                  color: '#E5F2FF', fontSize: 11.5, lineHeight: 1.4,
                  cursor: 'pointer',
                  borderRadius: 4,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(46,168,255,0.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <span style={{
                  width: 14, height: 14, borderRadius: 3,
                  border: '1.5px solid #7FA5D3', flexShrink: 0,
                  marginTop: 1,
                }} />
                <span>{c.text}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
  if (call.name === 'show_anomaly') {
    const sev = sevTone(r.severity);
    const tone = { critical:'#E84118', high:'#FF7F0E', medium:'#F4C20D', low:'#2ECC71' }[sev];
    const hasNums = r.measured != null && r.reference != null;
    const dev = r.deviation_pct != null ? Number(r.deviation_pct) : null;
    return (
      <div style={{
        background: 'linear-gradient(165deg, rgba(8,19,31,0.85), rgba(8,19,31,0.6))',
        border: `1px solid ${tone}55`,
        borderLeft: `4px solid ${tone}`,
        borderRadius: 10,
        overflow: 'hidden',
        color: '#E5F2FF',
      }}>
        {/* Header: severity badge + rule_id + name */}
        <div style={{
          padding: '8px 12px',
          display: 'flex', alignItems: 'center', gap: 8,
          borderBottom: hasNums ? `1px solid ${tone}22` : 'none',
        }}>
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: 0.6,
            color: '#0D1117', background: tone,
            padding: '2px 7px', borderRadius: 4,
          }}>{String(r.severity ?? 'LOW')}</span>
          <span style={{ fontWeight: 700, color: tone, fontSize: 12 }}>{String(r.rule_id ?? '—')}</span>
          <span style={{ fontSize: 11.5, color: '#E5F2FF' }}>{String(r.name ?? '')}</span>
        </div>

        {/* When the row carries measured/reference, render two tiles.
            When it only has a description (Supabase rows often do), render
            the description as a clean subline with the deviation chip. */}
        {!hasNums && (r.description || dev != null) && (
          <div style={{
            padding: '10px 12px',
            background: 'rgba(8,19,31,0.85)',
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            {r.description && (
              <div style={{ fontSize: 11.5, color: '#E5F2FF', lineHeight: 1.5 }}>
                {String(r.description)}
              </div>
            )}
            {dev != null && (
              <div style={{
                alignSelf: 'flex-start',
                padding: '2px 8px',
                background: `${tone}22`,
                border: `1px solid ${tone}55`,
                borderRadius: 999,
                fontSize: 10, fontWeight: 700, color: tone,
              }}>
                Δ {dev > 0 ? '+' : ''}{dev.toFixed(2)}%{r.unit ? ` ${r.unit}` : ''}
              </div>
            )}
          </div>
        )}
        {hasNums && (
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: 1, background: `${tone}22`,
          }}>
            <div style={{ padding: '8px 12px', background: 'rgba(8,19,31,0.85)' }}>
              <div style={{ fontSize: 9, color: '#7FA5D3', letterSpacing: 0.6 }}>MEASURED</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2, color: tone }}>
                {String(r.measured)}<span style={{ fontSize: 10, color: '#7FA5D3', marginLeft: 2 }}>{r.unit ?? ''}</span>
              </div>
            </div>
            <div style={{ padding: '8px 12px', background: 'rgba(8,19,31,0.85)' }}>
              <div style={{ fontSize: 9, color: '#7FA5D3', letterSpacing: 0.6 }}>EXPECTED</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>
                {String(r.reference)}<span style={{ fontSize: 10, color: '#7FA5D3', marginLeft: 2 }}>{r.unit ?? ''}</span>
              </div>
            </div>
            {dev != null && (
              <div style={{
                gridColumn: '1 / -1',
                padding: '6px 12px', background: 'rgba(8,19,31,0.85)',
                fontSize: 11, color: tone, fontWeight: 700,
                textAlign: 'right',
              }}>
                Δ {dev > 0 ? '+' : ''}{dev.toFixed(2)}%
              </div>
            )}
          </div>
        )}

        {/* Citation footer */}
        {r.regulatory_basis && (
          <div style={{
            padding: '6px 12px', borderTop: `1px solid ${tone}22`,
            fontSize: 10, color: '#7FA5D3',
          }}>
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

/**
 * Minimal inline markdown for assistant bubbles — handles **bold**, *italic*,
 * `code`, list lines starting with "-" or numbers, and double-newline paragraph
 * breaks. We deliberately do NOT pull in a markdown library: the assistant
 * text is short, security-sensitive (no HTML pass-through), and the structure
 * we want to convey is mostly already in the tool cards.
 */
function renderRichText(text: string): React.ReactNode {
  // Drop horizontal rules (---) and empty action checkbox lines — the verdict
  // card already renders the real checklist with clickable buttons.
  const cleaned = text
    .split('\n')
    .filter((line) => !/^---+\s*$/.test(line))
    .filter((line) => !/^\s*-\s*\[\s*\]\s*/.test(line))   // "- [ ] HOLD ..."
    .join('\n')
    .trim();
  const paragraphs = cleaned.split(/\n{2,}/);
  return (
    <>
      {paragraphs.map((para, pi) => {
        const lines = para.split('\n');
        const isList = lines.every((l) => /^\s*(?:[-*•]|\d+\.)\s+/.test(l));
        if (isList) {
          return (
            <div key={pi} style={{ display: 'flex', flexDirection: 'column', gap: 4, margin: '4px 0' }}>
              {lines.map((l, li) => (
                <div key={li} style={{ display: 'flex', gap: 8 }}>
                  <span style={{ color: '#2EA8FF', flexShrink: 0, marginTop: 1 }}>›</span>
                  <span style={{ flex: 1 }}>{renderInline(l.replace(/^\s*(?:[-*•]|\d+\.)\s+/, ''))}</span>
                </div>
              ))}
            </div>
          );
        }
        return (
          <p key={pi} style={{ margin: pi === 0 ? '0' : '6px 0 0' }}>
            {lines.map((l, li) => (
              <React.Fragment key={li}>
                {li > 0 && <br />}
                {renderInline(l)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}

/** Inline pass — bold / italic / inline-code. Safe text only, no HTML. */
function renderInline(s: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  // Order matters: **bold** before *italic*, both before `code`.
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = regex.exec(s)) !== null) {
    if (m.index > last) parts.push(s.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) {
      parts.push(<b key={key++} style={{ color: '#FFF' }}>{tok.slice(2, -2)}</b>);
    } else if (tok.startsWith('`')) {
      parts.push(<code key={key++} style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.92em',
        padding: '1px 5px',
        background: 'rgba(46,168,255,0.12)',
        border: '1px solid rgba(46,168,255,0.25)',
        borderRadius: 3,
        color: '#7FC5FF',
      }}>{tok.slice(1, -1)}</code>);
    } else {
      parts.push(<i key={key++} style={{ color: '#C4D8EE' }}>{tok.slice(1, -1)}</i>);
    }
    last = m.index + tok.length;
  }
  if (last < s.length) parts.push(s.slice(last));
  return <>{parts}</>;
}
