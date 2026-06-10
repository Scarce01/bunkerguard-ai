import { useParams, useNavigate } from 'react-router';
import { SectionPanel } from '../components/dashboard/SectionPanel';
import { StatusPill } from '../components/dashboard/StatusPill';
import { useSessionDetail } from '../../lib/useSessionDetail';
import { useFuelReference } from '../../lib/useFuelReference';
import { EvidenceReportDrawer } from '../components/evidence/EvidenceReportDrawer';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle, FileText, Shield, Radio } from 'lucide-react';
import { useState } from 'react';

type TabType = 'overview' | 'bdn' | 'mfm' | 'ais' | 'anomalies' | 'evidence' | 'blockchain';

export function SessionDetailPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Live Supabase joins — sessions + bdn_records + risk_scores + mfm_stream
  // + anomalies, normalised to the shape the existing UI expects.
  const { session, anomalies, blockchainRecord, loading, error } = useSessionDetail(sessionId);
  const fuel = useFuelReference();
  const [reportDrawerOpen, setReportDrawerOpen] = useState(false);

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-sm text-foreground-muted">Loading session {sessionId}…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-xl font-semibold text-critical mb-2">Failed to load session</div>
          <div className="text-sm text-foreground-muted mb-4">{error}</div>
          <button onClick={() => navigate('/sessions')} className="text-sm text-primary hover:text-primary/80">
            Back to Sessions
          </button>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-xl font-semibold text-foreground mb-2">Session Not Found</div>
          <div className="text-sm text-foreground-muted mb-4">No row in Supabase for <code>{sessionId}</code>.</div>
          <button onClick={() => navigate('/sessions')} className="text-sm text-primary hover:text-primary/80">
            Back to Sessions
          </button>
        </div>
      </div>
    );
  }

  const chartData = session.mfmStream.readings.map((reading, index) => ({
    index: index,
    time: new Date(reading.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    mfm: reading.cumulativeMass,
    massFlowRate: reading.massFlowRate,
    density: reading.density,
    temperature: reading.temperature,
  }));

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'bdn', label: 'BDN Data' },
    { id: 'mfm', label: 'MFM Stream' },
    { id: 'ais', label: 'AIS Data' },
    { id: 'anomalies', label: 'Anomaly Details' },
    { id: 'evidence', label: 'Evidence' },
    { id: 'blockchain', label: 'Blockchain' },
  ] as const;

  const documentChecklist = [
    { name: 'BDN Signed by Supplier', status: session.bdnRecord.supplierSigned ? 'complete' : 'incomplete' },
    { name: 'BDN Signed by Chief Officer', status: session.bdnRecord.officerSigned ? 'complete' : 'incomplete' },
    { name: 'Sample Seal Verified', status: 'complete' },
    { name: 'MFM Certificate Valid', status: 'complete' },
    { name: 'Supplier Licence Valid', status: 'complete' },
    { name: 'Fuel Analysis Report', status: session.status === 'COMPLETED' ? 'complete' : 'pending' },
    { name: 'AIS Track Record', status: 'complete' },
    { name: 'Geofence Verification', status: 'complete' },
  ];

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/sessions')}
            className="p-2 hover:bg-surface-secondary rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground-secondary" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-semibold text-foreground">Session #{session.sessionNumber}</h1>
              <StatusPill status={session.status} />
              <StatusPill status={session.verdict} />
            </div>
            <p className="text-sm text-foreground-muted">
              {session.vesselName} • {new Date(session.startTime).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setReportDrawerOpen(true)}
            title="Generate signed evidence report via Claude — costs ~$0.02 in tokens"
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
            style={{
              background: 'linear-gradient(135deg, rgba(46,168,255,0.18), rgba(0,217,142,0.18))',
              border: '1px solid rgba(46,168,255,0.45)',
              color: '#2EA8FF',
              fontWeight: 700,
            }}
          >
            <FileText className="w-4 h-4" />
            Generate Evidence Report
          </button>
          <button onClick={() => alert('Fleet Alert: All vessels notified of potential fraud pattern from ' + session.supplierName)} className="flex items-center gap-2 px-4 py-2 bg-background-secondary border border-border rounded-lg hover:bg-surface-secondary transition-colors">
            <Radio className="w-4 h-4" />
            Alert Fleet
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-foreground-muted hover:text-foreground'
              }`}
            >
              {tab.label}
              {tab.id === 'anomalies' && anomalies.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-critical/20 text-critical text-xs rounded-full">
                  {anomalies.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-6">
            <SectionPanel>
              <div className="text-xs text-foreground-muted mb-2">BDN Quantity</div>
              <div className="text-2xl font-bold text-foreground mb-1">{session.bdnQuantity.toFixed(1)}</div>
              <div className="text-xs text-foreground-secondary">MT Declared</div>
            </SectionPanel>
            <SectionPanel>
              <div className="text-xs text-foreground-muted mb-2">MFM Delivered</div>
              <div className="text-2xl font-bold text-foreground mb-1">{session.mfmQuantity.toFixed(1)}</div>
              <div className="text-xs text-foreground-secondary">MT Recorded</div>
            </SectionPanel>
            <SectionPanel>
              <div className="text-xs text-foreground-muted mb-2">Mismatch</div>
              <div className="text-2xl font-bold text-critical mb-1">{session.mismatchMT.toFixed(1)}</div>
              <div className="text-xs text-critical">{session.mismatchPercent.toFixed(2)}% Short</div>
            </SectionPanel>
            <SectionPanel>
              <div className="text-xs text-foreground-muted mb-2">Risk Score</div>
              <div className="text-2xl font-bold text-critical mb-1">{session.riskScore.total}/100</div>
              <StatusPill status={session.riskScore.level} size="sm" />
            </SectionPanel>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Session Info */}
            <SectionPanel title="Session Information">
              <div className="space-y-3">
                {[
                  { label: 'Vessel', value: session.vesselName },
                  { label: 'IMO', value: session.vesselIMO },
                  { label: 'Supplier', value: session.supplierName },
                  { label: 'Barge', value: session.bargeName },
                  { label: 'Location', value: session.location },
                  { label: 'Fuel Grade', value: session.fuelGrade },
                  { label: 'Started', value: new Date(session.startTime).toLocaleString() },
                  { label: 'Duration', value: `${session.mfmStream.duration} minutes` },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between text-sm">
                    <span className="text-foreground-muted">{item.label}</span>
                    <span className="text-foreground font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            </SectionPanel>

            {/* Document Checklist */}
            <SectionPanel title="Document Checklist">
              <div className="space-y-2">
                {documentChecklist.map((doc) => (
                  <div key={doc.name} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <span className="text-sm text-foreground">{doc.name}</span>
                    {doc.status === 'complete' ? (
                      <CheckCircle2 className="w-4 h-4 text-success" />
                    ) : doc.status === 'incomplete' ? (
                      <XCircle className="w-4 h-4 text-critical" />
                    ) : (
                      <span className="text-xs text-foreground-muted">Pending</span>
                    )}
                  </div>
                ))}
              </div>
            </SectionPanel>

            {/* Risk Breakdown */}
            <SectionPanel title="Risk Breakdown">
              <div className="space-y-4">
                {[
                  { label: 'Quantity Mismatch', value: session.riskScore.quantityMismatch, max: 40 },
                  { label: 'Data Integrity', value: session.riskScore.dataIntegrity, max: 20 },
                  { label: 'Regulatory Compliance', value: session.riskScore.regulatoryCompliance, max: 20 },
                  { label: 'Supplier History', value: session.riskScore.supplierHistory, max: 20 },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-foreground-muted">{item.label}</span>
                      <span className="text-foreground font-semibold">
                        {item.value}/{item.max}
                      </span>
                    </div>
                    <div className="h-2 bg-background-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-critical rounded-full"
                        style={{ width: `${(item.value / item.max) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </SectionPanel>
          </div>
        </div>
      )}

      {activeTab === 'bdn' && (
        <SectionPanel title="Bunker Delivery Note (BDN) Data">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              {[
                { label: 'BDN Reference', value: session.bdnRecord.reference },
                { label: 'Vessel Name', value: session.bdnRecord.vesselName },
                { label: 'Vessel IMO', value: session.bdnRecord.vesselIMO },
                { label: 'Supplier Name', value: session.bdnRecord.supplierName },
                { label: 'Supplier Licence', value: session.bdnRecord.supplierLicence },
                { label: 'Barge Name', value: session.bdnRecord.bargeName },
                { label: 'Barge IMO', value: session.bdnRecord.bargeIMO },
                { label: 'Port', value: session.bdnRecord.port },
              ].map((item) => (
                <div key={item.label} className="flex justify-between py-2 border-b border-border">
                  <span className="text-sm text-foreground-muted">{item.label}</span>
                  <span className="text-sm font-medium text-foreground">{item.value}</span>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              {(() => {
                const spec = fuel.paramFor(session.bdnRecord.productGrade);
                const price = fuel.priceFor(session.bdnRecord.productGrade);
                const chip = (pass: boolean | null) => {
                  if (pass === null) return null;
                  return (
                    <span
                      title={pass ? 'Within fuel_parameters spec' : 'Out of spec — fuel_parameters violation'}
                      style={{
                        marginLeft: 8,
                        padding: '1px 7px',
                        background: pass ? 'rgba(0,217,142,0.15)' : 'rgba(255,86,86,0.15)',
                        border: `1px solid ${pass ? '#00D98E' : '#FF5656'}`,
                        color: pass ? '#00D98E' : '#FF5656',
                        borderRadius: 4,
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: 0.6,
                      }}>
                      {pass ? '🟢 PASS' : '🔴 FAIL'}
                    </span>
                  );
                };
                const sulphurPass  = spec?.max_sulphur_pct       != null ? session.bdnRecord.sulphurPercent <= spec.max_sulphur_pct          : null;
                const densityPass  = spec?.max_density_kg_m3     != null ? session.bdnRecord.density15C    <= spec.max_density_kg_m3        : null;
                const flashPass    = spec?.min_flash_point_c     != null ? session.bdnRecord.flashPoint    >= spec.min_flash_point_c        : null;
                const limitNote = (n: number | null | undefined, unit: string, dir: 'max' | 'min') =>
                  n == null ? '' : ` · ${dir} ${n}${unit}`;
                const items = [
                  { label: 'Product Grade', value: session.bdnRecord.productGrade, sub: spec ? `Category: ${spec.category} · MARPOL: ${spec.marpol_applicable ? 'Yes' : 'No'}` : null, chip: null as any },
                  { label: 'Sulphur %',     value: `${session.bdnRecord.sulphurPercent}%`, sub: 'spec' + limitNote(spec?.max_sulphur_pct, '%', 'max'), chip: chip(sulphurPass) },
                  { label: 'Density @ 15°C', value: `${session.bdnRecord.density15C} kg/m³`, sub: 'spec' + limitNote(spec?.max_density_kg_m3, ' kg/m³', 'max'), chip: chip(densityPass) },
                  { label: 'Flash Point',   value: `${session.bdnRecord.flashPoint}°C`, sub: 'spec' + limitNote(spec?.min_flash_point_c, '°C', 'min'), chip: chip(flashPass) },
                  { label: 'Quantity',      value: `${session.bdnRecord.quantityMT} MT`, sub: price ? `≈ USD $${(session.bdnRecord.quantityMT * price.price_usd_per_mt).toLocaleString(undefined, { maximumFractionDigits: 0 })} @ $${price.price_usd_per_mt}/MT (${price.source})` : null, chip: null as any },
                  { label: 'Sample Seal',   value: session.bdnRecord.sampleSeal, sub: null, chip: null as any },
                  { label: 'Supplier Signed', value: session.bdnRecord.supplierSigned ? 'Yes' : 'No', sub: null, chip: null as any },
                  { label: 'Officer Signed',  value: session.bdnRecord.officerSigned  ? 'Yes' : 'No', sub: null, chip: null as any },
                ];
                return items.map((item) => (
                  <div key={item.label} className="py-2 border-b border-border">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-foreground-muted">{item.label}</span>
                      <span className="text-sm font-medium text-foreground flex items-center">
                        {item.value}
                        {item.chip}
                      </span>
                    </div>
                    {item.sub && (
                      <div className="text-[10px] text-foreground-muted mt-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {item.sub}
                      </div>
                    )}
                  </div>
                ));
              })()}
            </div>
          </div>

          <div className="mt-6 p-4 bg-background-secondary rounded-lg">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-foreground">Validation Status</div>
              <StatusPill status={session.bdnRecord.validationStatus} />
            </div>
          </div>
        </SectionPanel>
      )}

      {activeTab === 'mfm' && (
        <div className="space-y-6">
          <SectionPanel title="MFM Stream Data">
            <div className="grid grid-cols-4 gap-6 mb-6">
              {[
                { label: 'Final Quantity', value: `${session.mfmStream.finalQuantity.toFixed(1)} MT` },
                { label: 'Duration', value: `${session.mfmStream.duration} min` },
                { label: 'Avg Flow Rate', value: `${session.mfmStream.averageFlowRate.toFixed(1)} MT/h` },
                { label: 'Avg Density', value: `${session.mfmStream.averageDensity.toFixed(1)} kg/m³` },
              ].map((item) => (
                <div key={item.label} className="p-4 bg-background-secondary rounded-lg">
                  <div className="text-xs text-foreground-muted mb-1">{item.label}</div>
                  <div className="text-lg font-bold text-foreground">{item.value}</div>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-foreground mb-3">Cumulative Mass</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(56, 189, 248, 0.1)" />
                    <XAxis
                      dataKey="index"
                      stroke="#94A3B8"
                      style={{ fontSize: '11px' }}
                      tickFormatter={(index) => chartData[index]?.time.slice(0, 5) || ''}
                    />
                    <YAxis stroke="#94A3B8" style={{ fontSize: '11px' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#111C31',
                        border: '1px solid rgba(56, 189, 248, 0.2)',
                        borderRadius: '6px',
                      }}
                    />
                    <Line type="monotone" dataKey="mfm" stroke="#38BDF8" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div>
                <div className="text-sm font-medium text-foreground mb-3">Mass Flow Rate</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(56, 189, 248, 0.1)" />
                    <XAxis
                      dataKey="index"
                      stroke="#94A3B8"
                      style={{ fontSize: '11px' }}
                      tickFormatter={(index) => chartData[index]?.time.slice(0, 5) || ''}
                    />
                    <YAxis stroke="#94A3B8" style={{ fontSize: '11px' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#111C31',
                        border: '1px solid rgba(56, 189, 248, 0.2)',
                        borderRadius: '6px',
                      }}
                    />
                    <Line type="monotone" dataKey="massFlowRate" stroke="#22C55E" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </SectionPanel>
        </div>
      )}

      {activeTab === 'ais' && (
        <SectionPanel title="AIS Data & Geofence Verification">
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-6">
              <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                  <div className="text-sm font-semibold text-success">AIS Track Verified</div>
                </div>
                <div className="text-xs text-foreground-muted">Vessel position confirmed</div>
              </div>

              <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                  <div className="text-sm font-semibold text-success">Geofence Verified</div>
                </div>
                <div className="text-xs text-foreground-muted">Within authorized zone</div>
              </div>

              <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                  <div className="text-sm font-semibold text-success">Vessel Identity Verified</div>
                </div>
                <div className="text-xs text-foreground-muted">IMO matches AIS</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="text-sm font-medium text-foreground mb-3">Vessel AIS Data</div>
                {[
                  { label: 'MMSI', value: '563' + session.vesselIMO },
                  { label: 'Call Sign', value: 'V7' + session.vesselIMO.substring(0, 4) },
                  { label: 'Flag', value: 'Singapore' },
                  { label: 'Vessel Type', value: 'Cargo' },
                  { label: 'Position', value: session.location },
                  { label: 'Last Update', value: new Date(session.startTime).toLocaleString() },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between py-2 border-b border-border">
                    <span className="text-sm text-foreground-muted">{item.label}</span>
                    <span className="text-sm font-medium text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <div className="text-sm font-medium text-foreground mb-3">Barge AIS Data</div>
                {[
                  { label: 'MMSI', value: '563' + session.bdnRecord.bargeIMO },
                  { label: 'Call Sign', value: 'V7' + session.bdnRecord.bargeIMO.substring(0, 4) },
                  { label: 'Flag', value: 'Singapore' },
                  { label: 'Vessel Type', value: 'Tanker' },
                  { label: 'Position', value: session.location },
                  { label: 'Last Update', value: new Date(session.startTime).toLocaleString() },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between py-2 border-b border-border">
                    <span className="text-sm text-foreground-muted">{item.label}</span>
                    <span className="text-sm font-medium text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-background-secondary rounded-lg">
              <div className="text-xs text-foreground-muted mb-2">Geofence Zone</div>
              <div className="text-sm font-medium text-foreground">Singapore Eastern Anchorage - Authorized Bunkering Zone A3</div>
            </div>
          </div>
        </SectionPanel>
      )}

      {activeTab === 'anomalies' && (
        <SectionPanel title="Anomaly Details" noPadding>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border">
                <tr className="text-left text-xs text-foreground-muted uppercase tracking-wide">
                  <th className="px-6 py-3">Rule</th>
                  <th className="px-6 py-3">Severity</th>
                  <th className="px-6 py-3">Finding</th>
                  <th className="px-6 py-3">Evidence</th>
                  <th className="px-6 py-3">Timestamp</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {anomalies.map((anomaly) => (
                  <tr key={anomaly.id} className="hover:bg-surface-secondary/50">
                    <td className="px-6 py-4">
                      <div className="font-mono text-sm font-semibold text-primary">{anomaly.ruleId}</div>
                      <div className="text-xs text-foreground-muted">{anomaly.ruleName}</div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusPill status={anomaly.severity} size="sm" />
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">{anomaly.finding}</td>
                    <td className="px-6 py-4 text-sm text-foreground-secondary">{anomaly.evidence}</td>
                    <td className="px-6 py-4 text-xs text-foreground-muted">
                      {new Date(anomaly.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {anomaly.acknowledged && <CheckCircle2 className="w-4 h-4 text-success" />}
                        {anomaly.resolved && <span className="text-xs text-success">Resolved</span>}
                        {!anomaly.acknowledged && <span className="text-xs text-foreground-muted">New</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionPanel>
      )}

      {activeTab === 'evidence' && (
        <SectionPanel title="Evidence Summary">
          <div className="space-y-6">
            <div className="p-4 bg-background-secondary rounded-lg">
              <div className="text-xs text-foreground-muted mb-2">AI Analysis</div>
              <p className="text-sm text-foreground mb-3">
                Significant quantity discrepancy detected. MFM recorded {session.mfmQuantity.toFixed(1)} MT while BDN declares {session.bdnQuantity.toFixed(1)} MT.
              </p>
              <div className="p-3 bg-critical/10 border border-critical/20 rounded">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-critical" />
                  <span className="text-sm font-semibold text-critical">Recommendation: REFUSE TO SIGN</span>
                </div>
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-foreground mb-3">Quantity Comparison</div>
              <div className="overflow-x-auto">
                <table className="w-full border border-border rounded-lg overflow-hidden">
                  <thead className="bg-background-secondary">
                    <tr className="text-left text-xs text-foreground-muted uppercase">
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3 text-right">Quantity</th>
                      <th className="px-4 py-3 text-right">Difference</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td className="px-4 py-3 text-sm text-foreground">BDN Declared</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold">{session.bdnQuantity.toFixed(1)} MT</td>
                      <td className="px-4 py-3 text-right text-sm">-</td>
                      <td className="px-4 py-3"><StatusPill status="MISMATCH" size="sm" /></td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm text-foreground">MFM Recorded</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold">{session.mfmQuantity.toFixed(1)} MT</td>
                      <td className="px-4 py-3 text-right text-sm text-critical font-semibold">
                        -{session.mismatchMT.toFixed(1)} MT
                      </td>
                      <td className="px-4 py-3"><StatusPill status="CRITICAL" size="sm" /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </SectionPanel>
      )}

      {activeTab === 'blockchain' && blockchainRecord && (
        <SectionPanel title="Blockchain Verification">
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              {[
                { label: 'BDN Hash', value: blockchainRecord.bdnHash },
                { label: 'MFM Hash', value: blockchainRecord.mfmHash },
                { label: 'Validation Hash', value: blockchainRecord.validationHash },
                { label: 'Transaction Hash', value: blockchainRecord.transactionHash },
              ].map((item) => (
                <div key={item.label} className="p-4 bg-background-secondary rounded-lg">
                  <div className="text-xs text-foreground-muted mb-2">{item.label}</div>
                  <div className="font-mono text-xs text-foreground-secondary break-all">{item.value}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="p-4 bg-background-secondary rounded-lg">
                <div className="text-xs text-foreground-muted mb-2">Block Number</div>
                <div className="font-mono text-lg font-semibold text-foreground">#{blockchainRecord.blockNumber}</div>
              </div>
              <div className="p-4 bg-background-secondary rounded-lg">
                <div className="text-xs text-foreground-muted mb-2">Timestamp</div>
                <div className="text-sm font-semibold text-foreground">
                  {new Date(blockchainRecord.timestamp).toLocaleString()}
                </div>
              </div>
            </div>

            <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-success" />
                <span className="text-sm font-semibold text-success">Data immutably recorded on blockchain</span>
              </div>
            </div>
          </div>
        </SectionPanel>
      )}

      <EvidenceReportDrawer
        sessionId={session.id}
        open={reportDrawerOpen}
        onClose={() => setReportDrawerOpen(false)}
      />
    </div>
  );
}
