import { useEffect, useState } from 'react';
import { SectionPanel } from '../components/dashboard/SectionPanel';
import { StatusPill } from '../components/dashboard/StatusPill';
import { mockAnomalies, anomalyRules } from '../../data/mockAnomalies';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useAnomaliesList } from '../../lib/useAnomaliesList';

export function AnomalyMonitorPage() {
  const live = useAnomaliesList();
  const [anomalies, setAnomalies] = useState<typeof mockAnomalies>(mockAnomalies);

  // Sync live Supabase rows into local state once they load, while keeping
  // the existing Acknowledge/Resolve interactions wired client-side.
  useEffect(() => {
    if (!live.loading && live.anomalies.length > 0) {
      setAnomalies(live.anomalies as unknown as typeof mockAnomalies);
    }
  }, [live.loading, live.anomalies]);

  const handleAcknowledge = (anomalyId: string) => {
    setAnomalies(prev => prev.map(a => a.id === anomalyId ? { ...a, acknowledged: true } : a));
  };

  const handleResolve = (anomalyId: string) => {
    setAnomalies(prev => prev.map(a => a.id === anomalyId ? { ...a, resolved: true } : a));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground mb-2">Anomaly Monitor</h1>
        <p className="text-sm text-foreground-muted">Detection rules and triggered anomalies</p>
      </div>

      {/* Rule Library */}
      <SectionPanel title="Anomaly Detection Rules">
        <div className="grid grid-cols-3 gap-4">
          {anomalyRules.map((rule) => (
            <div key={rule.id} className="p-4 bg-background-secondary border border-border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="font-mono text-sm font-semibold text-primary">{rule.id}</div>
                <StatusPill status={rule.severity} size="sm" />
              </div>
              <div className="text-sm font-medium text-foreground mb-2">{rule.name}</div>
              <div className="text-xs text-foreground-muted mb-3">{rule.triggerCondition}</div>
              <div className="space-y-1">
                <div className="text-xs text-foreground-muted">
                  <span className="font-medium">Frequency:</span> {rule.checkFrequency}
                </div>
                <div className="text-xs text-foreground-muted">
                  <span className="font-medium">Sources:</span> {rule.dataSources.join(', ')}
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionPanel>

      {/* Triggered Anomalies */}
      <SectionPanel title="Triggered Anomalies" noPadding>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border">
              <tr className="text-left text-xs text-foreground-muted uppercase tracking-wide">
                <th className="px-6 py-3">Rule</th>
                <th className="px-6 py-3">Session</th>
                <th className="px-6 py-3">Severity</th>
                <th className="px-6 py-3">Finding</th>
                <th className="px-6 py-3">Source A</th>
                <th className="px-6 py-3">Source B</th>
                <th className="px-6 py-3">Deviation</th>
                <th className="px-6 py-3">Timestamp</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {anomalies.map((anomaly) => (
                <tr key={anomaly.id} className="hover:bg-surface-secondary/50 transition-colors">
                  <td className="px-6 py-3 font-mono text-sm text-primary">{anomaly.ruleId}</td>
                  <td className="px-6 py-3 font-mono text-sm text-foreground">#{anomaly.sessionId}</td>
                  <td className="px-6 py-3">
                    <StatusPill status={anomaly.severity} size="sm" />
                  </td>
                  <td className="px-6 py-3 text-sm text-foreground">{anomaly.finding}</td>
                  <td className="px-6 py-3 text-xs text-foreground-secondary">{anomaly.sourceA || '-'}</td>
                  <td className="px-6 py-3 text-xs text-foreground-secondary">{anomaly.sourceB || '-'}</td>
                  <td className="px-6 py-3 text-xs text-foreground-secondary">{anomaly.deviation || '-'}</td>
                  <td className="px-6 py-3 text-xs text-foreground-muted">
                    {new Date(anomaly.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      {anomaly.acknowledged && <CheckCircle2 className="w-4 h-4 text-success" title="Acknowledged" />}
                      {anomaly.resolved && <CheckCircle2 className="w-4 h-4 text-success" title="Resolved" />}
                      {!anomaly.acknowledged && !anomaly.resolved && <XCircle className="w-4 h-4 text-foreground-muted" />}
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      {!anomaly.acknowledged && (
                        <button onClick={() => handleAcknowledge(anomaly.id)} className="text-xs text-primary hover:text-primary/80 font-medium">Acknowledge</button>
                      )}
                      {anomaly.acknowledged && !anomaly.resolved && (
                        <button onClick={() => handleResolve(anomaly.id)} className="text-xs text-success hover:text-success/80 font-medium">Resolve</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionPanel>
    </div>
  );
}
