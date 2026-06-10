import { Suspense, useRef, useEffect, useMemo, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  OrbitControls,
  useGLTF,
  Environment,
  ContactShadows,
  Html,
  Sky,
  BakeShadows,
} from '@react-three/drei';
import * as THREE from 'three';
import { TerminalInfo, statusColor, statusLabel, VESSELS_BY_TERMINAL, VESSEL_GLB, VesselSpot } from '../../../data/terminals';
import { ArrowLeft, Loader2, RotateCcw, Ship } from 'lucide-react';
import { useVesselSession } from '../../../lib/useVesselSession';
import { useVesselStatus, type VesselStatusRow } from '../../../lib/useVesselStatus';

interface Props {
  terminal: TerminalInfo;
  onBack: () => void;
  /** Notified when the user dives into a vessel; null when back at terminal view. */
  onVesselChange?: (vessel: VesselSpot | null) => void;
}

/* ─── Time of day → sun direction / lighting ─────────────────────────── */

type TimeOfDay = 'auto' | 'morning' | 'afternoon' | 'evening' | 'night';

/** Map our TOD label to a drei Environment preset. */
function envPresetForLabel(label: string): 'dawn' | 'sunset' | 'park' | 'city' | 'night' {
  switch (label) {
    case 'NIGHT':     return 'night';
    case 'DAWN':      return 'dawn';
    case 'MORNING':   return 'park';
    case 'NOON':
    case 'AFTERNOON': return 'city';
    case 'DUSK':      return 'sunset';
    default:          return 'city';
  }
}

/** Hours-since-midnight (0-24) for each preset, or the live SGT clock for "auto". */
function hourForTOD(mode: TimeOfDay): number {
  switch (mode) {
    case 'morning':   return 8.0;
    case 'afternoon': return 14.5;
    case 'evening':   return 18.6;
    case 'night':     return 22.0;
    default: {
      // Singapore is UTC+8 year-round
      const now = new Date();
      const sgtMs = now.getTime() + (now.getTimezoneOffset() + 8 * 60) * 60 * 1000;
      const sgt = new Date(sgtMs);
      return sgt.getUTCHours() + sgt.getUTCMinutes() / 60;
    }
  }
}

interface SunState {
  /** Unit vector from origin toward the sun (Y-up). */
  dir: [number, number, number];
  sunColor: string;
  sunIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  bg: string;
  fogColor: string;
  isNight: boolean;
  exposure: number;
  /** Pretty label for the HUD. */
  label: string;
}

/**
 * Equator-aligned solar arc — east at sunrise (~06:00), zenith at noon, west at sunset (~18:00).
 * Singapore sits near 1.3°N so the sun passes nearly overhead year-round; this is a fair
 * approximation for visual purposes.
 */
function sunStateForHour(h: number): SunState {
  // Wrap 0..24 just in case
  const hour = ((h % 24) + 24) % 24;

  // Day arc: t goes 0 at sunrise (6) to 1 at sunset (18)
  const t = (hour - 6) / 12;
  const angle = t * Math.PI;           // 0..π across the sky
  const sunX = -Math.cos(angle);       // -1 east → +1 west
  const sunY =  Math.sin(angle);       // 0 horizon → 1 overhead
  const sunZ = -0.18;                  // slight north tilt (Singapore is 1.3°N)

  // Night → moon: opposite-ish arc, fixed-ish high & cool
  if (hour < 5.7 || hour > 18.7) {
    return {
      dir: [-sunX * 0.5, 0.85, -sunZ - 0.25],
      sunColor: '#a8c4ff',
      sunIntensity: 0.28,
      hemiSky: '#1d2c4a',
      hemiGround: '#04080f',
      hemiIntensity: 0.55,
      bg: '#020812',
      fogColor: '#040e1c',
      isNight: true,
      exposure: 0.65,
      label: 'NIGHT',
    };
  }

  // Dawn (5.7-7) / Dusk (17.5-18.7) — low warm sun
  if (hour < 7 || hour > 17.5) {
    return {
      dir: [sunX, Math.max(0.08, sunY), sunZ],
      sunColor: '#ff8855',
      sunIntensity: 0.95,
      hemiSky: '#7a5942',
      hemiGround: '#0d0a08',
      hemiIntensity: 0.55,
      bg: '#3b2218',
      fogColor: '#3a1f15',
      isNight: false,
      exposure: 0.95,
      label: hour < 12 ? 'DAWN' : 'DUSK',
    };
  }

  // Morning soft warm
  if (hour < 10) {
    return {
      dir: [sunX, sunY, sunZ],
      sunColor: '#ffe0b3',
      sunIntensity: 1.35,
      hemiSky: '#9bbedc',
      hemiGround: '#0a1825',
      hemiIntensity: 0.6,
      bg: '#06182a',
      fogColor: '#06182a',
      isNight: false,
      exposure: 1.05,
      label: 'MORNING',
    };
  }

  // Midday bright white
  if (hour < 15) {
    return {
      dir: [sunX, sunY, sunZ],
      sunColor: '#ffffff',
      sunIntensity: 1.85,
      hemiSky: '#bcd9f1',
      hemiGround: '#0a1825',
      hemiIntensity: 0.65,
      bg: '#0a1f33',
      fogColor: '#08182a',
      isNight: false,
      exposure: 1.10,
      label: hour < 13 ? 'NOON' : 'AFTERNOON',
    };
  }

  // Late afternoon — golden hour run-up
  return {
    dir: [sunX, sunY, sunZ],
    sunColor: '#ffcc99',
    sunIntensity: 1.45,
    hemiSky: '#a6b7c7',
    hemiGround: '#100c08',
    hemiIntensity: 0.55,
    bg: '#1d2434',
    fogColor: '#1a2030',
    isNight: false,
    exposure: 1.00,
    label: 'AFTERNOON',
  };
}

/* ─── Vessel HUD (data-driven from Supabase via useVesselSession) ───── */

