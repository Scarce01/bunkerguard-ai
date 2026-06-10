import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import { buildReportPdf, PdfMeta, PDF_SCHEMA_VERSION } from './pdfBuilder';

/**
 * Hub for every app-generated PDF report — evidence reports, Chief
 * Engineer sign-off audits, anomaly bundles, supplier dossiers, etc.
 *
 * Storage strategy (two-tier with graceful degradation):
 *   1. PRIMARY — Supabase Storage bucket `app-reports`. Path convention:
 *        {kind_slug}/{subject_slug}-{timestamp}.pdf
 *      Metadata is encoded into Supabase Storage's `metadata` object so
 *      the list view can render the cover card without re-parsing the PDF.
 *   2. FALLBACK — `localStorage` under `bunkerguard.generatedReports`.
 *      Stores small base-64 chunks of each PDF for offline / pre-bucket
 *      demos. Each entry carries `persistedSupabase: boolean` so the UI
 *      can show which are server-backed.
 *
 * Read path: list both sources, merge by id, dedupe, sort newest first.
 *
 * Why both: the demo needs to "just work" even when the operator hasn't
 * created the Supabase Storage bucket + RLS policies yet (a hackathon
 * environment usually skips that). The moment the bucket exists, new
 * saves go straight to Supabase and the UI is unchanged.
 */

export interface GeneratedReport {
  id: string;
  kind: string;             // "Evidence Report", "Sign-Off Audit" …
  title: string;
  subtitle?: string;
  sessionId?: string;
  generatedAt: string;
  pageCount: number;
  sizeBytes: number;
  /** Object key in the bucket (when stored on Supabase). */
  path?: string;
  /** Pre-signed URL or blob URL — whichever the row was saved with. */
  url: string;
  /** True if persisted to Supabase Storage; false = localStorage fallback. */
  persistedSupabase: boolean;
  /** Per-report verdict color hint for the cover card. */
  verdict?: { label: string; color?: [number, number, number] };
  /** Cover-page meta for thumbnail rendering. */
  facts?: PdfMeta['facts'];
  hash?: string;
  /** Stamp from `pdfBuilder.PDF_SCHEMA_VERSION` at save time. Used to
   *  detect stale cached entries so the auto-backfill in the Reports
   *  tab can quietly regenerate them with the current layout. */
  schemaVersion?: string;
}

/** Re-export so callers (Reports tab backfill) can compare against the
 *  current target without importing pdfBuilder directly. */
export { PDF_SCHEMA_VERSION };

const BUCKET = 'app-reports';
const LOCAL_KEY = 'bunkerguard.generatedReports';

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

interface LocalEntry {
  id: string;
  kind: string;
  title: string;
  subtitle?: string;
  sessionId?: string;
  generatedAt: string;
  pageCount: number;
  sizeBytes: number;
  /** base64-encoded PDF bytes. */
  base64: string;
  verdict?: GeneratedReport['verdict'];
  facts?: GeneratedReport['facts'];
  hash?: string;
  schemaVersion?: string;
}

function loadLocal(): LocalEntry[] {
  try {
    const all: LocalEntry[] = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
    // Drop entries from older schema versions — those PDFs would render
    // with stale layout when clicked. Evidence Report ones get re-saved
    // by the Reports-tab backfill on next mount; Sign-Off Audits will be
    // re-created the next time the operator signs off.
    const fresh = all.filter((row) => row.schemaVersion === PDF_SCHEMA_VERSION);
    if (fresh.length !== all.length) {
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify(fresh)); }
      catch { /* quota — ignore */ }
    }
    return fresh;
  } catch { return []; }
}

