import { AlertTriangle } from 'lucide-react';

interface PortMapViewProps {
  hasAnomaly: boolean;
  flowPulse: number;
  vesselName: string;
  bargeName: string;
  flowRate: number;
  delivered: number;
  target?: number;
  shortage?: number;
  riskScore?: number;
}

export function PortMapView({
  hasAnomaly,
  vesselName,
  bargeName,
  delivered,
  target = 500,
  shortage = 18.8,
}: PortMapViewProps) {
  const pipeColor = hasAnomaly ? 'rgba(228,86,86,0.45)' : 'rgba(61,168,255,0.35)';
  const pipeAnimColor = hasAnomaly ? '#E45656' : '#3DA8FF';

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: 'linear-gradient(160deg, #071523 0%, #091c2e 55%, #0b2038 100%)',
      }}
    >
      {/* Navigation grid */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.045 }}>
        <defs>
          <pattern id="navgrid" width="72" height="72" patternUnits="userSpaceOnUse">
            <path d="M 72 0 L 0 0 0 72" fill="none" stroke="rgba(61,168,255,1)" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#navgrid)"/>
      </svg>

      {/* Bathymetric depth contours */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.04 }}>
        <ellipse cx="50%" cy="52%" rx="46%" ry="30%" fill="none" stroke="rgba(61,168,255,1)" strokeWidth="1"/>
        <ellipse cx="50%" cy="52%" rx="32%" ry="20%" fill="none" stroke="rgba(61,168,255,1)" strokeWidth="1"/>
        <ellipse cx="50%" cy="52%" rx="19%" ry="11%" fill="none" stroke="rgba(61,168,255,1)" strokeWidth="1"/>
      </svg>

      {/* Anchorage boundary — dashed perimeter */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.08 }}>
        <ellipse cx="50%" cy="50%" rx="38%" ry="38%" fill="none" stroke="rgba(61,168,255,1)" strokeWidth="1" strokeDasharray="8 6"/>
      </svg>

      {/* AIS approach tracks */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.1 }}>
        <path d="M 3% 18% Q 14% 36% 18% 50%" fill="none" stroke="#3DA8FF" strokeWidth="1" strokeDasharray="5 5"/>
        <path d="M 97% 16% Q 85% 34% 81% 50%" fill="none" stroke="#7A96B8" strokeWidth="1" strokeDasharray="5 5"/>
        <circle cx="3%" cy="18%" r="2" fill="#3DA8FF" opacity="0.4"/>
        <circle cx="97%" cy="16%" r="2" fill="#7A96B8" opacity="0.4"/>
      </svg>

      {/* Coordinate labels */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {["103°49'E", "103°51'E", "103°53'E"].map((lon, i) => (
          <div key={lon} style={{ position: 'absolute', top: 8, left: `${16 + i * 34}%`, fontSize: 8, fontFamily: 'monospace', color: 'rgba(61,168,255,0.14)' }}>{lon}</div>
        ))}
        {["1°18'N", "1°17'N"].map((lat, i) => (
          <div key={lat} style={{ position: 'absolute', left: 8, top: `${24 + i * 30}%`, fontSize: 8, fontFamily: 'monospace', color: 'rgba(61,168,255,0.14)' }}>{lat}</div>
        ))}
      </div>

      {/* Zone label */}
      <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', zIndex: 10 }}>
        <div style={{ padding: '4px 12px', borderRadius: 5, background: 'rgba(11,31,54,0.92)', border: '1px solid rgba(61,168,255,0.1)' }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(61,168,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Port of Singapore · Anchorage Zone B4</span>
        </div>
      </div>

      {/* ── Main layout: Vessel | Transfer+Anomaly | Barge ── */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '56px 48px 40px' }}>

        {/* ── Receiving Vessel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          {/* AIS position ring */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="96" height="96" style={{ position: 'absolute', pointerEvents: 'none' }}>
              <circle cx="48" cy="48" r="44" fill="none" stroke="rgba(61,168,255,0.1)" strokeWidth="1" strokeDasharray="6 5"/>
            </svg>
            {/* Ship SVG */}
            <svg width="72" height="72" viewBox="0 0 72 72">
              <circle cx="36" cy="36" r="30" fill="rgba(61,168,255,0.05)" stroke="rgba(61,168,255,0.18)" strokeWidth="1"/>
              <path d="M 18 44 L 22 36 L 50 36 L 54 44 L 52 51 L 20 51 Z" fill="rgba(61,168,255,0.32)" stroke="#3DA8FF" strokeWidth="1.5"/>
              <rect x="28" y="30" width="16" height="7" rx="1" fill="rgba(61,168,255,0.22)" stroke="#3DA8FF" strokeWidth="1"/>
              <rect x="32" y="24" width="8" height="7" rx="1" fill="rgba(61,168,255,0.18)" stroke="#3DA8FF" strokeWidth="0.8"/>
              <circle cx="36" cy="43" r="2" fill="#3DA8FF">
                <animate attributeName="opacity" values="1;0.3;1" dur="2.5s" repeatCount="indefinite"/>
              </circle>
            </svg>
          </div>

          {/* Vessel info block */}
          <div style={{ padding: '10px 16px', borderRadius: 8, background: 'rgba(11,31,54,0.92)', border: '1px solid rgba(61,168,255,0.14)', textAlign: 'center', minWidth: 148 }}>
            <div style={{ fontSize: 9, color: 'rgba(61,168,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 4 }}>Receiving Vessel</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9', marginBottom: 2 }}>{vesselName}</div>
            <div style={{ fontSize: 9, color: '#7A96B8', fontFamily: 'monospace', marginBottom: 8 }}>IMO 9876543</div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
              <div style={{ fontSize: 9, color: '#7A96B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>MFM Delivered</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#3DA8FF', lineHeight: 1 }}>
                {delivered.toFixed(1)}<span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(61,168,255,0.55)', marginLeft: 3 }}>MT</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Transfer pipeline + focal card ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, margin: '0 24px' }}>

          {/* Pipeline */}
          <svg style={{ width: '100%' }} height="32" viewBox="0 0 400 32" preserveAspectRatio="none">
            <line x1="0" y1="16" x2="400" y2="16" stroke={pipeColor} strokeWidth="2.5"/>
            <line x1="0" y1="16" x2="400" y2="16" stroke={pipeAnimColor} strokeWidth="1.5" strokeDasharray="10 8" opacity="0.8">
              <animate attributeName="stroke-dashoffset" from="0" to="18" dur="1.6s" repeatCount="indefinite"/>
            </line>
            {[66, 133, 200, 267, 334].map(cx => (
              <circle key={cx} cx={cx} cy="16" r="2" fill={pipeAnimColor} opacity="0.45"/>
            ))}
          </svg>

          {/* ── FOCAL ANOMALY / STATUS CARD ── */}
          {hasAnomaly ? (
            <div style={{
              width: '100%', padding: '20px 24px', borderRadius: 10,
              background: 'rgba(228,86,86,0.07)', border: '1px solid rgba(228,86,86,0.26)',
              animation: 'criticalPulse 4s ease-in-out infinite',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                <AlertTriangle style={{ width: 14, height: 14, color: '#E45656', flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#E45656', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Quantity Mismatch Detected</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr 1px 1fr', alignItems: 'center', gap: 0 }}>
                {[
                  { label: 'MFM Delivered', value: delivered.toFixed(1), unit: 'MT', color: '#CBD5E1' },
                  null,
                  { label: 'BDN Declared', value: target.toFixed(0), unit: 'MT', color: '#CBD5E1' },
                  null,
                  { label: 'Shortage', value: shortage.toFixed(1), unit: 'MT', color: '#E45656' },
                ].map((item, i) =>
                  item === null ? (
                    <div key={i} style={{ width: 1, height: 40, background: 'rgba(228,86,86,0.2)', margin: '0 auto' }} />
                  ) : (
                    <div key={i} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: 'rgba(228,86,86,0.5)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 5 }}>{item.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: item.color, lineHeight: 1 }}>
                        {item.value}
                        <span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(228,86,86,0.45)', marginLeft: 3 }}>{item.unit}</span>
                      </div>
                    </div>
                  )
                )}
              </div>
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(228,86,86,0.14)', fontSize: 10, color: 'rgba(228,86,86,0.55)', textAlign: 'center' }}>
                Rule A02 · MFM vs BDN deviation exceeds 2% threshold
              </div>
            </div>
          ) : (
            <div style={{ width: '100%', padding: '16px 24px', borderRadius: 10, background: 'rgba(30,176,90,0.06)', border: '1px solid rgba(30,176,90,0.18)', textAlign: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#1EB05A', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 14 }}>Transfer Within Tolerance</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr 1px 1fr', alignItems: 'center', gap: 0 }}>
                {[
                  { label: 'MFM Delivered', value: delivered.toFixed(1), unit: 'MT', color: '#3DA8FF' },
                  null,
                  { label: 'BDN Target', value: target.toFixed(0), unit: 'MT', color: '#CBD5E1' },
                  null,
                  { label: 'Variance', value: Math.abs(target - delivered).toFixed(1), unit: 'MT', color: '#CBD5E1' },
                ].map((item, i) =>
                  item === null ? (
                    <div key={i} style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.07)', margin: '0 auto' }} />
                  ) : (
                    <div key={i} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: '#7A96B8', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 4 }}>{item.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: item.color, lineHeight: 1 }}>
                        {item.value}
                        <span style={{ fontSize: 10, fontWeight: 500, color: '#7A96B8', marginLeft: 3 }}>{item.unit}</span>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* Pipeline (bottom half) */}
          <svg style={{ width: '100%' }} height="32" viewBox="0 0 400 32" preserveAspectRatio="none">
            <line x1="0" y1="16" x2="400" y2="16" stroke={pipeColor} strokeWidth="2.5"/>
            <line x1="0" y1="16" x2="400" y2="16" stroke={pipeAnimColor} strokeWidth="1.5" strokeDasharray="10 8" opacity="0.8">
              <animate attributeName="stroke-dashoffset" from="18" to="0" dur="1.6s" repeatCount="indefinite"/>
            </line>
            {[66, 133, 200, 267, 334].map(cx => (
              <circle key={cx} cx={cx} cy="16" r="2" fill={pipeAnimColor} opacity="0.45"/>
            ))}
          </svg>
        </div>

        {/* ── Supply Barge ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          {/* AIS position ring */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="96" height="96" style={{ position: 'absolute', pointerEvents: 'none' }}>
              <circle cx="48" cy="48" r="44" fill="none" stroke="rgba(122,150,184,0.08)" strokeWidth="1" strokeDasharray="6 5"/>
            </svg>
            {/* Barge SVG */}
            <svg width="72" height="72" viewBox="0 0 72 72">
              <circle cx="36" cy="36" r="30" fill="rgba(122,150,184,0.04)" stroke="rgba(122,150,184,0.15)" strokeWidth="1"/>
              <rect x="14" y="40" width="44" height="13" rx="2" fill="rgba(122,150,184,0.22)" stroke="#7A96B8" strokeWidth="1.5"/>
              <ellipse cx="24" cy="38" rx="4.5" ry="6.5" fill="rgba(140,160,185,0.32)" stroke="#7A96B8" strokeWidth="1"/>
              <ellipse cx="36" cy="38" rx="4.5" ry="6.5" fill="rgba(140,160,185,0.32)" stroke="#7A96B8" strokeWidth="1"/>
              <ellipse cx="48" cy="38" rx="4.5" ry="6.5" fill="rgba(140,160,185,0.32)" stroke="#7A96B8" strokeWidth="1"/>
              <line x1="24" y1="35" x2="48" y2="35" stroke="rgba(122,150,184,0.35)" strokeWidth="0.8"/>
            </svg>
          </div>

          {/* Barge info block */}
          <div style={{ padding: '10px 16px', borderRadius: 8, background: 'rgba(11,31,54,0.92)', border: '1px solid rgba(122,150,184,0.12)', textAlign: 'center', minWidth: 148 }}>
            <div style={{ fontSize: 9, color: 'rgba(122,150,184,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 4 }}>Supply Barge</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9', marginBottom: 2 }}>{bargeName}</div>
            <div style={{ fontSize: 9, color: '#7A96B8', fontFamily: 'monospace', marginBottom: 8 }}>IMO 9654321</div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
              <div style={{ fontSize: 9, color: '#7A96B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>BDN Declared</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#CBD5E1', lineHeight: 1 }}>
                {target.toFixed(0)}<span style={{ fontSize: 10, fontWeight: 500, color: '#7A96B8', marginLeft: 3 }}>MT</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transfer active — bottom right */}
      <div style={{ position: 'absolute', bottom: 14, right: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 5, background: 'rgba(11,31,54,0.88)', border: '1px solid rgba(30,176,90,0.14)' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#1EB05A', display: 'inline-block', animation: 'livePulse 2.5s ease-in-out infinite' }} />
          <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(30,176,90,0.65)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Transfer Active</span>
        </div>
      </div>
    </div>
  );
}