function VesselHud({ terminal, vessel }: { terminal: TerminalInfo; vessel: VesselSpot }) {
  // Real-time operational state of the vessel itself — preferred source.
  const { status: vstatus, loading: statusLoading } = useVesselStatus(vessel.id);

  // Pull the upcoming-or-current delivery session ONLY to enrich the HUD
  // with "next customer" info — never to drive the headline state.
  const sessionId = vstatus?.next_session_id ?? vessel.sessionId;
  const { session, risk, supplier, loading: sessionLoading } = useVesselSession(sessionId);

  // Resolve the headline state. Vessel-status table wins; fall back to the
  // in-app metadata (`vessel.status`) so unseeded demos still render.
  const headlineState: VesselStatusRow['current_status'] =
       vstatus?.current_status
    ?? (vessel.status === 'loading'  ? 'LOADING'
      : vessel.status === 'transit'  ? 'EN_ROUTE'
      : vessel.status === 'idle'     ? 'IDLE'
      : 'STANDBY');

  const isDelivering = headlineState === 'DELIVERING';

  return (
    <div style={{
      position: 'absolute', top: 12, left: 12,
      background: 'rgba(8,19,31,0.92)',
      border: '1px solid rgba(46,168,255,0.45)',
      padding: '12px 16px', borderRadius: 8,
      backdropFilter: 'blur(10px)', color: '#E5F2FF',
      minWidth: 280, maxWidth: 340,
    }}>
      {/* Header */}
      <div style={{ fontSize: 9, fontWeight: 700, color: '#2EA8FF', letterSpacing: 1.5, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Ship size={11} /> {terminal.id} · {vessel.id}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{vessel.name}</div>
      <div style={{ fontSize: 10, color: '#8BB4D6', marginTop: 1 }}>
        {vstatus?.berth_label
          ? `${vstatus.berth_label} · ${terminal.name}`
          : `Berthed at ${terminal.name}`}
      </div>

      {/* Headline state pill */}
      <StatusPill state={headlineState} />

      {statusLoading && !vstatus && (
        <div style={{ fontSize: 10, color: '#7FA5D3', marginTop: 6 }}>Loading vessel status…</div>
      )}

      {/* ── PORT-STATE PANEL (LOADING / IDLE / STANDBY / EN_ROUTE / MAINTENANCE) ── */}
      {!isDelivering && (
        <PortStatePanel
          vstatus={vstatus}
          fallbackCargo={vessel.cargo}
          state={headlineState}
        />
      )}

      {/* ── DELIVERY PANEL (only when this vessel is actively transferring) ── */}
      {isDelivering && sessionId && (
        <DeliveryPanel
          sessionId={sessionId}
          session={session}
          risk={risk}
          supplier={supplier}
          loading={sessionLoading}
        />
      )}

      {/* Next-job preview — shown when not delivering and a session is queued */}
      {!isDelivering && (vstatus?.next_session_id || sessionId) && (
        <NextJobPreview
          customer={vstatus?.next_customer ?? session?.vessel_name ?? null}
          sessionId={vstatus?.next_session_id ?? sessionId ?? null}
          etd={vstatus?.etd_local ?? null}
        />
      )}
    </div>
  );
}

/* ─── HUD sub-components ──────────────────────────────────────────────── */

function StatusPill({ state }: { state: VesselStatusRow['current_status'] }) {
  const map: Record<VesselStatusRow['current_status'], { c: string; l: string }> = {
    IDLE:        { c: '#7FA5D3', l: 'IDLE · awaiting nomination' },
    LOADING:     { c: '#FFA940', l: 'LOADING · fuel intake' },
    STANDBY:     { c: '#4A9EFF', l: 'STANDBY · ready to depart' },
    EN_ROUTE:    { c: '#A36CFF', l: 'EN-ROUTE · transit' },
    DELIVERING:  { c: '#00D98E', l: 'DELIVERING · live transfer' },
    MAINTENANCE: { c: '#FF5656', l: 'MAINTENANCE · out of service' },
  };
  const { c, l } = map[state];
  return (
    <div style={{
      marginTop: 8, padding: '5px 9px', borderRadius: 4,
      background: `${c}1A`, border: `1px solid ${c}55`,
      fontSize: 10, fontWeight: 700, color: c, letterSpacing: 0.8,
    }}>
      {l}
    </div>
  );
}

function PortStatePanel({
  vstatus, fallbackCargo, state,
}: {
  vstatus: VesselStatusRow | null;
  fallbackCargo?: string;
  state: VesselStatusRow['current_status'];
}) {
  // Parse fallback cargo string like "VLSFO 380 cSt · 480 MT"
  const fallback = (() => {
    if (!fallbackCargo) return { grade: null, loaded: null };
    const m = fallbackCargo.match(/^(.+?)\s*·\s*([\d.]+)\s*MT$/);
    return m ? { grade: m[1], loaded: Number(m[2]) } : { grade: fallbackCargo, loaded: null };
  })();

  const grade   = vstatus?.cargo_grade       ?? fallback.grade   ?? '—';
  const loaded  = vstatus?.cargo_loaded_mt   ?? fallback.loaded;
  const cap     = vstatus?.cargo_capacity_mt;
  const rate    = vstatus?.loading_rate_m3h;
  const etd     = vstatus?.etd_local;
  const crewOk  = vstatus?.crew_verified;
  const mpaOk   = vstatus?.mpa_tag_verified;
  const action  = vstatus?.recommended_action;
  const event   = vstatus?.last_event;

  return (
    <>
      <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
        <HudStat label="CARGO" value={grade} mono={false} />
        <HudStat
          label="ONBOARD"
          value={loaded != null ? (cap ? `${loaded} / ${cap} MT` : `${loaded} MT`) : '—'}
          mono
        />
      </div>
      {state === 'LOADING' && (
        <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
          <HudStat label="LOAD RATE" value={rate ? `${rate} m³/h` : '—'} mono />
          <HudStat label="ETD" value={etd ?? '—'} mono />
        </div>
      )}
      {state === 'EN_ROUTE' && etd && (
        <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
          <HudStat label="ETA" value={etd} mono />
        </div>
      )}
      {(crewOk != null || mpaOk != null) && (
        <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 10 }}>
          <VerifyTag label="Crew"    ok={!!crewOk} />
          <VerifyTag label="MPA tag" ok={!!mpaOk} />
        </div>
      )}
      {event && (
        <div style={{ marginTop: 8, fontSize: 10, color: '#A8C8E8', lineHeight: 1.45 }}>
          <span style={{ color: '#5A8AB4', fontWeight: 600 }}>Last event · </span>{event}
        </div>
      )}
      {action && (
        <div style={{
          marginTop: 8, padding: '6px 8px', borderRadius: 4,
          background: 'rgba(46,168,255,0.08)', border: '1px solid rgba(46,168,255,0.25)',
          fontSize: 10, color: '#BFD7F7',
        }}>
          <span style={{ color: '#2EA8FF', fontWeight: 700, letterSpacing: 0.6 }}>RECOMMENDED · </span>
          {action}
        </div>
      )}
    </>
  );
}