function persistLocal(rows: LocalEntry[]) {
  try {
    // Cap at ~30 newest to stay under the localStorage 5 MB ceiling
    // (each PDF is typically 20–80 KB base64).
    localStorage.setItem(LOCAL_KEY, JSON.stringify(rows.slice(-30)));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[generatedReports] localStorage quota exceeded', e);
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function base64ToBlobUrl(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
}

/**
 * Generate a PDF from any in-app report payload, persist it, and return
 * the saved record. Tries Supabase Storage first; falls back to
 * localStorage on any error so the demo never breaks.
 */
export async function saveReportPdf(meta: PdfMeta): Promise<GeneratedReport> {
  const { blob, pageCount } = buildReportPdf(meta);
  const generatedAt = meta.generatedAt ?? new Date().toISOString();
  const idBase = `${slug(meta.kind)}-${slug(meta.sessionId || meta.title)}-${generatedAt.replace(/[:.]/g, '').slice(0, 15)}Z`;
  const path = `${slug(meta.kind)}/${idBase}.pdf`;

  // PRIMARY: Supabase Storage
  let persistedSupabase = false;
  let url = '';
  try {
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
      contentType: 'application/pdf',
      upsert: true,
      cacheControl: '3600',
    });
    if (error) throw error;
    // Public URL works if the bucket is public; otherwise the read hook
    // will create signed URLs on demand. For now use the public URL.
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    url = pub.publicUrl;
    persistedSupabase = true;
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.warn(`[generatedReports] Supabase Storage save failed (${e?.message ?? e}). Falling back to localStorage.`);
  }

  // FALLBACK: localStorage. Also drop any prior entry that matched the
  // same (kind, sessionId, generatedAt) — without this, every backfill
  // run would APPEND a duplicate copy of the same report and the list
  // would grow until it hit the localStorage quota.
  if (!persistedSupabase) {
    const base64 = await blobToBase64(blob);
    const rows = loadLocal().filter((row) =>
      !(row.kind === meta.kind && row.sessionId === meta.sessionId && row.generatedAt === generatedAt),
    );
    rows.push({
      id: idBase, kind: meta.kind, title: meta.title, subtitle: meta.subtitle,
      sessionId: meta.sessionId, generatedAt, pageCount, sizeBytes: blob.size,
      base64, verdict: meta.verdict, facts: meta.facts, hash: meta.hash,
      schemaVersion: PDF_SCHEMA_VERSION,
    });
    persistLocal(rows);
    url = base64ToBlobUrl(base64);
  }

  return {
    id: idBase,
    kind: meta.kind,
    title: meta.title,
    subtitle: meta.subtitle,
    sessionId: meta.sessionId,
    generatedAt,
    pageCount,
    sizeBytes: blob.size,
    path: persistedSupabase ? path : undefined,
    url,
    persistedSupabase,
    verdict: meta.verdict,
    facts: meta.facts,
    hash: meta.hash,
    schemaVersion: PDF_SCHEMA_VERSION,
  };
}

/**
 * Subscribe to the full list of generated reports — Supabase Storage
 * union localStorage, freshest first.
 */
export function useGeneratedReports() {
  const [reports, setReports] = useState<GeneratedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [bucketAvailable, setBucketAvailable] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const merged: GeneratedReport[] = [];

    // Supabase Storage — recursive list under each top-level "kind" prefix.
    try {
      const { data: top, error } = await supabase.storage.from(BUCKET).list('', { limit: 100 });
      if (error) throw error;
      setBucketAvailable(true);
      const prefixes = (top ?? []).filter((o) => o.id == null).map((o) => o.name); // folders
      for (const prefix of prefixes) {
        const { data: files } = await supabase.storage.from(BUCKET).list(prefix, { limit: 200 });
        for (const f of files ?? []) {
          if (!f.name.endsWith('.pdf')) continue;
          const path = `${prefix}/${f.name}`;
          const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
          const m = (f as any).metadata ?? {};
          merged.push({
            id: f.name.replace(/\.pdf$/, ''),
            kind: prefix.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            title: m.title ?? f.name,
            subtitle: m.subtitle,
            sessionId: m.sessionId,
            generatedAt: f.created_at ?? f.updated_at ?? new Date().toISOString(),
            pageCount: Number(m.pageCount ?? 1),
            sizeBytes: Number(m.size ?? f.metadata?.size ?? 0),
            path,
            url: pub.publicUrl,
            persistedSupabase: true,
            verdict: m.verdict,
            facts: m.facts,
            hash: m.hash,
          });
        }
      }
    } catch (e: any) {
      // Bucket missing / not configured — quiet, continue with local only.
      setBucketAvailable(false);
    }

    // localStorage fallback layer
    for (const row of loadLocal()) {
      // Don't duplicate rows that already came back from Supabase.
      if (merged.find((r) => r.id === row.id)) continue;
      merged.push({
        id: row.id,
        kind: row.kind,
        title: row.title,
        subtitle: row.subtitle,
        sessionId: row.sessionId,
        generatedAt: row.generatedAt,
        pageCount: row.pageCount,
        sizeBytes: row.sizeBytes,
        url: base64ToBlobUrl(row.base64),
        persistedSupabase: false,
        verdict: row.verdict,
        facts: row.facts,
        hash: row.hash,
        schemaVersion: row.schemaVersion,
      });
    }

    merged.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
    setReports(merged);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { reports, loading, bucketAvailable, refresh };
}
