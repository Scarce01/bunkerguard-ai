import { X, BookOpen, Shield } from 'lucide-react';
import type { AnomalyRule } from '../../../data/types';
import { anomalyRules } from '../../../data/mockAnomalies';

interface RegulatoryReferenceModalProps {
  ruleId: string;
  open: boolean;
  onClose: () => void;
}

export function RegulatoryReferenceModal({ ruleId, open, onClose }: RegulatoryReferenceModalProps) {
  const rule = anomalyRules.find(r => r.id === ruleId);

  if (!rule) return null;

  const severityColor = {
    CRITICAL: '#E84E4E',
    HIGH: '#E0A020',
    MEDIUM: '#4A9EFF',
    LOW: '#34C98C',
  }[rule.severity];

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, zIndex: 299, background: 'rgba(0,0,0,0.5)' }}
        />
      )}

      {/* Modal */}
      {open && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 300,
          width: 600,
          maxHeight: '80vh',
          background: 'linear-gradient(180deg, #0E1C2D 0%, #0A1521 100%)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
          display: 'flex',
          flexDirection: 'column',
        }}>

          {/* Header */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: `${severityColor}15`, border: `1px solid ${severityColor}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Shield style={{ width: 20, height: 20, color: severityColor }} />
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: severityColor, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                    {rule.id} • {rule.severity}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#EAF4FF' }}>{rule.name}</div>
                </div>
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#7FA5D3', display: 'flex' }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

            {/* Trigger Condition */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4A9EFF', marginBottom: 12 }}>Trigger Condition</div>
              <div style={{ padding: '12px 16px', background: 'rgba(74,158,255,0.08)', border: '1px solid rgba(74,158,255,0.2)', borderRadius: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#EAF4FF', marginBottom: 6 }}>{rule.triggerCondition}</div>
                {rule.threshold && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#7FA5D3', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Threshold:</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: severityColor, fontFamily: "'JetBrains Mono', monospace" }}>{rule.threshold}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Detection Parameters */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4A9EFF', marginBottom: 12 }}>Detection Parameters</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Check Frequency</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#EAF4FF' }}>{rule.checkFrequency}</div>
                </div>
                <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Severity Level</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: severityColor }}>{rule.severity}</div>
                </div>
              </div>
            </div>

            {/* Data Sources */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4A9EFF', marginBottom: 12 }}>Data Sources</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {rule.dataSources.map((source, i) => (
                  <div key={i} style={{ padding: '6px 12px', background: 'rgba(74,158,255,0.10)', border: '1px solid rgba(74,158,255,0.25)', borderRadius: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#4A9EFF' }}>{source}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Regulatory References */}
            {rule.regulatorySource && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4A9EFF', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BookOpen style={{ width: 14, height: 14 }} />
                  Regulatory References
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {rule.regulatorySource.mpaReference && (
                    <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderLeft: '3px solid #4A9EFF', borderRadius: 6 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>MPA (Maritime and Port Authority of Singapore)</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#EAF4FF' }}>{rule.regulatorySource.mpaReference}</div>
                    </div>
                  )}
                  {rule.regulatorySource.isoReference && (
                    <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderLeft: '3px solid #E0A020', borderRadius: 6 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>ISO (International Organization for Standardization)</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#EAF4FF' }}>{rule.regulatorySource.isoReference}</div>
                    </div>
                  )}
                  {rule.regulatorySource.solasReference && (
                    <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderLeft: '3px solid #34C98C', borderRadius: 6 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>SOLAS (Safety of Life at Sea)</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#EAF4FF' }}>{rule.regulatorySource.solasReference}</div>
                    </div>
                  )}
                  {rule.regulatorySource.marpolReference && (
                    <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderLeft: '3px solid #3AABFF', borderRadius: 6 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>MARPOL (Marine Pollution)</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#EAF4FF' }}>{rule.regulatorySource.marpolReference}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

        </div>
      )}
    </>
  );
}
