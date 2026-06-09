import { Building2, Mail, Phone, MapPin, AlertTriangle, TrendingDown, TrendingUp, FileWarning, Calendar, CheckCircle, XCircle } from 'lucide-react';
import type { SupplierReputation } from '../../../data/types';

interface SupplierProfilePanelProps {
  supplier: SupplierReputation;
  onClose: () => void;
}

export function SupplierProfilePanel({ supplier, onClose }: SupplierProfilePanelProps) {
  const FIELD_STYLE = {
    label: { fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#5A8AB4', marginBottom: 4 },
    value: { fontSize: 12, fontWeight: 600, color: '#EAF4FF' },
  };

  const licenceExpired = supplier.licenceExpiry && new Date(supplier.licenceExpiry) < new Date();
  const licenceExpiringSoon = supplier.licenceExpiry && new Date(supplier.licenceExpiry) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const trendColor = supplier.trend === 'IMPROVING' ? '#34C98C' : supplier.trend === 'WORSENING' ? '#E84E4E' : '#7FA5D3';
  const trendIcon = supplier.trend === 'IMPROVING' ? TrendingUp : supplier.trend === 'WORSENING' ? TrendingDown : TrendingUp;
  const TrendIcon = trendIcon;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      bottom: 0,
      width: 480,
      zIndex: 200,
      background: 'linear-gradient(180deg, #08131F 0%, #0A1521 100%)',
      borderLeft: '1px solid rgba(255,255,255,0.12)',
      boxShadow: '-16px 0 48px rgba(0,0,0,0.7)',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.10)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Building2 style={{ width: 18, height: 18, color: '#4A9EFF' }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#EAF4FF' }}>Supplier Profile</div>
              <div style={{ fontSize: 11, color: '#7FA5D3', marginTop: 2 }}>{supplier.name}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#7FA5D3', display: 'flex', fontSize: 20 }}>
            ×
          </button>
        </div>

        {/* Status Badges */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, background: supplier.registrationStatus === 'ACTIVE' ? 'rgba(52,201,140,0.12)' : supplier.registrationStatus === 'SUSPENDED' ? 'rgba(232,78,78,0.12)' : 'rgba(255,184,77,0.12)', border: `1px solid ${supplier.registrationStatus === 'ACTIVE' ? 'rgba(52,201,140,0.3)' : supplier.registrationStatus === 'SUSPENDED' ? 'rgba(232,78,78,0.3)' : 'rgba(255,184,77,0.3)'}` }}>
            {supplier.registrationStatus === 'ACTIVE' ? <CheckCircle style={{ width: 12, height: 12, color: '#34C98C' }} /> : <XCircle style={{ width: 12, height: 12, color: '#E84E4E' }} />}
            <span style={{ fontSize: 10, fontWeight: 700, color: supplier.registrationStatus === 'ACTIVE' ? '#34C98C' : supplier.registrationStatus === 'SUSPENDED' ? '#E84E4E' : '#FFB84D', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {supplier.registrationStatus}
            </span>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, background: `${trendColor}15`, border: `1px solid ${trendColor}30` }}>
            <TrendIcon style={{ width: 12, height: 12, color: trendColor }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: trendColor, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {supplier.trend}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

        {/* Licence Information */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4A9EFF', marginBottom: 14 }}>Licence Information</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={FIELD_STYLE.label}>Licence Number</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#EAF4FF', fontFamily: "'JetBrains Mono', monospace" }}>{supplier.licence}</div>
            </div>
            {supplier.licenceExpiry && (
              <div>
                <div style={FIELD_STYLE.label}>Licence Expiry</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Calendar style={{ width: 14, height: 14, color: licenceExpired ? '#E84E4E' : licenceExpiringSoon ? '#FFB84D' : '#7FA5D3' }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: licenceExpired ? '#E84E4E' : licenceExpiringSoon ? '#FFB84D' : '#EAF4FF' }}>
                    {new Date(supplier.licenceExpiry).toLocaleDateString('en-SG', { dateStyle: 'medium' })}
                  </span>
                  {licenceExpired && <span style={{ fontSize: 9, fontWeight: 700, color: '#E84E4E', background: 'rgba(232,78,78,0.1)', padding: '2px 6px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>EXPIRED</span>}
                  {licenceExpiringSoon && !licenceExpired && <span style={{ fontSize: 9, fontWeight: 700, color: '#FFB84D', background: 'rgba(255,184,77,0.1)', padding: '2px 6px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>EXPIRING SOON</span>}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Contact Details */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4A9EFF', marginBottom: 14 }}>Contact Details</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {supplier.email && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Mail style={{ width: 14, height: 14, color: '#7FA5D3', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 8, fontWeight: 700, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Email</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#BFD7F7' }}>{supplier.email}</div>
                </div>
              </div>
            )}
            {supplier.phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Phone style={{ width: 14, height: 14, color: '#7FA5D3', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 8, fontWeight: 700, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Phone</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#BFD7F7', fontFamily: "'JetBrains Mono', monospace" }}>{supplier.phone}</div>
                </div>
              </div>
            )}
            {supplier.address && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <MapPin style={{ width: 14, height: 14, color: '#7FA5D3', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 8, fontWeight: 700, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Address</div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: '#BFD7F7', lineHeight: 1.6 }}>{supplier.address}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Session Statistics */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4A9EFF', marginBottom: 14 }}>Session Statistics</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ padding: '12px 14px', background: 'rgba(74,158,255,0.06)', border: '1px solid rgba(74,158,255,0.15)', borderRadius: 8 }}>
              <div style={FIELD_STYLE.label}>Total Sessions</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#4A9EFF', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{supplier.totalSessions}</div>
            </div>
            <div style={{ padding: '12px 14px', background: 'rgba(232,78,78,0.06)', border: '1px solid rgba(232,78,78,0.15)', borderRadius: 8 }}>
              <div style={FIELD_STYLE.label}>Flagged Sessions</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#E84E4E', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{supplier.flaggedSessions}</div>
            </div>
            <div style={{ padding: '12px 14px', background: 'rgba(255,184,77,0.06)', border: '1px solid rgba(255,184,77,0.15)', borderRadius: 8 }}>
              <div style={FIELD_STYLE.label}>Critical Incidents</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#FFB84D', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{supplier.criticalIncidents}</div>
            </div>
            <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}>
              <div style={FIELD_STYLE.label}>Avg Deviation</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#BFD7F7', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{supplier.averageDeviation.toFixed(2)}%</div>
            </div>
          </div>
        </div>

        {/* Risk Metrics */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4A9EFF', marginBottom: 14 }}>Risk Metrics</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}>
              <div style={FIELD_STYLE.label}>Historical Risk Score</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: supplier.riskScore >= 70 ? '#E84E4E' : supplier.riskScore >= 40 ? '#FFB84D' : '#34C98C', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{supplier.riskScore}/100</div>
            </div>
            <div style={{ padding: '12px 14px', background: 'rgba(232,78,78,0.06)', border: '1px solid rgba(232,78,78,0.15)', borderRadius: 8 }}>
              <div style={FIELD_STYLE.label}>Letters of Protest</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#E84E4E', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{supplier.lettersOfProtest}</div>
            </div>
          </div>
        </div>

        {/* Incident Flags */}
        {supplier.criticalIncidents > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4A9EFF', marginBottom: 14 }}>Incident Flags</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ padding: '12px 14px', background: 'rgba(232,78,78,0.08)', border: '1px solid rgba(232,78,78,0.2)', borderRadius: 8, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <AlertTriangle style={{ width: 16, height: 16, color: '#E84E4E', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#E84E4E', marginBottom: 4 }}>Critical Incident Pattern Detected</div>
                  <div style={{ fontSize: 11, color: '#BFD7F7', lineHeight: 1.5 }}>
                    {supplier.criticalIncidents} critical incident{supplier.criticalIncidents > 1 ? 's' : ''} recorded across {supplier.flaggedSessions} flagged session{supplier.flaggedSessions > 1 ? 's' : ''}.
                  </div>
                </div>
              </div>
              {supplier.lettersOfProtest > 0 && (
                <div style={{ padding: '12px 14px', background: 'rgba(255,184,77,0.08)', border: '1px solid rgba(255,184,77,0.2)', borderRadius: 8, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <FileWarning style={{ width: 16, height: 16, color: '#FFB84D', flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#FFB84D', marginBottom: 4 }}>Formal Disputes Recorded</div>
                    <div style={{ fontSize: 11, color: '#BFD7F7', lineHeight: 1.5 }}>
                      {supplier.lettersOfProtest} Letter{supplier.lettersOfProtest > 1 ? 's' : ''} of Protest issued by vessel operators.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Internal Notes */}
        {supplier.internalNotes && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4A9EFF', marginBottom: 14 }}>Internal Notes</div>
            <div style={{ padding: '14px 16px', background: supplier.registrationStatus === 'SUSPENDED' ? 'rgba(232,78,78,0.06)' : 'rgba(255,255,255,0.03)', border: supplier.registrationStatus === 'SUSPENDED' ? '1px solid rgba(232,78,78,0.15)' : '1px solid rgba(255,255,255,0.08)', borderRadius: 8, borderLeft: supplier.registrationStatus === 'SUSPENDED' ? '3px solid #E84E4E' : '3px solid rgba(74,158,255,0.4)' }}>
              <div style={{ fontSize: 11, color: '#BFD7F7', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{supplier.internalNotes}</div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
