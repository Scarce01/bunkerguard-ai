import { SectionPanel } from '../components/dashboard/SectionPanel';
import { mockBlockchainRecords as fallbackRecords } from '../../data/mockBlockchain';
import { Shield, Copy, ExternalLink } from 'lucide-react';
import { useBlockchainRecords } from '../../lib/useBlockchainRecords';

export function BlockchainPage() {
  const live = useBlockchainRecords();
  const mockBlockchainRecords = live.loading || live.records.length === 0
    ? fallbackRecords
    : (live.records as unknown as typeof fallbackRecords);
  return (
    <div className="p-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground mb-2">Blockchain Records</h1>
        <p className="text-sm text-foreground-muted">Immutable bunker delivery verification</p>
      </div>

      <SectionPanel title="Signed Bundles" noPadding>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border">
              <tr className="text-left text-xs text-foreground-muted uppercase tracking-wide">
                <th className="px-6 py-3">Session</th>
                <th className="px-6 py-3">BDN Hash</th>
                <th className="px-6 py-3">MFM Hash</th>
                <th className="px-6 py-3">Validation Hash</th>
                <th className="px-6 py-3">Transaction Hash</th>
                <th className="px-6 py-3">Block</th>
                <th className="px-6 py-3">Timestamp</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {mockBlockchainRecords.map((record) => (
                <tr key={record.sessionId} className="hover:bg-surface-secondary/50 transition-colors">
                  <td className="px-6 py-3 font-mono text-sm text-foreground">#{record.sessionId}</td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-foreground-secondary">
                        {record.bdnHash.substring(0, 10)}...
                      </span>
                      <button className="p-1 hover:bg-surface-secondary rounded">
                        <Copy className="w-3 h-3 text-foreground-muted" />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-foreground-secondary">
                        {record.mfmHash.substring(0, 10)}...
                      </span>
                      <button className="p-1 hover:bg-surface-secondary rounded">
                        <Copy className="w-3 h-3 text-foreground-muted" />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-foreground-secondary">
                        {record.validationHash.substring(0, 10)}...
                      </span>
                      <button className="p-1 hover:bg-surface-secondary rounded">
                        <Copy className="w-3 h-3 text-foreground-muted" />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-foreground-secondary">
                        {record.transactionHash.substring(0, 10)}...
                      </span>
                      <button className="p-1 hover:bg-surface-secondary rounded">
                        <Copy className="w-3 h-3 text-foreground-muted" />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-3 font-mono text-sm text-foreground-secondary">
                    #{record.blockNumber}
                  </td>
                  <td className="px-6 py-3 text-xs text-foreground-muted">
                    {new Date(record.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-3">
                    <button className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 font-medium">
                      <ExternalLink className="w-3 h-3" />
                      Explorer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionPanel>

      {/* Detail View */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <SectionPanel title="Bundle Detail - Session #16">
            <div className="space-y-4">
              {[
                { label: 'BDN Hash', value: mockBlockchainRecords[0].bdnHash },
                { label: 'MFM Hash', value: mockBlockchainRecords[0].mfmHash },
                { label: 'Validation Hash', value: mockBlockchainRecords[0].validationHash },
                { label: 'Transaction Hash', value: mockBlockchainRecords[0].transactionHash },
              ].map((item) => (
                <div key={item.label} className="p-4 bg-background-secondary border border-border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-foreground-muted">{item.label}</div>
                    <button className="flex items-center gap-1 text-xs text-primary hover:text-primary/80">
                      <Copy className="w-3 h-3" />
                      Copy
                    </button>
                  </div>
                  <div className="font-mono text-xs text-foreground-secondary break-all">
                    {item.value}
                  </div>
                </div>
              ))}

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-background-secondary border border-border rounded-lg">
                  <div className="text-xs text-foreground-muted mb-2">Block Number</div>
                  <div className="font-mono text-lg font-semibold text-foreground">
                    #{mockBlockchainRecords[0].blockNumber}
                  </div>
                </div>
                <div className="p-4 bg-background-secondary border border-border rounded-lg">
                  <div className="text-xs text-foreground-muted mb-2">Timestamp</div>
                  <div className="text-sm font-semibold text-foreground">
                    {new Date(mockBlockchainRecords[0].timestamp).toLocaleString()}
                  </div>
                </div>
              </div>

              <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                <ExternalLink className="w-4 h-4" />
                View on Block Explorer
              </button>
            </div>
          </SectionPanel>
        </div>

        <div>
          <SectionPanel title="QR Code">
            <div className="space-y-4">
              <div className="aspect-square bg-background-secondary border-2 border-border rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <Shield className="w-16 h-16 text-primary mx-auto mb-2" />
                  <div className="text-xs text-foreground-muted">QR Code</div>
                </div>
              </div>
              <div className="p-3 bg-success/10 border border-success/20 rounded-lg text-center">
                <div className="text-xs font-medium text-success">Verified on Blockchain</div>
              </div>
            </div>
          </SectionPanel>
        </div>
      </div>
    </div>
  );
}