function DeliveryPanel({
  sessionId, session, risk, supplier, loading,
}: {
  sessionId: string;
  session: any;
  risk: any;
  supplier: any;
  loading: boolean;
}) {
  const riskColor = !risk
    ? '#7FA5D3'
    : risk.risk_category === 'CRITICAL' ? '#FF5656'
    : risk.risk_category === 'HIGH'     ? '#FFA940'
    : risk.risk_category === 'MEDIUM'   ? '#4A9EFF'
    : '#00D98E';
  const devColor = (session?.dev_pct ?? 0) <= -2 ? '#FF5656'
                 : (session?.dev_pct ?? 0) <= -1 ? '#FFA940'
                 : '#00D98E';

  return (
    <>
      <div style={{
        marginTop: 10, paddingTop: 8,
        borderTop: '1px solid rgba(127,165,211,0.18)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#7FA5D3', letterSpacing: 1.1 }}>
          ACTIVE SESSION
        </span>
        <span style={{ fontSize: 9, color: '#3D5A75', fontFamily: "'JetBrains Mono', monospace" }}>
          {sessionId}
        </span>
      </div>
      {loading && (
        <div style={{ fontSize: 10, color: '#7FA5D3', marginTop: 6 }}>Loading live session…</div>
      )}
      {session && (
        <>
          <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
            <HudStat label="RECEIVING" value={session.vessel_name} mono={false} />
            <HudStat label="BARGE" value={session.barge_name ?? '—'} mono={false} />
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
            <HudStat label="SUPPLIER" value={supplier?.name?.split(' ').slice(-3).join(' ') ?? session.supplier_name ?? '—'} mono={false} />
            <HudStat label="GRADE" value={session.fuel_grade ?? '—'} mono={false} />
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
            <HudStat label="BDN" value={`${session.bdn_qty_mt ?? '—'} MT`} mono />
            <HudStat label="MFM" value={`${session.mfm_qty_mt ?? '—'} MT`} mono />
            <HudStat label="ΔPCT" value={`${(session.dev_pct ?? 0).toFixed(2)}%`} mono color={devColor} />
          </div>
          {risk && (
            <div style={{
              marginTop: 8, padding: '6px 8px',
              background: 'rgba(8,19,31,0.6)',
              border: `1px solid ${riskColor}44`,
              borderRadius: 4,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#7FA5D3', letterSpacing: 1.1 }}>
                RISK · {risk.risk_category}
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: riskColor, fontFamily: "'JetBrains Mono', monospace" }}>
                {risk.final_risk_score}/100
              </span>
            </div>
          )}
          {risk?.verdict && (
            <div style={{ marginTop: 6, fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: riskColor }}>
              VERDICT · {String(risk.verdict).replace(/_/g, ' ')}
            </div>
          )}
        </>
      )}
    </>
  );
}

