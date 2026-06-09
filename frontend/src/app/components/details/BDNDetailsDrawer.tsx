import { X, FileText, CheckCircle, XCircle, QrCode, Copy } from 'lucide-react';
import type { BDNRecord } from '../../../data/types';

interface BDNDetailsDrawerProps {
  bdn: BDNRecord;
  open: boolean;
  onClose: () => void;
}

export function BDNDetailsDrawer({ bdn, open, onClose }: BDNDetailsDrawerProps) {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const FIELD_STYLE = {
    label: { fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#5A8AB4', marginBottom: 4 },
    value: { fontSize: 12, fontWeight: 600, color: '#EAF4FF' },
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, zIndex: 199, background: 'rgba(0,0,0,0.4)' }}
        />
      )}

      {/* Drawer */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 520,
        zIndex: 200,
        background: 'linear-gradient(180deg, #08131F 0%, #0A1521 100%)',
        borderLeft: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '-16px 0 48px rgba(0,0,0,0.7)',
        display: 'flex',
        flexDirection: 'column',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 280ms cubic-bezier(0.32, 0, 0.12, 1)',
      }}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.10)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FileText style={{ width: 18, height: 18, color: '#4A9EFF' }} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#EAF4FF' }}>Bunker Delivery Note</div>
                <div style={{ fontSize: 11, color: '#7FA5D3', marginTop: 2 }}>{bdn.reference}</div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#7FA5D3', display: 'flex' }}>
              <X style={{ width: 18, height: 18 }} />
            </button>
          </div>

          {/* Validation Status Badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, background: bdn.validationStatus === 'VALID' ? 'rgba(52,201,140,0.12)' : 'rgba(232,78,78,0.12)', border: `1px solid ${bdn.validationStatus === 'VALID' ? 'rgba(52,201,140,0.3)' : 'rgba(232,78,78,0.3)'}` }}>
            {bdn.validationStatus === 'VALID' ? <CheckCircle style={{ width: 12, height: 12, color: '#34C98C' }} /> : <XCircle style={{ width: 12, height: 12, color: '#E84E4E' }} />}
            <span style={{ fontSize: 10, fontWeight: 700, color: bdn.validationStatus === 'VALID' ? '#34C98C' : '#E84E4E', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {bdn.validationStatus}
            </span>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* Vessel Information */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4A9EFF', marginBottom: 14 }}>Vessel Information</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <div style={FIELD_STYLE.label}>Vessel Name</div>
                <div style={FIELD_STYLE.value}>{bdn.vesselName}</div>
              </div>
              <div>
                <div style={FIELD_STYLE.label}>IMO Number</div>
                <div style={FIELD_STYLE.value}>{bdn.vesselIMO}</div>
              </div>
              {bdn.vesselMMSI && (
                <div>
                  <div style={FIELD_STYLE.label}>MMSI</div>
                  <div style={FIELD_STYLE.value}>{bdn.vesselMMSI}</div>
                </div>
              )}
              <div>
                <div style={FIELD_STYLE.label}>Port</div>
                <div style={FIELD_STYLE.value}>{bdn.port}</div>
              </div>
            </div>
          </div>

          {/* Supplier Information */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4A9EFF', marginBottom: 14 }}>Supplier Information</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={FIELD_STYLE.label}>Supplier Name</div>
                <div style={FIELD_STYLE.value}>{bdn.supplierName}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <div style={FIELD_STYLE.label}>Licence Number</div>
                  <div style={FIELD_STYLE.value}>{bdn.supplierLicence}</div>
                </div>
                {bdn.supplierEmail && (
                  <div>
                    <div style={FIELD_STYLE.label}>Email</div>
                    <div style={{ fontSize: 11, fontWeight: 500, color: '#BFD7F7' }}>{bdn.supplierEmail}</div>
                  </div>
                )}
              </div>
              {bdn.supplierPhone && (
                <div>
                  <div style={FIELD_STYLE.label}>Phone</div>
                  <div style={FIELD_STYLE.value}>{bdn.supplierPhone}</div>
                </div>
              )}
            </div>
          </div>

          {/* Barge Information */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4A9EFF', marginBottom: 14 }}>Barge Information</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <div style={FIELD_STYLE.label}>Barge Name</div>
                <div style={FIELD_STYLE.value}>{bdn.bargeName}</div>
              </div>
              <div>
                <div style={FIELD_STYLE.label}>Barge IMO</div>
                <div style={FIELD_STYLE.value}>{bdn.bargeIMO}</div>
              </div>
              {bdn.bargeMMSI && (
                <div>
                  <div style={FIELD_STYLE.label}>Barge MMSI</div>
                  <div style={FIELD_STYLE.value}>{bdn.bargeMMSI}</div>
                </div>
              )}
            </div>
          </div>

          {/* Fuel Specifications */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4A9EFF', marginBottom: 14 }}>Fuel Specifications</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <div style={FIELD_STYLE.label}>Product Grade</div>
                <div style={FIELD_STYLE.value}>{bdn.productGrade}</div>
              </div>
              <div>
                <div style={FIELD_STYLE.label}>Declared Quantity</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#EAF4FF', fontFamily: "'JetBrains Mono', monospace" }}>{bdn.quantityMT.toFixed(1)} MT</div>
              </div>
              <div>
                <div style={FIELD_STYLE.label}>Sulphur %</div>
                <div style={FIELD_STYLE.value}>{bdn.sulphurPercent.toFixed(2)}%</div>
              </div>
              <div>
                <div style={FIELD_STYLE.label}>Density @ 15°C</div>
                <div style={FIELD_STYLE.value}>{bdn.density15C.toFixed(1)} kg/m³</div>
              </div>
              {bdn.viscosity && (
                <div>
                  <div style={FIELD_STYLE.label}>Viscosity</div>
                  <div style={FIELD_STYLE.value}>{bdn.viscosity} cSt</div>
                </div>
              )}
              <div>
                <div style={FIELD_STYLE.label}>Flash Point</div>
                <div style={FIELD_STYLE.value}>{bdn.flashPoint}°C</div>
              </div>
            </div>
          </div>

          {/* Sample Seals */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4A9EFF', marginBottom: 14 }}>Sample Seal Numbers</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[bdn.sampleSeal, bdn.sampleSealB, bdn.sampleSealC, bdn.sampleSealD].filter(Boolean).map((seal, i) => (
                <div key={i} style={{ padding: '8px 12px', background: 'rgba(74,158,255,0.08)', border: '1px solid rgba(74,158,255,0.2)', borderRadius: 6 }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>Sample {String.fromCharCode(65 + i)}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#BFD7F7', fontFamily: "'JetBrains Mono', monospace" }}>{seal}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Signatures */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4A9EFF', marginBottom: 14 }}>Signature Status</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ padding: '10px 14px', background: bdn.supplierSigned ? 'rgba(52,201,140,0.08)' : 'rgba(232,78,78,0.08)', border: `1px solid ${bdn.supplierSigned ? 'rgba(52,201,140,0.2)' : 'rgba(232,78,78,0.2)'}`, borderRadius: 6 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#7FA5D3', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Supplier</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {bdn.supplierSigned ? <CheckCircle style={{ width: 14, height: 14, color: '#34C98C' }} /> : <XCircle style={{ width: 14, height: 14, color: '#E84E4E' }} />}
                  <span style={{ fontSize: 12, fontWeight: 700, color: bdn.supplierSigned ? '#34C98C' : '#E84E4E' }}>
                    {bdn.supplierSigned ? 'SIGNED' : 'UNSIGNED'}
                  </span>
                </div>
              </div>
              <div style={{ padding: '10px 14px', background: bdn.officerSigned ? 'rgba(52,201,140,0.08)' : 'rgba(232,78,78,0.08)', border: `1px solid ${bdn.officerSigned ? 'rgba(52,201,140,0.2)' : 'rgba(232,78,78,0.2)'}`, borderRadius: 6 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#7FA5D3', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Chief Officer</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {bdn.officerSigned ? <CheckCircle style={{ width: 14, height: 14, color: '#34C98C' }} /> : <XCircle style={{ width: 14, height: 14, color: '#E84E4E' }} />}
                  <span style={{ fontSize: 12, fontWeight: 700, color: bdn.officerSigned ? '#34C98C' : '#E84E4E' }}>
                    {bdn.officerSigned ? 'SIGNED' : 'UNSIGNED'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* eBDN Data */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4A9EFF', marginBottom: 14 }}>eBDN Authentication</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={FIELD_STYLE.label}>Issue Timestamp</div>
                <div style={FIELD_STYLE.value}>{bdn.bdnIssueTimestamp ? new Date(bdn.bdnIssueTimestamp).toLocaleString('en-SG', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A'}</div>
              </div>
              {bdn.eBDNQRHash && (
                <div>
                  <div style={FIELD_STYLE.label}>eBDN QR Hash</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6 }}>
                    <QrCode style={{ width: 14, height: 14, color: '#4A9EFF' }} />
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#BFD7F7', fontFamily: "'JetBrains Mono', monospace", flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{bdn.eBDNQRHash}</div>
                    <button onClick={() => copyToClipboard(bdn.eBDNQRHash!)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#7FA5D3' }}>
                      <Copy style={{ width: 12, height: 12 }} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
