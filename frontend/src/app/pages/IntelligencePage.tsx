import { useState } from 'react';
import { useNavigate } from 'react-router';
import { PortCopilot } from '../components/PortCopilot';
import { KiroGhostNode, AGENT_AVATAR_SRC } from '../components/ai/KiroGhost';
import { SupplierProfilePanel } from '../components/details/SupplierProfilePanel';
import { mockSupplierReputation } from '../../data/mockSupplierReputation';
import { useSupplierReputation } from '../../lib/useSupplierReputation';
import { AgentConversationStream } from '../components/intelligence/AgentConversationStream';

const CARD: React.CSSProperties = {
  background: 'linear-gradient(180deg, #102033 0%, #0E1C2D 100%)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 8,
  boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
};

const LABEL: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#5A8AB4', marginBottom: 6,
};

type Tab = 'supplier' | 'fleet';
const TABS: { id: Tab; label: string }[] = [
  { id: 'supplier', label: 'Supplier Intelligence' },
  { id: 'fleet',    label: 'Fleet Intelligence' },
];

/* ── Fraud Intelligence Network with AI propagation ────────────── */
/** Single label + value chip used in the AI-insights banner below the
 *  network graph. Compact, fixed-width feel via min-width on the value. */
function InsightStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <span style={{ fontSize: 9, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.10em', fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 800, color, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '-0.01em' }}>{value}</span>
    </div>
  );
}

