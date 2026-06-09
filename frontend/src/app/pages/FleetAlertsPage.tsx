import { SectionPanel } from '../components/dashboard/SectionPanel';
import { StatusPill } from '../components/dashboard/StatusPill';
import { mockFleetAlerts } from '../../data/mockFleetAlerts';
import { AlertTriangle, Radio } from 'lucide-react';

export function FleetAlertsPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground mb-2">Fleet Alerts</h1>
        <p className="text-sm text-foreground-muted">Multi-agent broadcast alerts and warnings</p>
      </div>

      <div className="grid gap-6">
        {mockFleetAlerts.map((alert) => (
          <SectionPanel key={alert.id}>
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {alert.type === 'SUPPLIER_FLAG' ? (
                    <div className="p-2 bg-critical/10 border border-critical/20 rounded-lg">
                      <AlertTriangle className="w-6 h-6 text-critical" />
                    </div>
                  ) : (
                    <div className="p-2 bg-primary/10 border border-primary/20 rounded-lg">
                      <Radio className="w-6 h-6 text-primary" />
                    </div>
                  )}
                  <div>
                    <div className="text-lg font-semibold text-foreground mb-1">
                      {alert.type === 'SUPPLIER_FLAG' ? 'Supplier Flag' : 'Fleet Alert'}
                    </div>
                    <div className="text-sm text-foreground-muted">
                      {new Date(alert.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
                <StatusPill status={alert.type} size="sm" />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-foreground-muted mb-1">SUPPLIER</div>
                    <div className="font-semibold text-foreground">{alert.supplierName}</div>
                    <div className="text-sm text-foreground-muted">Reputation Score: {alert.supplierReputation}</div>
                  </div>

                  <div>
                    <div className="text-xs text-foreground-muted mb-1">TRIGGER SESSION</div>
                    <div className="font-mono text-sm text-foreground">#{alert.triggerSessionId}</div>
                  </div>

                  <div>
                    <div className="text-xs text-foreground-muted mb-1">TRIGGER REASON</div>
                    <div className="text-sm text-foreground">{alert.triggerReason}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-foreground-muted mb-1">PATTERN DETECTED</div>
                    <div className="text-sm text-foreground">{alert.patternDetected}</div>
                  </div>

                  {alert.estimatedTotalLoss > 0 && (
                    <div>
                      <div className="text-xs text-foreground-muted mb-1">ESTIMATED TOTAL LOSS</div>
                      <div className="text-xl font-bold text-critical">
                        ${alert.estimatedTotalLoss.toLocaleString()}
                      </div>
                    </div>
                  )}

                  {alert.affectedSessionIds.length > 0 && (
                    <div>
                      <div className="text-xs text-foreground-muted mb-1">AFFECTED ACTIVE SESSIONS</div>
                      <div className="flex gap-2">
                        {alert.affectedSessionIds.map((id) => (
                          <span key={id} className="px-2 py-1 bg-warning/10 border border-warning/20 rounded text-xs font-mono text-warning">
                            #{id}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-background-secondary border border-border rounded-lg">
                <div className="text-xs text-foreground-muted mb-2">RECOMMENDATION</div>
                <div className="text-sm font-medium text-foreground">{alert.recommendation}</div>
              </div>
            </div>
          </SectionPanel>
        ))}
      </div>
    </div>
  );
}
