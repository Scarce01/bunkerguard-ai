import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/** Compact, LLM-friendly context for the dashboard copilot. Pulls a snapshot
 *  of the worst recent anomalies + flagged suppliers + the top-risk session
 *  so the model can answer "what's happening right now" without re-querying. */
export interface CopilotContext {
  text: string;
  loading: boolean;
}

export function useCopilotContext(): CopilotContext {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function load() {
      const [anomRes, supRes, sessRes] = await Promise.all([
        supabase.from('anomalies')
          .select('anomaly_id, session_id, rule, rule_name, severity, dev_pct, description, triggered_at')
          .order('triggered_at', { ascending: false, nullsFirst: false })
          .limit(8),
        supabase.from('suppliers')
          .select('id, name, total_sessions, mismatch_count, reputation_score, flag')
          .order('reputation_score', { ascending: true })
          .limit(4),
        supabase.from('sessions')
          .select('session_id, vessel_name, supplier_name, fuel_grade, bdn_qty_mt, mfm_qty_mt, dev_pct, risk_score, risk_category, verdict, port, status, lop_issued')
          .order('risk_score', { ascending: false, nullsFirst: false })
          .limit(4),
      ]);

      const lines: string[] = [];
      lines.push('## Top risk sessions (live):');
      (sessRes.data ?? []).forEach((s: any) => {
        lines.push(`- ${s.session_id} · ${s.vessel_name} · supplier ${s.supplier_name ?? '—'} · ${s.fuel_grade ?? '—'} · BDN ${s.bdn_qty_mt ?? '—'} MT / MFM ${s.mfm_qty_mt ?? '—'} MT (Δ ${s.dev_pct ?? '—'}%) · risk ${s.risk_score ?? '—'}/${s.risk_category ?? '—'} · verdict ${s.verdict ?? '—'} · status ${s.status ?? '—'}${s.lop_issued ? ' · LoP issued' : ''}`);
      });
      lines.push('');
      lines.push('## Recent anomalies:');
      (anomRes.data ?? []).forEach((a: any) => {
        lines.push(`- ${a.session_id} · ${a.rule} ${a.rule_name} (${a.severity}) · Δ ${a.dev_pct ?? '—'}% · ${a.description ?? ''}`.slice(0, 220));
      });
      lines.push('');
      lines.push('## Flagged suppliers (worst-first):');
      (supRes.data ?? []).forEach((s: any) => {
        lines.push(`- ${s.name} · reputation ${s.reputation_score ?? '—'}/100 · ${s.mismatch_count ?? 0}/${s.total_sessions ?? 0} flagged · ${s.flag ?? '—'}`);
      });

      if (!cancelled) {
        setText(lines.join('\n'));
        setLoading(false);
      }
    }

    load().catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { text, loading };
}
