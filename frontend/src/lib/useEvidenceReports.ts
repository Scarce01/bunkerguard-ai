import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';

/** Row from the `evidence_reports` table — see
 *  supabase/migrations/20260610_evidence_reports.sql */
export interface EvidenceReportRow {
  report_id: string;
  session_id: string;
  generated_at: string;
  report_json: any;                  // full report dict from the Python service
  sign_off_status: string;           // REFUSE_TO_SIGN | SIGN | REVIEW | ...
  report_hash: string | null;
  signing_bundle_id: string | null;
  anchor_tx: string | null;
  created_at: string;
}

/** Fetch all generated evidence reports, newest first.
 *  Returns { reports, loading, error, refresh } so the page can re-fetch
 *  after a new report is generated elsewhere. */
export function useEvidenceReports() {
  const [reports, setReports] = useState<EvidenceReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('evidence_reports')
      .select('*')
      .order('generated_at', { ascending: false });
    if (error) {
      setError(error.message);
      setReports([]);
    } else {
      setReports((data as EvidenceReportRow[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { reports, loading, error, refresh };
}

/** Fetch a single evidence report by id. Used by the viewer route. */
export function useEvidenceReport(reportId: string | null | undefined) {
  const [report, setReport] = useState<EvidenceReportRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reportId) { setReport(null); return; }
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      const { data, error } = await supabase
        .from('evidence_reports')
        .select('*')
        .eq('report_id', reportId)
        .maybeSingle();
      if (cancelled) return;
      if (error) setError(error.message);
      setReport((data as EvidenceReportRow) ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [reportId]);

  return { report, loading, error };
}