function NetworkGraph({ onSupplierClick, onVesselClick }: { onSupplierClick?: (supplier: string) => void; onVesselClick?: (session: number) => void }) {
  const [hovered, setHovered] = useState<string | null>(null);
  /* Pinned agent — clicking an agent ghost locks its info panel open.
   * Clicking the same agent again (or any non-agent node) unpins. Means
   * the operator can read the agent's role without keeping their cursor
   * frozen on the dot. */
  const [pinnedAgent, setPinnedAgent] = useState<string | null>(null);
  /* Effective focus for the tooltip — pinned agent wins over hover so a
   * pinned panel doesn't flicker when the cursor leaves the chart. */
  const focus = pinnedAgent ?? hovered;

  const suppliers = [
    { id: 'S1', x: 8,  y: 16, name: 'Supplier Gamma', risk: 'CRITICAL', score: 38, discrepancy: 2.31, flagged: '9/22' },
    { id: 'S2', x: 8,  y: 36, name: 'Supplier Beta',  risk: 'MODERATE', score: 58, discrepancy: 1.22, flagged: '5/20' },
    { id: 'S3', x: 8,  y: 56, name: 'Supplier Alpha', risk: 'LOW',      score: 78, discrepancy: 0.31, flagged: '3/26' },
    { id: 'S4', x: 8,  y: 84, name: 'OceanBunker',    risk: 'CRITICAL', score: 0,  discrepancy: 0,    flagged: '1/1'  },
  ];

  /* ── AI Agent column (middle layer) ─────────────────────────── *
   * Mirrors the 4-agent workflow on the Live Session page:
   *   Surveyor → Investigator → Compliance → Decision
   * Copilot floats above as the observer/explainer. */
  const agents = [
    { id: 'A1', x: 46, y: 18, key: 'surveyor',     name: 'Surveyor',     glyph: 'SV', desc: 'Reads MFM + AIS + IoT',     color: '#2EA8FF', reads: 'sessions'  },
    { id: 'A2', x: 46, y: 38, key: 'investigator', name: 'Investigator', glyph: 'IV', desc: 'Cross-refs supplier history', color: '#A36CFF', reads: 'suppliers' },
    { id: 'A3', x: 46, y: 58, key: 'compliance',   name: 'Compliance',   glyph: 'CP', desc: 'MARPOL · MPA · ISO 8217',     color: '#FFB84D', reads: 'rules'     },
    { id: 'A4', x: 46, y: 78, key: 'decision',     name: 'Decision',     glyph: 'DC', desc: 'Final verdict + sign-off',    color: '#34C98C', reads: 'verdict'   },
  ];

  const vessels = [
    { id: 'V1', x: 88, y: 8,  name: 'MAERSK HONAM',    session: 16, risk: 78, deviation: 3.76, supplier: 'Supplier Gamma' },
    { id: 'V2', x: 88, y: 21, name: 'MSC OSCAR',       session: 19, risk: 67, deviation: 3.06, supplier: 'Supplier Gamma' },
    { id: 'V3', x: 88, y: 34, name: 'CMA CGM ANTOINE', session: 12, risk: 85, deviation: 3.14, supplier: 'Supplier Gamma' },
    { id: 'V4', x: 88, y: 47, name: 'EVER GIVEN',      session: 21, risk: 85, deviation: 3.75, supplier: 'Supplier Gamma' },
    { id: 'V5', x: 88, y: 60, name: 'MAERSK HONAM',    session: 22, risk: 72, deviation: 2.64, supplier: 'Supplier Beta'  },
    { id: 'V6', x: 88, y: 73, name: 'MSC OSCAR',       session: 14, risk: 15, deviation: 0.05, supplier: 'Supplier Alpha' },
    { id: 'V7', x: 88, y: 86, name: 'CMA CGM ANTOINE', session: 15, risk: 52, deviation: 1.37, supplier: 'Supplier Beta'  },
  ];

  /* Supplier → Investigator (left half).  Risk = the source supplier's risk. */
  const supplierEdges = suppliers.map(s => ({ from: s, to: agents[1], risk: s.risk, thickness: s.risk === 'CRITICAL' ? 2.4 : s.risk === 'MODERATE' ? 1.5 : 1 }));

  /* Vessel → Surveyor (right half).  Risk derived from vessel risk score. */
  const vesselEdges = vessels.map(v => {
    const r = v.risk >= 70 ? 'CRITICAL' : v.risk >= 50 ? 'HIGH' : v.risk >= 30 ? 'MODERATE' : 'LOW';
    return { from: agents[0], to: v, risk: r, thickness: r === 'CRITICAL' ? 2.4 : r === 'HIGH' ? 1.8 : r === 'MODERATE' ? 1.3 : 1 };
  });

  /* Agent → Agent workflow chain (the hero). */
  const agentChain = [
    { from: agents[0], to: agents[1], label: 'observations' },
    { from: agents[1], to: agents[2], label: 'pattern' },
    { from: agents[2], to: agents[3], label: 'verdict' },
  ];

  /* Decision → high-risk Vessels (sign-off broadcast). */
  const verdictEdges = vessels.filter(v => v.risk >= 70).map(v => ({ from: agents[3], to: v }));

  function riskColor(r: string) {
    if (r === 'CRITICAL') return '#E84E4E';
    if (r === 'HIGH')     return '#E0A020';
    if (r === 'MODERATE') return '#5A82A8';
    return '#2E7D6F';
  }

  /* Hover propagation — when a node is hovered (or an agent is pinned),
   * its neighbours light up too. */
  const isLit = (id: string): boolean => {
    const f = focus;
    if (!f) return false;
    if (f === id) return true;
    if (f.startsWith('A')) {
      if (f === 'A1') return id === 'A2' || vessels.some(v => v.id === id);
      if (f === 'A2') return id === 'A1' || id === 'A3' || suppliers.some(s => s.id === id);
      if (f === 'A3') return id === 'A2' || id === 'A4';
      if (f === 'A4') return id === 'A3' || (vessels.find(v => v.id === id)?.risk ?? 0) >= 70;
    }
    if (f.startsWith('S')) return id === 'A2';
    if (f.startsWith('V')) return id === 'A1' || ((vessels.find(v => v.id === f)?.risk ?? 0) >= 70 && id === 'A4');
    return false;
  };

  return (
    <div style={{ width: '100%', height: 480, position: 'relative', background: 'linear-gradient(175deg, #030B16 0%, #041020 55%, #06132A 100%)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
      {/* Intelligence glow — centred on the agent column to draw the eye there */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 42% 60% at 46% 50%, rgba(46,168,255,0.12) 0%, transparent 65%)', pointerEvents: 'none', animation: 'atmosphericPulse 9s ease-in-out infinite' }} />

      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          <pattern id="netgrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(46,168,255,0.05)" strokeWidth="0.5" />
          </pattern>
          <filter id="edgeGlow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <rect width="100%" height="100%" fill="url(#netgrid)" />

        {/* ── Layer 1: Supplier → Investigator edges (left half) ── */}
        {supplierEdges.map((e, i) => {
          const isActive = hovered === e.from.id || hovered === 'A2';
          const isCritical = e.risk === 'CRITICAL';
          return (
            <g key={`se${i}`}>
              <line
                x1={`${e.from.x}%`} y1={`${e.from.y}%`}
                x2={`${e.to.x - 4}%`} y2={`${e.to.y}%`}
                stroke={riskColor(e.risk)}
                strokeWidth={isActive ? e.thickness * 1.4 : e.thickness}
                opacity={isActive ? 0.65 : isCritical ? 0.32 : 0.18}
                style={{ transition: 'all 200ms' }}
              />
              {isCritical && (
                <circle r="3.5" fill={riskColor(e.risk)} opacity="0.6">
                  <animateMotion dur="4.5s" repeatCount="indefinite">
                    <mpath href={`#spath${i}`}/>
                  </animateMotion>
                </circle>
              )}
              <path id={`spath${i}`} d={`M ${e.from.x}% ${e.from.y}% L ${e.to.x - 4}% ${e.to.y}%`} fill="none" stroke="none"/>
            </g>
          );
        })}

        {/* ── Layer 2: Surveyor → Vessel edges (right half) ── */}
        {vesselEdges.map((e, i) => {
          const isActive = hovered === e.to.id || hovered === 'A1';
          const isCritical = e.risk === 'CRITICAL';
          return (
            <g key={`ve${i}`}>
              <line
                x1={`${e.from.x + 4}%`} y1={`${e.from.y}%`}
                x2={`${e.to.x - 5}%`} y2={`${e.to.y}%`}
                stroke={riskColor(e.risk)}
                strokeWidth={isActive ? e.thickness * 1.4 : e.thickness}
                opacity={isActive ? 0.7 : isCritical ? 0.34 : 0.18}
                style={{ transition: 'all 200ms' }}
              />
              {(isCritical || e.risk === 'HIGH') && (
                <circle r="3.5" fill={riskColor(e.risk)} opacity="0.65">
                  <animateMotion dur="3.8s" repeatCount="indefinite">
                    <mpath href={`#vpath${i}`}/>
                  </animateMotion>
                </circle>
              )}
              <path id={`vpath${i}`} d={`M ${e.from.x + 4}% ${e.from.y}% L ${e.to.x - 5}% ${e.to.y}%`} fill="none" stroke="none"/>
            </g>
          );
        })}

        {/* ── Layer 3: Agent → Agent workflow chain (the hero) ── */}
        {agentChain.map((e, i) => {
          const isActive = hovered === e.from.id || hovered === e.to.id;
          return (
            <g key={`ac${i}`}>
              <line
                x1={`${e.from.x}%`} y1={`${e.from.y + 3.5}%`}
                x2={`${e.to.x}%`}   y2={`${e.to.y - 3.5}%`}
                stroke="#2EA8FF"
                strokeWidth={isActive ? 3 : 2.2}
                opacity={isActive ? 1 : 0.55}
                strokeDasharray="6 4"
                style={{ transition: 'all 200ms' }}
              >
                <animate attributeName="stroke-dashoffset" from="20" to="0" dur="1.4s" repeatCount="indefinite" />
              </line>
              {/* Travelling photon */}
              <circle r="3" fill="#2EA8FF" opacity="0.9">
                <animateMotion dur="2.4s" repeatCount="indefinite" begin={`${i * 0.4}s`}>
                  <mpath href={`#apath${i}`}/>
                </animateMotion>
                <animate attributeName="opacity" values="1;0.3;1" dur="2.4s" repeatCount="indefinite"/>
              </circle>
              <path id={`apath${i}`} d={`M ${e.from.x}% ${e.from.y + 3.5}% L ${e.to.x}% ${e.to.y - 3.5}%`} fill="none" stroke="none"/>
              {/* Edge label */}
              <text x={`${(e.from.x + e.to.x) / 2 + 2}%`} y={`${(e.from.y + e.to.y) / 2}%`} style={{ fontSize: '8px', fill: '#5A8AB4', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', pointerEvents: 'none' }}>{e.label}</text>
            </g>
          );
        })}

        {/* ── Layer 4: Decision → high-risk Vessels (verdict broadcast, dashed green) ── */}
        {verdictEdges.map((e, i) => {
          const isActive = hovered === e.to.id || hovered === 'A4';
          return (
            <g key={`vd${i}`}>
              <line
                x1={`${e.from.x + 4}%`} y1={`${e.from.y}%`}
                x2={`${e.to.x - 5}%`}   y2={`${e.to.y}%`}
                stroke="#34C98C"
                strokeWidth={isActive ? 2 : 1.4}
                opacity={isActive ? 0.85 : 0.32}
                strokeDasharray="3 5"
                style={{ transition: 'all 200ms' }}
              />
            </g>
          );
        })}

        {/* Supplier nodes — Kiro ghost agents, one per supplier.
            Each supplier has its own "agent" inside our system that watches
            its history, registry, and discrepancy pattern. The ghost colour
            reflects current risk (red CRITICAL / orange MODERATE / green LOW).
            The risk score is rendered as a small chip below the ghost so
            it's still scannable at a glance. */}
        {suppliers.map((s, sIdx) => {
          const color = riskColor(s.risk);
          const isH = hovered === s.id;
          const isCritical = s.risk === 'CRITICAL';
          return (
            <g key={s.id}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHovered(s.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSupplierClick?.(s.name)}
            >
              {/* Extra pulsing ring for critical suppliers — same as before */}
              {isCritical && (
                <circle cx={`${s.x}%`} cy={`${s.y}%`} r="7" fill="none" stroke={color} strokeWidth="0.8" opacity="0.3">
                  <animate attributeName="r" values="5;9;5" dur="2.8s" repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="0.35;0;0.35" dur="2.8s" repeatCount="indefinite"/>
                </circle>
              )}
              {/* Kiro ghost — supplier agent avatar */}
              <KiroGhostNode
                cx={s.x} cy={s.y}
                size={isH ? 6 : 5}
                color={color}
                hovered={isH}
                lit={isCritical}
                idx={sIdx + 4 /* offset so pulses don't sync with agent column */}
              />
              {/* Risk-score chip — sits just below the ghost */}
              <rect
                x={`${s.x - 2.5}%`} y={`${s.y + 3.4}%`}
                width="5%" height="2.4%"
                rx="3" ry="3"
                fill={`${color}28`}
                stroke={color}
                strokeWidth="0.8"
                opacity={isH ? 1 : 0.85}
              />
              <text x={`${s.x}%`} y={`${s.y + 4.65}%`} textAnchor="middle" dominantBaseline="middle"
                style={{ fontSize: '8.5px', fill: color, fontWeight: 800, fontFamily: 'monospace', pointerEvents: 'none' }}>
                {s.score}
              </text>
              {/* Name label */}
              <text x={`${s.x}%`} y={`${s.y + 7.2}%`} textAnchor="middle"
                style={{ fontSize: '9px', fill: isH ? '#BFD7F7' : '#91B4DA', fontFamily: 'sans-serif', pointerEvents: 'none', transition: 'fill 200ms' }}>
                {s.name}
              </text>
            </g>
          );
        })}

        {/* ── Vessel cards (right column) ─────────────────────────────
           Each card is a clickable button that navigates to the session
           detail page. Layout is now scannable at a distance:
              left edge  →  big monospaced #SESSION
              right edge →  risk-score chip in the row's risk colour
              second row →  vessel name (truncated) + deviation %
           Bigger card box (12% wide × 7% tall) + thicker stroke so the
           numbers don't get lost behind cursor pulses or edge animations. */}
        {vessels.map(v => {
          const isH = hovered === v.id;
          const riskLevel = v.risk >= 70 ? 'CRITICAL' : v.risk >= 50 ? 'HIGH' : v.risk >= 30 ? 'MODERATE' : 'LOW';
          const color = riskColor(riskLevel);
          const isCritical = riskLevel === 'CRITICAL';
          // Truncate vessel names that overflow the new wider card.
          const shortName = v.name.length > 13 ? v.name.slice(0, 12) + '…' : v.name;
          return (
            <g key={v.id}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHovered(v.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onVesselClick?.(v.session)}
            >
              {/* Outer halo for critical sessions */}
              {isCritical && (
                <rect
                  x={`${v.x - 6.5}%`} y={`${v.y - 3.8}%`} width="13%" height="7.6%"
                  rx="5" fill={color} opacity={isH ? 0.10 : 0.06}
                />
              )}
              {/* Card */}
              <rect
                x={`${v.x - 6}%`} y={`${v.y - 3.5}%`} width="12%" height="7%"
                rx="4"
                fill={isH ? `${color}28` : 'rgba(8,19,33,0.95)'}
                stroke={color} strokeWidth={isH ? '1.6' : '1.1'}
                opacity={isH ? 1 : 0.92}
                style={{ transition: 'all 200ms' }}
              />
              {/* Left accent stripe — colour-coded by risk */}
              <rect
                x={`${v.x - 6}%`} y={`${v.y - 3.5}%`} width="0.45%" height="7%"
                rx="2"
                fill={color} opacity={isH ? 1 : 0.85}
              />
              {/* Big session number — primary, scannable */}
              <text x={`${v.x - 5}%`} y={`${v.y - 0.8}%`} textAnchor="start" dominantBaseline="middle"
                style={{
                  fontSize: '13px', fontWeight: 800,
                  fill: isH ? '#FFFFFF' : '#EAF4FF',
                  fontFamily: "'JetBrains Mono', monospace",
                  pointerEvents: 'none', transition: 'fill 200ms',
                }}>
                #{v.session}
              </text>
              {/* Vessel name — secondary */}
              <text x={`${v.x - 5}%`} y={`${v.y + 2.2}%`} textAnchor="start" dominantBaseline="middle"
                style={{
                  fontSize: '7.5px', fontWeight: 600,
                  fill: isH ? '#BFD7F7' : '#7FA5D3',
                  fontFamily: 'sans-serif',
                  letterSpacing: '0.02em',
                  pointerEvents: 'none', transition: 'fill 200ms',
                }}>
                {shortName}  ·  {v.deviation}%
              </text>
              {/* Risk-score chip on the right edge */}
              <rect
                x={`${v.x + 2.8}%`} y={`${v.y - 2.3}%`} width="3%" height="4.6%"
                rx="3"
                fill={`${color}30`} stroke={color} strokeWidth="0.8"
                opacity={isH ? 1 : 0.95}
              />
              <text x={`${v.x + 4.3}%`} y={`${v.y - 0.05}%`} textAnchor="middle" dominantBaseline="middle"
                style={{
                  fontSize: '10px', fontWeight: 800,
                  fill: color,
                  fontFamily: "'JetBrains Mono', monospace",
                  pointerEvents: 'none',
                }}>
                {v.risk}
              </text>
              {/* "open →" hint on hover so clicks feel discoverable */}
              {isH && (
                <text x={`${v.x + 4.3}%`} y={`${v.y + 2.5}%`} textAnchor="middle"
                  style={{ fontSize: '6.5px', fontWeight: 700, fill: color, letterSpacing: '0.15em', pointerEvents: 'none' }}>
                  OPEN →
                </text>
              )}
            </g>
          );
        })}

        {/* ── Agent nodes (middle layer) ── */}
        {agents.map((a, idx) => {
          const isH = focus === a.id;
          const isPinned = pinnedAgent === a.id;
          const lit = isLit(a.id);
          const r = isH ? 18 : 15;
          return (
            <g key={a.id}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHovered(a.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => {
                /* Toggle the agent's info panel — first click pins, second
                 * click on the SAME agent unpins. Clicking a different
                 * agent simply moves the pin. */
                setPinnedAgent((prev) => (prev === a.id ? null : a.id));
              }}
            >
              {/* Outer pulse — always on, marks "live" agents */}
              <circle cx={`${a.x}%`} cy={`${a.y}%`} r={r + 5} fill="none" stroke={a.color} strokeWidth="0.8" opacity="0.3">
                <animate attributeName="r" values={`${r + 5};${r + 11};${r + 5}`} dur="3.5s" begin={`${idx * 0.5}s`} repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.35;0;0.35" dur="3.5s" begin={`${idx * 0.5}s`} repeatCount="indefinite"/>
              </circle>
              {/* Pin ring — visible when the agent's panel is locked open. */}
              {isPinned && (
                <circle cx={`${a.x}%`} cy={`${a.y}%`} r={r + 3} fill="none" stroke={a.color} strokeWidth="1.4" opacity="0.95" />
              )}
              {/* ── Agent avatar ──
                  Investigator → Exa logo (its third-party brain),
                  every other agent → the BunkerGuard Kiro mascot. */}
              <KiroGhostNode
                cx={a.x} cy={a.y}
                size={7}
                color={a.color}
                hovered={isH}
                lit={lit}
                idx={idx}
                src={a.key === 'investigator' ? AGENT_AVATAR_SRC.exa : AGENT_AVATAR_SRC.kiro}
              />
              {/* Agent name */}
              <text x={`${a.x}%`} y={`${a.y + 5.5}%`} textAnchor="middle"
                style={{ fontSize: '10px', fontWeight: 700, fill: isH ? '#EAF4FF' : '#BFD7F7', fontFamily: 'sans-serif', pointerEvents: 'none', transition: 'fill 200ms', letterSpacing: '0.04em' }}>
                {a.name}
              </text>
              {/* "click to pin / click to close" hint — only when hovered
                  and not yet pinned, so it doesn't add visual noise once
                  the user has done it once. */}
              {isH && !isPinned && (
                <text x={`${a.x}%`} y={`${a.y + 8}%`} textAnchor="middle"
                  style={{ fontSize: '7.5px', fontWeight: 700, fill: a.color, fontFamily: 'sans-serif', pointerEvents: 'none', letterSpacing: '0.18em' }}>
                  CLICK TO PIN
                </text>
              )}
            </g>
          );
        })}

        {/* Legend labels with intelligence context */}
        <text x="8%"  y="96%" textAnchor="middle" style={{ fontSize: '9px', fill: '#4E7A9A', fontFamily: 'sans-serif', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Suppliers</text>
        <text x="46%" y="96%" textAnchor="middle" style={{ fontSize: '9px', fill: '#2EA8FF', fontFamily: 'sans-serif', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>AI Agents · Workflow</text>
        <text x="88%" y="96%" textAnchor="middle" style={{ fontSize: '9px', fill: '#4E7A9A', fontFamily: 'sans-serif', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Fleet Sessions</text>
      </svg>

      {/* Info panel — pinned agent wins over hover so the operator can move
          the cursor freely once they've clicked. Position is anchored
          NEAR the focused node so the centre-top of the chart (which used
          to overlap the vessel column) is now clear. */}
      {focus && (() => {
        const supplier = suppliers.find(s => s.id === focus);
        const vessel = vessels.find(v => v.id === focus);
        const agent = agents.find(a => a.id === focus);
        if (!supplier && !vessel && !agent) return null;

        /* Position rules (chart container is the % reference):
         *   - Supplier (x≈8%)  → tooltip to its RIGHT, just inside the
         *                        agent column. Vessels stay visible.
         *   - Agent    (x≈46%) → tooltip BELOW the agent. Centre column,
         *                        never bleeds into supplier or vessel
         *                        cards.
         *   - Vessel   (x≈88%) → tooltip to its LEFT so the card itself
         *                        stays uncovered and clickable. */
        let leftPct: number, topPct: number, transform: string;
        if (supplier) {
          leftPct = supplier.x + 8; topPct = supplier.y - 2;
          transform = 'translate(0, -50%)';
        } else if (agent) {
          leftPct = agent.x; topPct = agent.y + 12;
          transform = 'translate(-50%, 0)';
        } else if (vessel) {
          leftPct = vessel.x - 8; topPct = vessel.y;
          transform = 'translate(-100%, -50%)';
        } else {
          leftPct = 50; topPct = 4;
          transform = 'translate(-50%, 0)';
        }
        const isPinned = !!pinnedAgent && pinnedAgent === focus;

        return (
          <div style={{
            position: 'absolute', top: `${topPct}%`, left: `${leftPct}%`, transform,
            width: 220, padding: '12px 14px', borderRadius: 9,
            background: 'rgba(6,14,28,0.98)',
            border: `1px solid ${isPinned ? 'rgba(46,168,255,0.55)' : 'rgba(46,100,168,0.25)'}`,
            boxShadow: isPinned ? '0 6px 20px rgba(46,168,255,0.25), 0 0 0 1px rgba(46,168,255,0.35)' : '0 6px 20px rgba(0,0,0,0.7)',
            pointerEvents: isPinned ? 'auto' : 'none',
            zIndex: 5,
          }}>
            {supplier && (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#EAF4FF', marginBottom: 8 }}>{supplier.name}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                    <span style={{ color: '#7FA5D3' }}>Risk Score:</span>
                    <span style={{ fontWeight: 700, color: riskColor(supplier.risk), fontFamily: "'JetBrains Mono', monospace" }}>{supplier.score}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                    <span style={{ color: '#7FA5D3' }}>{supplier.flagged} sessions flagged</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                    <span style={{ color: '#7FA5D3' }}>Avg discrepancy:</span>
                    <span style={{ fontWeight: 700, color: '#E84E4E', fontFamily: "'JetBrains Mono', monospace" }}>{supplier.discrepancy}%</span>
                  </div>
                </div>
              </>
            )}
            {agent && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ fontSize: 9, color: agent.color, textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700 }}>AI AGENT · {agent.glyph}</div>
                  {isPinned && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setPinnedAgent(null); }}
                      title="Close (or click the same agent again)"
                      style={{
                        background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                        color: '#7FA5D3', borderRadius: 3,
                        width: 18, height: 18, lineHeight: '14px',
                        fontSize: 13, cursor: 'pointer', padding: 0,
                      }}>×</button>
                  )}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#EAF4FF', marginBottom: 6 }}>{agent.name}</div>
                <div style={{ fontSize: 10, color: '#BFD7F7', lineHeight: 1.4, marginBottom: 8 }}>{agent.desc}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                    <span style={{ color: '#7FA5D3' }}>Role:</span>
                    <span style={{ color: agent.color, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                      {agent.key === 'surveyor' ? 'OBSERVE' : agent.key === 'investigator' ? 'CORRELATE' : agent.key === 'compliance' ? 'VERIFY' : 'DECIDE'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                    <span style={{ color: '#7FA5D3' }}>Reads:</span>
                    <span style={{ color: '#BFD7F7' }}>
                      {agent.key === 'surveyor' ? 'MFM · AIS · IoT · geofence' :
                       agent.key === 'investigator' ? 'supplier history + Exa' :
                       agent.key === 'compliance' ? 'MARPOL · MPA · ISO 8217' :
                       'all upstream verdicts'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                    <span style={{ color: '#7FA5D3' }}>Output →</span>
                    <span style={{ color: '#BFD7F7' }}>
                      {agent.key === 'surveyor' ? 'Investigator' :
                       agent.key === 'investigator' ? 'Compliance' :
                       agent.key === 'compliance' ? 'Decision' :
                       'Chief Engineer + sessions'}
                    </span>
                  </div>
                </div>
              </>
            )}
            {vessel && (
              <>
                <div style={{ fontSize: 10, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 4 }}>Session #{vessel.session}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#EAF4FF', marginBottom: 8 }}>{vessel.name}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                    <span style={{ color: '#7FA5D3' }}>Supplier:</span>
                    <span style={{ color: '#BFD7F7' }}>{vessel.supplier}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                    <span style={{ color: '#7FA5D3' }}>Risk:</span>
                    <span style={{ fontWeight: 700, color: riskColor(vessel.risk >= 70 ? 'CRITICAL' : vessel.risk >= 50 ? 'HIGH' : vessel.risk >= 30 ? 'MODERATE' : 'LOW'), fontFamily: "'JetBrains Mono', monospace" }}>{vessel.risk}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                    <span style={{ color: '#7FA5D3' }}>Deviation:</span>
                    <span style={{ fontWeight: 700, color: '#E84E4E', fontFamily: "'JetBrains Mono', monospace" }}>{vessel.deviation}%</span>
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* Intelligence layer indicator */}
      <div style={{ position: 'absolute', top: 12, left: 14, display: 'flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 7, background: 'rgba(46,168,255,0.10)', border: '1px solid rgba(46,168,255,0.20)', boxShadow: '0 0 12px rgba(46,168,255,0.15)' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#2EA8FF', boxShadow: '0 0 8px rgba(46,168,255,0.6)', animation: 'livePulse 3s ease-in-out infinite' }} />
        <span style={{ fontSize: 9, fontWeight: 700, color: '#2EA8FF', textTransform: 'uppercase', letterSpacing: '0.10em' }}>4-Agent Workflow · Live</span>
      </div>

      {/* Copilot observer badge — the 5th identity, floating off-chain */}
      <div
        onMouseEnter={() => setHovered('A0')}
        onMouseLeave={() => setHovered(null)}
        style={{ position: 'absolute', bottom: 38, left: '46%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 12, background: 'rgba(163,108,255,0.12)', border: '1px dashed rgba(163,108,255,0.45)', cursor: 'help' }}
      >
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#A36CFF', animation: 'livePulse 2.5s ease-in-out infinite' }} />
        <span style={{ fontSize: 9, fontWeight: 700, color: '#A36CFF', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Copilot · explains</span>
      </div>

    </div>
  );
}

/* ── Supplier data ───────────────────────────────────────────────── */
const SUPPLIER_LIST = [
  { key: 'SupplierGamma', label: 'BunkerGuard Demo Supplier Gamma Pte Ltd', risk: 'CRITICAL', riskColor: '#E84E4E', trust: 38 },
  { key: 'SupplierBeta',  label: 'BunkerGuard Demo Supplier Beta Pte Ltd',  risk: 'HIGH',     riskColor: '#E0A020', trust: 58 },
  { key: 'SupplierAlpha', label: 'BunkerGuard Demo Supplier Alpha Pte Ltd', risk: 'LOW',      riskColor: '#34C98C', trust: 78 },
  { key: 'OceanBunker',   label: 'OceanBunker International',               risk: 'SUSPENDED', riskColor: '#E84E4E', trust: 0 },
];

const DOSSIER_DATA: Record<string, {
  fullName: string; rank: number;
  aiRisk: string; aiConf: string; riskColor: string; exposure: string; aiPattern: string;
  context: { trigger: string; sessions: string };
  flags: { text: string; sub: string; sev: 'critical' | 'high' | 'moderate' | 'ok' }[];
  recommendations: string[];
}> = {
  SupplierGamma: {
    fullName: 'BunkerGuard Demo Supplier Gamma Pte Ltd', rank: 1,
    aiRisk: 'CRITICAL', aiConf: '94%', riskColor: '#E84E4E', exposure: 'USD 32,405',
    aiPattern: 'Systematic underfueling pattern confirmed',
    context: { trigger: 'AI detected systematic underfueling pattern. MPA notification issued on 2026-06-10.', sessions: 'SES-2026-012, 016, 019, 021' },
    flags: [
      { text: '9 of last 22 deliveries flagged', sub: 'Consistent short-delivery pattern — highest mismatch count', sev: 'critical' },
      { text: '3 Letters of Protest issued', sub: 'Most disputes among all registered suppliers', sev: 'critical' },
      { text: '4 Critical incidents recorded', sub: 'Multiple REFUSE_TO_SIGN verdicts across sessions', sev: 'critical' },
      { text: 'Average shortage rate: 2.31%', sub: 'Exceeds MPA 2.0% tolerance threshold', sev: 'critical' },
      { text: 'Trust score declined from 62 → 38', sub: '24-point drop in 5 weeks — worsening trend', sev: 'critical' },
      { text: 'MPA notification issued', sub: 'Regulatory escalation on 2026-06-10', sev: 'high' },
    ],
    recommendations: [
      'DO NOT ENGAGE — suspend all future deliveries pending MPA review',
      'Require independent survey for any outstanding deliveries',
      'Escalate all anomalies automatically to MPA',
      'Consider legal action for systematic fraud pattern',
    ],
  },
  SupplierBeta: {
    fullName: 'BunkerGuard Demo Supplier Beta Pte Ltd', rank: 2,
    aiRisk: 'HIGH', aiConf: '89%', riskColor: '#E0A020', exposure: 'USD 5,137',
    aiPattern: 'Repeated discrepancy pattern detected',
    context: { trigger: 'Multiple delivery discrepancies flagged across 5 of 20 sessions.', sessions: 'SES-2026-015, 022' },
    flags: [
      { text: '5 of last 20 deliveries flagged', sub: 'Consistent delivery irregularities detected', sev: 'high' },
      { text: '2 Letters of Protest issued', sub: 'Above fleet average dispute rate', sev: 'high' },
      { text: '1 Critical incident recorded', sub: 'Session SES-2026-022 flagged as CRITICAL', sev: 'high' },
      { text: 'Average shortage rate: 1.22%', sub: 'Within MPA tolerance but trending upward', sev: 'moderate' },
      { text: 'Trust score stable at 58 / 100', sub: 'MONITORING status — requires enhanced oversight', sev: 'moderate' },
    ],
    recommendations: [
      'Enable enhanced MFM monitoring for next 5 sessions',
      'Require independent survey for deliveries >300 MT',
      'Flag supplier for quarterly review',
      'Monitor for pattern escalation',
    ],
  },
  SupplierAlpha: {
    fullName: 'BunkerGuard Demo Supplier Alpha Pte Ltd', rank: 3,
    aiRisk: 'LOW', aiConf: '92%', riskColor: '#34C98C', exposure: 'USD 890',
    aiPattern: 'Stable performance — minimal discrepancies',
    context: { trigger: 'Low-risk supplier with stable delivery record across 26 sessions.', sessions: 'SES-2026-014' },
    flags: [
      { text: '3 of last 26 deliveries flagged', sub: 'Minor discrepancies only — no systematic pattern', sev: 'ok' },
      { text: '0 Letters of Protest issued', sub: 'Clean dispute record', sev: 'ok' },
      { text: '1 Critical incident', sub: 'Isolated anomaly — not part of systematic pattern', sev: 'moderate' },
      { text: 'Average shortage rate: 0.31%', sub: 'Well within MPA 2.0% tolerance threshold', sev: 'ok' },
      { text: 'Trust score stable at 78 / 100', sub: 'Consistent performance — STABLE trend', sev: 'ok' },
    ],
    recommendations: [
      'Maintain standard delivery monitoring protocol',
      'Continue approved supplier status',
      'No immediate action required',
    ],
  },
  OceanBunker: {
    fullName: 'OceanBunker International', rank: 4,
    aiRisk: 'SUSPENDED', aiConf: '100%', riskColor: '#E84E4E', exposure: '—',
    aiPattern: 'MPA licence verification failed',
    context: { trigger: 'MPA licence NOT REGISTERED. DO NOT ENGAGE.', sessions: '—' },
    flags: [
      { text: 'MPA licence verification FAILED', sub: 'Supplier not registered with Maritime and Port Authority', sev: 'critical' },
      { text: 'Regulatory compliance violation', sub: 'Unlicensed operation — illegal supplier', sev: 'critical' },
      { text: '1 Critical incident recorded', sub: 'Attempted engagement detected and blocked', sev: 'critical' },
      { text: 'Trust score: 0 / 100', sub: 'SUSPENDED — DO NOT ENGAGE', sev: 'critical' },
    ],
    recommendations: [
      'DO NOT ENGAGE under any circumstances',
      'Report to MPA if approached by this supplier',
      'Block from all supplier databases',
      'Flag for potential fraud investigation',
    ],
  },
};

const SIMILAR_CASES = [
  { id: 18, type: 'Quantity Shortage', match: 94 },
  { id: 14, type: 'Quantity Shortage', match: 88 },
  { id: 21, type: 'Supplier Dispute',  match: 71 },
];

/* ── AI Supplier Dossier ─────────────────────────────────────────── */
function SupplierIntelligencePanel({ selectedSupplier, onSelect }: { selectedSupplier: string | null; onSelect: (s: string | null) => void }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const activeKey = selectedSupplier && DOSSIER_DATA[selectedSupplier] ? selectedSupplier : null;
  const d = activeKey ? DOSSIER_DATA[activeKey] : null;

  const flagColor = (sev: string) =>
    sev === 'critical' ? '#E84E4E' : sev === 'high' ? '#E0A020' : sev === 'ok' ? '#34C98C' : '#3AABFF';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Multi-supplier awareness bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '9px 18px', borderRadius: 7, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#3AABFF', animation: 'livePulse 2.5s ease-in-out infinite' }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: '#7FA5D3', textTransform: 'uppercase', letterSpacing: '0.1em' }}>4 Suppliers Under AI Monitoring</span>
        </div>
        <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />
        {[
          { label: 'Critical', count: 2, color: '#E84E4E' },
          { label: 'High', count: 1, color: '#E0A020' },
          { label: 'Low Risk', count: 1, color: '#34C98C' },
        ].map(r => (
          <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: r.color, opacity: 0.85 }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: r.color }}>{r.count}</span>
            <span style={{ fontSize: 10, color: '#5A8AB4' }}>{r.label}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 9, color: d ? '#5A8AB4' : '#4E7A9A', fontStyle: d ? 'normal' : 'italic' }}>
          {d ? <span>Viewing: <span style={{ color: d.riskColor, fontWeight: 700 }}>{d.fullName}</span></span>
              : 'Select a supplier below to open AI investigation report →'}
        </div>
      </div>

      {/* Main card */}
      <div style={{ ...CARD, overflow: 'hidden' }}>
        {!d ? (
          /* ── Empty state ── */
          <div style={{ padding: '30px 28px' }}>
            <div style={{ textAlign: 'center', marginBottom: 22 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>AI Supplier Investigation</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#EAF4FF', marginBottom: 6 }}>Select a Supplier to Investigate</div>
              <div style={{ fontSize: 11, color: '#5A8AB4' }}>The AI has analysed 4 suppliers. Select one to open the full AI investigation report.</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {SUPPLIER_LIST.map(sup => (
                <div key={sup.key}
                  style={{ padding: '14px 14px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', gap: 10, transition: 'all 160ms' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = `${sup.riskColor}45`; e.currentTarget.style.background = `${sup.riskColor}08`; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                >
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#BFD7F7', marginBottom: 2 }}>{sup.key}</div>
                    <div style={{ fontSize: 9, color: '#5A8AB4' }}>{sup.label}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: sup.riskColor, background: `${sup.riskColor}18`, border: `1px solid ${sup.riskColor}30`, padding: '2px 7px', borderRadius: 4, textTransform: 'uppercase', alignSelf: 'flex-start' }}>{sup.risk}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ flex: 1, height: 2, borderRadius: 1, background: 'rgba(255,255,255,0.08)' }}>
                        <div style={{ width: `${sup.trust}%`, height: '100%', borderRadius: 1, background: sup.riskColor, opacity: 0.65 }} />
                      </div>
                      <span style={{ fontSize: 9, color: '#5A8AB4', fontFamily: "'JetBrains Mono', monospace" }}>{sup.trust}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => onSelect(sup.key)}
                    style={{ width: '100%', padding: '6px 0', borderRadius: 5, fontSize: 10, fontWeight: 600, cursor: 'pointer', background: `${sup.riskColor}14`, border: `1px solid ${sup.riskColor}35`, color: sup.riskColor, transition: 'all 140ms' }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${sup.riskColor}26`; }}
                    onMouseLeave={e => { e.currentTarget.style.background = `${sup.riskColor}14`; }}
                  >Investigate</button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* ── Active dossier ── */
          <>

      {/* ── Header ── */}
      <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ fontSize: 9, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700, marginBottom: 2 }}>AI Investigation Report</div>
          <div style={{ fontSize: 10, color: '#4E7A9A', marginBottom: 3 }}>Supplier Under Investigation</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#EAF4FF', marginBottom: 4 }}>{d.fullName}</div>
          <div style={{ fontSize: 9, color: '#4E7A9A' }}>Supplier {d.rank} of 4 Monitored Suppliers</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          <span style={{ padding: '4px 10px', borderRadius: 5, fontSize: 10, fontWeight: 700, color: d.riskColor, background: `${d.riskColor}16`, border: `1px solid ${d.riskColor}35`, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {d.aiRisk}
          </span>
          <div>
            <div style={{ fontSize: 9, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>AI Confidence</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#3AABFF', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{d.aiConf}</div>
          </div>
          <button
            onClick={() => { setSelectedSupplierKey(activeKey); setProfilePanelOpen(true); }}
            style={{ padding: '7px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'rgba(74,158,255,0.12)', border: '1px solid rgba(74,158,255,0.28)', color: '#4A9EFF', transition: 'all 150ms', whiteSpace: 'nowrap' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(74,158,255,0.18)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(74,158,255,0.12)'; }}
          >
            View Full Profile
          </button>
          {/* Dropdown */}
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 8, color: '#4E7A9A', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 3 }}>Investigate Supplier</div>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px 5px 12px', borderRadius: 5, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#BFD7F7', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 140ms' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
            >
              {SUPPLIER_LIST.find(s => s.key === activeKey)?.key}
              <span style={{ fontSize: 9, color: '#5A8AB4', marginLeft: 2 }}>▼</span>
            </button>
            {dropdownOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 98 }} onClick={() => setDropdownOpen(false)} />
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, width: 192, borderRadius: 7, background: '#0B1C30', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 8px 24px rgba(0,0,0,0.65)', zIndex: 99, overflow: 'hidden' }}>
                  {SUPPLIER_LIST.map(s => (
                    <div key={s.key}
                      onClick={() => { onSelect(s.key); setDropdownOpen(false); }}
                      style={{ padding: '9px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9, background: s.key === activeKey ? 'rgba(58,171,255,0.08)' : 'transparent', transition: 'background 120ms' }}
                      onMouseEnter={e => { if (s.key !== activeKey) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                      onMouseLeave={e => { if (s.key !== activeKey) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.riskColor, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: s.key === activeKey ? '#3AABFF' : '#BFD7F7' }}>{s.key}</div>
                        <div style={{ fontSize: 9, color: '#5A8AB4' }}>{s.risk}</div>
                      </div>
                      {s.key === activeKey && <span style={{ fontSize: 9, color: '#3AABFF' }}>✓</span>}
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '8px 14px' }}>
                    <button onClick={() => { onSelect(null); setDropdownOpen(false); }} style={{ fontSize: 10, color: '#5A8AB4', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>← Back to supplier list</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Investigation Context Panel */}
      <div style={{ padding: '11px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: `${d.riskColor}0A`, display: 'flex', alignItems: 'center', gap: 24 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 3 }}>Investigation Trigger</div>
          <div style={{ fontSize: 11, color: '#BFD7F7', lineHeight: 1.5 }}>{d.context.trigger}</div>
        </div>
        <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 9, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>Confidence</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: d.riskColor, fontFamily: "'JetBrains Mono', monospace" }}>{d.aiConf}</div>
        </div>
        <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 9, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>Affected Sessions</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#BFD7F7', fontFamily: "'JetBrains Mono', monospace" }}>{d.context.sessions}</div>
        </div>
        <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 9, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>Est. Exposure</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: d.riskColor, fontFamily: "'JetBrains Mono', monospace" }}>{d.exposure}</div>
        </div>
      </div>

      {/* ── Body: 60/40 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '60% 40%', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>

        {/* Left — AI Investigation Summary */}
        <div style={{ padding: '20px 24px', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: 9, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700, marginBottom: 14 }}>AI Investigation Summary</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {d.flags.map((flag, i) => {
              const fc = flagColor(flag.sev);
              const conf = [96, 91, 89, 84, 78][i] ?? 80;
              return (
                <div key={i} style={{ padding: '11px 14px', borderRadius: 7, background: 'rgba(4,10,18,0.5)', border: `1px solid rgba(255,255,255,0.06)`, borderLeft: `3px solid ${fc}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ fontSize: 9, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Pattern #{i + 1}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 9, color: '#4E7A9A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Confidence</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: fc, fontFamily: "'JetBrains Mono', monospace" }}>{conf}%</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#EAF4FF', marginBottom: 3 }}>{flag.text}</div>
                  <div style={{ fontSize: 10, color: '#7FA5D3', lineHeight: 1.5 }}>{flag.sub}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right — AI Assessment */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 9, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700, marginBottom: 2 }}>AI Assessment</div>

          <div style={{ padding: '12px 14px', borderRadius: 7, background: 'rgba(4,10,18,0.5)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontSize: 9, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>Risk Level</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: d.riskColor, fontFamily: "'JetBrains Mono', monospace" }}>{d.aiRisk}</div>
          </div>

          <div style={{ padding: '12px 14px', borderRadius: 7, background: 'rgba(4,10,18,0.5)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontSize: 9, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>Likely Pattern</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#BFD7F7', lineHeight: 1.5 }}>{d.aiPattern}</div>
          </div>

          <div style={{ padding: '12px 14px', borderRadius: 7, background: 'rgba(4,10,18,0.5)', border: '1px solid rgba(255,255,255,0.07)', flex: 1 }}>
            <div style={{ fontSize: 9, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>AI Recommendation</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {d.recommendations.map((rec, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#3AABFF', marginTop: 5, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: '#BFD7F7', lineHeight: 1.4 }}>{rec}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: '12px 14px', borderRadius: 7, background: `${d.riskColor}10`, border: `1px solid ${d.riskColor}28` }}>
            <div style={{ fontSize: 9, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Potential Exposure</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: d.riskColor, fontFamily: "'JetBrains Mono', monospace" }}>{d.exposure}</div>
          </div>
        </div>
      </div>

      {/* ── Bottom: Similar Historical Incidents ── */}
      <div style={{ padding: '16px 24px' }}>
        <div style={{ fontSize: 9, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700, marginBottom: 12 }}>Similar Historical Incidents · AI Pattern Match</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {SIMILAR_CASES.map(inc => (
            <div key={inc.id} style={{ ...CARD, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'border-color 150ms' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(74,158,255,0.3)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)')}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#5A8AB4', fontFamily: "'JetBrains Mono', monospace" }}>#{inc.id}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: inc.match >= 90 ? '#3AABFF' : '#7FA5D3', fontFamily: "'JetBrains Mono', monospace" }}>{inc.match}%</span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#BFD7F7', marginBottom: 2 }}>{inc.type}</div>
                <div style={{ fontSize: 9, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.07em' }}>AI Match</div>
              </div>
              <button onClick={() => navigate('/evidence', { state: { sessionId: inc.id } })} style={{ padding: '5px 10px', borderRadius: 5, fontSize: 9, fontWeight: 600, color: '#7FA5D3', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 140ms' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#3AABFF'; e.currentTarget.style.borderColor = 'rgba(58,171,255,0.3)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#7FA5D3'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; }}
              >
                View Evidence
              </button>
            </div>
          ))}
        </div>
      </div>
          </>
        )}
      </div>
    </div>
  );
}

export function IntelligencePage() {
  const [activeTab, setActiveTab] = useState<Tab>('supplier');
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
  const [profilePanelOpen, setProfilePanelOpen] = useState(false);
  const [selectedSupplierKey, setSelectedSupplierKey] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleInvestigate = (key: string | null) => {
    setSelectedSupplier(key);
    if (key) setTimeout(() => document.getElementById('supplier-dossier')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  // Fleet-wide stats
  const activeRiskSignals = 4;
  const flaggedSuppliers = 3;
  const affectedSessions = 8;
  const estimatedExposure = 18620;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative' }}>

      {/* Header + tabs */}
      <div style={{ padding: '28px 32px 0', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(4,10,20,0.7)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#EAF4FF', lineHeight: 1, letterSpacing: '-0.02em', margin: 0, marginBottom: 6 }}>Intelligence</h1>
            <div style={{ fontSize: 11, color: '#7FA5D3' }}>Fleet-wide supplier and vessel risk analysis</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 2 }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '9px 22px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                background: activeTab === tab.id ? 'rgba(46,168,255,0.1)' : 'transparent',
                color: activeTab === tab.id ? '#2EA8FF' : '#7FA5D3',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid #2EA8FF' : '2px solid transparent',
                borderRadius: '8px 8px 0 0',
                transition: 'all 160ms',
                letterSpacing: '0.02em',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content — no inner overflowY any more; lets <main> handle
          one consistent scroll-axis across the app. */}
      <div style={{ flex: 1, minHeight: 0 }}>
      <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ══ TAB 1: SUPPLIER INTELLIGENCE ══════════════════════════════ */}
        {activeTab === 'supplier' && (
          <>
            {/* Section 1 — Intelligence Overview */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { label: 'Active Risk Signals', value: activeRiskSignals.toString(), color: '#E84E4E', sub: '↑ 2 since yesterday' },
                { label: 'Flagged Suppliers',   value: flaggedSuppliers.toString(),   color: '#E0A020', sub: 'MegaFuel critical' },
                { label: 'Affected Sessions',   value: affectedSessions.toString(),   color: '#3AABFF', sub: '3 require action' },
                { label: 'Estimated Exposure',  value: `$${(estimatedExposure / 1000).toFixed(1)}K`, color: '#E84E4E', sub: 'Across 3 suppliers' },
              ].map(kpi => (
                <div key={kpi.label} style={{ ...CARD, padding: '14px 18px' }}>
                  <div style={LABEL}>{kpi.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: kpi.color, lineHeight: 1, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '-0.02em', marginBottom: 5 }}>
                    {kpi.value}
                  </div>
                  <div style={{ fontSize: 9, color: '#5A8AB4' }}>{kpi.sub}</div>
                </div>
              ))}
            </div>

            {/* Section 2 — Supplier–Vessel Risk Network (hero) */}
            <div style={{ ...CARD, padding: '18px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#EAF4FF' }}>Supplier–Vessel Risk Network</div>
                  <div style={{ fontSize: 11, color: '#5A8AB4', marginTop: 3 }}>AI correlates supplier behaviour across active and historical bunkering sessions</div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  {[['CRITICAL', '#E84E4E'], ['HIGH', '#E0A020'], ['MODERATE', '#3AABFF'], ['LOW', '#34C98C']].map(([l, c]) => (
                    <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 16, height: 2, background: c, borderRadius: 1, opacity: 0.7 }} />
                      <span style={{ fontSize: 8, color: '#7FA5D3', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{l}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Network graph */}
              <NetworkGraph
                onSupplierClick={(name) => setSelectedSupplier(name)}
                /* Vessel session click → open the session in the
                 * Sessions detail page. Session numbers are stored as
                 * plain ints in the chart data (e.g. 16) but Supabase
                 * IDs are zero-padded "SES-2026-016", so we format
                 * here before navigating. */
                onVesselClick={(session) =>
                  navigate(`/sessions/SES-2026-${String(session).padStart(3, '0')}`)
                }
              />

              {/* AI Generated Insights — lives BELOW the chart now (used
               *  to be absolutely-positioned over the top-right of the
               *  network and was blocking the vessel column). Rendered as
               *  a horizontal banner so it doesn't add much vertical
               *  height. Click the affected-session chips → navigate to
               *  that session's detail view. */}
              <div style={{
                marginTop: 12,
                background: 'rgba(6,14,28,0.92)',
                border: '1px solid rgba(74,158,255,0.22)',
                borderRadius: 10,
                padding: '12px 16px',
                display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap',
                boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3AABFF', animation: 'livePulse 2s ease-in-out infinite' }} />
                  <span style={{ fontSize: 9, fontWeight: 800, color: '#3AABFF', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                    AI Generated Insights
                  </span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#EAF4FF', flex: 1, minWidth: 240 }}>
                  Recurring shortage behaviour detected across 3 MegaFuel deliveries
                </div>
                <InsightStat label="Confidence"   value="94%"     color="#3AABFF" />
                <InsightStat label="Est. Exposure" value="$17,620" color="#E84E4E" />
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 9, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.10em', fontWeight: 700 }}>Affected</span>
                  {[16, 19, 20].map((s) => (
                    <button
                      key={s}
                      onClick={() => navigate(`/sessions/SES-2026-${String(s).padStart(3, '0')}`)}
                      style={{
                        padding: '3px 8px', borderRadius: 4,
                        fontSize: 11, fontWeight: 800,
                        fontFamily: "'JetBrains Mono', monospace",
                        background: 'rgba(232,78,78,0.10)',
                        border: '1px solid rgba(232,78,78,0.35)',
                        color: '#E84E4E', cursor: 'pointer',
                        transition: 'all 140ms',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(232,78,78,0.20)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(232,78,78,0.10)'; }}
                    >#{s}</button>
                  ))}
                </div>
                <div style={{
                  padding: '4px 10px', borderRadius: 4,
                  background: 'rgba(232,78,78,0.08)',
                  border: '1px solid rgba(232,78,78,0.30)',
                  fontSize: 11, color: '#FFA8A8', fontWeight: 600,
                }}>
                  <span style={{ color: '#E84E4E', fontWeight: 800 }}>Action: </span>
                  Independent survey required
                </div>
              </div>
            </div>

            {/* Section 2.5 — Live Agent Conversation (the network's payload) */}
            <AgentConversationStream sessionId="SES-2026-016" />

            {/* Section 3 — AI Alert Feed */}
            <div style={{ ...CARD, overflow: 'hidden' }}>
              <div style={{ padding: '11px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#E84E4E', animation: 'livePulse 2s ease-in-out infinite' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#EAF4FF' }}>AI Alert Feed</span>
                </div>
                <span style={{ fontSize: 9, fontWeight: 600, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.09em' }}>4 active signals</span>
              </div>
              {[
                {
                  sev: 'CRITICAL', color: '#E84E4E',
                  title: 'Supplier Gamma Risk Escalation Detected',
                  summary: 'Systematic underfueling pattern confirmed. MPA notification issued 2026-06-10.',
                  conf: '94%',
                  action: 'Investigate Supplier',
                  onAction: () => handleInvestigate('SupplierGamma'),
                },
                {
                  sev: 'CRITICAL', color: '#E84E4E',
                  title: 'A02 Quantity Final Mismatch — SES-2026-016',
                  summary: 'MFM Final: 481.2 MT vs BDN Declared: 500.0 MT. Discrepancy: 18.8 MT (3.76%).',
                  conf: '91%',
                  action: 'Review Evidence',
                  onAction: () => navigate('/evidence'),
                },
                {
                  sev: 'HIGH', color: '#E0A020',
                  title: 'Repeated Discrepancy Pattern — Supplier Gamma',
                  summary: 'Pattern detected across SES-2026-012, 016, 019, 021. Total exposure: USD 32,405.',
                  conf: '89%',
                  action: 'View Sessions',
                  onAction: () => navigate('/sessions'),
                },
                {
                  sev: 'CRITICAL', color: '#E84E4E',
                  title: 'OceanBunker International — Licence Failed',
                  summary: 'MPA licence verification failed. NOT REGISTERED. DO NOT ENGAGE.',
                  conf: '100%',
                  action: 'View Details',
                  onAction: () => handleInvestigate('OceanBunker'),
                },
              ].map((alert, i, arr) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 20px', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', transition: 'background 130ms' }}
                  onMouseEnter={e => (e.currentTarget.style.background = `${alert.color}05`)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Severity bar */}
                  <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: alert.color, flexShrink: 0, opacity: 0.8 }} />
                  {/* Severity badge */}
                  <span style={{ fontSize: 8, fontWeight: 700, color: alert.color, background: `${alert.color}18`, border: `1px solid ${alert.color}30`, padding: '2px 7px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.09em', flexShrink: 0, minWidth: 64, textAlign: 'center' }}>{alert.sev}</span>
                  {/* Title + summary */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#EAF4FF', marginBottom: 2 }}>{alert.title}</div>
                    <div style={{ fontSize: 10, color: '#7FA5D3', lineHeight: 1.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{alert.summary}</div>
                  </div>
                  {/* Confidence */}
                  <div style={{ textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: 8, color: '#4E7A9A', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 1 }}>Conf.</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: alert.color, fontFamily: "'JetBrains Mono', monospace" }}>{alert.conf}</div>
                  </div>
                  {/* Action button */}
                  <button
                    onClick={alert.onAction}
                    style={{ padding: '6px 14px', borderRadius: 5, fontSize: 10, fontWeight: 600, cursor: 'pointer', background: `${alert.color}14`, border: `1px solid ${alert.color}35`, color: alert.color, whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 140ms' }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${alert.color}26`; }}
                    onMouseLeave={e => { e.currentTarget.style.background = `${alert.color}14`; }}
                  >{alert.action}</button>
                </div>
              ))}
            </div>

            {/* Section 4 — Supplier Watchlist */}
            <div style={{ ...CARD, overflow: 'hidden' }}>
              <div style={{ padding: '13px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#EAF4FF' }}>Supplier Watchlist</div>
                <span style={{ fontSize: 9, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 600 }}>Ranked by risk</span>
              </div>
              {[
                { name: 'BunkerGuard Demo Supplier Gamma Pte Ltd', trust: 38, risk: 'CRITICAL', riskColor: '#E84E4E', exposure: 'USD 32,405', key: 'SupplierGamma' },
                { name: 'BunkerGuard Demo Supplier Beta Pte Ltd',  trust: 58, risk: 'HIGH',     riskColor: '#E0A020', exposure: 'USD 5,137',  key: 'SupplierBeta' },
                { name: 'BunkerGuard Demo Supplier Alpha Pte Ltd', trust: 78, risk: 'LOW',      riskColor: '#34C98C', exposure: 'USD 890',    key: 'SupplierAlpha' },
                { name: 'OceanBunker International',               trust: 0,  risk: 'SUSPENDED',riskColor: '#E84E4E', exposure: '—',         key: 'OceanBunker' },
              ].map((sup, idx, arr) => (
                <div key={idx}
                  onClick={() => handleInvestigate(sup.key)}
                  style={{ display: 'grid', gridTemplateColumns: '1fr 140px 90px auto', alignItems: 'center', gap: 0, padding: '10px 20px', borderBottom: idx < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', transition: 'background 130ms', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(74,158,255,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Supplier + trust bar */}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#BFD7F7', marginBottom: 5 }}>{sup.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, maxWidth: 120, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}>
                        <div style={{ width: `${sup.trust}%`, height: '100%', borderRadius: 2, background: sup.riskColor, opacity: 0.7 }} />
                      </div>
                      <span style={{ fontSize: 9, color: '#5A8AB4', fontFamily: "'JetBrains Mono', monospace" }}>{sup.trust}</span>
                    </div>
                  </div>
                  {/* Risk chip */}
                  <div>
                    <span style={{ padding: '3px 9px', borderRadius: 4, fontSize: 9, fontWeight: 700, color: sup.riskColor, background: `${sup.riskColor}14`, border: `1px solid ${sup.riskColor}28`, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{sup.risk}</span>
                  </div>
                  {/* Exposure */}
                  <div style={{ fontSize: 11, fontWeight: 700, color: sup.exposure !== '—' ? '#E84E4E' : '#5A8AB4', fontFamily: "'JetBrains Mono', monospace" }}>{sup.exposure}</div>
                  {/* Investigate button */}
                  <div style={{ paddingLeft: 12 }}>
                    <button
                      onClick={() => handleInvestigate(sup.key)}
                      style={{ padding: '5px 12px', borderRadius: 5, fontSize: 9, fontWeight: 600, cursor: 'pointer', color: sup.riskColor, background: `${sup.riskColor}12`, border: `1px solid ${sup.riskColor}30`, whiteSpace: 'nowrap', transition: 'all 140ms' }}
                      onMouseEnter={e => { e.currentTarget.style.background = `${sup.riskColor}22`; }}
                      onMouseLeave={e => { e.currentTarget.style.background = `${sup.riskColor}12`; }}
                    >Investigate</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Supplier Intelligence Profile */}
            <div id="supplier-dossier">
              <SupplierIntelligencePanel selectedSupplier={selectedSupplier} onSelect={handleInvestigate} />
            </div>
          </>
        )}

        {/* ══ TAB 2: FLEET IMPACT ANALYSIS ══════════════════════════════ */}
        {activeTab === 'fleet' && (
          <>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { label: 'Affected Vessels',    value: '6',       color: '#E84E4E', sub: 'Across 3 suppliers' },
                { label: 'At-Risk Sessions',    value: '8',       color: '#E0A020', sub: '#16 #19 #20 and 5 more' },
                { label: 'Potential Exposure',  value: '$28.8K',  color: '#E84E4E', sub: 'If unresolved' },
              ].map(kpi => (
                <div key={kpi.label} style={{ ...CARD, padding: '14px 18px' }}>
                  <div style={LABEL}>{kpi.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: kpi.color, lineHeight: 1, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '-0.02em', marginBottom: 5 }}>{kpi.value}</div>
                  <div style={{ fontSize: 9, color: '#5A8AB4' }}>{kpi.sub}</div>
                </div>
              ))}
            </div>

            {/* 2-col: Affected Fleet + Cascading Impact */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'stretch' }}>

              {/* Affected Fleet */}
              <div style={{ ...CARD, overflow: 'hidden' }}>
                <div style={{ padding: '13px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#EAF4FF' }}>Affected Fleet</div>
                  <div style={{ fontSize: 10, color: '#5A8AB4', marginTop: 2 }}>Vessels with active or historical risk from flagged suppliers</div>
                </div>
                {[
                  { vessel: 'MV Pacific Harmony', session: 16, supplier: 'MegaFuel', risk: 78, deviation: '3.76%', sev: '#E84E4E' },
                  { vessel: 'MV Harbor Crest',    session: 19, supplier: 'MegaFuel', risk: 72, deviation: '2.88%', sev: '#E84E4E' },
                  { vessel: 'MV Meridian Star',   session: 20, supplier: 'MegaFuel', risk: 68, deviation: '2.34%', sev: '#E0A020' },
                  { vessel: 'MV Atlantic Pride',  session: 15, supplier: 'OceanFuel', risk: 62, deviation: '2.14%', sev: '#E0A020' },
                  { vessel: 'MV Quantum Star',    session: 14, supplier: 'MegaFuel', risk: 58, deviation: '1.45%', sev: '#E0A020' },
                  { vessel: 'MV Northern Tide',   session: 22, supplier: 'SinoMarine', risk: 52, deviation: '1.18%', sev: '#3AABFF' },
                ].map((v, i, arr) => (
                  <div key={i} onClick={() => navigate('/sessions', { state: { selectedSessionId: v.session } })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', transition: 'background 130ms', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(74,158,255,0.04)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: v.sev, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#BFD7F7' }}>{v.vessel}</div>
                      <div style={{ fontSize: 9, color: '#5A8AB4' }}>#{v.session} · {v.supplier}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: v.sev, fontFamily: "'JetBrains Mono', monospace" }}>{v.risk}</div>
                      <div style={{ fontSize: 9, color: '#5A8AB4' }}>{v.deviation}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Cascading Risk Impact */}
              <div style={{ ...CARD, padding: '18px 22px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#EAF4FF', marginBottom: 4 }}>Risk Spread Analysis</div>
                <div style={{ fontSize: 10, color: '#5A8AB4', marginBottom: 20 }}>Cascading impact from flagged supplier activity</div>

                {[
                  { label: 'Supplier', items: ['MegaFuel Pte Ltd'], color: '#E84E4E', icon: '⬡' },
                  { label: 'Affected Vessels', items: ['MV Pacific Harmony', 'MV Harbor Crest', 'MV Meridian Star'], color: '#E0A020', icon: '⬡' },
                  { label: 'Affected Deliveries', items: ['Session #16 · 18.8 MT shortage', 'Session #19 · 6.2 MT shortage', 'Session #20 · 5.8 MT shortage'], color: '#3AABFF', icon: '⬡' },
                  { label: 'Potential Future Risk', items: ['2 upcoming MegaFuel sessions flagged for enhanced monitoring'], color: '#34C98C', icon: '⬡' },
                ].map((tier, i, arr) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: i < arr.length - 1 ? 0 : 0 }}>
                    <div style={{ width: '100%', padding: '11px 16px', borderRadius: 7, background: `${tier.color}0C`, border: `1px solid ${tier.color}28` }}>
                      <div style={{ fontSize: 9, color: tier.color, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 6 }}>{tier.label}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {tier.items.map((item, j) => (
                          <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#BFD7F7' }}>
                            <div style={{ width: 4, height: 4, borderRadius: '50%', background: tier.color, flexShrink: 0 }} />
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                    {i < arr.length - 1 && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0' }}>
                        <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.12)' }} />
                        <div style={{ fontSize: 9, color: '#4E7A9A', lineHeight: 1 }}>↓</div>
                        <div style={{ width: 1, height: 6, background: 'rgba(255,255,255,0.12)' }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Historical Pattern Matching */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#EAF4FF', marginBottom: 12 }}>Historical Pattern Matching</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { id: 18, match: 94, type: 'Quantity Shortage',  detail: 'MegaFuel · 0.55% shortage · Jun 2025' },
                  { id: 14, match: 88, type: 'MFM Drift Pattern',  detail: 'OceanFuel · Rule A07 triggered · Apr 2025' },
                  { id: 21, match: 71, type: 'Supplier Dispute',   detail: 'SinoMarine · AIS anomaly · Mar 2025' },
                ].map(inc => (
                  <div key={inc.id} style={{ ...CARD, padding: '14px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#5A8AB4', fontFamily: "'JetBrains Mono', monospace" }}>Case #{inc.id}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ height: 3, width: `${inc.match * 0.6}px`, borderRadius: 2, background: inc.match >= 90 ? '#3AABFF' : '#7FA5D3', opacity: 0.7 }} />
                        <span style={{ fontSize: 13, fontWeight: 800, color: inc.match >= 90 ? '#3AABFF' : '#7FA5D3', fontFamily: "'JetBrains Mono', monospace" }}>{inc.match}%</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#EAF4FF', marginBottom: 4 }}>{inc.type}</div>
                    <div style={{ fontSize: 10, color: '#7FA5D3', marginBottom: 12, lineHeight: 1.4 }}>{inc.detail}</div>
                    <button onClick={() => navigate('/evidence', { state: { sessionId: inc.id } })} style={{ width: '100%', padding: '6px 0', borderRadius: 5, fontSize: 10, fontWeight: 600, color: '#7FA5D3', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', cursor: 'pointer', transition: 'all 140ms' }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#3AABFF'; e.currentTarget.style.borderColor = 'rgba(74,158,255,0.3)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#7FA5D3'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; }}
                    >View Evidence</button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

      </div>
      </div>

      <PortCopilot />

      {/* Supplier Profile Panel — live Supabase suppliers + historical_transactions */}
      {profilePanelOpen && selectedSupplierKey && (
        <LiveSupplierProfile
          supplierKey={selectedSupplierKey}
          onClose={() => setProfilePanelOpen(false)}
        />
      )}
    </div>
  );
}

/** Resolves a UI key like "SupplierGamma" → SUP-### → live Supabase data. */
function LiveSupplierProfile({ supplierKey, onClose }: { supplierKey: string; onClose: () => void }) {
  const keyToId: Record<string, string> = {
    SupplierAlpha: 'SUP-001',
    SupplierBeta:  'SUP-002',
    SupplierGamma: 'SUP-003',
    OceanBunker:   'SUP-004',
  };
  const supplierId = keyToId[supplierKey] ?? 'SUP-003';
  const { supplier, loading } = useSupplierReputation(supplierId);

  // Fallback to mock during the first ~200ms while the Supabase query loads,
  // and also if the Supabase row is missing — keeps the panel from flashing empty.
  const keyToName: Record<string, string> = {
    SupplierAlpha: 'BunkerGuard Demo Supplier Alpha Pte Ltd',
    SupplierBeta:  'BunkerGuard Demo Supplier Beta Pte Ltd',
    SupplierGamma: 'BunkerGuard Demo Supplier Gamma Pte Ltd',
    OceanBunker:   'OceanBunker International',
  };
  const fallbackName = keyToName[supplierKey];
  const fallback = mockSupplierReputation.find((s) => s.name === fallbackName);

  const data = (loading || !supplier ? fallback : (supplier as any)) ?? fallback;
  if (!data) return null;

  return <SupplierProfilePanel supplier={data} onClose={onClose} />;
}
