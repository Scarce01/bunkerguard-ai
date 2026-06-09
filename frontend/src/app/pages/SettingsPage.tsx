import { useState } from 'react';
import { Settings, Shield, Bell, Database, AlertTriangle, ShieldCheck, Scale, Lock } from 'lucide-react';

const CARD: React.CSSProperties = {
  background: 'linear-gradient(158deg, rgba(11,33,61,0.98) 0%, rgba(13,38,68,0.97) 60%, rgba(15,43,76,0.98) 100%)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 16,
  boxShadow: '0 10px 36px rgba(0,0,0,0.6), 0 3px 10px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07)',
};

const LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  color: '#5A8AB4',
  marginBottom: 8,
};

export function SettingsPage() {
  const [mfmThreshold, setMfmThreshold] = useState(2.0);
  const [riskSensitivity, setRiskSensitivity] = useState('balanced');
  const [alertTrigger, setAlertTrigger] = useState(70);
  const [geofenceTolerance, setGeofenceTolerance] = useState(500);
  const [investigationMode, setInvestigationMode] = useState('balanced');
  const [evidenceRetention, setEvidenceRetention] = useState('90');

  return (
    <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
      <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* Header */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(46,168,255,0.12)', border: '1px solid rgba(46,168,255,0.25)', boxShadow: '0 0 12px rgba(46,168,255,0.15)' }}>
              <Settings style={{ width: 18, height: 18, color: '#2EA8FF' }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.16em', fontWeight: 700 }}>
                System Configuration
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: '#EAF4FF', lineHeight: 1, letterSpacing: '-0.02em', margin: 0 }}>
                Maritime Monitoring Settings
              </h1>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 1400 }}>

          {/* ══ MONITORING THRESHOLDS ════════════════════════════════════ */}
          <div style={{ ...CARD, padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,184,77,0.12)', border: '1px solid rgba(255,184,77,0.25)' }}>
                <AlertTriangle style={{ width: 16, height: 16, color: '#FFB84D' }} />
              </div>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: '#EAF4FF', marginBottom: 2 }}>Monitoring Thresholds</h2>
                <p style={{ fontSize: 11, color: '#7FA5D3' }}>Configure fraud detection sensitivity</p>
              </div>
            </div>

            {/* MFM Deviation Threshold */}
            <div>
              <div style={LABEL}>MFM Deviation Threshold (%)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <input
                  type="range"
                  min="0.5"
                  max="5.0"
                  step="0.1"
                  value={mfmThreshold}
                  onChange={(e) => setMfmThreshold(parseFloat(e.target.value))}
                  style={{ flex: 1, height: 6, borderRadius: 3, background: 'linear-gradient(90deg, rgba(46,168,255,0.2), rgba(46,168,255,0.08))', outline: 'none', cursor: 'pointer' }}
                />
                <div style={{ width: 56, padding: '6px 12px', borderRadius: 7, background: 'rgba(46,168,255,0.12)', border: '1px solid rgba(46,168,255,0.25)', textAlign: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#2EA8FF', fontFamily: "'JetBrains Mono', monospace" }}>{mfmThreshold.toFixed(1)}%</span>
                </div>
              </div>
              <p style={{ fontSize: 10, color: '#7FA5D3', marginTop: 8 }}>
                Trigger anomaly when mass flow meter deviation exceeds this threshold
              </p>
            </div>

            {/* Risk Escalation Sensitivity */}
            <div>
              <div style={LABEL}>Risk Escalation Sensitivity</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {['low', 'balanced', 'high'].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setRiskSensitivity(mode)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: riskSensitivity === mode ? 'rgba(46,168,255,0.15)' : 'rgba(5,11,20,0.7)',
                      border: riskSensitivity === mode ? '1px solid rgba(46,168,255,0.35)' : '1px solid rgba(255,255,255,0.08)',
                      color: riskSensitivity === mode ? '#2EA8FF' : '#8BB4D6',
                      transition: 'all 200ms',
                      textTransform: 'capitalize',
                    }}
                    onMouseEnter={(e) => {
                      if (riskSensitivity !== mode) {
                        e.currentTarget.style.background = 'rgba(46,168,255,0.08)';
                        e.currentTarget.style.borderColor = 'rgba(46,168,255,0.20)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (riskSensitivity !== mode) {
                        e.currentTarget.style.background = 'rgba(5,11,20,0.7)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                      }
                    }}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 10, color: '#7FA5D3', marginTop: 8 }}>
                {riskSensitivity === 'low' && 'Fewer alerts, focus on critical signals only'}
                {riskSensitivity === 'balanced' && 'Recommended for most operations'}
                {riskSensitivity === 'high' && 'Maximum vigilance, flag all suspicious patterns'}
              </p>
            </div>

            {/* Alert Trigger Score */}
            <div>
              <div style={LABEL}>Alert Trigger Score (0-100)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <input
                  type="range"
                  min="50"
                  max="90"
                  step="5"
                  value={alertTrigger}
                  onChange={(e) => setAlertTrigger(parseInt(e.target.value))}
                  style={{ flex: 1, height: 6, borderRadius: 3, background: 'linear-gradient(90deg, rgba(255,90,90,0.2), rgba(255,90,90,0.08))', outline: 'none', cursor: 'pointer' }}
                />
                <div style={{ width: 56, padding: '6px 12px', borderRadius: 7, background: 'rgba(255,90,90,0.12)', border: '1px solid rgba(255,90,90,0.25)', textAlign: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#FF5A5A', fontFamily: "'JetBrains Mono', monospace" }}>{alertTrigger}</span>
                </div>
              </div>
              <p style={{ fontSize: 10, color: '#7FA5D3', marginTop: 8 }}>
                Minimum risk score to trigger critical alert notification
              </p>
            </div>

            {/* AIS Geofence Tolerance */}
            <div>
              <div style={LABEL}>AIS Geofence Tolerance (meters)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <input
                  type="range"
                  min="100"
                  max="2000"
                  step="100"
                  value={geofenceTolerance}
                  onChange={(e) => setGeofenceTolerance(parseInt(e.target.value))}
                  style={{ flex: 1, height: 6, borderRadius: 3, background: 'linear-gradient(90deg, rgba(0,212,126,0.2), rgba(0,212,126,0.08))', outline: 'none', cursor: 'pointer' }}
                />
                <div style={{ width: 72, padding: '6px 12px', borderRadius: 7, background: 'rgba(0,212,126,0.12)', border: '1px solid rgba(0,212,126,0.25)', textAlign: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#00D47E', fontFamily: "'JetBrains Mono', monospace" }}>{geofenceTolerance}m</span>
                </div>
              </div>
              <p style={{ fontSize: 10, color: '#7FA5D3', marginTop: 8 }}>
                Maximum distance from authorized zone before flagging position anomaly
              </p>
            </div>
          </div>

          {/* ══ INVESTIGATION MODE ═══════════════════════════════════════ */}
          <div style={{ ...CARD, padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(46,168,255,0.12)', border: '1px solid rgba(46,168,255,0.25)' }}>
                <Shield style={{ width: 16, height: 16, color: '#2EA8FF' }} />
              </div>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: '#EAF4FF', marginBottom: 2 }}>Investigation Mode</h2>
                <p style={{ fontSize: 11, color: '#7FA5D3' }}>AI verification protocol</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                {
                  mode: 'conservative',
                  label: 'Conservative',
                  desc: 'Fewer AI recommendations, prioritize human review',
                  Icon: ShieldCheck,
                },
                {
                  mode: 'balanced',
                  label: 'Balanced',
                  desc: 'AI-assisted decisions with officer oversight (Recommended)',
                  Icon: Scale,
                },
                {
                  mode: 'strict',
                  label: 'Strict',
                  desc: 'Maximum AI autonomy, immediate escalation on signals',
                  Icon: Lock,
                },
              ].map((option) => {
                const OptionIcon = option.Icon;
                return (
                  <button
                    key={option.mode}
                    onClick={() => setInvestigationMode(option.mode)}
                    style={{
                      padding: '14px 18px',
                      borderRadius: 10,
                      cursor: 'pointer',
                      background: investigationMode === option.mode ? 'rgba(46,168,255,0.15)' : 'rgba(5,11,20,0.7)',
                      border: investigationMode === option.mode ? '1px solid rgba(46,168,255,0.35)' : '1px solid rgba(255,255,255,0.08)',
                      transition: 'all 200ms',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => {
                      if (investigationMode !== option.mode) {
                        e.currentTarget.style.background = 'rgba(46,168,255,0.08)';
                        e.currentTarget.style.borderColor = 'rgba(46,168,255,0.20)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (investigationMode !== option.mode) {
                        e.currentTarget.style.background = 'rgba(5,11,20,0.7)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: investigationMode === option.mode ? 'rgba(46,168,255,0.15)' : 'rgba(46,168,255,0.08)', border: `1px solid ${investigationMode === option.mode ? 'rgba(46,168,255,0.30)' : 'rgba(46,168,255,0.15)'}` }}>
                        <OptionIcon style={{ width: 18, height: 18, color: '#2EA8FF' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: investigationMode === option.mode ? '#2EA8FF' : '#BFD7F7', marginBottom: 4 }}>
                          {option.label}
                        </div>
                        <div style={{ fontSize: 11, color: '#8BB4D6' }}>{option.desc}</div>
                      </div>
                      {investigationMode === option.mode && (
                        <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(46,168,255,0.25)', border: '2px solid #2EA8FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2EA8FF' }} />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ══ EVIDENCE RETENTION ═══════════════════════════════════════ */}
          <div style={{ ...CARD, padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,212,126,0.12)', border: '1px solid rgba(0,212,126,0.25)' }}>
                <Database style={{ width: 16, height: 16, color: '#00D47E' }} />
              </div>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: '#EAF4FF', marginBottom: 2 }}>Evidence Retention</h2>
                <p style={{ fontSize: 11, color: '#7FA5D3' }}>Compliance data storage policy</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { value: '30', label: '30 Days', desc: 'Minimum regulatory compliance', storage: '~2.4 GB' },
                { value: '90', label: '90 Days', desc: 'Recommended for dispute resolution', storage: '~7.2 GB' },
                { value: '365', label: '1 Year', desc: 'Full audit trail for legal proceedings', storage: '~28.8 GB' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setEvidenceRetention(option.value)}
                  style={{
                    padding: '14px 18px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    background: evidenceRetention === option.value ? 'rgba(0,212,126,0.11)' : 'rgba(5,11,20,0.7)',
                    border: evidenceRetention === option.value ? '1px solid rgba(0,212,126,0.28)' : '1px solid rgba(255,255,255,0.08)',
                    transition: 'all 200ms',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    if (evidenceRetention !== option.value) {
                      e.currentTarget.style.background = 'rgba(0,212,126,0.06)';
                      e.currentTarget.style.borderColor = 'rgba(0,212,126,0.15)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (evidenceRetention !== option.value) {
                      e.currentTarget.style.background = 'rgba(5,11,20,0.7)';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: evidenceRetention === option.value ? '#00D47E' : '#BFD7F7', marginBottom: 4 }}>
                        {option.label}
                      </div>
                      <div style={{ fontSize: 11, color: '#8BB4D6' }}>{option.desc}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#7FA5D3', fontFamily: "'JetBrains Mono', monospace" }}>{option.storage}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div style={{ padding: '12px 16px', borderRadius: 9, background: 'rgba(46,168,255,0.07)', border: '1px solid rgba(46,168,255,0.15)' }}>
              <p style={{ fontSize: 11, color: '#8BB4D6', lineHeight: 1.5 }}>
                Evidence includes MFM logs, AIS data, blockchain hashes, and AI analysis metadata
              </p>
            </div>
          </div>

          {/* ══ NOTIFICATION PREFERENCES ═════════════════════════════════ */}
          <div style={{ ...CARD, padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,90,90,0.12)', border: '1px solid rgba(255,90,90,0.25)' }}>
                <Bell style={{ width: 16, height: 16, color: '#FF5A5A' }} />
              </div>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: '#EAF4FF', marginBottom: 2 }}>Notification Preferences</h2>
                <p style={{ fontSize: 11, color: '#7FA5D3' }}>Alert delivery channels</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { id: 'highRisk', label: 'High-Risk Alerts', desc: 'Critical fraud signals and anomalies', checked: true },
                { id: 'fleetAnomalies', label: 'Fleet Anomalies', desc: 'Multi-vessel pattern detection', checked: true },
                { id: 'supplierEscalation', label: 'Supplier Escalation', desc: 'Reputation threshold breaches', checked: true },
                { id: 'mfmDrift', label: 'MFM Drift Warnings', desc: 'Meter calibration issues', checked: false },
                { id: 'blockchain', label: 'Blockchain Confirmations', desc: 'Evidence commit notifications', checked: false },
              ].map((item) => (
                <label
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '12px 16px',
                    borderRadius: 9,
                    background: 'rgba(5,11,20,0.7)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    cursor: 'pointer',
                    transition: 'all 200ms',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(46,168,255,0.05)';
                    e.currentTarget.style.borderColor = 'rgba(46,168,255,0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(5,11,20,0.7)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                  }}
                >
                  <input
                    type="checkbox"
                    defaultChecked={item.checked}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      cursor: 'pointer',
                      accentColor: '#2EA8FF',
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#BFD7F7', marginBottom: 3 }}>{item.label}</div>
                    <div style={{ fontSize: 10, color: '#8BB4D6' }}>{item.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

        </div>

        {/* Save Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 12 }}>
          <button
            style={{
              padding: '12px 22px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              background: 'rgba(5,11,20,0.8)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#8BB4D6',
              transition: 'all 200ms',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(5,11,20,0.95)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(5,11,20,0.8)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
            }}
          >
            Reset to Defaults
          </button>
          <button
            style={{
              padding: '12px 28px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              background: 'linear-gradient(135deg, rgba(46,168,255,0.22) 0%, rgba(46,168,255,0.15) 100%)',
              border: '1px solid rgba(46,168,255,0.4)',
              color: '#2EA8FF',
              transition: 'all 200ms',
              boxShadow: '0 0 16px rgba(46,168,255,0.15)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(46,168,255,0.28) 0%, rgba(46,168,255,0.20) 100%)';
              e.currentTarget.style.borderColor = 'rgba(46,168,255,0.5)';
              e.currentTarget.style.boxShadow = '0 0 24px rgba(46,168,255,0.25)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(46,168,255,0.22) 0%, rgba(46,168,255,0.15) 100%)';
              e.currentTarget.style.borderColor = 'rgba(46,168,255,0.4)';
              e.currentTarget.style.boxShadow = '0 0 16px rgba(46,168,255,0.15)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Save Configuration
          </button>
        </div>

      </div>
    </div>
  );
}
