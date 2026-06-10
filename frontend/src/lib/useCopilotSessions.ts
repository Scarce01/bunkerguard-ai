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
        setRows((data ?? []) as CopilotSession[]);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [limit]);

  return { sessions: rows, loading };
}
