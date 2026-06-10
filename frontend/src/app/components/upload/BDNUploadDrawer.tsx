import { useState } from 'react';
import {
  X, Upload, FileText, CheckCircle, Radio, ArrowRight, ExternalLink,
  AlertTriangle, Loader2, XCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router';

import {
  startBunkeringSession,
  uploadBdn,
  type StartSessionResponse,
  type UploadResponse,
} from '../../../lib/bunker-api';

interface BDNUploadDrawerProps {
  open: boolean;
  onClose: () => void;
}

type UploadState =
  | 'idle'
  | 'uploading'       // file picked, POSTing to Claude
  | 'analyzed'        // got the response, Claude said it IS a BDN
  | 'rejected'        // Claude said it's NOT a BDN
  | 'creating'        // POSTing /start-session
  | 'created'         // session row in Supabase as PENDING (un-bunked)
  | 'error';

export function BDNUploadDrawer({ open, onClose }: BDNUploadDrawerProps) {
  const navigate = useNavigate();
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number>(0);

  // Real Claude response + downstream session record.
  const [analysis, setAnalysis] = useState<UploadResponse | null>(null);
  const [session, setSession] = useState<StartSessionResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const handleFileSelect = async (file: File) => {
    setFileName(file.name);
    setFileSize(file.size);
    setUploadState('uploading');
    setErrorMsg('');
    setAnalysis(null);
    setSession(null);

    try {
      const result = await uploadBdn(file);
      setAnalysis(result);
      setUploadState(result.is_bdn ? 'analyzed' : 'rejected');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setUploadState('error');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      void handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleCreateSession = async () => {
    if (!analysis) return;
    setUploadState('creating');
    try {
      const result = await startBunkeringSession(analysis);
      setSession(result);
      setUploadState('created');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setUploadState('error');
    }
  };

  const handleReset = () => {
    setUploadState('idle');
    setFileName(null);
    setFileSize(0);
    setAnalysis(null);
    setSession(null);
    setErrorMsg('');
  };

  const FIELD_STYLE = {
    label: { fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#5A8AB4', marginBottom: 4 },
    value: { fontSize: 12, fontWeight: 600, color: '#EAF4FF' },
  };

  // Per-field ticks now come from Claude's `checks` map. OCR-completed is
  // implicit: if we have a response at all, OCR ran.
  const processingSteps = analysis
    ? [
        { label: 'OCR Completed', done: true },
        { label: 'Vessel Identified', done: analysis.checks.vessel_identified },
        { label: 'Supplier Identified', done: analysis.checks.supplier_identified },
        { label: 'Quantity Extracted', done: analysis.checks.quantity_extracted },
        { label: 'Fuel Grade Extracted', done: analysis.checks.fuel_grade_extracted },
      ]
    : [];

  const extracted = analysis?.extracted;
  const showExtractionPanel = uploadState === 'analyzed' || uploadState === 'creating' || (uploadState === 'created' && !!analysis);
  const showProcessingPanel = showExtractionPanel || uploadState === 'rejected';
  const confidencePct = analysis ? analysis.parsing_confidence_pct : 0;
  const confidenceColor = confidencePct >= 80 ? '#34C98C' : confidencePct >= 50 ? '#FFB84D' : '#F87171';

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
          {uploadState === 'created' && session && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(52,201,140,0.12)', border: '1px solid rgba(52,201,140,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <CheckCircle style={{ width: 32, height: 32, color: '#34C98C' }} />
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#EAF4FF', marginBottom: 8 }}>
                {session.session_id} Created
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#FFB84D', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                Status: {session.status === 'PENDING' ? 'UN-BUNKED · awaiting MFM stream' : session.status}
              </div>
              <div style={{ fontSize: 13, color: '#7FA5D3', marginBottom: 32, maxWidth: 360 }}>
                {session.notes}
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

          {/* Error state */}
          {uploadState === 'error' && (
            <div style={{ padding: '18px 20px', borderRadius: 8, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <XCircle style={{ width: 18, height: 18, color: '#F87171' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#F87171' }}>Upload failed</span>
              </div>
              <div style={{ fontSize: 12, color: '#FCA5A5', marginBottom: 12 }}>{errorMsg}</div>
              <button onClick={handleReset} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)', color: '#F87171' }}>
                Try again
              </button>
            </div>
          )}

          {/* Upload Flow */}
          {uploadState !== 'created' && uploadState !== 'error' && (
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
                    <div style={{ fontSize: 11, color: '#7FA5D3', marginBottom: 16 }}>Drag PDF/image here or</div>
                    <label style={{ display: 'inline-block', padding: '10px 20px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'rgba(74,158,255,0.12)', border: '1px solid rgba(74,158,255,0.28)', color: '#4A9EFF', transition: 'all 150ms' }}>
                      Select File
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(e) => e.target.files && void handleFileSelect(e.target.files[0])}
                        style={{ display: 'none' }}
                      />
                    </label>
                    <div style={{ fontSize: 10, color: '#5A8AB4', marginTop: 12 }}>
                      Claude verifies the document is really a BDN before creating a session.
                    </div>
                  </div>
                )}

                {uploadState !== 'idle' && (
                  <div style={{ padding: '16px 18px', borderRadius: 8, background: 'rgba(74,158,255,0.06)', border: '1px solid rgba(74,158,255,0.15)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <FileText style={{ width: 20, height: 20, color: '#4A9EFF', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#EAF4FF', marginBottom: 2 }}>{fileName ?? 'upload'}</div>
                      <div style={{ fontSize: 10, color: '#7FA5D3' }}>
                        {(fileSize / (1024 * 1024)).toFixed(2)} MB • Uploaded {new Date().toLocaleTimeString()}
                      </div>
                    </div>
                    {uploadState === 'uploading' ? (
                      <Loader2 style={{ width: 18, height: 18, color: '#4A9EFF', flexShrink: 0, animation: 'spin 1s linear infinite' }} />
                    ) : uploadState === 'rejected' ? (
                      <XCircle style={{ width: 18, height: 18, color: '#F87171', flexShrink: 0 }} />
                    ) : (
                      <CheckCircle style={{ width: 18, height: 18, color: '#34C98C', flexShrink: 0 }} />
                    )}
                  </div>
                )}
              </div>

              {/* Section 2: OCR / Extraction Status */}
              {showProcessingPanel && analysis && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4A9EFF', marginBottom: 14 }}>Document Processing</div>
                  <div style={{
                    padding: '18px 20px', borderRadius: 8,
                    background: uploadState === 'rejected' ? 'rgba(248,113,113,0.06)' : 'rgba(52,201,140,0.06)',
                    border: `1px solid ${uploadState === 'rejected' ? 'rgba(248,113,113,0.18)' : 'rgba(52,201,140,0.15)'}`,
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                      {processingSteps.map((step, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {step.done ? (
                            <CheckCircle style={{ width: 14, height: 14, color: '#34C98C', flexShrink: 0 }} />
                          ) : (
                            <XCircle style={{ width: 14, height: 14, color: '#7FA5D3', flexShrink: 0 }} />
                          )}
                          <span style={{ fontSize: 12, fontWeight: 600, color: step.done ? '#BFD7F7' : '#7FA5D3' }}>{step.label}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                          {uploadState === 'rejected' ? 'Classification Confidence:' : 'Parsing Confidence:'}
                        </span>
                        <span style={{ fontSize: 16, fontWeight: 700, color: confidenceColor, fontFamily: "'JetBrains Mono', monospace" }}>
                          {confidencePct.toFixed(0)}%
                        </span>
                      </div>
                      <div style={{ fontSize: 10, color: '#7FA5D3', lineHeight: 1.5 }}>
                        Document type: <span style={{ color: '#BFD7F7', fontWeight: 700 }}>{analysis.document_type}</span> · {analysis.reasoning}
                      </div>
                      {analysis.red_flags.length > 0 && (
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                          <AlertTriangle style={{ width: 12, height: 12, color: '#FFB84D', flexShrink: 0, marginTop: 2 }} />
                          <span style={{ fontSize: 10, color: '#FFB84D' }}>
                            {analysis.red_flags.join(' · ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Rejection: not a BDN */}
              {uploadState === 'rejected' && (
                <div style={{ padding: '18px 20px', borderRadius: 8, background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <XCircle style={{ width: 16, height: 16, color: '#F87171' }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#F87171' }}>Not a Bunker Delivery Note</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#FCA5A5', marginBottom: 12 }}>
                    No session was created. Upload a real BDN to continue.
                  </div>
                  <button onClick={handleReset} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)', color: '#F87171' }}>
                    Upload a different document
                  </button>
                </div>
              )}

              {/* Section 3: Extracted BDN Data (Claude-extracted, not constants) */}
              {showExtractionPanel && extracted && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4A9EFF', marginBottom: 14 }}>Extracted BDN Data</div>

                  {/* Vessel Information */}
                  <div style={{ marginBottom: 18, padding: '16px 18px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#4A9EFF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Vessel Information</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <div style={FIELD_STYLE.label}>BDN Reference</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#BFD7F7', fontFamily: "'JetBrains Mono', monospace" }}>{extracted.bdn_ref ?? '—'}</div>
                      </div>
                      <div>
                        <div style={FIELD_STYLE.label}>Vessel</div>
                        <div style={FIELD_STYLE.value}>{extracted.vessel_name ?? '—'}</div>
                      </div>
                      <div>
                        <div style={FIELD_STYLE.label}>IMO</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#BFD7F7', fontFamily: "'JetBrains Mono', monospace" }}>{extracted.vessel_imo ?? '—'}</div>
                      </div>
                      <div>
                        <div style={FIELD_STYLE.label}>Port</div>
                        <div style={FIELD_STYLE.value}>{extracted.port ?? '—'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Supplier Information */}
                  <div style={{ marginBottom: 18, padding: '16px 18px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#4A9EFF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Supplier Information</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <div style={FIELD_STYLE.label}>Supplier</div>
                        <div style={FIELD_STYLE.value}>{extracted.supplier_name ?? '—'}</div>
                      </div>
                      <div>
                        <div style={FIELD_STYLE.label}>Barge</div>
                        <div style={FIELD_STYLE.value}>{extracted.barge_name ?? '—'}</div>
                      </div>
                      <div>
                        <div style={FIELD_STYLE.label}>Barge IMO</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#BFD7F7', fontFamily: "'JetBrains Mono', monospace" }}>{extracted.barge_imo ?? '—'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Fuel Specifications */}
                  <div style={{ marginBottom: 18, padding: '16px 18px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#4A9EFF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Fuel Specifications</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <div style={FIELD_STYLE.label}>Fuel Grade</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#BFD7F7', fontFamily: "'JetBrains Mono', monospace" }}>{extracted.grade ?? '—'}</div>
                      </div>
                      <div>
                        <div style={FIELD_STYLE.label}>Declared Quantity</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#4A9EFF', fontFamily: "'JetBrains Mono', monospace" }}>
                          {extracted.qty_mt != null ? `${extracted.qty_mt.toFixed(1)} MT` : '—'}
                        </div>
                      </div>
                      <div>
                        <div style={FIELD_STYLE.label}>Sulphur</div>
                        <div style={FIELD_STYLE.value}>{extracted.sulphur_pct != null ? `${extracted.sulphur_pct}%` : '—'}</div>
                      </div>
                      <div>
                        <div style={FIELD_STYLE.label}>Density @ 15°C</div>
                        <div style={FIELD_STYLE.value}>{extracted.density_15c_kg_m3 != null ? `${extracted.density_15c_kg_m3} kg/m³` : '—'}</div>
                      </div>
                      <div>
                        <div style={FIELD_STYLE.label}>Flash Point</div>
                        <div style={FIELD_STYLE.value}>{extracted.flash_point_c != null ? `${extracted.flash_point_c}°C` : '—'}</div>
                      </div>
                      <div>
                        <div style={FIELD_STYLE.label}>Sample Seal</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#BFD7F7', fontFamily: "'JetBrains Mono', monospace" }}>{extracted.sample_seal ?? '—'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Signature Status */}
                  <div style={{ padding: '16px 18px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#4A9EFF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Signature Status</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <SignatureCell label="Supplier Signature" present={extracted.supplier_signed === true} />
                      <SignatureCell label="Chief Officer Signature" present={extracted.officer_signed === true} />
                    </div>
                  </div>
                </div>
              )}

              {/* Section 4: Session Creation hint */}
              {uploadState === 'analyzed' && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4A9EFF', marginBottom: 14 }}>Session Creation</div>
                  <div style={{ padding: '18px 20px', borderRadius: 8, background: 'rgba(255,184,77,0.06)', border: '1px solid rgba(255,184,77,0.18)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#FFB84D', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                      Will be created as UN-BUNKED (PENDING)
                    </div>
                    <div style={{ fontSize: 11, color: '#BFD7F7', lineHeight: 1.5 }}>
                      The session row lands in Supabase with status <strong>PENDING</strong> and zero MFM throughput. The first MFM packet flips it to <strong>BUNKERING</strong>; reaching {extracted?.qty_mt?.toFixed(1) ?? '—'} MT auto-completes it.
                    </div>
                  </div>
                </div>
              )}

              {/* Primary Action */}
              {(uploadState === 'analyzed' || uploadState === 'creating') && (
                <button
                  onClick={handleCreateSession}
                  disabled={uploadState === 'creating'}
                  style={{
                    width: '100%',
                    padding: '14px 24px',
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: uploadState === 'creating' ? 'wait' : 'pointer',
                    background: 'linear-gradient(135deg, rgba(74,158,255,0.15) 0%, rgba(74,158,255,0.08) 100%)',
                    border: '1px solid rgba(74,158,255,0.35)',
                    color: '#4A9EFF',
                    transition: 'all 200ms',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    opacity: uploadState === 'creating' ? 0.7 : 1,
                  }}
                >
                  {uploadState === 'creating' ? (
                    <>
                      <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                      Creating session…
                    </>
                  ) : (
                    <>
                      <ArrowRight style={{ width: 16, height: 16 }} />
                      Create Monitoring Session
                    </>
                  )}
                </button>
              )}

              {/* Uploading state */}
              {uploadState === 'uploading' && (
                <div style={{ padding: '18px 20px', borderRadius: 8, background: 'rgba(74,158,255,0.06)', border: '1px solid rgba(74,158,255,0.15)', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Loader2 style={{ width: 18, height: 18, color: '#4A9EFF', animation: 'spin 1s linear infinite' }} />
                  <div style={{ fontSize: 12, color: '#BFD7F7' }}>
                    Sending to Claude for classification + extraction…
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </>
  );
}


function SignatureCell({ label, present }: { label: string; present: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5A8AB4', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {present ? (
          <>
            <CheckCircle style={{ width: 12, height: 12, color: '#34C98C' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#34C98C' }}>Present</span>
          </>
        ) : (
          <>
            <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #FFB84D' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#FFB84D' }}>Pending</span>
          </>
        )}
      </div>
    </div>
  );
}