function NextJobPreview({
  customer, sessionId, etd,
}: { customer: string | null; sessionId: string | null; etd: string | null }) {
  if (!customer && !sessionId) return null;
  return (
    <div style={{
      marginTop: 10, paddingTop: 8,
      borderTop: '1px dashed rgba(127,165,211,0.22)',
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#5A8AB4', letterSpacing: 1.1, marginBottom: 4 }}>
        NEXT JOB (QUEUED)
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontSize: 11 }}>
        <span style={{ color: '#BFD7F7' }}>→ {customer ?? 'tbc'}</span>
        {etd && <span style={{ color: '#5A8AB4', fontFamily: "'JetBrains Mono', monospace" }}>ETD {etd}</span>}
      </div>
      {sessionId && (
        <div style={{ fontSize: 9, color: '#3D5A75', fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
          {sessionId}
        </div>
      )}
    </div>
  );
}

function VerifyTag({ label, ok }: { label: string; ok: boolean }) {
  const c = ok ? '#00D98E' : '#FF5656';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />
      <span style={{ color: '#A8C8E8' }}>{label}</span>
      <span style={{ color: c, fontWeight: 700 }}>{ok ? '✓' : '✗'}</span>
    </span>
  );
}

function HudStat({ label, value, mono, color }: { label: string; value: string; mono?: boolean; color?: string }) {
  return (
    <div style={{ minWidth: 0, flex: 1 }}>
      <div style={{
        fontSize: 8.5, fontWeight: 700, color: '#3D5A75',
        textTransform: 'uppercase', letterSpacing: 1.1,
      }}>{label}</div>
      <div style={{
        fontSize: 11, fontWeight: 700, marginTop: 2,
        color: color ?? '#E5F2FF',
        fontFamily: mono ? "'JetBrains Mono', monospace" : undefined,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {value}
      </div>
    </div>
  );
}

/* ─── Cloud-pass overlay used during the vessel dive ───────────────────── */

/**
 * Mirror of SingaporeMap's CloudPass — 30 soft puffs streaming outward across
 * the 3D viewer area while the camera dives to the selected vessel. Kept local
 * so the viewer doesn't import a private helper from another file.
 */
function ViewerCloudPass() {
  const puffs = [
    { angle:  10, layer: 'near' as const, size: 360, delay: 0.05, dur: 1.0, alpha: 0.78, hue: 218 },
    { angle:  46, layer: 'near' as const, size: 320, delay: 0.20, dur: 1.0, alpha: 0.72, hue: 220 },
    { angle:  88, layer: 'near' as const, size: 380, delay: 0.10, dur: 1.1, alpha: 0.80, hue: 216 },
    { angle: 130, layer: 'near' as const, size: 340, delay: 0.30, dur: 1.0, alpha: 0.75, hue: 222 },
    { angle: 175, layer: 'near' as const, size: 400, delay: 0.15, dur: 1.2, alpha: 0.82, hue: 218 },
    { angle: 218, layer: 'near' as const, size: 360, delay: 0.25, dur: 1.0, alpha: 0.76, hue: 220 },
    { angle: 260, layer: 'near' as const, size: 320, delay: 0.05, dur: 1.1, alpha: 0.72, hue: 215 },
    { angle: 300, layer: 'near' as const, size: 380, delay: 0.32, dur: 1.0, alpha: 0.80, hue: 222 },
    { angle: 340, layer: 'near' as const, size: 340, delay: 0.18, dur: 1.1, alpha: 0.75, hue: 218 },
    { angle:  25, layer: 'mid'  as const, size: 200, delay: 0.10, dur: 1.5, alpha: 0.58, hue: 215 },
    { angle:  60, layer: 'mid'  as const, size: 220, delay: 0.28, dur: 1.4, alpha: 0.60, hue: 220 },
    { angle: 100, layer: 'mid'  as const, size: 180, delay: 0.18, dur: 1.6, alpha: 0.55, hue: 216 },
    { angle: 140, layer: 'mid'  as const, size: 210, delay: 0.40, dur: 1.5, alpha: 0.58, hue: 222 },
    { angle: 188, layer: 'mid'  as const, size: 195, delay: 0.05, dur: 1.5, alpha: 0.55, hue: 218 },
    { angle: 230, layer: 'mid'  as const, size: 215, delay: 0.32, dur: 1.6, alpha: 0.60, hue: 220 },
    { angle: 270, layer: 'mid'  as const, size: 185, delay: 0.20, dur: 1.4, alpha: 0.52, hue: 210 },
    { angle: 315, layer: 'mid'  as const, size: 220, delay: 0.12, dur: 1.6, alpha: 0.60, hue: 218 },
    { angle: 350, layer: 'mid'  as const, size: 195, delay: 0.35, dur: 1.5, alpha: 0.56, hue: 222 },
    { angle:   0, layer: 'far'  as const, size: 120, delay: 0.00, dur: 2.0, alpha: 0.50, hue: 215 },
    { angle:  40, layer: 'far'  as const, size: 110, delay: 0.30, dur: 2.2, alpha: 0.48, hue: 218 },
    { angle:  80, layer: 'far'  as const, size: 130, delay: 0.10, dur: 1.9, alpha: 0.55, hue: 220 },
    { angle: 120, layer: 'far'  as const, size: 115, delay: 0.40, dur: 2.0, alpha: 0.50, hue: 212 },
    { angle: 160, layer: 'far'  as const, size: 125, delay: 0.20, dur: 2.1, alpha: 0.55, hue: 218 },
    { angle: 200, layer: 'far'  as const, size: 105, delay: 0.55, dur: 1.9, alpha: 0.50, hue: 215 },
    { angle: 245, layer: 'far'  as const, size: 130, delay: 0.05, dur: 2.3, alpha: 0.58, hue: 222 },
    { angle: 285, layer: 'far'  as const, size: 115, delay: 0.35, dur: 2.0, alpha: 0.48, hue: 208 },
    { angle: 325, layer: 'far'  as const, size: 120, delay: 0.15, dur: 2.2, alpha: 0.55, hue: 216 },
    { angle: 355, layer: 'far'  as const, size: 110, delay: 0.45, dur: 1.9, alpha: 0.50, hue: 213 },
  ];

  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      overflow: 'hidden', zIndex: 10, mixBlendMode: 'screen',
    }}>
      {puffs.map((p, i) => {
        const blur = p.layer === 'near' ? 26 : p.layer === 'mid' ? 14 : 7;
        const anim = p.layer === 'near' ? 'vCloudNear'
                   : p.layer === 'mid'  ? 'vCloudMid'
                                        : 'vCloudFar';
        const w = p.size * 1.6;
        const h = p.size * 0.9;
        return (
          <div
            key={i}
            style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, transform: `rotate(${p.angle}deg)` }}
          >
            <div
              style={{
                position: 'absolute', left: 0, top: 0,
                width: `${w}px`, height: `${h}px`,
                marginLeft: `${-w / 2}px`, marginTop: `${-h / 2}px`,
                background: `
                  radial-gradient(ellipse 60% 70% at 35% 40%, hsla(${p.hue}, 80%, 99%, ${p.alpha}) 0%, hsla(${p.hue}, 70%, 95%, ${p.alpha * 0.7}) 35%, transparent 70%),
                  radial-gradient(ellipse 75% 80% at 65% 55%, hsla(${p.hue}, 65%, 94%, ${p.alpha * 0.85}) 0%, hsla(${p.hue}, 60%, 88%, ${p.alpha * 0.5}) 40%, transparent 75%),
                  radial-gradient(ellipse 90% 70% at 50% 50%, hsla(${p.hue}, 55%, 85%, ${p.alpha * 0.55}) 0%, transparent 80%)
                `,
                animation: `${anim} ${p.dur}s cubic-bezier(0.36, 0.04, 0.56, 1) ${p.delay}s forwards`,
                opacity: 0,
                filter: `blur(${blur}px)`,
                borderRadius: '50%',
              }}
            />
          </div>
        );
      })}
      <style>{`
        @keyframes vCloudNear { 0%{opacity:0;transform:translate(0,0) rotate(0deg) scale(0.4);} 18%{opacity:0.95;} 50%{opacity:1;transform:translate(20vmax,-1.5vmax) rotate(6deg) scale(1.0);} 80%{opacity:0.8;} 100%{opacity:0;transform:translate(65vmax,2vmax) rotate(12deg) scale(1.7);} }
        @keyframes vCloudMid  { 0%{opacity:0;transform:translate(0,0) rotate(0deg) scale(0.5);} 22%{opacity:0.85;} 55%{opacity:0.9;transform:translate(14vmax,1vmax) rotate(-4deg) scale(1.0);} 85%{opacity:0.5;} 100%{opacity:0;transform:translate(50vmax,-1.5vmax) rotate(-8deg) scale(1.5);} }
        @keyframes vCloudFar  { 0%{opacity:0;transform:translate(0,0) rotate(0deg) scale(0.6);} 25%{opacity:0.65;} 60%{opacity:0.7;transform:translate(9vmax,0.5vmax) rotate(3deg) scale(1.0);} 90%{opacity:0.3;} 100%{opacity:0;transform:translate(32vmax,-0.8vmax) rotate(7deg) scale(1.3);} }
      `}</style>
    </div>
  );
}

/* ─── Vessel ────────────────────────────────────────────────────────────── */

/**
 * Bunkering vessel — single shared GLB instanced at three locations per terminal.
 * Click any vessel to dive into it. The model is centered on origin XZ and its
 * keel sits at Y = 0 (sea level).
 */
