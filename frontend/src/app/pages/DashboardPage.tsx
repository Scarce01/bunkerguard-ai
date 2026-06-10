import { mockSessions } from '../../data/mockSessions';
import {
  AlertTriangle,
  Activity,
  TrendingDown,
  ArrowRight,
  Ship,
  ExternalLink,
  Shield,
  TrendingUp,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { SingaporeMap } from '../components/terminals/SingaporeMap';
import { Terminal3DViewer } from '../components/terminals/Terminal3DViewer';
import {
  TerminalInfo,
  TERMINAL_DASHBOARDS,
  VESSEL_DASHBOARDS,
  TerminalDashboardData,
  VesselSpot,
} from '../../data/terminals';
import { useLiveDashboard } from '../../lib/useLiveDashboard';
import { PortCopilot } from '../components/PortCopilot';

/** Placeholder shown inside a panel when a terminal/vessel is open but its
 *  scoped data hasn't been wired in yet. */
function NoTerminalData({ label, contextName }: { label: string; contextName: string }) {
  return (
    <div style={{
      padding: '12px 14px',
      background: 'rgba(255,255,255,0.04)',
      border: '1px dashed rgba(127,165,211,0.3)',
      borderRadius: 6,
      color: '#7FA5D3',
      fontSize: 11,
      lineHeight: 1.4,
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, color: '#557A96',
        textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4,
      }}>
        {label} · {contextName}
      </div>
      Schedule + telemetry pending. Wires up with AWS / Supabase next.
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [selectedTerminal, setSelectedTerminal] = useState<TerminalInfo | null>(null);
  const [selectedVessel, setSelectedVessel] = useState<VesselSpot | null>(null);
  const [mapResetSignal, setMapResetSignal] = useState(0);

  function returnToMap() {
    setSelectedTerminal(null);
    setSelectedVessel(null);
    setMapResetSignal((n) => n + 1);
  }

  // Network-wide KPIs come from the live Supabase hook below. Mock values are
  // kept only as the loading fallback so the panel doesn't flash empty.
  const fallbackCritical = mockSessions.filter(s => s.riskScore.level === 'CRITICAL').length;
  const fallbackActive   = mockSessions.filter(s => s.status === 'BUNKERING').length;
  const fallbackLoss     = mockSessions.reduce((a, s) => a + (s.estimatedLoss || 0), 0);

  // ─── Live data from Supabase ──────────────────────────────────────────
  // When a terminal is open, filter by its real location keywords (e.g. T07
  // → "Stolthaven"). Currently sessions.port is free-text ("Singapore,
  // Eastern Anchorage"), so the LIKE match is intentionally fuzzy.
  const portFragments = selectedTerminal
    ? [selectedTerminal.operator, selectedTerminal.location].filter(Boolean) as string[]
    : undefined;
  const live = useLiveDashboard(portFragments);

  // Scope precedence: vessel > terminal > network-wide
  const vesselDash: TerminalDashboardData | null =
    selectedTerminal && selectedVessel
      ? (VESSEL_DASHBOARDS[`${selectedTerminal.id}:${selectedVessel.id}`] ?? null)
      : null;
  const terminalDashOnly: TerminalDashboardData | null =
    selectedTerminal ? (TERMINAL_DASHBOARDS[selectedTerminal.id] ?? null) : null;
  const scopedDash: TerminalDashboardData | null = vesselDash ?? terminalDashOnly;

  const hasTerminalContext = selectedTerminal !== null;
  const hasVesselContext = selectedVessel !== null;
  const contextLabel = hasVesselContext
    ? `${selectedTerminal!.id} · ${selectedVessel!.id} · ${selectedVessel!.name}`
    : hasTerminalContext
    ? `${selectedTerminal!.id} · ${selectedTerminal!.name}`
    : '';
  const contextChipLabel = hasVesselContext
    ? `Vessel · ${selectedVessel!.id}`
    : hasTerminalContext
    ? `Terminal · ${selectedTerminal!.id}`
    : '';

  // KPI source — terminal-scoped > vessel-scoped > live Supabase > mock fallback
  const kpiCritical = scopedDash ? scopedDash.kpi.criticalAlerts : (live.kpis?.criticalAlerts ?? fallbackCritical);
  const kpiActive   = scopedDash ? scopedDash.kpi.activeSessions : (live.kpis?.activeSessions ?? fallbackActive);
  const kpiFlags    = scopedDash ? scopedDash.kpi.supplierFlags  : (live.kpis?.supplierFlags  ?? 3);
  const kpiLoss     = scopedDash ? scopedDash.kpi.lossPrevented
                                 : (live.kpis?.lossPrevented ?? `$${(fallbackLoss / 1000).toFixed(0)}K`);

  // Card title for the map/3D card
  const cardTitle = hasVesselContext
    ? `${selectedVessel!.id} · ${selectedVessel!.name} (Vessel View)`
    : hasTerminalContext
    ? `${selectedTerminal!.id} · ${selectedTerminal!.operator} (3D View)`
    : 'Singapore Bunkering Terminals';
  const cardSubtitle = hasVesselContext
    ? `${selectedVessel!.status ?? 'idle'} · ${selectedVessel!.cargo ?? '—'}`
    : hasTerminalContext
    ? `${selectedTerminal!.location} · ${selectedTerminal!.bboxSize[0].toFixed(0)} × ${selectedTerminal!.bboxSize[1].toFixed(0)} m`
    : 'Port of Singapore · 10 terminals tracked';

  return (
    <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, background: '#07111D' }}>
      <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Header */}
        <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#FFFFFF', marginBottom: 2, letterSpacing: '-0.01em' }}>
              Mission Control
            </h1>
            <p style={{ fontSize: 11, color: '#7FA5D3', fontWeight: 500 }}>
              {hasTerminalContext ? `Scoped to ${contextLabel}` : 'Real-time maritime fraud intelligence'}
            </p>
          </div>
          {hasTerminalContext && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 12px',
              background: hasVesselContext ? 'rgba(0,212,126,0.12)' : 'rgba(46,168,255,0.12)',
              border: `1px solid ${hasVesselContext ? 'rgba(0,212,126,0.3)' : 'rgba(46,168,255,0.3)'}`,
              borderRadius: 6,
              fontSize: 10, fontWeight: 700,
              color: hasVesselContext ? '#00D47E' : '#2EA8FF',
              letterSpacing: 1, textTransform: 'uppercase',
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: hasVesselContext ? '#00D47E' : '#2EA8FF',
                boxShadow: `0 0 6px ${hasVesselContext ? '#00D47E' : '#2EA8FF'}`,
              }} />
              {contextChipLabel}
            </div>
          )}
        </div>

        {/* MAIN LAYOUT */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'start' }}>

          {/* LEFT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* KPI GRID — scoped to current context */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { label: 'Critical Alerts',  value: kpiCritical.toString(), color: '#FF5656', icon: AlertTriangle, isCritical: true },
                { label: 'Active Sessions',  value: kpiActive.toString(),   color: '#4A9EFF', icon: Activity,      isCritical: false },
                { label: 'Supplier Flags',   value: kpiFlags.toString(),    color: '#FFA940', icon: TrendingDown,  isCritical: false },
                { label: 'Loss Prevented',   value: kpiLoss,                color: '#00D98E', icon: TrendingUp,    isCritical: false },
              ].map(kpi => {
                const Icon = kpi.icon;
                return (
                  <div key={kpi.label} style={{
                    padding: '10px 14px', background: '#0E1C2D',
                    border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8,
                    display: 'flex', flexDirection: 'column', gap: 8,
                  }}>
                    <Icon style={{ width: 16, height: 16, color: kpi.color }} />
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7FA5D3', marginBottom: 6 }}>
                        {kpi.label}
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: kpi.isCritical ? kpi.color : '#FFFFFF', lineHeight: 1, fontFamily: "'JetBrains Mono', monospace" }}>
                        {kpi.value}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* MAP / 3D CARD */}
            <div style={{ background: 'linear-gradient(180deg, #102033 0%, #0E1C2D 100%)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: 560 }}>
              <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF' }}>
                    {cardTitle}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#00D98E', display: 'inline-block', animation: 'livePulse 2s ease-in-out infinite' }} />
                    <span style={{ fontSize: 9, fontWeight: 600, color: '#00D98E', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Live</span>
                  </div>
                </div>
                <span style={{ fontSize: 10, color: '#7FA5D3', fontWeight: 500 }}>{cardSubtitle}</span>
              </div>

              <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
                <div style={{
                  position: 'absolute', inset: 0,
                  opacity: selectedTerminal ? 0 : 1,
                  transform: selectedTerminal ? 'scale(0.94)' : 'scale(1)',
                  filter: selectedTerminal ? 'blur(4px)' : 'blur(0)',
                  transition: 'opacity 500ms cubic-bezier(0.4,0,0.2,1), transform 500ms cubic-bezier(0.4,0,0.2,1), filter 350ms ease',
                  pointerEvents: selectedTerminal ? 'none' : 'auto',
                }}>
                  <SingaporeMap
                    onSelect={setSelectedTerminal}
                    resetSignal={mapResetSignal}
                    onDeliveryClick={(d) => navigate(`/live?session=${encodeURIComponent(d.session_id)}&view=iso`)}
                  />
                </div>
                <div style={{
                  position: 'absolute', inset: 0,
                  opacity: selectedTerminal ? 1 : 0,
                  transform: selectedTerminal ? 'scale(1)' : 'scale(1.04)',
                  transition: 'opacity 500ms cubic-bezier(0.4,0,0.2,1), transform 600ms cubic-bezier(0.4,0,0.2,1)',
                  pointerEvents: selectedTerminal ? 'auto' : 'none',
                }}>
                  {selectedTerminal && (
                    <Terminal3DViewer
                      terminal={selectedTerminal}
                      onBack={returnToMap}
                      onVesselChange={setSelectedVessel}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* CRITICAL EVENTS — scoped */}
            <div style={{ background: 'linear-gradient(180deg, #102033 0%, #0E1C2D 100%)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, overflow: 'hidden', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '10px 18px', borderBottom: '1px solid rgba(255,255,255,0.09)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#FF6B6B', display: 'inline-block', animation: 'livePulse 2s ease-in-out infinite' }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF' }}>Critical Events</span>
                </div>
              </div>
              <div style={{ flex: 1, padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', minHeight: 0 }}>
                {hasTerminalContext && !scopedDash && (
                  <NoTerminalData label="critical events" contextName={contextLabel} />
                )}
                {(scopedDash
                  ? scopedDash.events.map(e => ({ ...e, link: '/live' as const }))
                  : hasTerminalContext
                  ? []
                  : (live.events ?? [
                      // Skeleton fallback while the supabase fetch is in flight.
                      { severity: 'MEDIUM' as const, label: 'Loading live events…', detail: 'Querying Supabase', time: '—', color: '#4A9EFF' },
                    ]).map(e => ({ ...e, link: '/live' as const }))
                ).map((event, i) => {
                  const isCritical = event.severity === 'CRITICAL';
                  const tagBg: Record<string, string> = {
                    CRITICAL: 'rgba(255,86,86,0.12)',
                    HIGH:     'rgba(255,169,64,0.12)',
                    MEDIUM:   'rgba(74,158,255,0.12)',
                  };
                  return (
                    <div
                      key={i}
                      style={{
                        padding: '9px 12px',
                        background: '#152843',
                        border: '1px solid rgba(255,255,255,0.09)',
                        borderLeft: isCritical ? `3px solid ${event.color}` : '1px solid rgba(255,255,255,0.09)',
                        borderRadius: 6,
                        cursor: 'pointer',
                        transition: 'background 200ms',
                      }}
                      onClick={() => navigate(event.link)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{event.label}</span>
                          <span style={{
                            flexShrink: 0,
                            fontSize: 9, fontWeight: 700,
                            color: event.color,
                            textTransform: 'uppercase',
                            letterSpacing: '0.07em',
                            background: tagBg[event.severity],
                            border: `1px solid ${event.color}22`,
                            borderRadius: 4,
                            padding: '1px 6px',
                            lineHeight: '16px',
                          }}>{event.severity}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <span style={{ fontSize: 9, color: '#7FA5D3', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{event.time}</span>
                          <ArrowRight style={{ width: 10, height: 10, color: '#7FA5D3' }} />
                        </div>
                      </div>
                      <div style={{ fontSize: 10, color: '#A8C0E0' }}>{event.detail}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SUPPLIER WATCHLIST — scoped */}
            <div style={{ background: 'linear-gradient(180deg, #102033 0%, #0E1C2D 100%)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '10px 18px', borderBottom: '1px solid rgba(255,255,255,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TrendingDown style={{ width: 13, height: 13, color: '#FFA940' }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF' }}>Supplier Watchlist</span>
                </div>
                <button
                  onClick={() => navigate('/intelligence')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px',
                    fontSize: 10, fontWeight: 600, cursor: 'pointer',
                    background: 'rgba(74,158,255,0.12)', border: '1px solid rgba(74,158,255,0.25)',
                    color: '#4A9EFF',
                    borderRadius: 6,
                  }}
                >
                  View All
                  <ArrowRight style={{ width: 10, height: 10 }} />
                </button>
              </div>
              <div style={{ padding: '0 18px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 60px', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.09)' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#7FA5D3', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Supplier</div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#7FA5D3', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Risk</div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#7FA5D3', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sessions</div>
                  <div></div>
                </div>
                {hasTerminalContext && !scopedDash && (
                  <NoTerminalData label="suppliers" contextName={contextLabel} />
                )}
                {(scopedDash
                  ? scopedDash.watchlist
                  : hasTerminalContext
                  ? []
                  : (live.suppliers ?? [
                      { name: 'Loading live suppliers…', risk: 0, sessions: '—', severity: 'MEDIUM' as const, color: '#4A9EFF' },
                    ])
                ).map((supplier, i) => (
                  <div
                    key={i}
                    onClick={() => navigate('/intelligence')}
                    style={{
                      display: 'grid', gridTemplateColumns: '1fr 80px 100px 60px', gap: 12,
                      padding: '10px 12px',
                      margin: '4px -12px 0',
                      borderRadius: 6,
                      background: '#152843',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#FFFFFF' }}>{supplier.name}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: supplier.color, fontFamily: "'JetBrains Mono', monospace" }}>
                      {supplier.risk}
                    </div>
                    <div style={{ fontSize: 11, color: '#A8C8E8' }}>{supplier.sessions} flagged</div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <ArrowRight style={{ width: 11, height: 11, color: '#7FA5D3' }} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ padding: '0 0 10px 0' }} />
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 24 }}>

            {/* AI RECOMMENDATION */}
            <div style={{
              padding: '16px 18px',
              background: 'linear-gradient(180deg, #102033 0%, #0E1C2D 100%)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 8,
            }}>
              {hasTerminalContext && !scopedDash ? (
                <NoTerminalData label="AI recommendation" contextName={contextLabel} />
              ) : (() => {
                const aiRec    = scopedDash?.ai.recommendation      ?? 'REFUSE TO SIGN BDN';
                const aiColor  = scopedDash?.ai.recommendationColor ?? '#FF5656';
                const aiConf   = scopedDash?.ai.confidence          ?? 92;
                const aiSignals = scopedDash?.ai.signals ?? [
                  'A02 Quantity Final Mismatch',
                  'Systematic underfueling pattern',
                  'Supplier Gamma: 9/22 flagged',
                  'MPA threshold exceeded',
                ];
                const aiAction = scopedDash?.ai.action ?? 'Independent survey required';
                const criticalSessionId = scopedDash?.topRisk?.sessionId ?? 'SES-2026-016';
                /* Map each detected-signal substring → deep-link route + label. */
                const signalRoute = (signal: string): { route: string; hint: string } => {
                  const s = signal.toLowerCase();
                  if (s.includes('a02') || s.includes('mismatch') || s.includes('mfm')) return { route: '/anomalies', hint: 'Anomaly Monitor' };
                  if (s.includes('supplier gamma') || s.includes('gamma'))               return { route: '/suppliers/SUP-003', hint: 'Supplier Gamma profile' };
                  if (s.includes('underfueling') || s.includes('pattern'))               return { route: '/intelligence', hint: 'Intelligence · pattern' };
                  if (s.includes('mpa') || s.includes('threshold'))                      return { route: `/sessions/${criticalSessionId}`, hint: 'Session · BDN tab' };
                  return { route: `/sessions/${criticalSessionId}`, hint: 'Critical session' };
                };
                return (
                  <>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
                      <Shield style={{ width: 18, height: 18, color: aiColor, marginTop: 2 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 9, color: '#7FA5D3', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 6 }}>AI RECOMMENDATION</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: aiColor, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                          {aiRec}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.09)', overflow: 'hidden', position: 'relative' }}>
                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${aiConf}%`, background: '#4A9EFF' }} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#4A9EFF', fontFamily: "'JetBrains Mono', monospace" }}>{aiConf}%</span>
                    </div>

                    <div style={{ fontSize: 9, color: '#7FA5D3', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 8 }}>Detected Signals · click to inspect</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
                      {aiSignals.map((signal, i) => {
                        const target = signalRoute(signal);
                        return (
                          <button
                            key={i}
                            onClick={() => navigate(target.route)}
                            title={`Go to ${target.hint}`}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                              background: 'transparent', border: '1px solid transparent', borderRadius: 6,
                              cursor: 'pointer', textAlign: 'left', transition: 'all 140ms',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(74,158,255,0.07)'; e.currentTarget.style.borderColor = 'rgba(74,158,255,0.22)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                          >
                            <div style={{ width: 3, height: 3, borderRadius: '50%', background: aiColor, flexShrink: 0 }} />
                            <span style={{ fontSize: 11, color: '#D8E8F8', fontWeight: 500, flex: 1 }}>{signal}</span>
                            <ArrowRight style={{ width: 11, height: 11, color: '#5A8AB4', opacity: 0.6 }} />
                          </button>
                        );
                      })}
                    </div>

                    <div style={{ fontSize: 9, color: '#7FA5D3', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 6 }}>Recommended Action</div>
                    <button
                      onClick={() => navigate('/intelligence')}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px',
                        background: 'rgba(255,86,86,0.06)', border: '1px solid rgba(255,86,86,0.22)',
                        borderRadius: 6, cursor: 'pointer', textAlign: 'left', marginBottom: 14,
                        transition: 'all 140ms',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,86,86,0.12)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,86,86,0.06)'; }}
                      title="Open Intelligence · investigation workflow"
                    >
                      <span style={{ fontSize: 11, color: '#D8E8F8', fontWeight: 500, flex: 1, lineHeight: 1.4 }}>{aiAction}</span>
                      <ArrowRight style={{ width: 11, height: 11, color: aiColor }} />
                    </button>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <button
                        onClick={() => navigate(`/sessions/${criticalSessionId}`)}
                        title={`Open ${criticalSessionId} detail view`}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          padding: '10px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          background: 'rgba(74,158,255,0.15)',
                          border: '1px solid rgba(74,158,255,0.3)',
                          borderRadius: 8,
                          color: '#4A9EFF', transition: 'all 140ms',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(74,158,255,0.25)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(74,158,255,0.15)'; }}
                      >
                        Open Critical Session · {criticalSessionId}
                        <ArrowRight style={{ width: 12, height: 12 }} />
                      </button>
                      <button
                        onClick={() => navigate('/blockchain')}
                        title="View blockchain-anchored evidence chain"
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          padding: '9px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 8,
                          color: '#A8C8E8', transition: 'all 140ms',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                      >
                        View Evidence Chain
                        <ExternalLink style={{ width: 11, height: 11 }} />
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* TOP RISK SESSION */}
            <div style={{ padding: '16px 18px', background: 'linear-gradient(180deg, #102033 0%, #0E1C2D 100%)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8 }}>
              {hasTerminalContext && !scopedDash ? (
                <NoTerminalData label="top risk session" contextName={contextLabel} />
              ) : (() => {
                const tr = scopedDash?.topRisk;
                const vesselName = tr?.vesselName ?? 'MAERSK HONAM';
                const sessionId  = tr?.sessionId  ?? 'SES-2026-016';
                const supplier   = tr?.supplier   ?? 'Supplier Gamma';
                const riskScore  = tr?.riskScore  ?? 78;
                const riskLevel  = tr?.riskLevel  ?? 'CRITICAL';
                const riskColor  = tr?.riskColor  ?? '#FF5656';
                const breakdown  = tr?.breakdown  ?? [
                  { label: 'Quantity mismatch', value: 35, color: '#FF5656' },
                  { label: 'Data integrity',    value: 18, color: '#FF5656' },
                  { label: 'Supplier history',  value: 13, color: '#FFA940' },
                  { label: 'Regulatory compliance', value: 12, color: '#FFA940' },
                ];
                const metrics = tr?.metrics ?? [
                  { label: 'Shortage',   value: '18.8 MT', color: '#FF5656' },
                  { label: 'Deviation',  value: '3.76%',   color: '#FF5656' },
                  { label: 'Confidence', value: '94%',     color: '#4A9EFF' },
                ];
                return (
                  <>
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <Ship style={{ width: 14, height: 14, color: riskColor }} />
                        <div style={{ fontSize: 9, color: '#7FA5D3', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Top Risk Session</div>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#FFFFFF', marginBottom: 4, lineHeight: 1.2 }}>{vesselName}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#A8C8E8' }}>
                        <span>{sessionId}</span>
                        <span style={{ color: '#7FA5D3' }}>•</span>
                        <span><span style={{ fontWeight: 600, color: '#D8E8F8' }}>{supplier}</span></span>
                      </div>
                    </div>

                    <div style={{ padding: '16px', background: '#152843', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div style={{ fontSize: 9, color: '#7FA5D3', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Risk Score</div>
                        <div style={{ fontSize: 8, fontWeight: 700, color: riskColor, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{riskLevel}</div>
                      </div>
                      <div style={{ fontSize: 54, fontWeight: 700, color: riskColor, lineHeight: 1, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '-0.02em', marginBottom: 16 }}>
                        {riskScore}<span style={{ fontSize: 16, color: '#7FA5D3', marginLeft: 4 }}>/100</span>
                      </div>

                      <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7FA5D3', marginBottom: 10 }}>Risk Breakdown</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {breakdown.map(item => (
                          <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 10, color: '#D8E8F8', fontWeight: 500 }}>{item.label}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: item.color, fontFamily: "'JetBrains Mono', monospace" }}>+{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {metrics.map(row => (
                        <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#152843', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 6 }}>
                          <span style={{ fontSize: 11, color: '#A8C8E8', fontWeight: 500 }}>{row.label}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: row.color, fontFamily: "'JetBrains Mono', monospace" }}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* SUPPLIER SIGNALS */}
            <div style={{ padding: '14px 18px', background: 'linear-gradient(180deg, #102033 0%, #0E1C2D 100%)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF', marginBottom: 12 }}>Supplier Signals</div>
              {hasTerminalContext && !scopedDash && (
                <NoTerminalData label="supplier signals" contextName={contextLabel} />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(scopedDash
                  ? scopedDash.signals
                  : hasTerminalContext
                  ? []
                  : [
                      { name: 'Supplier Gamma',    score: 38, color: '#FF5656', status: '9/22 sessions flagged',  trend: '↓', trendLabel: '-7',  trendColor: '#FF5656' },
                      { name: 'Supplier Beta',     score: 58, color: '#FFA940', status: '5/20 sessions · 2 LOP',  trend: '—', trendLabel: '-1',  trendColor: '#FFA940' },
                      { name: "OceanBunker Int'l", score: 0,  color: '#FF5656', status: 'NOT REGISTERED',         trend: '⚠', trendLabel: 'FAIL', trendColor: '#FF5656' },
                    ]
                ).map((supplier, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '10px 12px',
                      background: '#152843',
                      border: '1px solid rgba(255,255,255,0.09)',
                      borderRadius: 6,
                      cursor: 'pointer',
                    }}
                    onClick={() => navigate('/intelligence')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#FFFFFF' }}>{supplier.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: supplier.trendColor, fontFamily: "'JetBrains Mono', monospace" }}>
                          {supplier.trend} {supplier.trendLabel}
                        </div>
                        <span style={{ fontSize: 16, fontWeight: 700, color: supplier.color, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{supplier.score}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 10, color: '#7FA5D3' }}>{supplier.status}</div>
                      <ArrowRight style={{ width: 10, height: 10, color: '#7FA5D3' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Floating BunkerGuard Copilot — always-on AI helper */}
      <PortCopilot />
    </div>
  );
}
