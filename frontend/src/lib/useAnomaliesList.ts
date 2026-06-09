import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/** Shape used by AnomalyMonitorPage — matches mockAnomalies row spec. */
export interface AdaptedAnomalyListRow {
  id: string;
  sessionId: string;
  ruleId: string;
  ruleName: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
  finding: string;
  evidence: string;
  timestamp: string;
  acknowledged: boolean;
  resolved: boolean;
  sourceA?: string;
  sourceB?: string;
  deviation?: string;
}

export interface AnomaliesListData {
  anomalies: AdaptedAnomalyListRow[];
  loading: boolean;
  error: string | null;
}

export function useAnomaliesList(): AnomaliesListData {
  const [data, setData] = useState<AnomaliesListData>({ anomalies: [], loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    setData((d) => ({ ...d, loading: true, error: null }));

    async function load() {
      try {
        const { data: rows, error } = await supabase
          .from('anomalies')
          .select('*')
          .order('triggered_at', { ascending: false, nullsFirst: false });
        if (error) throw error;

        const anomalies: AdaptedAnomalyListRow[] = (rows ?? []).map((a: any) => ({
          id: a.anomaly_id,
          sessionId: a.session_id?.replace(/^SES-/, '') ?? '—',
          ruleId: a.rule,
          ruleName: a.rule_name ?? a.rule,
          severity: a.severity,
          finding: a.rule_name ?? a.description ?? '',
          evidence: a.description ?? '',
          timestamp: a.triggered_at,
          acknowledged: !!a.acknowledged,
          resolved: !!a.resolved,
          sourceA: a.source_a,
          sourceB: a.source_b,
          deviation:
            a.dev_value != null
              ? `${a.dev_value} ${a.unit ?? ''}${a.dev_pct != null ? ` (${a.dev_pct}%)` : ''}`.trim()
              : undefined,
        }));

        if (!cancelled) setData({ anomalies, loading: false, error: null });
      } catch (e: any) {
        if (!cancelled) setData((d) => ({ ...d, loading: false, error: e?.message ?? String(e) }));
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return data;
}