function Vessel({
  spot, isFocused, dimmed, onClick,
}: {
  spot: VesselSpot;
  isFocused: boolean;
  dimmed: boolean;
  onClick: () => void;
}) {
  const gltf = useGLTF(VESSEL_GLB);
  const ref = useRef<THREE.Group>(null);

  const centeredScene = useMemo(() => {
    const s = gltf.scene.clone(true);
    s.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(s);
    const center = new THREE.Vector3();
    box.getCenter(center);
    s.position.x -= center.x;
    s.position.z -= center.z;
    s.position.y -= box.min.y;
    // Disable shadow casts/receives on the 480-mesh vessel. With 3 vessels
    // in scene that's 1440 extra meshes per shadow pass — kills the WebGL
    // context on top of the terminal's ~5k meshes. ContactShadows still
    // grounds the vessel visually below.
    s.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const m = o as THREE.Mesh;
        m.castShadow = false;
        m.receiveShadow = false;
        // No tint applied — use the GLB's baked materials so every vessel has
        // the same livery (black hull, rust-brown deck tanks, white bridge),
        // matching the original Blender file.
      }
    });
    return s;
  }, [gltf]);

  // Dim non-focused vessels by hiding entirely — avoids messing with material
  // transparency (which would force the GPU to depth-sort vessel hull pieces
  // and risk the boat rendering behind the water plane).
  useEffect(() => {
    if (!ref.current) return;
    ref.current.visible = !dimmed;
  }, [dimmed]);

  return (
    <group
      ref={ref}
      position={spot.pos}
      rotation={[0, (spot.rotY * Math.PI) / 180, 0]}
      scale={spot.scale}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={(e) => { e.stopPropagation(); (document.body.style as any).cursor = 'pointer'; }}
      onPointerOut={() => { (document.body.style as any).cursor = ''; }}
    >
      <primitive object={centeredScene} />
      {/* Focus glow ring on the sea surface beneath the vessel */}
      {isFocused && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.5, 0]}>
          <ringGeometry args={[150, 180, 64]} />
          <meshBasicMaterial color="#2EA8FF" transparent opacity={0.85} />
        </mesh>
      )}
      {/* Clickable green status dot floating above the vessel — same affordance
          as the SG map pins. Hosted by drei <Html> so it sits in screen space
          and can receive DOM events even with the heavy GLB underneath.
          Hidden in two cases:
          - `isFocused` — we're already zoomed into this vessel, the dot would
            balloon over the hull.
          - `dimmed`    — another vessel is selected; we need to remove this
            vessel's dot too. (`group.visible = false` hides the 3D mesh but
            <Html> renders to a DOM portal outside the group, so we must
            short-circuit it explicitly.) */}
      {!isFocused && !dimmed && (
      <Html
        position={[0, 45, 0]}
        center
        distanceFactor={300}
        zIndexRange={[20, 0]}
        style={{ pointerEvents: 'auto' }}
      >
        <div
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          style={{
            position: 'relative',
            width: 22, height: 22,
            cursor: 'pointer',
          }}
        >
          {/* pulsing ring */}
          <div style={{
            position: 'absolute',
            left: '50%', top: '50%',
            width: 22, height: 22, marginLeft: -11, marginTop: -11,
            borderRadius: '50%',
            background: '#00D47E',
            opacity: 0.25,
            animation: 'vesselPulse 2.4s ease-in-out infinite',
          }} />
          {/* core dot */}
          <div style={{
            position: 'absolute',
            left: '50%', top: '50%',
            width: 14, height: 14, marginLeft: -7, marginTop: -7,
            borderRadius: '50%',
            background: '#00D47E',
            border: '2px solid #fff',
            boxShadow: '0 0 12px #00D47E, 0 0 0 1px rgba(0,0,0,0.4)',
          }} />
          {/* label badge */}
          <div style={{
            position: 'absolute',
            left: 18, top: -4,
            background: 'rgba(8,19,31,0.92)',
            border: '1px solid rgba(0,212,126,0.45)',
            color: '#E5F2FF',
            padding: '3px 7px',
            borderRadius: 4,
            whiteSpace: 'nowrap',
            backdropFilter: 'blur(6px)',
          }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4 }}>{spot.id} · {spot.name}</div>
            <div style={{ fontSize: 7.5, fontWeight: 700, color: '#00D47E', letterSpacing: 0.8 }}>
              ● {(spot.status ?? 'idle').toUpperCase()}
            </div>
          </div>
          <style>{`
            @keyframes vesselPulse {
              0%   { transform: scale(0.7); opacity: 0.5; }
              70%  { transform: scale(3.2); opacity: 0; }
              100% { transform: scale(3.2); opacity: 0; }
            }
          `}</style>
        </div>
      </Html>
      )}
    </group>
  );
}

/* ─── Vessel camera dive ─────────────────────────────────────────────────── */

interface VesselCameraProps {
  spot: VesselSpot;
  vesselLengthMeters: number;
  triggerKey: string;
  onArrive: () => void;
}

function VesselCameraIntro({ spot, vesselLengthMeters, triggerKey, onArrive }: VesselCameraProps) {
  const { camera, size } = useThree();
  const startTime = useRef(performance.now());
  const captured = useRef<THREE.Vector3 | null>(null);
  const lastKey = useRef<string | null>(null);

  // Close-up broadside view — camera roughly half a vessel-length away,
  // eye-level just above water, looking at deck height. Frames the vessel
  // tightly so the side profile fills the screen the way the reference
  // photo did, instead of pulling back to fit the whole bbox.
  //
  // The vessel GLB's natural long axis is +X (bbox.x = 137 m) — i.e. bow at
  // +X end at rotY = 0. After a Y-axis rotation of θ:
  //   forward (bow direction)  = ( cos θ, 0, -sin θ )
  //   starboard side (90° CW of forward) = ( sin θ, 0,  cos θ )
  const theta = (spot.rotY * Math.PI) / 180;
  const fwdDir = useMemo(
    () => new THREE.Vector3(Math.cos(theta), 0, -Math.sin(theta)).normalize(),
    [theta],
  );
  const sideDir = useMemo(
    () => new THREE.Vector3(Math.sin(theta), 0, Math.cos(theta)).normalize(),
    [theta],
  );

  // Isometric broadside, viewed from the **bow quarter** — front-side angle
  // so the bow points toward the camera (positive fwdOffset).
  const sideOffset = vesselLengthMeters * 0.42;         // perpendicular to keel
  const fwdOffset  = vesselLengthMeters * 0.28;         // positive → toward the bow
  const eyeHeight  = vesselLengthMeters * 0.30;         // ~30° iso elevation

  const targetX = spot.pos[0];
  const targetZ = spot.pos[2];

  const finalCam = useMemo(() => {
    return new THREE.Vector3(
      targetX + sideDir.x * sideOffset + fwdDir.x * fwdOffset,
      eyeHeight,
      targetZ + sideDir.z * sideOffset + fwdDir.z * fwdOffset,
    );
  }, [targetX, targetZ, sideDir, fwdDir, sideOffset, fwdOffset, eyeHeight]);

  // Look slightly above deck height — with the camera up high, aiming a bit
  // higher pulls the bridge into frame and keeps the iso composition centred.
  const lookAt = useMemo(
    () => new THREE.Vector3(targetX, vesselLengthMeters * 0.07, targetZ),
    [targetX, targetZ, vesselLengthMeters],
  );

  useEffect(() => {
    if (lastKey.current === triggerKey) return;
    lastKey.current = triggerKey;
    // Capture current camera position as start so we don't jump
    captured.current = camera.position.clone();
    startTime.current = performance.now();
  }, [triggerKey, camera]);

  useFrame(() => {
    const start = captured.current;
    if (!start) return;
    const t = Math.min(1, (performance.now() - startTime.current) / 1600);
    const e = 1 - Math.pow(1 - t, 4);
    camera.position.lerpVectors(start, finalCam, e);
    camera.lookAt(lookAt);
    if (t >= 1 && lastKey.current === triggerKey) {
      lastKey.current = triggerKey + ':done';
      onArrive();
    }
  });

  return null;
}

/* ─── Model ────────────────────────────────────────────────────────────── */

