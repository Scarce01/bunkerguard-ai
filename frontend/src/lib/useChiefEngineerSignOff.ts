import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/** Polling fallback cadence — only kicks in when Supabase Realtime is
 *  disabled on `llm_outputs` (the table needs to be in the
 *  `supabase_realtime` publication for push to work). With Realtime on,
 *  this poll is redundant but harmless. */
const POLL_MS = 2_500;

/**
 * Subscribe to the latest Chief Engineer sign-off for a session.
 *
 * Sign-offs are persisted as rows in `llm_outputs` with `stage = 5` and
 * `model = 'human:chief_engineer'` — the natural extension of the
 * 4-stage AI pipeline. We pick the most-recent row (an operator can
 * approve, then later override) by ordering `id DESC LIMIT 1`.
 *
 * Updates land in two channels:
 *   1. Initial fetch on mount / when `sessionId` changes.
 *   2. Supabase Realtime push — when AgentWorkflow.handleSignOff inserts
 *      a new row, this hook re-renders within ~200 ms even if it lives
 *      on a different tab (e.g. Intelligence) than the page that wrote
 *      the sign-off (Live Session). That cross-tab live update is what
 *      makes the demo land: switch to Live Session, hit APPROVE, switch
 *      back to Intelligence, the conversation reveals the verdict.
 */
export interface ChiefEngineerSignOff {
  action: 'APPROVED' | 'OVERRIDDEN' | string;
  signer_role: string;
  signed_at: string;
  risk_score_at_sign: number | null;
  risk_category_at_sign: string | null;
  verdict_at_sign: string | null;
  raw_id: number;
}

export function useChiefEngineerSignOff(sessionId: string | null | undefined): ChiefEngineerSignOff | null {
  const [signOff, setSignOff] = useState<ChiefEngineerSignOff | null>(null);

  useEffect(() => {
    if (!sessionId) { setSignOff(null); return; }
    let cancelled = false;

    function applyRow(row: any) {
      const p = row?.payload ?? {};
      if (!p.action) return;
      setSignOff({
        action: p.action,
        signer_role: p.signer_role ?? 'Chief Engineer',
        signed_at: p.signed_at ?? row.created_at ?? new Date().toISOString(),
        risk_score_at_sign: p.risk_score_at_sign ?? null,
        risk_category_at_sign: p.risk_category_at_sign ?? null,
        verdict_at_sign: p.verdict_at_sign ?? null,
        raw_id: row.id,
      });
    }

    async function fetchLatest() {
      const { data } = await supabase
        .from('llm_outputs')
        .select('*')
        .eq('session_id', sessionId)
        .eq('stage', 5)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (data) applyRow(data);
      else setSignOff(null);   // sign-off was cleared / reset
    }

    // 1. initial fetch + 2.5 s polling — the polling is a safety net so
    //    the Intelligence tab still picks up a sign-off even when
    //    Supabase Realtime isn't enabled on `llm_outputs`. When Realtime
    //    IS enabled (channel below), the push lands within ~200 ms and
    //    the next poll is a no-op.
    fetchLatest();
    const pollId = window.setInterval(fetchLatest, POLL_MS);

    // 2. realtime push — fires when AgentWorkflow inserts a new row
    const channel = supabase
      .channel(`chief-signoff:${sessionId}`)
      .on(
        'postgres_changes' as any,
        {
          event: 'INSERT',
          schema: 'public',
          table: 'llm_outputs',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload: any) => {
          const row = payload.new;
          if (!row || row.stage !== 5) return;
          applyRow(row);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
      void supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return signOff;
}
