import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface CopilotSession {
  session_id: string;
  vessel_name: string | null;
  supplier_name: string | null;
  risk_score: number | null;
  risk_category: string | null;
  verdict: string | null;
}

/** Top sessions for the copilot picker — ordered worst-first so the default
 *  selection on first open is the one the officer most likely needs. */
export function useCopilotSessions(limit = 12) {
  const [rows, setRows] = useState<CopilotSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase.from('sessions')
      .select('session_id,vessel_name,supplier_name,risk_score,risk_category,verdict')
      .order('risk_score', { ascending: false, nullsFirst: false })
      .limit(limit)
      .then(({ data }) => {
        if (cancelled) return;
        const all = (data ?? []) as CopilotSession[];
        // SES-2026-016 is the only session with the full data fan-out
        // (MFM stream, supplier history, anomalies, risk components). Pin
        // it to the top so the bar defaults to it and the first demo
        // question lands on a session where every tool returns rich data.
        const PINNED = 'SES-2026-016';
        const pinned = all.find((s) => s.session_id === PINNED);
        const rest = all.filter((s) => s.session_id !== PINNED);
        setRows(pinned ? [pinned, ...rest] : all);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [limit]);

  return { sessions: rows, loading };
}
