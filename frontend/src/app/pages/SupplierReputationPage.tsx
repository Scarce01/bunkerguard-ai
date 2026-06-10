import { SectionPanel } from '../components/dashboard/SectionPanel';
import { StatusPill } from '../components/dashboard/StatusPill';
import { mockSupplierReputation } from '../../data/mockSupplierReputation';
import { TrendingDown, TrendingUp, AlertTriangle, ArrowRight, ArrowLeft, Shield } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useSupplierReputation } from '../../lib/useSupplierReputation';
import { useSuppliersList } from '../../lib/useSuppliersList';
import { useParams, useNavigate } from 'react-router';
import { SupplierLogo } from '../components/suppliers/SupplierLogo';

/** /suppliers (no id) → grid view of all suppliers
 *  /suppliers/:id    → individual supplier dossier (existing detail UI) */
export function SupplierReputationPage() {
  const { supplierId } = useParams<{ supplierId?: string }>();
  if (!supplierId) return <SuppliersIndex />;
  return <SupplierDetail supplierId={supplierId} />;
}

function SuppliersIndex() {
  const navigate = useNavigate();
  const { suppliers, loading } = useSuppliersList();

  const flagColor = (score: number | null, flag: string | null) => {
    if (flag === 'NOT_REGISTERED') return { bg: 'rgba(255,86,86,0.10)', border: '#FF5656', text: '#FF5656' };
    if (score == null) return { bg: 'rgba(127,165,211,0.10)', border: '#7FA5D3', text: '#7FA5D3' };
    if (score < 50)  return { bg: 'rgba(255,86,86,0.10)', border: '#FF5656', text: '#FF5656' };
    if (score < 70)  return { bg: 'rgba(255,169,64,0.10)', border: '#FFA940', text: '#FFA940' };
    return { bg: 'rgba(0,217,142,0.10)', border: '#00D98E', text: '#00D98E' };
  };

  return (
    <div className="p-6 space-y-4 overflow-y-auto h-full">
      <div className="mb-2">
        <h1 className="text-2xl font-semibold text-foreground mb-1">Suppliers</h1>
        <p className="text-sm text-foreground-muted">
          {loading ? 'Loading suppliers…' : `${suppliers.length} licensed bunker suppliers · sorted by reputation`}
        </p>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {suppliers.map((s) => {
          const col = flagColor(s.reputationScore, s.flag);
          const flagged = s.totalSessions > 0 ? Math.round((s.mismatchCount / s.totalSessions) * 100) : 0;
          return (
            <button
              key={s.id}
              onClick={() => navigate(`/suppliers/${s.id}`)}
              style={{
                textAlign: 'left',
                background: 'linear-gradient(180deg, #102033 0%, #0E1C2D 100%)',
                border: `1px solid ${col.border}55`,
                borderLeft: `4px solid ${col.border}`,
                borderRadius: 8,
                padding: '16px 18px',
                cursor: 'pointer',
                color: '#EAF4FF',
                transition: 'transform 120ms ease, border-color 120ms ease',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; }}
            >
              <div className="flex items-center justify-between mb-2">
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: 1.4,
                  color: col.text,
                  textTransform: 'uppercase',
                }}>
                  {s.flag ?? 'UNKNOWN'}
                </span>
                <span style={{ fontSize: 9, color: '#7FA5D3', fontFamily: "'JetBrains Mono', monospace" }}>{s.id}</span>
              </div>
              {/* Logo + supplier name row — brand mark loads from
               *  /suppliers/<key>.png with a text-initials fallback when
               *  the PNG isn't present, so missing files never break the
               *  card. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
                <SupplierLogo id={s.id} name={s.name} size={128} borderColor={`${col.border}55`} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF', marginBottom: 4, lineHeight: 1.25 }}>
                    {s.name}
                  </div>
                  <div style={{ fontSize: 10, color: '#7FA5D3', fontFamily: "'JetBrains Mono', monospace" }}>
                    {s.mpaLicence ?? '—'}
                  </div>
                </div>
              </div>

              <div className="flex items-end justify-between">
                <div>
                  <div style={{ fontSize: 9, color: '#7FA5D3', letterSpacing: 1, fontWeight: 700 }}>REPUTATION</div>
                  <div style={{
                    fontSize: 32, fontWeight: 700, lineHeight: 1,
                    color: col.text, fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    {s.reputationScore ?? '—'}
                    <span style={{ fontSize: 12, color: '#7FA5D3', marginLeft: 4 }}>/100</span>
                  </div>
                </div>
                <div className="text-right">
                  <div style={{ fontSize: 10, color: '#7FA5D3' }}>
                    {s.mismatchCount}/{s.totalSessions} flagged
                  </div>
                  <div style={{ fontSize: 9, color: '#7FA5D3', fontFamily: "'JetBrains Mono', monospace" }}>
                    {flagged}% flag rate
                  </div>
                  {s.lopCount > 0 && (
                    <div style={{ fontSize: 9, color: '#FFA940', fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
                      {s.lopCount} LoP{s.lopCount > 1 ? 's' : ''} issued
                    </div>
                  )}
                </div>
              </div>

              <div style={{
                marginTop: 12, paddingTop: 10,
                borderTop: '1px solid rgba(127,165,211,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                fontSize: 10, color: '#7FA5D3',
              }}>
                <span>
                  {s.criticalCount > 0
                    ? <><Shield size={10} style={{ display: 'inline', marginRight: 4, color: '#FF5656' }} /> {s.criticalCount} critical</>
                    : 'No critical incidents'}
                </span>
                <span className="flex items-center gap-1" style={{ color: col.text, fontWeight: 700 }}>
                  View dossier <ArrowRight size={11} />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SupplierDetail({ supplierId }: { supplierId: string }) {
  const navigate = useNavigate();
  const live = useSupplierReputation(supplierId);
  const supplier = (live.loading || !live.supplier
    ? mockSupplierReputation
    : (live.supplier as unknown as typeof mockSupplierReputation));

  return (
    <div className="p-6 space-y-6">
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate('/suppliers')}
          className="p-2 rounded hover:bg-surface-secondary transition-colors"
          title="Back to all suppliers"
          style={{ color: '#7FA5D3' }}
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground mb-1">Supplier Reputation</h1>
          <p className="text-sm text-foreground-muted">
            Dossier · <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{supplierId}</span>
          </p>
        </div>
      </div>

      {/* Supplier Profile */}
      <div className="grid grid-cols-3 gap-6">
        <SectionPanel title="Supplier Profile">
          <div className="space-y-4">
            {/* Brand mark — large, prominent at the top of the dossier
                so the operator can confirm at a glance which supplier
                they're looking at. Same fallback rules as the index
                cards (initials chip if PNG is missing). */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <SupplierLogo id={supplierId} name={supplier.supplierName} size={168} />
              <div style={{ minWidth: 0 }}>
                <div className="text-xs text-foreground-muted mb-1">Supplier Name</div>
                <div className="font-semibold text-foreground" style={{ lineHeight: 1.25 }}>
                  {supplier.supplierName}
                </div>
              </div>
            </div>
            <div>
              <div className="text-xs text-foreground-muted mb-1">Licence</div>
              <div className="font-mono text-sm text-foreground-secondary">{supplier.licence}</div>
            </div>
            <div>
              <div className="text-xs text-foreground-muted mb-1">Status</div>
              <StatusPill status={supplier.status} size="sm" />
            </div>
          </div>
        </SectionPanel>

        <SectionPanel title="Reputation Score">
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-5xl font-bold text-critical mb-1">{supplier.reputationScore}</div>
              <div className="text-sm text-foreground-muted">/ 100</div>
            </div>

            <div className="flex items-center justify-between p-3 bg-critical/10 border border-critical/20 rounded-lg">
              <div className="text-sm text-foreground-muted">Change</div>
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-critical" />
                <span className="font-semibold text-critical">{supplier.scoreChange}</span>
              </div>
            </div>

            <div className="text-xs text-foreground-muted">
              <div className="flex justify-between mb-1">
                <span>Previous Score</span>
                <span className="font-semibold text-foreground">{supplier.previousScore}</span>
              </div>
            </div>
          </div>
        </SectionPanel>

        <SectionPanel title="Pattern Detection">
          <div className="space-y-4">
            <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                <span className="text-sm font-semibold text-warning">Pattern Detected</span>
              </div>
              <div className="text-xs text-foreground-muted space-y-1">
                <div>3 of last 6 sessions flagged</div>
                <div>Average discrepancy: 1.5%</div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-foreground-muted">Estimated Fleet Loss</span>
                <span className="font-bold text-critical">USD 23,166</span>
              </div>

              {/* Mini sparkline */}
              <div>
                <div className="text-xs text-foreground-muted mb-2 flex items-center justify-between">
                  <span>6-Session Trend</span>
                  <div className="flex items-center gap-1">
                    <TrendingDown className="w-3 h-3 text-critical" />
                    <span className="font-semibold text-critical">Worsening</span>
                  </div>
                </div>
                <div className="flex items-end gap-1 h-12">
                  {[38, 42, 45, 41, 52, 58].map((val, i) => (
                    <div key={i} className="flex-1 bg-critical/30 rounded-t" style={{ height: `${(val / 60) * 100}%` }} />
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-border">
              <div className="text-xs font-semibold text-warning mb-1">Recommendation:</div>
              <div className="text-xs text-foreground-muted">Independent surveyor required</div>
            </div>
          </div>
        </SectionPanel>

        <SectionPanel title="Score Factors">
          <div className="space-y-3">
            {[
              { label: 'Avg Discrepancy', value: `${supplier.averageDiscrepancyPercent.toFixed(2)}%`, weight: '30%' },
              { label: 'Dispute Rate', value: `${(supplier.disputeRate * 100).toFixed(0)}%`, weight: '25%' },
              { label: 'Critical Anomalies', value: `${(supplier.criticalAnomalyFrequency * 100).toFixed(0)}%`, weight: '20%' },
              { label: 'Doc Compliance', value: `${(supplier.documentComplianceRate * 100).toFixed(0)}%`, weight: '15%' },
              { label: 'Trend Direction', value: supplier.trendDirection, weight: '10%' },
            ].map((factor) => (
              <div key={factor.label} className="flex items-center justify-between text-sm">
                <div className="text-foreground-muted">
                  {factor.label} <span className="text-xs">({factor.weight})</span>
                </div>
                <div className="font-semibold text-foreground">{factor.value}</div>
              </div>
            ))}
          </div>
        </SectionPanel>
      </div>

      {/* Reputation Trend */}
      <SectionPanel title="Reputation Trend (Last 6 Weeks)">
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={supplier.reputationHistory}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(56, 189, 248, 0.1)" />
            <XAxis dataKey="date" stroke="#94A3B8" style={{ fontSize: '12px' }} />
            <YAxis stroke="#94A3B8" style={{ fontSize: '12px' }} domain={[0, 100]} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#111C31',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                borderRadius: '8px',
              }}
              labelStyle={{ color: '#F8FAFC' }}
            />
            <Line type="monotone" dataKey="score" stroke="#EF4444" strokeWidth={2} name="Reputation Score" />
          </LineChart>
        </ResponsiveContainer>
      </SectionPanel>

      {/* Pattern Alert */}
      <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-warning mt-0.5" />
        <div>
          <div className="font-semibold text-warning mb-1">Pattern Detected</div>
          <div className="text-sm text-warning/90">3 of 6 sessions in 5 days show &gt;1% short delivery.</div>
        </div>
      </div>

      {/* Historical Transactions */}
      <SectionPanel title="Historical Transactions" noPadding>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border">
              <tr className="text-left text-xs text-foreground-muted uppercase tracking-wide">
                <th className="px-6 py-3">Session</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Vessel</th>
                <th className="px-6 py-3 text-right">BDN Qty</th>
                <th className="px-6 py-3 text-right">MFM Qty</th>
                <th className="px-6 py-3 text-right">Discrepancy MT</th>
                <th className="px-6 py-3 text-right">Discrepancy %</th>
                <th className="px-6 py-3 text-center">Risk Score</th>
                <th className="px-6 py-3">Verdict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {supplier.historicalTransactions.map((session) => (
                <tr key={session.id} className="hover:bg-surface-secondary/50 transition-colors">
                  <td className="px-6 py-3 font-mono text-sm text-foreground">#{session.sessionNumber}</td>
                  <td className="px-6 py-3 text-xs text-foreground-muted">
                    {new Date(session.startTime).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-3 text-sm text-foreground">{session.vesselName}</td>
                  <td className="px-6 py-3 text-right text-sm font-semibold text-foreground">
                    {session.bdnQuantity.toFixed(1)} MT
                  </td>
                  <td className="px-6 py-3 text-right text-sm font-semibold text-foreground">
                    {session.mfmQuantity.toFixed(1)} MT
                  </td>
                  <td className="px-6 py-3 text-right text-sm font-semibold text-critical">
                    {session.mismatchMT.toFixed(1)} MT
                  </td>
                  <td className="px-6 py-3 text-right">
                    <span
                      className={`text-sm font-semibold ${
                        session.mismatchPercent > 1 ? 'text-critical' : 'text-success'
                      }`}
                    >
                      {session.mismatchPercent.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-6 py-3 text-center">
                    <div
                      className={`text-sm font-bold ${
                        session.riskScore.total >= 70
                          ? 'text-critical'
                          : session.riskScore.total >= 40
                          ? 'text-warning'
                          : 'text-success'
                      }`}
                    >
                      {session.riskScore.total}
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <StatusPill status={session.verdict} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionPanel>

      {/* Recommendation */}
      <div className="p-6 bg-critical/10 border border-critical/20 rounded-lg">
        <div className="font-semibold text-critical mb-2">Recommendation</div>
        <div className="text-sm text-critical/90">
          Engage independent surveyor for all future MegaFuel deliveries.
        </div>
      </div>
    </div>
  );
}