function TerminalModel({
  url,
  onReady,
}: { url: string; onReady: (r: number) => void }) {
  const gltf = useGLTF(url);

  const { centeredScene, radius } = useMemo(() => {
    const scene = gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(scene);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);

    scene.position.x -= center.x;
    scene.position.z -= center.z;
    scene.position.y -= box.min.y;

    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const m = o as THREE.Mesh;
        m.castShadow = true;
        m.receiveShadow = true;
        // PBR polish: any default material with low metalness becomes slightly more reflective
        if (Array.isArray(m.material)) {
          m.material.forEach(tunePBR);
        } else if (m.material) {
          tunePBR(m.material as THREE.Material);
        }
      }
    });

    const r = Math.max(size.x, size.z) / 2;
    return { centeredScene: scene, radius: r };
  }, [gltf]);

  useEffect(() => { onReady(radius); }, [radius, onReady]);

  return <primitive object={centeredScene} />;
}

function tunePBR(mat: THREE.Material) {
  const m = mat as THREE.MeshStandardMaterial;
  if (m.isMaterial && (m as any).roughness !== undefined) {
    if (m.roughness > 0.9) m.roughness = 0.78;
    if (m.metalness < 0.05) m.metalness = 0.12;
  }
}

/* ─── Camera entry animation — fits to viewport aspect ────────────────── */

interface CameraIntroProps {
  targetRadius: number;
  onArrive: () => void;
  triggerKey: string;
  frameRatio: number;
}

