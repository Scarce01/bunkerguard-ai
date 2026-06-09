import { useState } from 'react';
import { X, Upload, FileText, CheckCircle, Radio, ArrowRight, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router';

interface BDNUploadDrawerProps {
  open: boolean;
  onClose: () => void;
}

type UploadState = 'idle' | 'uploaded' | 'processing' | 'extracted' | 'ready' | 'created';

export function BDNUploadDrawer({ open, onClose }: BDNUploadDrawerProps) {
  const navigate = useNavigate();
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileSelect = (file: File) => {
    setFileName(file.name);
    setUploadState('uploaded');

    // Simulate processing
    setTimeout(() => setUploadState('processing'), 300);
    setTimeout(() => setUploadState('extracted'), 1800);
    setTimeout(() => setUploadState('ready'), 2200);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleCreateSession = () => {
    setUploadState('created');
  };

  const handleReset = () => {
    setUploadState('idle');
    setFileName(null);
  };

  const FIELD_STYLE = {
    label: { fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#5A8AB4', marginBottom: 4 },
    value: { fontSize: 12, fontWeight: 600, color: '#EAF4FF' },
  };

  const processingSteps = [
    { label: 'OCR Completed', done: true },
    { label: 'Vessel Identified', done: true },
    { label: 'Supplier Identified', done: true },
    { label: 'Quantity Extracted', done: true },
    { label: 'Fuel Grade Extracted', done: true },
  ];

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
        width: 580,
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
              <Upload style={{ width: 18, height: 18, color: '#4A9EFF' }} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#EAF4FF' }}>BDN Upload & Ingestion</div>
                <div style={{ fontSize: 11, color: '#7FA5D3', marginTop: 2 }}>Upload a Bunker Delivery Note to create a monitored bunkering session</div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#7FA5D3', display: 'flex' }}>
              <X style={{ width: 18, height: 18 }} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* Success State */}
          {uploadState === 'created' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(52,201,140,0.12)', border: '1px solid rgba(52,201,140,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <CheckCircle style={{ width: 32, height: 32, color: '#34C98C' }} />
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#EAF4FF', marginBottom: 8 }}>Session #16 Created</div>
              <div style={{ fontSize: 13, color: '#7FA5D3', marginBottom: 32, maxWidth: 360 }}>
                The system has started monitoring the bunkering operation for MAERSK HONAM at Singapore Eastern Anchorage.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 360 }}>
                <button
                  onClick={() => navigate('/live')}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'rgba(74,158,255,0.12)', border: '1px solid rgba(74,158,255,0.28)', color: '#4A9EFF', transition: 'all 150ms' }}
                >
                  <Radio style={{ width: 14, height: 14 }} />
                  Open Live Session
                </button>
                <button
                  onClick={() => { navigate('/sessions'); onClose(); handleReset(); }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'rgba(46,168,255,0.08)', border: '1px solid rgba(46,168,255,0.2)', color: '#2EA8FF', transition: 'all 150ms' }}
                >
                  <ExternalLink style={{ width: 14, height: 14 }} />
                  View Session Details
                </button>
                <button
                  onClick={handleReset}
                  style={{ padding: '10px 20px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#7FA5D3', transition: 'all 150ms', marginTop: 8 }}
                >
                  Upload Another BDN
                </button>
              </div>
            </div>
          )}

          {/* Upload Flow */}
          {uploadState !== 'created' && (
            <>
              {/* Section 1: Document Upload */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4A9EFF', marginBottom: 14 }}>Document Upload</div>

                {uploadState === 'idle' && (
                  <div
                    onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    style={{
                      padding: '48px 24px',
                      borderRadius: 12,
                      border: `2px dashed ${dragActive ? 'rgba(74,158,255,0.5)' : 'rgba(255,255,255,0.15)'}`,
                      background: dragActive ? 'rgba(74,158,255,0.05)' : 'rgba(255,255,255,0.02)',
                      textAlign: 'center',
                      transition: 'all 200ms',
                      cursor: 'pointer',
                    }}
                  >
                    <Upload style={{ width: 40, height: 40, color: '#4A9EFF', margin: '0 auto 16px' }} />
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#EAF4FF', marginBottom: 6 }}>Upload Bunker Delivery Note</div>
                    <div style={{ fontSize: 11, color: '#7FA5D3', marginBottom: 16 }}>Drag PDF here or</div>
                    <label style={{ display: 'inline-block', padding: '10px 20px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'rgba(74,158,255,0.12)', border: '1px solid rgba(74,158,255,0.28)', color: '#4A9EFF', transition: 'all 150ms' }}>
                      Select File
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])}
                        style={{ display: 'none' }}
                      />
                    </label>
                    <div style={{ fontSize: 10, color: '#5A8AB4', marginTop: 12 }}>Supported: PDF, Scanned BDN Image, eBDN Document</div>
                  </div>
                )}

                {uploadState !== 'idle' && (
                  <div style={{ padding: '16px 18px', borderRadius: 8, background: 'rgba(74,158,255,0.06)', border: '1px solid rgba(74,158,255,0.15)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <FileText style={{ width: 20, height: 20, color: '#4A9EFF', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#EAF4FF', marginBottom: 2 }}>{fileName || 'BDN_2026_06_10_00016.pdf'}</div>
                      <div style={{ fontSize: 10, color: '#7FA5D3' }}>3.2 MB • Uploaded {new Date().toLocaleTimeString()}</div>
                    </div>
                    <CheckCircle style={{ width: 18, height: 18, color: '#34C98C', flexShrink: 0 }} />
                  </div>
                )}
              </div>

              {/* Section 2: OCR / Extraction Status */}
              {(uploadState === 'processing' || uploadState === 'extracted' || uploadState === 'ready') && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4A9EFF', marginBottom: 14 }}>Document Processing</div>
                  <div style={{ padding: '18px 20px', borderRadius: 8, background: 'rgba(52,201,140,0.06)', border: '1px solid rgba(52,201,140,0.15)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                      {processingSteps.map((step, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <CheckCircle style={{ width: 14, height: 14, color: '#34C98C', flexShrink: 0 }} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#BFD7F7' }}>{step.label}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Parsing Confidence:</span>
                        <span style={{ fontSize: 16, fontWeight: 700, color: '#34C98C', fontFamily: "'JetBrains Mono', monospace" }}>98%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Section 3: Extracted BDN Data */}
              {(uploadState === 'extracted' || uploadState === 'ready') && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4A9EFF', marginBottom: 14 }}>Extracted BDN Data</div>

                  {/* Vessel Information */}
                  <div style={{ marginBottom: 18, padding: '16px 18px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#4A9EFF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Vessel Information</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <div style={FIELD_STYLE.label}>BDN Reference</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#BFD7F7', fontFamily: "'JetBrains Mono', monospace" }}>BDN-2026-06-10-00016</div>
                      </div>
                      <div>
                        <div style={FIELD_STYLE.label}>Vessel</div>
                        <div style={FIELD_STYLE.value}>MAERSK HONAM</div>
                      </div>
                      <div>
                        <div style={FIELD_STYLE.label}>IMO</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#BFD7F7', fontFamily: "'JetBrains Mono', monospace" }}>9650888</div>
                      </div>
                      <div>
                        <div style={FIELD_STYLE.label}>Port</div>
                        <div style={FIELD_STYLE.value}>Singapore Eastern Anchorage</div>
                      </div>
                    </div>
                  </div>

                  {/* Supplier Information */}
                  <div style={{ marginBottom: 18, padding: '16px 18px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#4A9EFF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Supplier Information</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <div style={FIELD_STYLE.label}>Supplier</div>
                        <div style={FIELD_STYLE.value}>BunkerGuard Demo Supplier Gamma Pte Ltd</div>
                      </div>
                      <div>
                        <div style={FIELD_STYLE.label}>Supplier Licence</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#BFD7F7', fontFamily: "'JetBrains Mono', monospace" }}>MPA-BKR-2024-0092</div>
                      </div>
                      <div>
                        <div style={FIELD_STYLE.label}>Barge</div>
                        <div style={FIELD_STYLE.value}>MT FUEL STAR 7</div>
                      </div>
                      <div>
                        <div style={FIELD_STYLE.label}>Barge IMO</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#BFD7F7', fontFamily: "'JetBrains Mono', monospace" }}>9123456</div>
                      </div>
                    </div>
                  </div>

                  {/* Fuel Specifications */}
                  <div style={{ marginBottom: 18, padding: '16px 18px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#4A9EFF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Fuel Specifications</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <div style={FIELD_STYLE.label}>Fuel Grade</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#BFD7F7', fontFamily: "'JetBrains Mono', monospace" }}>VLSFO RMG 380</div>
                      </div>
                      <div>
                        <div style={FIELD_STYLE.label}>Declared Quantity</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#4A9EFF', fontFamily: "'JetBrains Mono', monospace" }}>500.0 MT</div>
                      </div>
                      <div>
                        <div style={FIELD_STYLE.label}>Sulphur</div>
                        <div style={FIELD_STYLE.value}>0.38%</div>
                      </div>
                      <div>
                        <div style={FIELD_STYLE.label}>Density @ 15°C</div>
                        <div style={FIELD_STYLE.value}>991.5 kg/m³</div>
                      </div>
                      <div>
                        <div style={FIELD_STYLE.label}>Flash Point</div>
                        <div style={FIELD_STYLE.value}>62°C</div>
                      </div>
                      <div>
                        <div style={FIELD_STYLE.label}>Sample Seal</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#BFD7F7', fontFamily: "'JetBrains Mono', monospace" }}>SS-2026-00016</div>
                      </div>
                    </div>
                  </div>

                  {/* Signature Status */}
                  <div style={{ padding: '16px 18px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#4A9EFF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Signature Status</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <div style={FIELD_STYLE.label}>Supplier Signature</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <CheckCircle style={{ width: 12, height: 12, color: '#34C98C' }} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#34C98C' }}>Present</span>
                        </div>
                      </div>
                      <div>
                        <div style={FIELD_STYLE.label}>Chief Officer Signature</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #FFB84D' }} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#FFB84D' }}>Pending</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Section 4: Session Creation */}
              {uploadState === 'ready' && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4A9EFF', marginBottom: 14 }}>Session Creation</div>
                  <div style={{ padding: '18px 20px', borderRadius: 8, background: 'rgba(74,158,255,0.06)', border: '1px solid rgba(74,158,255,0.15)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                      <div>
                        <div style={FIELD_STYLE.label}>Session ID</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#4A9EFF', fontFamily: "'JetBrains Mono', monospace" }}>#16</div>
                      </div>
                      <div>
                        <div style={FIELD_STYLE.label}>Monitoring Status</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#34C98C' }}>Ready</div>
                      </div>
                      <div>
                        <div style={FIELD_STYLE.label}>MFM Stream</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#34C98C', animation: 'livePulse 2s ease-in-out infinite' }} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#34C98C' }}>Connected</span>
                        </div>
                      </div>
                      <div>
                        <div style={FIELD_STYLE.label}>AIS Feed</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#34C98C', animation: 'livePulse 2s ease-in-out infinite' }} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#34C98C' }}>Connected</span>
                        </div>
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <div style={FIELD_STYLE.label}>Risk Engine</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4A9EFF', animation: 'livePulse 2s ease-in-out infinite' }} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#4A9EFF' }}>Armed</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Primary Action */}
              {uploadState === 'ready' && (
                <button
                  onClick={handleCreateSession}
                  style={{
                    width: '100%',
                    padding: '14px 24px',
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: 'linear-gradient(135deg, rgba(74,158,255,0.15) 0%, rgba(74,158,255,0.08) 100%)',
                    border: '1px solid rgba(74,158,255,0.35)',
                    color: '#4A9EFF',
                    transition: 'all 200ms',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(74,158,255,0.22) 0%, rgba(74,158,255,0.12) 100%)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(74,158,255,0.15) 0%, rgba(74,158,255,0.08) 100%)'; }}
                >
                  <ArrowRight style={{ width: 16, height: 16 }} />
                  Create Monitoring Session
                </button>
              )}
            </>
          )}

        </div>
      </div>
    </>
  );
}
