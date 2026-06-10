import { useNavigate, useLocation } from 'react-router';
import { AlertTriangle, Cpu, Activity, ChevronRight, Satellite } from 'lucide-react';
import { useGeofence } from '../../lib/useGeofence';
import { useState } from 'react';
import { LiveSessionScene } from '../components/live/LiveSessionScene';
import { AgentWorkflow, TechStackBadges } from '../components/live/AgentWorkflow';
import { useLiveSession as useLiveSessionHook } from '../../lib/useLiveSession';

const FOCUS_SESSION_ID = 'SES-2026-016'; // V03's session — the demo target

export function LiveSessionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  /* Query params: ?session=SES-XXX&view=iso. Defaults to demo target + top-down. */
  const qs = new URLSearchParams(location.search);
  const focusSessionId = qs.get('session') || FOCUS_SESSION_ID;
  const cameraMode: 'top' | 'iso' = qs.get('view') === 'iso' ? 'iso' : 'top';
  const live = useLiveSessionHook(focusSessionId);
  const [sessionPatch, setSessionPatch] = useState<{ status?: string }>({});
  const liveSession = live.session ? { ...live.session, ...sessionPatch } : null;
  const { geofence } = useGeofence('Eastern');
  const [driftSim, setDriftSim] = useState(false);
  const outsideGeofence = driftSim;

  const latestPacket = live.mfm[live.mfm.length - 1] ?? null;
  const totalMfm = latestPacket?.cumulative_mt ?? live.session?.mfm_qty_mt ?? 0;
  const shortage = (live.session?.bdn_qty_mt ?? 0) - totalMfm;

  const riskColor =
    live.risk?.risk_category === 'CRITICAL' ? '#FF5656' :
    live.risk?.risk_category === 'HIGH'     ? '#FFA940' :
    live.risk?.risk_category === 'MEDIUM'   ? '#4A9EFF' : '#00D98E';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: '#07111D', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#7FA5D3', letterSpacing: 1.4 }}>LIVE SESSION</span>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00D47E', boxShadow: '0 0 6px #00D47E', animation: 'livePulse 2s ease-in-out infinite' }} />
        </div>
        <div style={{ fontSize: 11, color: '#3D5A75', fontFamily: "'JetBrains Mono', monospace" }}>{FOCUS_SESSION_ID}</div>
        <button
          onClick={() => setDriftSim((d) => !d)}
          title="Simulate the barge drifting outside the Eastern Anchorage zone — demonstrates Surveyor agent geofence detection"
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 9px',
            fontSize: 9.5, fontWeight: 700, letterSpacing: 0.7,
            background: driftSim ? 'rgba(255,86,86,0.18)' : 'rgba(46,168,255,0.12)',
            border: `1px solid ${driftSim ? '#FF5656' : 'rgba(46,168,255,0.4)'}`,
            color: driftSim ? '#FF5656' : '#2EA8FF',
            borderRadius: 4,
            cursor: 'pointer',
            textTransform: 'uppercase',
          }}>
          <Satellite size={11} /> {driftSim ? 'DRIFT ACTIVE' : 'SIMULATE DRIFT'}
        </button>
        <div style={{ flex: 1 }} />
        {live.session && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <KpiChip label="VESSEL" value={live.session.vessel_name} />
            <KpiChip label="BARGE" value={live.session.barge_name ?? '—'} />
            <KpiChip label="SUPPLIER" value={(live.session.supplier_name ?? '').split(' ').slice(-3).join(' ') || '—'} />
            <KpiChip label="PORT" value={live.session.port ?? '—'} />
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 380px', minHeight: 0 }}>

        {/* LEFT column: scene above, information panel below */}
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>

        {/* LEFT-TOP: 3D top-down scene — height scales with viewport but is capped
            so the right-side info panel stays easy to read on tall windows. */}
        <div style={{ position: 'relative', height: 'clamp(360px, 52vh, 620px)', flexShrink: 0 }}>
          {live.loading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7FA5D3', zIndex: 5 }}>
              Loading session telemetry…
            </div>
          )}
          {live.session && (
            <LiveSessionScene
              bdnQty={live.session.bdn_qty_mt ?? 500}
              mfmQty={totalMfm}
              driveGainPct={latestPacket?.drive_gain_pct ?? 0}
              recordedAt={latestPacket?.recorded_at ?? null}
              commercialVesselName={live.session.vessel_name}
              bargeVesselName={live.session.barge_name ?? 'ALLI'}
              outsideGeofence={outsideGeofence}
              cameraMode={cameraMode}
            />
          )}

          {/* KPI strip — overlaid bottom of scene */}
          {live.session && (
            <div style={{
              position: 'absolute', left: 16, right: 16, bottom: 14,
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10,
            }}>
              <KpiBlock label="TRANSFER" value={`${Math.round((totalMfm / (live.session.bdn_qty_mt || 1)) * 100)}%`} color="#4A9EFF" />
              <KpiBlock label="DURATION" value={`${live.session.duration_h ?? 0}h`} color="#7FA5D3" />
              <KpiBlock label="SHORTAGE" value={`${shortage.toFixed(1)} MT`} color={shortage > 0 ? '#FF5656' : '#00D98E'} />
              <KpiBlock label="ALERTS" value={`${live.anomalies.length}`} color={live.anomalies.length > 0 ? '#FFA940' : '#00D98E'} />
            </div>
          )}
        </div>

        {/* LEFT-BOTTOM: Live information panel — uses the space below the
            scene for things the camera can't show: latest MFM packet, drift
            status, supplier flag, recent anomalies.                       */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignContent: 'start' }}>
          {/* TELEMETRY card */}
          <div style={{ background: 'linear-gradient(180deg, #102033 0%, #0E1C2D 100%)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Activity size={12} style={{ color: '#4A9EFF' }} />
              <span style={{ fontSize: 9, fontWeight: 700, color: '#7FA5D3', letterSpacing: 1.4 }}>LIVE MFM TELEMETRY</span>
              <span style={{ marginLeft: 'auto', fontSize: 9, color: '#5A8AB4' }}>{live.mfm.length} packets</span>
            </div>
            {latestPacket ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <Telem label="Flow rate"     value={`${(latestPacket.flow_rate_mt_h ?? 0).toFixed(1)} MT/h`} />
                <Telem label="Cumulative"    value={`${(latestPacket.cumulative_mt ?? 0).toFixed(1)} MT`} />
                <Telem label="Density 15°C"  value={`${(latestPacket.density_15c ?? 0).toFixed(1)} kg/m³`} />
                <Telem label="Temperature"   value={`${(latestPacket.temp_c ?? 0).toFixed(1)} °C`} />
                <Telem label="Drive gain"    value={`${(latestPacket.drive_gain_pct ?? 0).toFixed(1)} %`} warn={(latestPacket.drive_gain_pct ?? 0) > 18} />
                <Telem label="Direction"     value={latestPacket.direction ?? '—'} />
              </div>
            ) : (
              <div style={{ fontSize: 11, color: '#7FA5D3' }}>No MFM data for this session.</div>
            )}
          </div>

          {/* SESSION CONTEXT card */}
          <div style={{ background: 'linear-gradient(180deg, #102033 0%, #0E1C2D 100%)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Cpu size={12} style={{ color: riskColor }} />
              <span style={{ fontSize: 9, fontWeight: 700, color: '#7FA5D3', letterSpacing: 1.4 }}>SESSION CONTEXT</span>
              <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: riskColor, padding: '1px 7px', borderRadius: 4, background: `${riskColor}1A`, border: `1px solid ${riskColor}40` }}>
                {(live.risk?.risk_category ?? 'PENDING').replace(/_/g, ' ')}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <Telem label="BDN qty"       value={`${live.session?.bdn_qty_mt ?? 0} MT`} />
              <Telem label="MFM measured"  value={`${totalMfm.toFixed(1)} MT`} />
              <Telem label="Deviation"     value={`${shortage.toFixed(1)} MT`} warn={shortage > 0} />
              <Telem label="Fuel"          value={live.session?.fuel_grade ?? '—'} />
              <Telem label="Anchorage"     value={outsideGeofence ? 'OUTSIDE' : 'INSIDE'} warn={outsideGeofence} />
              <Telem label="Risk score"    value={`${live.risk?.final_risk_score ?? '—'} / 100`} />
            </div>
          </div>
        </div>

        </div>{/* /LEFT column */}

        {/* RIGHT: Verdict + Decision Chain + Telemetry + Activity feed */}
        <div style={{ overflowY: 'auto', minHeight: 0, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* AI VERDICT */}
          <div style={{
            padding: '14px 16px',
            background: 'linear-gradient(180deg, #102033 0%, #0E1C2D 100%)',
            border: `1px solid ${riskColor}55`,
            borderRadius: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Cpu size={13} style={{ color: riskColor }} />
              <span style={{ fontSize: 9, fontWeight: 700, color: '#7FA5D3', letterSpacing: 1.4 }}>AI VERDICT</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: riskColor, lineHeight: 1.1 }}>
              {(live.risk?.verdict ?? 'PENDING').replace(/_/g, ' ')}
            </div>
            <div style={{ fontSize: 11, color: '#7FA5D3', marginTop: 2 }}>
              Risk {live.risk?.final_risk_score ?? '—'}/100 · {live.risk?.risk_category ?? '—'}
              {live.llm?.payload?.confidence != null && (
                <> · <span style={{ color: '#4A9EFF', fontWeight: 600 }}>{Math.round((live.llm.payload.confidence) * 100)}% confidence</span></>
              )}
            </div>
            {live.llm?.payload?.summary && (
              <div style={{ fontSize: 11, color: '#A8C0E0', marginTop: 8, lineHeight: 1.4 }}>
                {live.llm.payload.summary}
              </div>
            )}
            {(live.llm?.payload?.concerns ?? []).slice(0, 4).map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginTop: 6 }}>
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: riskColor, marginTop: 6, flexShrink: 0 }} />
                <span style={{ fontSize: 10.5, color: '#D8E8F8', lineHeight: 1.35 }}>{c}</span>
              </div>
            ))}
          </div>

          {/* AGENT WORKFLOW — Surveyor → Investigator → Compliance → Decision → Chief Engineer */}
          {liveSession && (
            <AgentWorkflow
              session={liveSession}
              risk={live.risk}
              anomalies={live.anomalies}
              mfm={live.mfm}
              llm={live.llm}
              geofence={geofence}
              outsideGeofence={outsideGeofence}
              onSessionUpdated={(p) => setSessionPatch((prev) => ({ ...prev, ...p }))}
            />
          )}

          {/* TELEMETRY moved to the left-bottom information panel — see above */}

          {/* ACTIVITY FEED (anomalies + AI verdict) */}
          <div style={{
            padding: '14px 16px',
            background: 'linear-gradient(180deg, #102033 0%, #0E1C2D 100%)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <AlertTriangle size={12} style={{ color: '#FFA940' }} />
              <span style={{ fontSize: 9, fontWeight: 700, color: '#7FA5D3', letterSpacing: 1.4 }}>ACTIVITY FEED</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {outsideGeofence && (
                <div style={{
                  padding: '8px 10px',
                  background: 'rgba(255,86,86,0.10)',
                  border: '1px solid rgba(255,86,86,0.4)',
                  borderLeft: '3px solid #FF5656',
                  borderRadius: 4,
                  animation: 'livePulse 1.6s ease-in-out infinite',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#FF5656', letterSpacing: 1 }}>
                      NOW · CRITICAL
                    </span>
                    <span style={{ fontSize: 9, color: '#7FA5D3', fontFamily: "'JetBrains Mono', monospace" }}>A12</span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#FFFFFF', marginTop: 3 }}>
                    Geofence Breach Detected
                  </div>
                  <div style={{ fontSize: 10.5, color: '#A8C0E0', marginTop: 2 }}>
                    {geofence?.anchorage_name ?? 'Eastern Anchorage'} zone exit · Surveyor agent observation
                  </div>
                </div>
              )}
              {!outsideGeofence && live.anomalies.length === 0 && (
                <div style={{ fontSize: 11, color: '#7FA5D3' }}>No anomalies on this session.</div>
              )}
              {live.anomalies.map((a) => {
                const sevColor =
                  a.severity === 'CRITICAL' ? '#FF5656' :
                  a.severity === 'HIGH'     ? '#FFA940' :
                  a.severity === 'MEDIUM'   ? '#4A9EFF' : '#00D98E';
                const time = a.triggered_at ? new Date(a.triggered_at).toISOString().slice(11, 16) : '—';
                return (
                  <div key={a.anomaly_id}
                    onClick={() => navigate('/evidence')}
                    style={{
                      padding: '8px 10px',
                      background: '#152843',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderLeft: `3px solid ${sevColor}`,
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: sevColor, letterSpacing: 1 }}>
                        {time} · {a.severity}
                      </span>
                      <span style={{ fontSize: 9, color: '#7FA5D3', fontFamily: "'JetBrains Mono', monospace" }}>
                        {a.rule}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#FFFFFF', marginTop: 3 }}>
                      {a.rule_name ?? a.rule}
                    </div>
                    <div style={{ fontSize: 10.5, color: '#A8C0E0', marginTop: 2 }}>
                      {a.description}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => navigate('/evidence')}
            style={{
              padding: '10px 14px',
              fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
              background: 'rgba(74,158,255,0.15)',
              border: '1px solid rgba(74,158,255,0.3)',
              borderRadius: 8,
              color: '#4A9EFF',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
            View evidence chain <ChevronRight size={13} />
          </button>

          <TechStackBadges />
        </div>
      </div>
    </div>
  );
}

function KpiChip({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      padding: '5px 10px',
      background: 'rgba(8,19,31,0.55)',
      border: '1px solid rgba(46,168,255,0.18)',
      borderRadius: 4,
      minWidth: 0,
    }}>
      <div style={{ fontSize: 8, fontWeight: 700, color: '#3D5A75', letterSpacing: 1.1 }}>{label}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#E5F2FF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>{value}</div>
    </div>
  );
}

function KpiBlock({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: '8px 12px',
      background: 'rgba(8,19,31,0.85)',
      border: '1px solid rgba(46,168,255,0.28)',
      borderRadius: 6,
      backdropFilter: 'blur(10px)',
    }}>
      <div style={{ fontSize: 8.5, fontWeight: 700, color: '#7FA5D3', letterSpacing: 1.3 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.1, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function Telem({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: '#7FA5D3', fontWeight: 600, letterSpacing: 0.8 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: warn ? '#FFA940' : '#E5F2FF', fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
        {value}
      </div>
    </div>
  );
}
