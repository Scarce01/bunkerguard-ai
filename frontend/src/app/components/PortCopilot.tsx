import { useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { TextStreamChatTransport } from 'ai';
import { Bot, Send, Sparkles, X, Command } from 'lucide-react';
import { useCopilotContext } from '../../lib/useCopilotContext';
import { apiUrl } from '../../lib/api';

const RAIL_WIDTH_PX = 380;
const OVERLAY_BREAKPOINT_PX = 1100;

const SUGGESTIONS = [
  'What is the worst session right now?',
  'Should I refuse to sign Session SES-2026-016?',
  "Summarise Supplier Gamma's reputation",
  'What anomalies tripped on EVER GIVEN?',
];

const SYSTEM_PROMPT = `You are BunkerGuard Copilot, an assistant for a Chief Engineer monitoring marine bunkering operations in Singapore. The user is at the dashboard looking at live sessions, suppliers, and anomalies. Be terse, concrete, and back every claim with the specific session_id, supplier name, rule code, or risk number from the CONTEXT block below. If the user asks something not covered by the context, say so plainly. Never invent vessel names, numbers, or verdicts. Format multi-line answers with short markdown bullets.`;

export function PortCopilot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const { text: contextText, loading: ctxLoading } = useCopilotContext();
  const scrollRef = useRef<HTMLDivElement>(null);
  const transport = useMemo(
    () => new TextStreamChatTransport({
      api: apiUrl('/api/copilot'),
      headers: { 'X-BunkerGuard-Stream': 'text' },
    }),
    [],
  );
  const { messages, sendMessage, status, error } = useChat({ transport });
  const busy = status === 'submitted' || status === 'streaming';

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
    setInput('');
    const system = `${SYSTEM_PROMPT}\n\n## CONTEXT — live Supabase snapshot\n${contextText}`;
    await sendMessage({ text }, { body: { system, maxTokens: 700 } });
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
            Vercel AI SDK · AWS Bedrock
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

        {messages.map((m) => (
          <div key={m.id} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '88%',
            padding: '8px 12px',
            background: m.role === 'user' ? 'rgba(46,168,255,0.20)' : 'rgba(127,165,211,0.10)',
            border: `1px solid ${m.role === 'user' ? 'rgba(46,168,255,0.45)' : 'rgba(127,165,211,0.25)'}`,
            borderRadius: 8,
            fontSize: 12, lineHeight: 1.45,
            color: '#E5F2FF',
            whiteSpace: 'pre-wrap',
          }}>
            {m.parts.map((part, index) =>
              part.type === 'text' ? <span key={`${m.id}-${index}`}>{part.text}</span> : null,
            )}
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
            {error.message}
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
