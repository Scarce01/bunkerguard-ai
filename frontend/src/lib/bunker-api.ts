/**
 * Client for the Python BDN-upload backend (llm/api.py).
 *
 * The hardcoded "Parsing Confidence: 98%" pill and the five always-true
 * "Vessel Identified / Supplier Identified / …" ticks used to live in the
 * upload drawer as constants. They now bind to the real Claude response
 * exposed by these endpoints — nothing is invented client-side.
 *
 * Configure with VITE_BUNKER_API_URL in .env.local; falls back to the
 * dev server on :8787 so `npm run dev` works out-of-the-box on a laptop
 * that also has the Python `uvicorn llm.api:app --port 8787` running.
 */

const API_BASE: string =
  (import.meta.env.VITE_BUNKER_API_URL as string | undefined) ??
  'http://localhost:8787';

export interface BdnChecks {
  vessel_identified: boolean;
  supplier_identified: boolean;
  quantity_extracted: boolean;
  fuel_grade_extracted: boolean;
}

export interface BdnExtracted {
  bdn_ref: string | null;
  vessel_name: string | null;
  vessel_imo: string | null;
  supplier_name: string | null;
  barge_name: string | null;
  barge_imo: string | null;
  port: string | null;
  delivery_date: string | null;
  time_start: string | null;
  time_end: string | null;
  grade: string | null;
  qty_mt: number | null;
  density_15c_kg_m3: number | null;
  viscosity_50c_cst: number | null;
  sulphur_pct: number | null;
  flash_point_c: number | null;
  biofuel_pct: number | null;
  sample_seal: string | null;
  supplier_signed: boolean | null;
  officer_signed: boolean | null;
  ebdn_status: string | null;
}

export interface UploadResponse {
  is_bdn: boolean;
  document_type: string;
  parsing_confidence: number;        // 0..1
  parsing_confidence_pct: number;    // 0..100, ready for the UI
  reasoning: string;
  red_flags: string[];
  checks: BdnChecks;
  extracted: BdnExtracted;
  usage: Record<string, unknown>;
  persisted: boolean;
}

export interface StartSessionResponse {
  session_id: string;
  status: 'PENDING' | 'BUNKERING' | 'COMPLETED' | 'HALTED';
  bdn_qty_mt: number;
  mfm_qty_mt: number;
  notes: string;
}

export interface SessionView {
  session_id: string;
  status: 'PENDING' | 'BUNKERING' | 'COMPLETED' | 'HALTED';
  vessel_name: string;
  vessel_imo: string;
  supplier_name: string;
  barge_name: string;
  port: string;
  fuel_grade: string;
  bdn_qty_mt: number;
  mfm_qty_mt: number;
  progress_pct: number;
  deviation_mt: number;
  deviation_pct: number;
  parsing_confidence: number;
  started_at: string;
  last_tick_at: string;
  notes: string;
}

/**
 * Upload a BDN document and have Claude classify + extract it.
 *
 * Returns the model's *actual* verdict. If `is_bdn` is false the caller
 * should render `reasoning` and not advance to session creation.
 */
export async function uploadBdn(
  file: File,
  options: { textHint?: string; uploadedBy?: string } = {},
): Promise<UploadResponse> {
  const form = new FormData();
  form.append('file', file);
  if (options.textHint) form.append('text_hint', options.textHint);
  if (options.uploadedBy) form.append('uploaded_by', options.uploadedBy);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/bdn/upload`, {
      method: 'POST',
      body: form,
    });
  } catch (e) {
    // Fetch only throws on network/CORS — most commonly because the Python
    // backend isn't running. Give the user the exact command to fix it.
    throw new Error(
      `Cannot reach BunkerGuard API at ${API_BASE}. ` +
      `Start it with:  uvicorn llm.api:app --port 8787  ` +
      `(and make sure ANTHROPIC_API_KEY is set).`,
    );
  }
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 500 && body.includes('ANTHROPIC_API_KEY')) {
      throw new Error('ANTHROPIC_API_KEY is not set on the backend.');
    }
    throw new Error(`Upload rejected (${res.status}): ${body || res.statusText}`);
  }
  return res.json();
}

/**
 * Promote an accepted BDN extraction into a PENDING (un-bunked) session.
 *
 * Status returned will be 'PENDING'. The first MFM tick (real meter or
 * simulator) flips it to 'BUNKERING'. Reaching the BDN target auto-flips
 * to 'COMPLETED'.
 */
export async function startBunkeringSession(
  upload: UploadResponse,
): Promise<StartSessionResponse> {
  const form = new FormData();
  form.append('is_bdn', String(upload.is_bdn));
  form.append('confidence', String(upload.parsing_confidence));
  form.append('reasoning', upload.reasoning);
  form.append('document_type', upload.document_type);
  form.append('extracted_json', JSON.stringify(upload.extracted));

  const res = await fetch(`${API_BASE}/api/bdn/start-session`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Start session failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

export async function tickSession(
  sessionId: string,
  dtSeconds = 30,
): Promise<SessionView> {
  const res = await fetch(
    `${API_BASE}/api/sessions/${sessionId}/tick?dt_seconds=${dtSeconds}`,
    { method: 'POST' },
  );
  if (!res.ok) throw new Error(`Tick failed (${res.status})`);
  return res.json();
}

export async function fetchSession(sessionId: string): Promise<SessionView> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}`);
  if (!res.ok) throw new Error(`Fetch session failed (${res.status})`);
  return res.json();
}

export const BUNKER_API_BASE = API_BASE;