function CameraIntro({ targetRadius, onArrive, triggerKey, frameRatio }: CameraIntroProps) {
  const { camera, size } = useThree();
  const startTimeRef = useRef(performance.now());
  const arrived = useRef(false);
  // Capture startCam ONCE when the intro begins. If we recomputed it from `size`
  // each render, every viewport resize would teleport the lerp origin and the
  // camera would visibly jerk. Final target *does* track resize for smooth re-framing.
  const capturedStart = useRef<THREE.Vector3 | null>(null);
  const lastTriggerKey = useRef<string | null>(null);

  // Default frames ~38% of the bbox (visually-dense tanks/jetties) rather than
  // the full plot extent, which includes outlying geometry that would make
  // the installation look small. Per-terminal override via `frameRatio` prop.
  const framingRadius = targetRadius * frameRatio;

  const fov = (camera as THREE.PerspectiveCamera).fov;
  const aspect = size.width / Math.max(1, size.height);
  const tanHalfFov = Math.tan((fov * Math.PI) / 360);
  const dY = framingRadius / tanHalfFov;
  const dX = framingRadius / (aspect * tanHalfFov);
  const topDist = Math.max(dX, dY);

  // ~32° tilt off vertical → cinematic 3/4 monitor angle.
  const finalCam = useMemo(
    () => new THREE.Vector3(topDist * 0.10, topDist * 0.85, topDist * 0.52),
    [topDist],
  );
  const lookTarget = useMemo(
    () => new THREE.Vector3(0, targetRadius * 0.05, 0),
    [targetRadius],
  );

  // Reset ONLY when the actual terminal model changes — never on resize.
  useEffect(() => {
    if (lastTriggerKey.current === triggerKey) return;
    lastTriggerKey.current = triggerKey;
    const start = new THREE.Vector3(topDist * 0.25, topDist * 5.5, topDist * 0.8);
    capturedStart.current = start.clone();
    camera.position.copy(start);
    camera.lookAt(lookTarget);
    (camera as THREE.PerspectiveCamera).far = topDist * 30;
    (camera as THREE.PerspectiveCamera).near = Math.max(0.1, topDist * 0.001);
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    startTimeRef.current = performance.now();
    arrived.current = false;
    // topDist is intentionally read at the moment of trigger; we don't want
    // a later resize to retrigger this reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerKey]);

  useFrame(() => {
    if (arrived.current) return;
    const start = capturedStart.current;
    if (!start) return;
    const t = Math.min(1, (performance.now() - startTimeRef.current) / 2000);
    const e = 1 - Math.pow(1 - t, 4); // easeOutQuart
    camera.position.lerpVectors(start, finalCam, e);
    camera.lookAt(lookTarget);
    if (t >= 1) { arrived.current = true; onArrive(); }
  });

  return null;
}

/* ─── Water surface (subtle reflective plane) ─────────────────────────── */

function WaterPlane({ radius, color, envMapIntensity }: { radius: number; color: string; envMapIntensity: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
      <circleGeometry args={[radius * 6, 96]} />
      <meshStandardMaterial
        color={color}
        roughness={0.42}
        metalness={0.6}
        envMapIntensity={envMapIntensity}
      />
    </mesh>
  );
}

/* ─── Loader UI ───────────────────────────────────────────────────────── */

function ModelLoader() {
  // Inside the Canvas — kept minimal because the real cloud backdrop is rendered
  // as a DOM overlay (CloudLoadingBackdrop) for richer effects than Html allows.
  return null;
}

/**
 * Full-card cloud backdrop shown while the GLB is downloading. 10 wispy puffs
 * drift slowly across the area on infinite loops, each at its own speed/depth,
 * giving the impression of looking down through scattered cloud cover.
 */
function CloudLoadingBackdrop() {
  // [topPercent, sizePx, driftDurationS, delayS, alpha, hue, blurPx]
  const puffs: Array<{ top: number; size: number; dur: number; delay: number; alpha: number; hue: number; blur: number }> = [
    { top:  8, size: 340, dur: 18, delay:  -4, alpha: 0.42, hue: 215, blur: 22 },
    { top: 18, size: 260, dur: 22, delay:  -9, alpha: 0.36, hue: 218, blur: 18 },
    { top: 28, size: 380, dur: 16, delay:  -1, alpha: 0.48, hue: 220, blur: 26 },
    { top: 38, size: 220, dur: 24, delay: -14, alpha: 0.32, hue: 212, blur: 16 },
    { top: 48, size: 320, dur: 20, delay:  -6, alpha: 0.45, hue: 218, blur: 22 },
    { top: 58, size: 280, dur: 19, delay: -12, alpha: 0.40, hue: 216, blur: 20 },
    { top: 68, size: 360, dur: 17, delay:  -3, alpha: 0.50, hue: 220, blur: 24 },
    { top: 78, size: 240, dur: 23, delay:  -8, alpha: 0.36, hue: 214, blur: 18 },
    { top: 88, size: 300, dur: 21, delay: -15, alpha: 0.42, hue: 218, blur: 22 },
    { top: 95, size: 200, dur: 25, delay:  -2, alpha: 0.30, hue: 213, blur: 16 },
  ];

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      overflow: 'hidden',
      background: 'linear-gradient(180deg, #6b8db3 0%, #4d6e92 45%, #2c4869 100%)',
      zIndex: 6,
    }}>
      {puffs.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 0,
            top: `${p.top}%`,
            width: `${p.size * 1.6}px`,
            height: `${p.size * 0.85}px`,
            marginTop: `${-p.size * 0.425}px`,
            background: `
              radial-gradient(ellipse 55% 65% at 35% 40%, hsla(${p.hue}, 75%, 99%, ${p.alpha}) 0%, hsla(${p.hue}, 65%, 95%, ${p.alpha * 0.7}) 35%, transparent 70%),
              radial-gradient(ellipse 70% 75% at 65% 55%, hsla(${p.hue}, 60%, 94%, ${p.alpha * 0.85}) 0%, hsla(${p.hue}, 55%, 88%, ${p.alpha * 0.5}) 45%, transparent 78%),
              radial-gradient(ellipse 85% 65% at 50% 50%, hsla(${p.hue}, 50%, 82%, ${p.alpha * 0.55}) 0%, transparent 80%)
            `,
            borderRadius: '50%',
            filter: `blur(${p.blur}px)`,
            animation: `cloudDrift ${p.dur}s linear ${p.delay}s infinite`,
            willChange: 'transform',
          }}
        />
      ))}

      {/* Loading label */}
      <div style={{
        position: 'absolute',
        left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'rgba(8,19,31,0.7)',
        border: '1px solid rgba(180,210,235,0.35)',
        padding: '10px 18px',
        borderRadius: 22,
        color: '#E5F2FF',
        backdropFilter: 'blur(10px)',
      }}>
        <Loader2 size={14} style={{ color: '#cfe2f6', animation: 'spin 1.2s linear infinite' }} />
        <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase' }}>
          Descending through cloud cover
        </span>
      </div>

      <style>{`
        @keyframes cloudDrift {
          0%   { transform: translateX(-30%); }
          100% { transform: translateX(140%); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

/* ─── Top-level viewer ────────────────────────────────────────────────── */

export function Terminal3DViewer({ terminal, onBack, onVesselChange }: Props) {
  const [introDone, setIntroDone] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [realRadius, setRealRadius] = useState<number>(
    Math.max(terminal.bboxSize[0], terminal.bboxSize[1]) / 2 || 500,
  );
  const [selectedVessel, setSelectedVessel] = useState<VesselSpot | null>(null);
  const [vesselDiving, setVesselDiving] = useState(false);
  const orbitRef = useRef<any>(null);

  const vessels = VESSELS_BY_TERMINAL[terminal.id] ?? [];

  // Reset everything whenever a new terminal is opened.
  useEffect(() => {
    setModelLoaded(false);
    setIntroDone(false);
    setSelectedVessel(null);
    setVesselDiving(false);
  }, [terminal.id]);

  function diveToVessel(spot: VesselSpot) {
    if (vesselDiving) return;
    setVesselDiving(true);
    // Lock orbit while diving; mount the VesselCameraIntro overlay on the next tick
    setTimeout(() => {
      setSelectedVessel(spot);
      onVesselChange?.(spot);
      setVesselDiving(false);
    }, 1400);
  }

  function returnFromVessel() {
    setSelectedVessel(null);
    onVesselChange?.(null);
    // Re-trigger the terminal camera intro so we sweep back out from the vessel
    // back to the full top-down view.
    setIntroDone(false);
  }

  // Sun is locked to morning (≈ 8 AM SGT) — gives the tank installation a strong
  // raking light that brings out 3D form without the harsh top-down flatness of noon.
  const sun = useMemo(() => sunStateForHour(8.0), []);
  // The sun vector is unit-length; scale into world coords for the directional light.
  const sunPos: [number, number, number] = [
    sun.dir[0] * realRadius * 3.5,
    Math.max(sun.dir[1], 0.05) * realRadius * 4.0,
    sun.dir[2] * realRadius * 3.5,
  ];
  // Sky shader wants a position vector (its own internal scaling) — pass the direction directly.
  const skySun: [number, number, number] = [sun.dir[0], sun.dir[1], sun.dir[2]];

  // Re-trigger camera intro whenever a new model finishes loading
  const triggerKey = `${terminal.id}:${realRadius.toFixed(0)}`;

  // Seed the Canvas camera with a rough overhead position based on the bbox
  // we already know from terminals.ts. Without this, R3F defaults to (0,0,5)
  // and the GLB fills the entire viewport for the first frame, then CameraIntro
  // teleports it far out — looks like a zoom-out flash. With this guess the
  // initial frame already roughly resembles the final framing.
  const bootRadius = Math.max(terminal.bboxSize[0], terminal.bboxSize[1]) / 2 || 500;
  const bootFrameRatio = terminal.frameRatio ?? 0.38;
  const bootDist = (bootRadius * bootFrameRatio) / Math.tan((38 * Math.PI) / 360);
  const bootCam: [number, number, number] = [
    bootDist * 0.10,
    bootDist * 0.85 * 5.5, // matches the start position scale in CameraIntro
    bootDist * 0.8,
  ];

  function resetView() {
    orbitRef.current?.reset();
  }

  if (!terminal.glb) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '100%', height: '100%',
        background: 'radial-gradient(ellipse at center, #0B2238 0%, #050E18 100%)',
        color: '#E5F2FF',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#3D5A75', letterSpacing: 1.5, marginBottom: 8 }}>MODEL UNAVAILABLE</div>
          <div style={{ fontSize: 16 }}>{terminal.name}</div>
          <button onClick={onBack} style={{
            marginTop: 18, padding: '8px 18px', background: 'rgba(46,168,255,0.15)',
            border: '1px solid rgba(46,168,255,0.4)', color: '#2EA8FF', borderRadius: 6, cursor: 'pointer',
            fontSize: 12, fontWeight: 600,
          }}>← Back to map</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#02060A', overflow: 'hidden' }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: sun.exposure,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        camera={{ fov: 38, near: 0.1, far: realRadius * 30, position: bootCam }}
      >
        <color attach="background" args={[sun.bg]} />
        <fog attach="fog" args={[sun.fogColor, realRadius * 3, realRadius * 9]} />

        {/* Atmospheric sky — sun direction drives the gradient. At night it sits
            below the horizon so the sky shader renders a dim dome we then tint dark. */}
        <Sky
          distance={45000}
          sunPosition={skySun}
          turbidity={sun.isNight ? 8 : 6}
          rayleigh={sun.isNight ? 0.1 : 2.5}
          mieCoefficient={0.005}
          mieDirectionalG={0.78}
        />

        {/* Hemisphere fills the shadows — sky tint + ground tint reflect time of day */}
        <hemisphereLight args={[sun.hemiSky, sun.hemiGround, sun.hemiIntensity]} />

        {/* Sun (or moon at night) — main directional light */}
        <directionalLight
          position={sunPos}
          intensity={sun.sunIntensity}
          color={sun.sunColor}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-realRadius * 1.4}
          shadow-camera-right={realRadius * 1.4}
          shadow-camera-top={realRadius * 1.4}
          shadow-camera-bottom={-realRadius * 1.4}
          shadow-camera-near={1}
          shadow-camera-far={realRadius * 10}
          shadow-bias={-0.0005}
        />

        {/* Subtle warm rim light from the opposite side keeps geometry readable
            even when the sun is low — especially helpful in dawn/dusk/night */}
        <directionalLight
          position={[-sunPos[0] * 0.4, realRadius * 1.5, -sunPos[2] * 0.4]}
          intensity={sun.isNight ? 0.15 : 0.25}
          color={sun.isNight ? '#3a5b8c' : '#fff0d6'}
        />

        <WaterPlane
          radius={realRadius}
          color={sun.isNight ? '#020a14' : (sun.label === 'DAWN' || sun.label === 'DUSK' ? '#1f1410' : '#031829')}
          envMapIntensity={sun.isNight ? 0.28 : 0.5}
        />

        <Suspense fallback={<ModelLoader />}>
          <TerminalModel
            url={terminal.glb}
            onReady={(r) => { setRealRadius(r); setModelLoaded(true); }}
          />
          {/* Environment HDR matches time of day so reflections in tanks/water read right. */}
          <Environment preset={envPresetForLabel(sun.label)} />
          {/* Vessels berthed at the port */}
          {vessels.map((v) => (
            <Vessel
              key={v.id}
              spot={v}
              isFocused={selectedVessel?.id === v.id}
              dimmed={selectedVessel !== null && selectedVessel.id !== v.id}
              onClick={() => diveToVessel(v)}
            />
          ))}
        </Suspense>

        <ContactShadows
          position={[0, 0.04, 0]}
          opacity={0.55}
          scale={realRadius * 2.6}
          blur={2.4}
          far={realRadius * 0.6}
        />

        {/* Terminal camera — only runs while no vessel is focused */}
        {!selectedVessel && (
          <CameraIntro
            targetRadius={realRadius}
            onArrive={() => setIntroDone(true)}
            triggerKey={triggerKey + (selectedVessel ? '' : ':term')}
            frameRatio={terminal.frameRatio ?? 0.38}
          />
        )}

        {/* Vessel camera — takes over when a vessel is selected */}
        {selectedVessel && (
          <VesselCameraIntro
            spot={selectedVessel}
            // Vessel GLB ships at 322 m bbox; scale × 322 ≈ on-screen length
            vesselLengthMeters={322 * selectedVessel.scale}
            triggerKey={`${terminal.id}:${selectedVessel.id}`}
            onArrive={() => { /* orbit controls take over */ }}
          />
        )}

        <OrbitControls
          ref={orbitRef}
          enabled={introDone && !vesselDiving}
          target={selectedVessel
            ? [selectedVessel.pos[0], 0, selectedVessel.pos[2]]
            : [0, 0, 0]}
          minDistance={selectedVessel ? 30 : realRadius * 0.25}
          maxDistance={realRadius * 6}
          maxPolarAngle={Math.PI / 2.05}
          minPolarAngle={0.15}
          dampingFactor={0.08}
          enableDamping
        />

        <BakeShadows />
      </Canvas>

      {/* Cloud cover while the GLB downloads — covers the whole 3D area.
          Fades out once the model is mounted, revealing the terminal beneath. */}
      <div style={{
        position: 'absolute', inset: 0,
        opacity: modelLoaded ? 0 : 1,
        transition: 'opacity 700ms cubic-bezier(0.4, 0, 0.2, 1)',
        pointerEvents: modelLoaded ? 'none' : 'auto',
      }}>
        <CloudLoadingBackdrop />
      </div>

      {/* Vessel dive cloud pass — same effect as the map → terminal dive */}
      {/* No cloud pass on vessel dive — kept minimal per user request. */}

      {/* Vessel HUD + back button when one is selected */}
      {selectedVessel && (
        <>
          <VesselHud terminal={terminal} vessel={selectedVessel} />
          {/* The top-right Reset + BACK button row (shared with terminal view)
              auto-swaps to BACK TO TERMINAL when selectedVessel is set, so
              no separate button is needed here. */}
        </>
      )}

      {/* Info HUD — hidden while a vessel is focused (VesselHud takes over). */}
      {!selectedVessel && (
      <div style={{
        position: 'absolute', top: 12, left: 12,
        background: 'rgba(8,19,31,0.88)',
        border: '1px solid rgba(46,168,255,0.32)',
        padding: '10px 14px', borderRadius: 8,
        backdropFilter: 'blur(10px)', color: '#E5F2FF',
        minWidth: 240,
      }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#2EA8FF', letterSpacing: 1.5 }}>
          {terminal.id} · {terminal.operator}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{terminal.name}</div>
        <div style={{ fontSize: 10, color: '#8BB4D6', marginTop: 1 }}>{terminal.location}</div>

        <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
          <Stat label="STATUS" value={statusLabel(terminal.status)} color={statusColor(terminal.status)} />
          <Stat label="THROUGHPUT" value={terminal.throughput} />
          <Stat label="BERTHED" value={String(terminal.vesselsBerthed)} />
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <Stat label="FOOTPRINT" value={`${(terminal.bboxSize[0]).toFixed(0)}×${(terminal.bboxSize[1]).toFixed(0)} m`} />
          <Stat label="OBJECTS" value={terminal.meshCount.toLocaleString()} />
        </div>
      </div>
      )}

      {/* Buttons */}
      <div style={{
        position: 'absolute', top: 12, right: 12, display: 'flex', gap: 6,
      }}>
        <button
          onClick={resetView}
          title="Reset view"
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(8,19,31,0.85)', border: '1px solid rgba(46,168,255,0.3)',
            color: '#8BB4D6', padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
            backdropFilter: 'blur(8px)', fontSize: 11, fontWeight: 600,
          }}
        >
          <RotateCcw size={12} /> Reset
        </button>
        {/* In vessel view, this slot becomes BACK TO TERMINAL (returns to the
            terminal camera); in terminal view it returns to the SG map. */}
        <button
          onClick={selectedVessel ? returnFromVessel : onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(46,168,255,0.15)', border: '1px solid rgba(46,168,255,0.4)',
            color: '#2EA8FF', padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
            backdropFilter: 'blur(8px)', fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
          }}
        >
          <ArrowLeft size={12} /> {selectedVessel ? 'BACK TO TERMINAL' : 'BACK TO MAP'}
        </button>
      </div>

      {/* Bottom controls tip */}
      {introDone && (
        <div style={{
          position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(8,19,31,0.7)', padding: '5px 12px', borderRadius: 14,
          backdropFilter: 'blur(8px)', color: '#557A96', fontSize: 9.5,
          letterSpacing: 1.2, fontWeight: 600,
          border: '1px solid rgba(46,168,255,0.15)',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}>
          DRAG TO ROTATE · SCROLL TO ZOOM · RIGHT-DRAG TO PAN
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{
        fontSize: 8, fontWeight: 700, color: '#3D5A75',
        textTransform: 'uppercase', letterSpacing: 1.2,
      }}>{label}</div>
      <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2, color: color || '#E5F2FF' }}>
        {value}
      </div>
    </div>
  );
}
