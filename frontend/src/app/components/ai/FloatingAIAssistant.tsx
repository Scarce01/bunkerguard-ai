import { useState, useRef, useEffect } from 'react';
import { Send, ChevronRight, Shield, FileText, Radio, X } from 'lucide-react';

interface AIMessage {
  role: 'assistant';
  findings: string[];
  recommendation?: string;
  confidence: number;
  timestamp: string;
}

interface FloatingAIAssistantProps {
  hasCritical?: boolean;
  initialMessages?: AIMessage[];
  onSendMessage?: (message: string) => void;
}

const QUICK_PROMPTS = [
  'Explain mismatch',
  'Supplier history',
  'Next actions',
  'Evidence chain',
];

export function FloatingAIAssistant({
  hasCritical = false,
  initialMessages = [],
  onSendMessage,
}: FloatingAIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AIMessage[]>(initialMessages);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialMessages.length > 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (text: string) => {
    if (!text.trim()) return;
    setInputValue('');
    setIsTyping(true);

    if (onSendMessage) {
      onSendMessage(text);
    }

    // Simulate AI thinking time
    setTimeout(() => {
      setIsTyping(false);
    }, 900);
  };

  const orbColor = hasCritical ? '#FF8A5A' : '#4FAFD1';
  const orbGlow = hasCritical ? 'rgba(255,138,90,0.2)' : 'rgba(79,175,209,0.25)';
  const accentColor = '#3EC7A5';

  return (
    <>
      {/* Premium Maritime AI Assistant Button */}
      {!isOpen && (
        <div
          onClick={() => setIsOpen(true)}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 88,
            height: 88,
            cursor: 'pointer',
            zIndex: 1000,
            transition: 'all 350ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {/* Floating particles */}
          <div style={{
            position: 'absolute',
            inset: -20,
            borderRadius: '50%',
            pointerEvents: 'none',
          }}>
            {[0, 1, 2].map(i => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  width: 3,
                  height: 3,
                  borderRadius: '50%',
                  background: orbColor,
                  opacity: 0.4,
                  boxShadow: `0 0 6px ${orbGlow}`,
                  animation: `floatingParticle ${4 + i}s ease-in-out ${i * 1.3}s infinite`,
                  left: '50%',
                  top: '50%',
                }}
              />
            ))}
          </div>

          {/* Sonar pulse rings */}
          <div style={{
            position: 'absolute',
            inset: -16,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${orbGlow} 0%, transparent 70%)`,
            animation: 'sonarPulse 5s ease-in-out infinite',
          }} />

          {/* Outer radar ring - rotating */}
          <svg style={{
            position: 'absolute',
            inset: -20,
            width: 'calc(100% + 40px)',
            height: 'calc(100% + 40px)',
            pointerEvents: 'none',
          }}>
            <defs>
              <linearGradient id="radarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={orbColor} stopOpacity="0.5" />
                <stop offset="50%" stopColor={orbColor} stopOpacity="0.2" />
                <stop offset="100%" stopColor={orbColor} stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Outer ring */}
            <circle
              cx="50%"
              cy="50%"
              r="56"
              fill="none"
              stroke={orbColor}
              strokeWidth="1.5"
              strokeDasharray="8 10"
              opacity="0.3"
              style={{
                transformOrigin: 'center',
                animation: 'rotateRadar 20s linear infinite',
              }}
            />
            {/* Middle ring */}
            <circle
              cx="50%"
              cy="50%"
              r="48"
              fill="none"
              stroke={accentColor}
              strokeWidth="1"
              strokeDasharray="4 6"
              opacity="0.25"
              style={{
                transformOrigin: 'center',
                animation: 'rotateRadar 28s linear infinite reverse',
              }}
            />
            {/* Inner technical ring */}
            <circle
              cx="50%"
              cy="50%"
              r="42"
              fill="none"
              stroke={orbColor}
              strokeWidth="0.5"
              strokeDasharray="2 4"
              opacity="0.2"
              style={{
                transformOrigin: 'center',
                animation: 'rotateRadar 16s linear infinite',
              }}
            />
          </svg>

          {/* Main maritime shield container - Semi-3D */}
          <div style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: `linear-gradient(135deg, rgba(18,42,68,0.98) 0%, rgba(11,29,51,0.96) 50%, rgba(8,22,40,0.98) 100%)`,
            backdropFilter: 'blur(32px)',
            border: `2px solid ${orbColor}60`,
            boxShadow: `
              0 0 40px ${orbGlow},
              0 12px 48px rgba(0,0,0,0.7),
              0 4px 12px rgba(0,0,0,0.5),
              inset 0 2px 4px rgba(255,255,255,0.15),
              inset 0 -4px 8px rgba(0,0,0,0.4)
            `,
            transition: 'all 350ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.08) translateY(-3px)';
            e.currentTarget.style.boxShadow = `
              0 0 56px ${orbGlow},
              0 16px 56px rgba(0,0,0,0.8),
              0 8px 20px rgba(0,0,0,0.6),
              inset 0 2px 6px rgba(255,255,255,0.2),
              inset 0 -4px 10px rgba(0,0,0,0.5)
            `;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1) translateY(0)';
            e.currentTarget.style.boxShadow = `
              0 0 40px ${orbGlow},
              0 12px 48px rgba(0,0,0,0.7),
              0 4px 12px rgba(0,0,0,0.5),
              inset 0 2px 4px rgba(255,255,255,0.15),
              inset 0 -4px 8px rgba(0,0,0,0.4)
            `;
          }}
          >
            {/* Top light reflection */}
            <div style={{
              position: 'absolute',
              top: '8%',
              left: '20%',
              right: '20%',
              height: '25%',
              borderRadius: '50%',
              background: `radial-gradient(ellipse 100% 100% at 50% 50%, rgba(255,255,255,0.18) 0%, transparent 60%)`,
              pointerEvents: 'none',
            }} />

            {/* Inner glow accent */}
            <div style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: `radial-gradient(ellipse 75% 65% at 50% 40%, ${orbColor}22 0%, transparent 70%)`,
              pointerEvents: 'none',
            }} />

            {/* Bottom shadow */}
            <div style={{
              position: 'absolute',
              bottom: '5%',
              left: '15%',
              right: '15%',
              height: '30%',
              borderRadius: '50%',
              background: `radial-gradient(ellipse 100% 80% at 50% 50%, rgba(0,0,0,0.3) 0%, transparent 60%)`,
              pointerEvents: 'none',
            }} />

            {/* Maritime AI Robot Avatar - Premium Design */}
            <svg style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              padding: 16,
            }} viewBox="0 0 100 100">
              <defs>
                {/* Eye glow filter */}
                <filter id="eyeGlow">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>

              {/* Robot Head Container - Rounded Square */}
              <g>
                {/* Head base - semi-3D effect */}
                <rect x="28" y="30" width="44" height="42" rx="8"
                  fill={`${orbColor}12`}
                  stroke={orbColor}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />

                {/* Inner frame detail */}
                <rect x="31" y="33" width="38" height="36" rx="6"
                  fill="none"
                  stroke={orbColor}
                  strokeWidth="0.8"
                  opacity="0.3"
                />

                {/* Left Eye - Glowing Cyan */}
                <ellipse cx="40" cy="45" rx="6" ry="7" fill={orbColor} opacity="0.85" filter="url(#eyeGlow)">
                  <animate attributeName="opacity" values="0.7;1;0.7" dur="3.5s" repeatCount="indefinite" />
                </ellipse>
                <ellipse cx="40" cy="43" rx="2.5" ry="3" fill="rgba(255,255,255,0.7)" opacity="0.9">
                  <animate attributeName="opacity" values="0.6;0.95;0.6" dur="3.5s" repeatCount="indefinite" />
                </ellipse>

                {/* Right Eye - Glowing Cyan */}
                <ellipse cx="60" cy="45" rx="6" ry="7" fill={orbColor} opacity="0.85" filter="url(#eyeGlow)">
                  <animate attributeName="opacity" values="0.7;1;0.7" dur="3.5s" repeatCount="indefinite" />
                </ellipse>
                <ellipse cx="60" cy="43" rx="2.5" ry="3" fill="rgba(255,255,255,0.7)" opacity="0.9">
                  <animate attributeName="opacity" values="0.6;0.95;0.6" dur="3.5s" repeatCount="indefinite" />
                </ellipse>

                {/* Antenna - Top Center */}
                <line x1="50" y1="30" x2="50" y2="22" stroke={orbColor} strokeWidth="2" opacity="0.6" strokeLinecap="round" />
                <circle cx="50" cy="19" r="3" fill={hasCritical ? '#FF8A5A' : accentColor} opacity="0.95">
                  <animate attributeName="opacity" values="0.5;1;0.5" dur="2.5s" repeatCount="indefinite" />
                </circle>
                <circle cx="50" cy="19" r="1.5" fill="rgba(255,255,255,0.8)" opacity="0.9" />

                {/* Small wave/anchor detail on forehead */}
                <path d="M 43 35 Q 50 37 57 35" fill="none" stroke={accentColor} strokeWidth="1.5" opacity="0.5" strokeLinecap="round" />

                {/* Mouth/Speaker Grille */}
                <g opacity="0.6">
                  <rect x="38" y="58" width="24" height="8" rx="3"
                    fill="none"
                    stroke={orbColor}
                    strokeWidth="1.5"
                  />
                  {/* Grille lines */}
                  <line x1="42" y1="60" x2="42" y2="64" stroke={orbColor} strokeWidth="0.8" opacity="0.4" />
                  <line x1="46" y1="60" x2="46" y2="64" stroke={orbColor} strokeWidth="0.8" opacity="0.4" />
                  <line x1="50" y1="60" x2="50" y2="64" stroke={orbColor} strokeWidth="0.8" opacity="0.4" />
                  <line x1="54" y1="60" x2="54" y2="64" stroke={orbColor} strokeWidth="0.8" opacity="0.4" />
                  <line x1="58" y1="60" x2="58" y2="64" stroke={orbColor} strokeWidth="0.8" opacity="0.4" />
                </g>

                {/* Side sensor accents */}
                <circle cx="32" cy="45" r="2" fill={accentColor} opacity="0.4" />
                <circle cx="68" cy="45" r="2" fill={accentColor} opacity="0.4" />
              </g>

              {/* Radar/Navigation markers - corner accents */}
              <g opacity="0.3">
                <path d="M 18 18 L 24 18 L 24 24" fill="none" stroke={orbColor} strokeWidth="1.2" strokeLinecap="round" />
                <path d="M 82 18 L 76 18 L 76 24" fill="none" stroke={orbColor} strokeWidth="1.2" strokeLinecap="round" />
                <path d="M 18 82 L 24 82 L 24 76" fill="none" stroke={orbColor} strokeWidth="1.2" strokeLinecap="round" />
                <path d="M 82 82 L 76 82 L 76 76" fill="none" stroke={orbColor} strokeWidth="1.2" strokeLinecap="round" />
              </g>
            </svg>

            {/* Breathing animation overlay */}
            <div style={{
              position: 'absolute',
              inset: 8,
              borderRadius: '50%',
              border: `1.5px solid ${orbColor}`,
              opacity: 0.2,
              animation: 'breathe 5s ease-in-out infinite',
            }} />

            {/* Speaking pulse ring (when active) */}
            <div style={{
              position: 'absolute',
              inset: 12,
              borderRadius: '50%',
              border: `1px solid ${accentColor}`,
              opacity: 0.15,
              animation: 'speakingPulse 3s ease-in-out infinite',
            }} />
          </div>

          {/* Hover tooltip */}
          {showTooltip && (
            <div style={{
              position: 'absolute',
              bottom: '100%',
              right: 0,
              marginBottom: 14,
              padding: '8px 14px',
              borderRadius: 9,
              background: 'linear-gradient(135deg, rgba(18,42,68,0.98) 0%, rgba(11,29,51,0.96) 100%)',
              backdropFilter: 'blur(20px)',
              border: `1px solid ${orbColor}40`,
              boxShadow: `0 4px 24px rgba(0,0,0,0.8), 0 0 20px ${orbGlow}`,
              whiteSpace: 'nowrap',
              fontSize: 11,
              fontWeight: 600,
              color: '#EAF4FF',
              animation: 'tooltipFadeIn 200ms ease-out',
              pointerEvents: 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: orbColor, boxShadow: `0 0 8px ${orbGlow}`, animation: 'livePulse 2s ease-in-out infinite' }} />
                <span>Investigation Assistant</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating AI Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(4px)',
              zIndex: 999,
              animation: 'fadeIn 200ms ease-out',
            }}
          />

          {/* Premium AI Panel - Compact & Readable */}
          <div style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 480,
            maxHeight: '90vh',
            borderRadius: 20,
            background: 'linear-gradient(158deg, rgba(11,29,51,0.98) 0%, rgba(16,38,62,0.96) 50%, rgba(19,44,72,0.97) 100%)',
            backdropFilter: 'blur(36px)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 28px 72px rgba(0,0,0,0.75), 0 10px 28px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.09)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'aiPanelSlideIn 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}>
            {/* Enhanced top glow accent */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 140,
              background: 'radial-gradient(ellipse 100% 85% at 50% 0%, rgba(46,168,255,0.14) 0%, transparent 75%)',
              pointerEvents: 'none',
            }} />

            {/* Premium Header */}
            <div style={{ padding: '18px 26px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2EA8FF', boxShadow: '0 0 8px rgba(46,168,255,0.15)', animation: 'livePulse 2.5s ease-in-out infinite' }} />
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#EAF4FF', letterSpacing: '-0.01em' }}>Investigation Assistant</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 6, background: 'rgba(46,168,255,0.10)', border: '1px solid rgba(46,168,255,0.20)' }}>
                    <div style={{ width: 30, height: 11, borderRadius: 3, background: 'rgba(11,29,51,0.85)', overflow: 'hidden', position: 'relative' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '92%', background: 'linear-gradient(90deg, #2EA8FF, #55BCFF)', borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#2EA8FF', fontFamily: "'JetBrains Mono', monospace" }}>92%</span>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    cursor: 'pointer',
                    transition: 'all 220ms cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.09)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)';
                  }}
                >
                  <X style={{ width: 16, height: 16, color: '#91B4DA' }} />
                </button>
              </div>
            </div>

            {/* Status & Compact Action Pills */}
            <div style={{ padding: '14px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
              <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(199,90,90,0.08)', border: '1px solid rgba(199,90,90,0.18)', marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#C75A5A', letterSpacing: '0.02em', marginBottom: 8 }}>
                  High Fraud Probability
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { icon: '⚠', text: 'Shortage' },
                    { icon: '⚠', text: 'Supplier' },
                    { icon: '⚠', text: 'MFM Drift' },
                  ].map((signal, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 5, background: 'rgba(199,90,90,0.10)', border: '1px solid rgba(199,90,90,0.15)' }}>
                      <span style={{ fontSize: 11, lineHeight: 1 }}>{signal.icon}</span>
                      <span style={{ fontSize: 10, color: '#D4E4F7', fontWeight: 500 }}>{signal.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Horizontal Action Pills */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { title: 'Generate Protest', icon: FileText },
                  { title: 'Explain Risk', icon: Shield },
                  { title: 'Investigate', icon: Shield },
                  { title: 'Compare Sessions', icon: Radio },
                ].map((action, i) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        height: 42,
                        padding: '0 14px',
                        borderRadius: 9,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: 'linear-gradient(135deg, rgba(46,168,255,0.08) 0%, rgba(46,168,255,0.04) 100%)',
                        border: '1px solid rgba(46,168,255,0.2)',
                        color: '#7AB8E8',
                        transition: 'all 220ms cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                        whiteSpace: 'nowrap',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'linear-gradient(135deg, rgba(46,168,255,0.15) 0%, rgba(46,168,255,0.08) 100%)';
                        e.currentTarget.style.borderColor = 'rgba(46,168,255,0.35)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(46,168,255,0.2), 0 0 16px rgba(46,168,255,0.08)';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'linear-gradient(135deg, rgba(46,168,255,0.08) 0%, rgba(46,168,255,0.04) 100%)';
                        e.currentTarget.style.borderColor = 'rgba(46,168,255,0.2)';
                        e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <Icon style={{ width: 13, height: 13 }} />
                      <span>{action.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Premium Conversation Area - Intelligence Mission Control Feel */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20, minHeight: 0 }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#2EA8FF', boxShadow: '0 0 6px rgba(46,168,255,0.15)', animation: 'livePulse 3s ease-in-out infinite' }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#2EA8FF', letterSpacing: '0.02em' }}>Analysis</span>
                    <div style={{ marginLeft: 'auto', padding: '3px 8px', borderRadius: 5, background: 'rgba(46,168,255,0.12)', border: '1px solid rgba(46,168,255,0.20)' }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#2EA8FF', fontFamily: "'JetBrains Mono', monospace" }}>{msg.confidence}%</span>
                    </div>
                    <span style={{ fontSize: 9, color: '#7FA5D3', fontFamily: "'JetBrains Mono', monospace" }}>{msg.timestamp}</span>
                  </div>
                  {/* Analysis Message Card */}
                  <div style={{
                    padding: '18px 20px',
                    borderRadius: 12,
                    background: 'linear-gradient(145deg, rgba(10,22,38,0.85) 0%, rgba(13,28,46,0.80) 100%)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    {/* Subtle accent */}
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 50,
                      background: 'radial-gradient(ellipse 100% 80% at 50% 0%, rgba(46,168,255,0.04) 0%, transparent 65%)',
                      pointerEvents: 'none',
                    }} />

                    {/* Session Analysis */}
                    <div style={{ position: 'relative', zIndex: 1 }}>
                      <div style={{ fontSize: 10, color: '#5A8AB4', letterSpacing: '0.02em', fontWeight: 600, marginBottom: 12 }}>
                        Session Analysis
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: msg.recommendation ? 16 : 0 }}>
                        {msg.findings.map((finding, idx) => (
                          <div key={idx} style={{ fontSize: 14.5, color: '#E0ECFA', lineHeight: 1.6, fontWeight: 500, letterSpacing: '0.005em' }}>
                            {finding}
                          </div>
                        ))}
                      </div>
                      {/* Recommended Action */}
                      {msg.recommendation && (
                        <div style={{ paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                          <div style={{ fontSize: 10, color: '#5A8AB4', letterSpacing: '0.02em', marginBottom: 9, fontWeight: 600 }}>
                            Recommended Action
                          </div>
                          <div style={{ fontSize: 16.5, fontWeight: 700, color: msg.recommendation.includes('REFUSE') ? '#C75A5A' : '#2EA8FF', lineHeight: 1.55, letterSpacing: '0.005em' }}>
                            {msg.recommendation}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#2EA8FF', boxShadow: '0 0 10px rgba(46,168,255,0.5)', animation: 'livePulse 3s ease-in-out infinite' }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#2EA8FF', textTransform: 'uppercase', letterSpacing: '0.09em' }}>AI Assistant</span>
                  </div>
                  <div style={{
                    padding: '18px 20px',
                    borderRadius: 12,
                    background: 'linear-gradient(145deg, rgba(7,20,35,0.7) 0%, rgba(11,25,42,0.6) 100%)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.35), 0 0 20px rgba(46,168,255,0.05)',
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                  }}>
                    {[0, 1, 2].map(n => (
                      <div key={n} style={{ width: 7, height: 7, borderRadius: '50%', background: '#2EA8FF', opacity: 0.6, boxShadow: '0 0 8px rgba(46,168,255,0.4)', animation: `livePulse 1.4s ease-in-out ${n * 0.2}s infinite` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Compact Chip Suggestions */}
            <div style={{ padding: '10px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
              <div style={{ fontSize: 9, color: '#7FA5D3', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 7 }}>
                Suggestions
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {QUICK_PROMPTS.map(prompt => (
                  <button
                    key={prompt}
                    onClick={() => handleSendMessage(prompt)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      height: 36,
                      padding: '0 11px',
                      borderRadius: 18,
                      cursor: 'pointer',
                      background: 'rgba(46,168,255,0.08)',
                      border: '1px solid rgba(46,168,255,0.16)',
                      color: '#7AB8E8',
                      transition: 'all 220ms cubic-bezier(0.4, 0, 0.2, 1)',
                      fontSize: 10.5,
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(46,168,255,0.16)';
                      e.currentTarget.style.borderColor = 'rgba(46,168,255,0.3)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(46,168,255,0.15)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(46,168,255,0.08)';
                      e.currentTarget.style.borderColor = 'rgba(46,168,255,0.16)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <ChevronRight style={{ width: 9, height: 9, flexShrink: 0 }} />
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            {/* Premium Input Area - Mission Control Style */}
            <div style={{ padding: '14px 24px 16px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '16px 20px',
                  borderRadius: 13,
                  background: 'linear-gradient(135deg, rgba(7,20,35,0.9) 0%, rgba(11,25,42,0.85) 100%)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
                  transition: 'all 280ms cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                onFocus={e => {
                  e.currentTarget.style.borderColor = 'rgba(46,168,255,0.4)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.4), 0 0 24px rgba(46,168,255,0.2), inset 0 1px 0 rgba(255,255,255,0.08)';
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)';
                }}
              >
                <input
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendMessage(inputValue)}
                  placeholder="Ask AI Maritime Assistant…"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: 16,
                    color: '#EAF4FF',
                    caretColor: '#2EA8FF',
                    fontWeight: 500,
                    letterSpacing: '0.01em',
                  }}
                />
                <button
                  onClick={() => handleSendMessage(inputValue)}
                  disabled={!inputValue.trim()}
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: inputValue.trim() ? 'pointer' : 'default',
                    background: inputValue.trim() ? 'linear-gradient(135deg, rgba(46,168,255,0.25) 0%, rgba(46,168,255,0.15) 100%)' : 'transparent',
                    border: `1px solid ${inputValue.trim() ? 'rgba(46,168,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    transition: 'all 250ms cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: inputValue.trim() ? '0 0 16px rgba(46,168,255,0.25), 0 2px 8px rgba(0,0,0,0.3)' : 'none',
                  }}
                  onMouseEnter={e => {
                    if (inputValue.trim()) {
                      e.currentTarget.style.background = 'linear-gradient(135deg, rgba(46,168,255,0.35) 0%, rgba(46,168,255,0.2) 100%)';
                      e.currentTarget.style.borderColor = 'rgba(46,168,255,0.5)';
                      e.currentTarget.style.boxShadow = '0 0 24px rgba(46,168,255,0.35), 0 4px 12px rgba(0,0,0,0.4)';
                      e.currentTarget.style.transform = 'scale(1.05)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (inputValue.trim()) {
                      e.currentTarget.style.background = 'linear-gradient(135deg, rgba(46,168,255,0.25) 0%, rgba(46,168,255,0.15) 100%)';
                      e.currentTarget.style.borderColor = 'rgba(46,168,255,0.4)';
                      e.currentTarget.style.boxShadow = '0 0 16px rgba(46,168,255,0.25), 0 2px 8px rgba(0,0,0,0.3)';
                      e.currentTarget.style.transform = 'scale(1)';
                    }
                  }}
                >
                  <Send style={{ width: 18, height: 18, color: inputValue.trim() ? '#2EA8FF' : '#7A96B8' }} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes rotateRadar {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes sonarPulse {
          0%, 100% {
            opacity: 0.35;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.2);
          }
        }
        @keyframes breathe {
          0%, 100% {
            opacity: 0.2;
            transform: scale(1);
          }
          50% {
            opacity: 0.35;
            transform: scale(1.08);
          }
        }
        @keyframes speakingPulse {
          0%, 100% {
            opacity: 0.1;
            transform: scale(1);
          }
          33% {
            opacity: 0.3;
            transform: scale(1.15);
          }
          66% {
            opacity: 0.15;
            transform: scale(1.05);
          }
        }
        @keyframes floatingParticle {
          0% {
            transform: translate(-50%, -50%) rotate(0deg) translateX(30px) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 0.5;
          }
          50% {
            opacity: 0.7;
          }
          90% {
            opacity: 0.3;
          }
          100% {
            transform: translate(-50%, -50%) rotate(360deg) translateX(30px) rotate(-360deg);
            opacity: 0;
          }
        }
        @keyframes tooltipFadeIn {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes aiPanelSlideIn {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </>
  );
}
