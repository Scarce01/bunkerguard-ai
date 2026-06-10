import { useState } from 'react';
import { useNavigate } from 'react-router';
import { StatusPill } from '../components/dashboard/StatusPill';
import { mockSessions as fallbackMockSessions } from '../../data/mockSessions';
import { useSessionsList } from '../../lib/useSessionsList';
import type { SessionStatus, RiskLevel, SessionVerdict } from '../../data/types';
import { Search, X, ArrowRight, ExternalLink, FileText, Filter, ChevronDown, Upload } from 'lucide-react';
import { BDNDetailsDrawer } from '../components/details/BDNDetailsDrawer';
import { MFMTelemetryPanel } from '../components/details/MFMTelemetryPanel';
import { BDNUploadDrawer } from '../components/upload/BDNUploadDrawer';
import { useNow } from '../../lib/useNowClock';
import { LIVE_DEMO_SESSIONS } from '../../lib/sessionDerive';

const CARD: React.CSSProperties = {
  background: 'linear-gradient(180deg, #102033 0%, #0E1C2D 100%)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 8,
  boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
};

const LABEL: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em',
  color: '#4E7A9A', marginBottom: 5,
};

export function SessionsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<SessionStatus | 'ALL'>('ALL');
  const [riskFilter, setRiskFilter] = useState<RiskLevel | 'ALL'>('ALL');
  const [supplierFilter, setSupplierFilter] = useState('ALL');
  const [vesselFilter, setVesselFilter] = useState('ALL');
  const [portFilter, setPortFilter] = useState('ALL');
  const [fuelGradeFilter, setFuelGradeFilter] = useState('ALL');
  const [verdictFilter, setVerdictFilter] = useState<SessionVerdict | 'ALL'>('ALL');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bdnDrawerOpen, setBdnDrawerOpen] = useState(false);
  const [uploadDrawerOpen, setUploadDrawerOpen] = useState(false);

  // Shared NowClock — drives the "last updated" footer in lock-step with
  // the Dashboard pin and Live Session telemetry.
  const nowMs = useNow();
  // Live data from Supabase, with mock data as the loading fallback.
  const live = useSessionsList();
  const mockSessions = live.loading || live.sessions.length === 0
    ? fallbackMockSessions
    : (live.sessions as unknown as typeof fallbackMockSessions);

  // Extract unique values for filters
  const uniqueSuppliers = Array.from(new Set(mockSessions.map(s => s.supplierName))).sort();
  const uniqueVessels = Array.from(new Set(mockSessions.map(s => s.vesselName))).sort();
  const uniquePorts = Array.from(new Set(mockSessions.map(s => s.location))).sort();
  const uniqueFuelGrades = Array.from(new Set(mockSessions.map(s => s.fuelGrade))).sort();

  const filteredSessions = mockSessions.filter(session => {
    const matchesSearch =
      searchQuery === '' ||
      session.vesselName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.id.toLowerCase().includes(searchQuery.toLowerCase());
    /* Status filter — DB enum values are ACTIVE / COMPLETED / HALTED.
     * Treat the demo-live session as ACTIVE so the operator can filter
     * to "the one currently bunkering" and find SES-2026-016 even
     * though Supabase has it marked COMPLETED. */
    const isDemoLive = LIVE_DEMO_SESSIONS.has(session.id);
    const effectiveStatus = isDemoLive ? 'ACTIVE' : session.status;
    const matchesStatus = statusFilter === 'ALL' || effectiveStatus === statusFilter;
    const matchesRisk = riskFilter === 'ALL' || session.riskScore.level === riskFilter;
    const matchesSupplier = supplierFilter === 'ALL' || session.supplierName === supplierFilter;
    const matchesVessel = vesselFilter === 'ALL' || session.vesselName === vesselFilter;
    const matchesPort = portFilter === 'ALL' || session.location === portFilter;
    const matchesFuelGrade = fuelGradeFilter === 'ALL' || session.fuelGrade === fuelGradeFilter;
    const matchesVerdict = verdictFilter === 'ALL' || session.verdict === verdictFilter;
    return matchesSearch && matchesStatus && matchesRisk && matchesSupplier && matchesVessel && matchesPort && matchesFuelGrade && matchesVerdict;
  });

  const selectedSession = selectedId ? mockSessions.find(s => s.id === selectedId) : null;

  const riskScoreColor = (score: number) =>
    score >= 70 ? '#FF5A5A' : score >= 40 ? '#FFB84D' : '#00D47E';

  const inputStyle: React.CSSProperties = {
    background: 'rgba(7,17,31,0.8)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 9,
    color: '#EAF4FF',
    fontSize: 12,
    fontWeight: 500,
    outline: 'none',
    transition: 'border-color 160ms',
  };

  const activeFiltersCount = [supplierFilter, vesselFilter, portFilter, fuelGradeFilter, verdictFilter].filter(f => f !== 'ALL').length;

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

      {/* ── Main content — flows naturally inside <main>'s overflow-y:auto.
            No overflow:hidden here, otherwise table content gets clipped on
            small laptops (the parent already handles page-level scroll). ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 28px', minWidth: 0 }}>

        {/* Header */}
        <div style={{ marginBottom: 20, marginTop: 4, flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 9, color: '#4E7A9A', textTransform: 'uppercase', letterSpacing: '0.16em', fontWeight: 700, marginBottom: 6 }}>Audit · History · Analytics</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#EAF4FF', lineHeight: 1, letterSpacing: '-0.01em', margin: 0 }}>Bunkering Sessions</h1>
          </div>
          <button
            onClick={() => setUploadDrawerOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'rgba(74,158,255,0.12)', border: '1px solid rgba(74,158,255,0.28)', color: '#4A9EFF', transition: 'all 150ms' }}
          >
            <Upload style={{ width: 14, height: 14 }} />
            Upload BDN
          </button>
        </div>

        {/* Primary Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexShrink: 0 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#7FA5D3' }} />
            <input
              type="text"
              placeholder="Search by vessel, supplier, or session ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ ...inputStyle, width: '100%', padding: '9px 12px 9px 36px', boxSizing: 'border-box' }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as SessionStatus | 'ALL')}
            style={{ ...inputStyle, padding: '9px 14px' }}
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active · Bunkering</option>
            <option value="COMPLETED">Completed</option>
            <option value="HALTED">Halted</option>
          </select>
          <select
            value={riskFilter}
            onChange={e => setRiskFilter(e.target.value as RiskLevel | 'ALL')}
            style={{ ...inputStyle, padding: '9px 14px' }}
          >
            <option value="ALL">All Risk Levels</option>
            <option value="LOW">Low</option>
            <option value="MODERATE">Moderate</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            style={{ ...inputStyle, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: showAdvancedFilters ? 'rgba(74,158,255,0.12)' : 'rgba(7,17,31,0.8)', border: showAdvancedFilters ? '1px solid rgba(74,158,255,0.3)' : '1px solid rgba(255,255,255,0.1)' }}
          >
            <Filter style={{ width: 14, height: 14, color: showAdvancedFilters ? '#4A9EFF' : '#7FA5D3' }} />
            <span style={{ color: showAdvancedFilters ? '#4A9EFF' : '#EAF4FF' }}>Filters</span>
            {activeFiltersCount > 0 && (
              <span style={{ fontSize: 10, fontWeight: 700, color: '#4A9EFF', background: 'rgba(74,158,255,0.2)', padding: '1px 5px', borderRadius: 3 }}>{activeFiltersCount}</span>
            )}
            <ChevronDown style={{ width: 12, height: 12, color: showAdvancedFilters ? '#4A9EFF' : '#7FA5D3', transform: showAdvancedFilters ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }} />
          </button>
        </div>

        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexShrink: 0, padding: '12px 14px', background: 'rgba(74,158,255,0.04)', border: '1px solid rgba(74,158,255,0.15)', borderRadius: 8 }}>
            <select value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)} style={{ ...inputStyle, flex: 1, padding: '8px 12px' }}>
              <option value="ALL">All Suppliers</option>
              {uniqueSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={vesselFilter} onChange={e => setVesselFilter(e.target.value)} style={{ ...inputStyle, flex: 1, padding: '8px 12px' }}>
              <option value="ALL">All Vessels</option>
              {uniqueVessels.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={portFilter} onChange={e => setPortFilter(e.target.value)} style={{ ...inputStyle, flex: 1, padding: '8px 12px' }}>
              <option value="ALL">All Ports</option>
              {uniquePorts.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={fuelGradeFilter} onChange={e => setFuelGradeFilter(e.target.value)} style={{ ...inputStyle, flex: 1, padding: '8px 12px' }}>
              <option value="ALL">All Fuel Grades</option>
              {uniqueFuelGrades.map(fg => <option key={fg} value={fg}>{fg}</option>)}
            </select>
            <select value={verdictFilter} onChange={e => setVerdictFilter(e.target.value as SessionVerdict | 'ALL')} style={{ ...inputStyle, flex: 1, padding: '8px 12px' }}>
              <option value="ALL">All Verdicts</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING">Pending</option>
              <option value="REFUSED">Refused</option>
              <option value="FLAGGED">Flagged</option>
            </select>
            {activeFiltersCount > 0 && (
              <button
                onClick={() => {
                  setSupplierFilter('ALL');
                  setVesselFilter('ALL');
                  setPortFilter('ALL');
                  setFuelGradeFilter('ALL');
                  setVerdictFilter('ALL');
                }}
                style={{ padding: '8px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'rgba(255,90,90,0.1)', border: '1px solid rgba(255,90,90,0.25)', color: '#FF5A5A', whiteSpace: 'nowrap' }}
              >
                Clear All
              </button>
            )}
          </div>
        )}

        {/* Table — natural flow (not flex:1 ↔ overflow:hidden any more)
            so on a 13" laptop the whole table can grow and the page-level
            scroll just keeps going. Inner overflow-x lets wide tables
            scroll horizontally without forcing a fixed table height. */}
        <div style={{ ...CARD, display: 'flex', flexDirection: 'column', overflowX: 'auto' }}>
          <div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr style={{ background: 'rgba(4,10,22,0.97)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {['Session', 'Vessel', 'Supplier', 'Port', 'Grade', 'BDN Qty', 'MFM Qty', 'Mismatch', 'Risk', 'Verdict', 'Status'].map(h => (
                    <th key={h} style={{ padding: '11px 18px', textAlign: 'left', fontSize: 9, fontWeight: 700, color: '#4E7A9A', textTransform: 'uppercase', letterSpacing: '0.12em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredSessions.map(session => {
                  const isSelected = session.id === selectedId;
                  return (
                    <tr
                      key={session.id}
                      onClick={() => setSelectedId(isSelected ? null : session.id)}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(46,168,255,0.08)' : 'transparent',
                        borderLeft: isSelected ? '2px solid rgba(46,168,255,0.6)' : '2px solid transparent',
                        transition: 'all 150ms',
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(46,168,255,0.04)'; }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '13px 18px', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#2EA8FF', fontWeight: 700 }}>#{session.sessionNumber}</td>
                      <td style={{ padding: '13px 18px' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#EAF4FF' }}>{session.vesselName}</div>
                        <div style={{ fontSize: 10, color: '#7FA5D3', marginTop: 2 }}>IMO {session.vesselIMO}</div>
                      </td>
                      <td style={{ padding: '13px 18px' }}>
                        <div style={{ fontSize: 12, color: '#BFD7F7' }}>{session.supplierName}</div>
                        <div style={{ fontSize: 10, color: '#7FA5D3', marginTop: 2 }}>{session.bargeName}</div>
                      </td>
                      <td style={{ padding: '13px 18px', fontSize: 11, color: '#91B4DA' }}>{session.location}</td>
                      <td style={{ padding: '13px 18px', fontSize: 11, color: '#91B4DA', fontFamily: "'JetBrains Mono', monospace" }}>{session.fuelGrade}</td>
                      <td style={{ padding: '13px 18px', fontSize: 12, fontWeight: 600, color: '#BFD7F7', fontFamily: "'JetBrains Mono', monospace" }}>{session.bdnQuantity.toFixed(1)} MT</td>
                      <td style={{ padding: '13px 18px', fontFamily: "'JetBrains Mono', monospace" }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#BFD7F7' }}>{session.mfmQuantity.toFixed(1)} MT</div>
                        {/* Shared-clock progress bar — same % shown on the
                            Dashboard delivery-pin tooltip and the Live
                            Session "TRANSFER" KPI at this same instant. */}
                        {typeof (session as any).progressPct === 'number' && (
                          <div style={{ marginTop: 4, width: 86 }} title={`${(session as any).progressPct}% transferred`}>
                            <div style={{ height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{
                                width: `${(session as any).progressPct}%`, height: '100%',
                                background: '#4A9EFF',
                                transition: 'width 800ms ease-out',
                              }} />
                            </div>
                            <div style={{ fontSize: 8, color: '#5A8AB4', marginTop: 2, letterSpacing: 0.6 }}>
                              {(session as any).progressPct}% · live
                            </div>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '13px 18px' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: session.mismatchPercent > 1 ? '#FF5A5A' : '#00D47E', fontFamily: "'JetBrains Mono', monospace" }}>
                          {session.mismatchPercent.toFixed(2)}%
                        </span>
                      </td>
                      <td style={{ padding: '13px 18px' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: riskScoreColor(session.riskScore.total), fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{session.riskScore.total}</div>
                        <div style={{ fontSize: 9, color: '#7FA5D3', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>{session.riskScore.level}</div>
                      </td>
                      <td style={{ padding: '13px 18px' }}><StatusPill status={session.verdict} size="sm" /></td>
                      <td style={{ padding: '13px 18px' }}><StatusPill status={session.status} size="sm" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div style={{ padding: '12px 18px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: '#7FA5D3' }}>Showing {filteredSessions.length} of {mockSessions.length} sessions</span>
            <span style={{ fontSize: 11, color: '#7FA5D3' }}>Last updated: {new Date(nowMs).toLocaleTimeString()} · synced clock</span>
          </div>
        </div>
      </div>

      {/* ── Right-side drawer ── */}
      {selectedSession && (
        <div style={{
          width: 360,
          flexShrink: 0,
          borderLeft: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(9,23,42,0.98)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          animation: 'none',
        }}>
          {/* Drawer header */}
          <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div>
              <div style={{ fontSize: 9, color: '#4E7A9A', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700, marginBottom: 4 }}>Session Preview</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#EAF4FF', fontFamily: "'JetBrains Mono', monospace" }}>#{selectedSession.sessionNumber}</div>
            </div>
            <button
              onClick={() => setSelectedId(null)}
              style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', color: '#91B4DA' }}
            >
              <X style={{ width: 14, height: 14 }} />
            </button>
          </div>

          {/* Status row */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 8 }}>
            <StatusPill status={selectedSession.status} size="sm" />
            <StatusPill status={selectedSession.verdict} size="sm" />
            <StatusPill status={selectedSession.riskScore.level} size="sm" />
          </div>

          {/* Key metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {[
              { label: 'Shortage', value: `${selectedSession.mismatchMT.toFixed(1)} MT`, color: '#FF5A5A' },
              { label: 'Risk Score', value: `${selectedSession.riskScore.total}/100`, color: riskScoreColor(selectedSession.riskScore.total) },
              { label: 'BDN Qty', value: `${selectedSession.bdnQuantity.toFixed(1)} MT`, color: '#BFD7F7' },
              { label: 'MFM Qty', value: `${selectedSession.mfmQuantity.toFixed(1)} MT`, color: '#BFD7F7' },
            ].map((m, i) => (
              <div key={m.label} style={{ padding: '14px 18px', borderRight: i % 2 === 0 ? '1px solid rgba(255,255,255,0.06)' : undefined }}>
                <div style={LABEL}>{m.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: m.color, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Session details */}
          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {[
              { label: 'Vessel', value: selectedSession.vesselName },
              { label: 'IMO', value: selectedSession.vesselIMO, mono: true },
              { label: 'Supplier', value: selectedSession.supplierName },
              { label: 'Barge', value: selectedSession.bargeName },
              { label: 'Port', value: selectedSession.location },
              { label: 'Fuel Grade', value: selectedSession.fuelGrade, mono: true },
              { label: 'Started', value: new Date(selectedSession.startTime).toLocaleString() },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ fontSize: 10, color: '#7FA5D3', fontWeight: 600, flexShrink: 0 }}>{row.label}</span>
                <span style={{ fontSize: 11, color: '#BFD7F7', fontWeight: 600, textAlign: 'right', fontFamily: row.mono ? "'JetBrains Mono', monospace" : undefined }}>{row.value}</span>
              </div>
            ))}
          </div>

          {/* Mismatch bar */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 10, color: '#7FA5D3', fontWeight: 600 }}>Quantity Mismatch</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: selectedSession.mismatchPercent > 1 ? '#FF5A5A' : '#00D47E', fontFamily: "'JetBrains Mono', monospace" }}>
                {selectedSession.mismatchPercent.toFixed(2)}%
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.07)' }}>
              <div style={{
                width: `${Math.min(selectedSession.mismatchPercent / 5 * 100, 100)}%`,
                height: '100%', borderRadius: 3,
                background: selectedSession.mismatchPercent > 1 ? '#FF5A5A' : '#00D47E',
                opacity: 0.85,
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
              <span style={{ fontSize: 9, color: '#4E7A9A' }}>0%</span>
              <span style={{ fontSize: 9, color: 'rgba(255,90,90,0.5)', fontWeight: 600 }}>2% MPA limit</span>
              <span style={{ fontSize: 9, color: '#4E7A9A' }}>5%</span>
            </div>
          </div>

          {/* MFM Telemetry */}
          {selectedSession.mfmStream && (
            <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <MFMTelemetryPanel mfmStream={selectedSession.mfmStream} />
            </div>
          )}

          {/* Actions */}
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={() => setBdnDrawerOpen(true)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'rgba(74,158,255,0.12)', border: '1px solid rgba(74,158,255,0.28)', color: '#4A9EFF', transition: 'all 150ms' }}
            >
              <FileText style={{ width: 13, height: 13 }} />
              View Full BDN
            </button>
            <button
              onClick={() => navigate(`/sessions/${selectedSession.id}`)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'rgba(46,168,255,0.12)', border: '1px solid rgba(46,168,255,0.28)', color: '#2EA8FF', transition: 'all 150ms' }}
            >
              <ExternalLink style={{ width: 13, height: 13 }} />
              Open Full Detail
            </button>
            <button
              onClick={() => navigate('/evidence')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'rgba(255,90,90,0.09)', border: '1px solid rgba(255,90,90,0.22)', color: '#FF5A5A', transition: 'all 150ms' }}
            >
              <ArrowRight style={{ width: 13, height: 13 }} />
              View Evidence
            </button>
          </div>
        </div>
      )}

      {/* BDN Details Drawer */}
      {selectedSession && selectedSession.bdnRecord && (
        <BDNDetailsDrawer
          bdn={selectedSession.bdnRecord}
          open={bdnDrawerOpen}
          onClose={() => setBdnDrawerOpen(false)}
        />
      )}

      {/* BDN Upload Drawer */}
      <BDNUploadDrawer
        open={uploadDrawerOpen}
        onClose={() => setUploadDrawerOpen(false)}
      />
    </div>
  );
}
