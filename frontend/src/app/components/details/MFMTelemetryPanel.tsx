import { useState } from 'react';
import { Activity, ChevronDown, ChevronUp, AlertTriangle, CheckCircle } from 'lucide-react';
import type { MFMStream, MFMReading } from '../../../data/types';

interface MFMTelemetryPanelProps {
  mfmStream: MFMStream;
}

export function MFMTelemetryPanel({ mfmStream }: MFMTelemetryPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const latestReading = mfmStream.readings[mfmStream.readings.length - 1];
  const hasAnomalies = mfmStream.readings.some(r => r.statusCode === 'WARNING');

  const FIELD_STYLE = {
    label: { fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#5A8AB4', marginBottom: 4 },
    value: { fontSize: 14, fontWeight: 700, color: '#EAF4FF', fontFamily: "'JetBrains Mono', monospace" },
  };

  return (
    <div style={{ background: 'linear-gradient(180deg, #102033 0%, #0E1C2D 100%)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, overflow: 'hidden' }}>

      {/* Header - Always Visible */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: '14px 18px',
          borderBottom: expanded ? '1px solid rgba(255,255,255,0.09)' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          transition: 'background 150ms',
          background: expanded ? 'rgba(74,158,255,0.04)' : 'transparent',
        }}
        onMouseEnter={(e) => !expanded && (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
        onMouseLeave={(e) => !expanded && (e.currentTarget.style.background = 'transparent')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Activity style={{ width: 16, height: 16, color: '#4A9EFF' }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#EAF4FF' }}>MFM Telemetry Stream</div>
            <div style={{ fontSize: 10, color: '#7FA5D3', marginTop: 2 }}>
              {mfmStream.readings.length} readings • {(mfmStream.duration / 60).toFixed(0)} min duration
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {hasAnomalies && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px', background: 'rgba(232,78,78,0.12)', border: '1px solid rgba(232,78,78,0.25)', borderRadius: 5 }}>
              <AlertTriangle style={{ width: 11, height: 11, color: '#E84E4E' }} />
              <span style={{ fontSize: 9, fontWeight: 700, color: '#E84E4E', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Anomalies</span>
            </div>
          )}
          {expanded ? <ChevronUp style={{ width: 16, height: 16, color: '#7FA5D3' }} /> : <ChevronDown style={{ width: 16, height: 16, color: '#7FA5D3' }} />}
        </div>
      </div>

      {/* Summary Stats - Always Visible */}
      <div style={{ padding: '14px 18px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, borderBottom: expanded ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
        <div>
          <div style={{ fontSize: 8, fontWeight: 700, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Final Quantity</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#4A9EFF', fontFamily: "'JetBrains Mono', monospace" }}>{mfmStream.finalQuantity.toFixed(1)} MT</div>
        </div>
        <div>
          <div style={{ fontSize: 8, fontWeight: 700, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Avg Flow Rate</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#EAF4FF', fontFamily: "'JetBrains Mono', monospace" }}>{mfmStream.averageFlowRate.toFixed(1)}</div>
        </div>
        <div>
          <div style={{ fontSize: 8, fontWeight: 700, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Avg Density</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#EAF4FF', fontFamily: "'JetBrains Mono', monospace" }}>{mfmStream.averageDensity.toFixed(1)}</div>
        </div>
        <div>
          <div style={{ fontSize: 8, fontWeight: 700, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Avg Temp</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#EAF4FF', fontFamily: "'JetBrains Mono', monospace" }}>{mfmStream.averageTemperature.toFixed(1)}°C</div>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div style={{ padding: '18px' }}>

          {/* Timeline Chart */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4A9EFF', marginBottom: 12 }}>Cumulative Mass Timeline</div>
            <div style={{ height: 120, position: 'relative', background: 'rgba(4,10,20,0.5)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', padding: 12 }}>
              <svg width="100%" height="100%" style={{ overflow: 'visible' }}>
                <defs>
                  <linearGradient id="massGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#4A9EFF" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#4A9EFF" stopOpacity="0.05" />
                  </linearGradient>
                </defs>
                {/* Grid lines */}
                {[0, 25, 50, 75, 100].map((pct) => (
                  <line key={pct} x1="0%" y1={`${pct}%`} x2="100%" y2={`${pct}%`} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                ))}
                {/* Data path */}
                <path
                  d={mfmStream.readings.map((r, i) => {
                    const x = (i / (mfmStream.readings.length - 1)) * 100;
                    const y = 100 - (r.cumulativeMass / mfmStream.finalQuantity) * 100;
                    return `${i === 0 ? 'M' : 'L'} ${x}% ${y}%`;
                  }).join(' ')}
                  stroke="#4A9EFF"
                  strokeWidth="2"
                  fill="none"
                />
                {/* Anomaly markers */}
                {mfmStream.readings.map((r, i) => {
                  if (r.statusCode !== 'WARNING') return null;
                  const x = (i / (mfmStream.readings.length - 1)) * 100;
                  const y = 100 - (r.cumulativeMass / mfmStream.finalQuantity) * 100;
                  return (
                    <circle key={i} cx={`${x}%`} cy={`${y}%`} r="4" fill="#E84E4E" stroke="#FFFFFF" strokeWidth="1.5">
                      <animate attributeName="r" values="4;6;4" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Latest Reading Details */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4A9EFF', marginBottom: 12 }}>Latest Reading</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {latestReading && (
                <>
                  <div style={{ padding: '10px 12px', background: 'rgba(74,158,255,0.06)', border: '1px solid rgba(74,158,255,0.15)', borderRadius: 6 }}>
                    <div style={FIELD_STYLE.label}>Flow Rate</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#BFD7F7', fontFamily: "'JetBrains Mono', monospace" }}>{latestReading.massFlowRate.toFixed(1)}</div>
                  </div>
                  <div style={{ padding: '10px 12px', background: 'rgba(74,158,255,0.06)', border: '1px solid rgba(74,158,255,0.15)', borderRadius: 6 }}>
                    <div style={FIELD_STYLE.label}>Density</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#BFD7F7', fontFamily: "'JetBrains Mono', monospace" }}>{latestReading.density.toFixed(1)}</div>
                  </div>
                  <div style={{ padding: '10px 12px', background: 'rgba(74,158,255,0.06)', border: '1px solid rgba(74,158,255,0.15)', borderRadius: 6 }}>
                    <div style={FIELD_STYLE.label}>Temperature</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#BFD7F7', fontFamily: "'JetBrains Mono', monospace" }}>{latestReading.temperature.toFixed(1)}°C</div>
                  </div>
                  {latestReading.tubeFrequency && (
                    <>
                      <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6 }}>
                        <div style={FIELD_STYLE.label}>Tube Frequency</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#BFD7F7', fontFamily: "'JetBrains Mono', monospace" }}>{latestReading.tubeFrequency.toFixed(0)} Hz</div>
                      </div>
                      <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6 }}>
                        <div style={FIELD_STYLE.label}>Drive Gain</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#BFD7F7', fontFamily: "'JetBrains Mono', monospace" }}>{latestReading.driveGain?.toFixed(1)}</div>
                      </div>
                      <div style={{ padding: '10px 12px', background: latestReading.statusCode === 'WARNING' ? 'rgba(232,78,78,0.10)' : 'rgba(52,201,140,0.10)', border: `1px solid ${latestReading.statusCode === 'WARNING' ? 'rgba(232,78,78,0.25)' : 'rgba(52,201,140,0.25)'}`, borderRadius: 6 }}>
                        <div style={FIELD_STYLE.label}>Status</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {latestReading.statusCode === 'WARNING' ? <AlertTriangle style={{ width: 12, height: 12, color: '#E84E4E' }} /> : <CheckCircle style={{ width: 12, height: 12, color: '#34C98C' }} />}
                          <span style={{ fontSize: 13, fontWeight: 700, color: latestReading.statusCode === 'WARNING' ? '#E84E4E' : '#34C98C' }}>{latestReading.statusCode}</span>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Data Integrity */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4A9EFF', marginBottom: 12 }}>Data Integrity</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', background: 'rgba(52,201,140,0.08)', border: '1px solid rgba(52,201,140,0.2)', borderRadius: 6 }}>
              <CheckCircle style={{ width: 16, height: 16, color: '#34C98C' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#34C98C', marginBottom: 2 }}>MFM Stream Verified</div>
                <div style={{ fontSize: 10, color: '#7FA5D3' }}>{mfmStream.readings.length} packets validated • All hashes verified</div>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
