import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle, Circle, FileText, Loader2, Upload, X } from 'lucide-react';
import { useNavigate } from 'react-router';

interface BDNUploadDrawerProps {
  open: boolean;
  onClose: () => void;
}

interface PipelineStep {
  stage: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
}

interface IngestionResult {
  document: {
    id: string;
    session_id?: string;
    filename: string;
    file_size_bytes: number;
    status: string;
    current_stage: string;
    pipeline_status?: { steps?: PipelineStep[]; error?: string };
    extracted_data?: Record<string, any>;
    parsing_confidence?: number;
    error_message?: string;
  };
  session?: {
    session_id: string;
    investigator_output?: any;
    compliance_output?: any;
    decision_output?: any;
    evidence_s3_key?: string;
  };
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const PIPELINE_LABELS: Record<string, string> = {
  UPLOADED: 'Uploaded',
  OCR: 'OCR',
  EXTRACTION: 'Extraction',
  ENRICHMENT: 'Enrichment',
  RISK_ANALYSIS: 'Risk Analysis',
  EVIDENCE_GENERATION: 'Evidence Generation',
  DECISION_RECOMMENDATION: 'Decision Recommendation',
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',', 2)[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function BDNUploadDrawer({ open, onClose }: BDNUploadDrawerProps) {
  const navigate = useNavigate();
  const pollRef = useRef<number | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<IngestionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    if (pollRef.current) window.clearTimeout(pollRef.current);
  }, []);

  const poll = async (documentId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/ingestion/${documentId}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to read ingestion status');
      setResult(payload);
      const status = payload.document?.status;
      if (status !== 'COMPLETED' && status !== 'FAILED') {
        pollRef.current = window.setTimeout(() => poll(documentId), 1400);
      }
    } catch (pollError: any) {
      setError(pollError?.message || String(pollError));
    }
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      if (file.size > 6 * 1024 * 1024) throw new Error('BDN file must be 6 MB or smaller');
      const response = await fetch(`${API_BASE}/api/ingest-bdn`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          content_type: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream'),
          file_base64: await fileToBase64(file),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'BDN upload failed');
      setUploading(false);
      await poll(payload.document_id);
    } catch (uploadError: any) {
      setUploading(false);
      setError(uploadError?.message || String(uploadError));
    }
  };

  const reset = () => {
    if (pollRef.current) window.clearTimeout(pollRef.current);
    setResult(null);
    setError(null);
    setUploading(false);
  };

  if (!open) return null;
  const document = result?.document;
  const fields = document?.extracted_data;
  const steps = document?.pipeline_status?.steps ?? Object.keys(PIPELINE_LABELS).map((stage) => ({
    stage,
    status: stage === 'UPLOADED' && document ? 'COMPLETED' : 'PENDING',
  } as PipelineStep));
  const decision = result?.session?.decision_output;
  const risk = result?.session?.investigator_output?.risk_package;
  const completed = document?.status === 'COMPLETED';

  const labelStyle: React.CSSProperties = {
    fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5A8AB4', marginBottom: 4,
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 199, background: 'rgba(0,0,0,0.48)' }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 620, zIndex: 200,
        background: 'linear-gradient(180deg, #08131F 0%, #0A1521 100%)',
        borderLeft: '1px solid rgba(255,255,255,0.12)', boxShadow: '-16px 0 48px rgba(0,0,0,0.7)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.10)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Upload size={18} color="#4A9EFF" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#EAF4FF' }}>BDN Upload & Intelligence Ingestion</div>
            <div style={{ fontSize: 11, color: '#7FA5D3', marginTop: 2 }}>Document extraction, Exa enrichment, deterministic risk and evidence workflow</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 0, color: '#7FA5D3', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {!document && !uploading && (
            <div
              onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
              onDragLeave={(event) => { event.preventDefault(); setDragActive(false); }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault(); setDragActive(false);
                if (event.dataTransfer.files[0]) uploadFile(event.dataTransfer.files[0]);
              }}
              style={{
                padding: '52px 24px', borderRadius: 12, textAlign: 'center',
                border: `2px dashed ${dragActive ? '#4A9EFF' : 'rgba(255,255,255,0.15)'}`,
                background: dragActive ? 'rgba(74,158,255,0.07)' : 'rgba(255,255,255,0.02)',
              }}
            >
              <Upload size={40} color="#4A9EFF" style={{ margin: '0 auto 16px' }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: '#EAF4FF', marginBottom: 7 }}>Upload a real Bunker Delivery Note</div>
              <div style={{ fontSize: 11, color: '#7FA5D3', marginBottom: 18 }}>PDF with selectable text, or JPEG/PNG scan · maximum 6 MB</div>
              <label style={{ padding: '10px 20px', borderRadius: 8, cursor: 'pointer', background: 'rgba(74,158,255,0.12)', border: '1px solid rgba(74,158,255,0.28)', color: '#4A9EFF', fontSize: 12, fontWeight: 700 }}>
                Select BDN
                <input type="file" accept=".pdf,image/jpeg,image/png,image/webp,image/gif" style={{ display: 'none' }} onChange={(event) => event.target.files?.[0] && uploadFile(event.target.files[0])} />
              </label>
            </div>
          )}

          {uploading && (
            <div style={{ minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#BFD7F7' }}>
              <Loader2 size={30} className="animate-spin" color="#4A9EFF" />
              <div style={{ marginTop: 14, fontWeight: 700 }}>Encrypting and uploading document…</div>
            </div>
          )}

          {error && (
            <div style={{ marginBottom: 18, padding: 14, borderRadius: 8, color: '#FF8A8A', background: 'rgba(232,78,78,0.09)', border: '1px solid rgba(232,78,78,0.25)', display: 'flex', gap: 9 }}>
              <AlertTriangle size={16} /> <span style={{ fontSize: 11 }}>{error}</span>
            </div>
          )}

          {document && (
            <>
              <div style={{ padding: '14px 16px', borderRadius: 8, background: 'rgba(74,158,255,0.06)', border: '1px solid rgba(74,158,255,0.15)', display: 'flex', gap: 12, marginBottom: 20 }}>
                <FileText size={20} color="#4A9EFF" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#EAF4FF' }}>{document.filename}</div>
                  <div style={{ fontSize: 10, color: '#7FA5D3', marginTop: 2 }}>{(document.file_size_bytes / 1024).toFixed(1)} KB · SHA-256 secured in S3</div>
                </div>
                {completed ? <CheckCircle size={18} color="#34C98C" /> : <Loader2 size={18} className="animate-spin" color="#4A9EFF" />}
              </div>

              <div style={{ marginBottom: 22 }}>
                <div style={{ ...labelStyle, color: '#4A9EFF', marginBottom: 12 }}>Live Pipeline Status</div>
                <div style={{ padding: '15px 17px', borderRadius: 8, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {steps.map((step, index) => (
                    <div key={step.stage} style={{ display: 'flex', minHeight: 34, gap: 10 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        {step.status === 'COMPLETED' ? <CheckCircle size={15} color="#34C98C" /> :
                          step.status === 'RUNNING' ? <Loader2 size={15} className="animate-spin" color="#4A9EFF" /> :
                          step.status === 'FAILED' ? <AlertTriangle size={15} color="#E84E4E" /> :
                          <Circle size={15} color="#35546E" />}
                        {index < steps.length - 1 && <div style={{ width: 1, flex: 1, background: step.status === 'COMPLETED' ? 'rgba(52,201,140,0.35)' : 'rgba(255,255,255,0.08)', margin: '3px 0' }} />}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 650, color: step.status === 'COMPLETED' ? '#BFD7F7' : step.status === 'RUNNING' ? '#4A9EFF' : '#5A8AB4' }}>{PIPELINE_LABELS[step.stage] ?? step.stage}</span>
                    </div>
                  ))}
                </div>
              </div>

              {fields && (
                <div style={{ marginBottom: 22 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ ...labelStyle, color: '#4A9EFF' }}>Extracted BDN Data</div>
                    <div style={{ fontSize: 11, color: Number(document.parsing_confidence) >= 80 ? '#34C98C' : '#E0A020', fontWeight: 800 }}>{document.parsing_confidence}% confidence</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: 16, borderRadius: 8, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {[
                      ['BDN Reference', fields.bdn_reference], ['Vessel', fields.vessel_name],
                      ['IMO Number', fields.imo_number], ['Supplier', fields.supplier_name],
                      ['Licence', fields.licence_number], ['Barge', fields.barge_name],
                      ['Fuel Grade', fields.fuel_grade], ['Quantity', fields.quantity_mt != null ? `${fields.quantity_mt} MT` : null],
                      ['Port', fields.port], ['Delivery Date', fields.delivery_date],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <div style={labelStyle}>{label}</div>
                        <div style={{ fontSize: 11, color: value ? '#EAF4FF' : '#E0A020', fontWeight: 650 }}>{value || 'Not found'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {completed && (
                <div style={{ padding: 18, borderRadius: 9, background: 'rgba(52,201,140,0.06)', border: '1px solid rgba(52,201,140,0.2)' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#EAF4FF', marginBottom: 12 }}>Session {document.session_id} created</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 13 }}>
                    <div><div style={labelStyle}>Risk Score</div><div style={{ color: '#EAF4FF', fontWeight: 800 }}>{risk?.risk_score ?? 'Pending'}</div></div>
                    <div><div style={labelStyle}>Risk Level</div><div style={{ color: '#E0A020', fontWeight: 800 }}>{risk?.risk_category ?? 'PENDING'}</div></div>
                    <div><div style={labelStyle}>Decision</div><div style={{ color: decision?.recommendation === 'REFUSE' ? '#E84E4E' : '#4A9EFF', fontWeight: 800 }}>{decision?.recommendation ?? 'REVIEW'}</div></div>
                  </div>
                  <div style={{ fontSize: 10, color: '#7FA5D3', lineHeight: 1.5, marginBottom: 15 }}>
                    {decision?.reason} Exa intelligence is supplementary and does not modify the deterministic risk score.
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => { navigate(`/sessions/${document.session_id}`); onClose(); }} style={{ flex: 1, padding: 10, borderRadius: 7, border: '1px solid rgba(74,158,255,0.3)', background: 'rgba(74,158,255,0.12)', color: '#4A9EFF', fontWeight: 700, cursor: 'pointer' }}>Open Session</button>
                    <button onClick={reset} style={{ flex: 1, padding: 10, borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#BFD7F7', fontWeight: 700, cursor: 'pointer' }}>Upload Another</button>
                  </div>
                </div>
              )}

              {document.status === 'FAILED' && (
                <button onClick={reset} style={{ width: '100%', padding: 11, borderRadius: 7, border: '1px solid rgba(232,78,78,0.3)', background: 'rgba(232,78,78,0.08)', color: '#FF8A8A', fontWeight: 700, cursor: 'pointer' }}>
                  Processing failed: {document.error_message || document.pipeline_status?.error || 'Unknown error'} · Try another document
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
