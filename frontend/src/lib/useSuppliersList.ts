import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface SupplierListRow {
  id: string;
  name: string;
  mpaLicence: string | null;
  reputationScore: number | null;
  totalSessions: number;
  mismatchCount: number;
  criticalCount: number;
  lopCount: number;
  avgDevPct: number | null;
  trend: string | null;
  flag: string | null;
}

export interface SuppliersListData {
  suppliers: SupplierListRow[];
  loading: boolean;
  error: string | null;
}

/** Fetch every supplier from Supabase ordered by reputation (worst first). */
export function useSuppliersList(): SuppliersListData {
  const [data, setData] = useState<SuppliersListData>({ suppliers: [], loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    setData((d) => ({ ...d, loading: true, error: null }));

    supabase
      .from('suppliers')
      .select('*')
      .order('reputation_score', { ascending: true, nullsFirst: true })
      .then(({ data: rows, error }) => {
        if (cancelled) return;
        if (error) {
          setData({ suppliers: [], loading: false, error: error.message });
          return;
        }
        const suppliers: SupplierListRow[] = (rows ?? []).map((s: any) => ({
          id: s.id,
          name: s.name,
          mpaLicence: s.mpa_licence,
          reputationScore: s.reputation_score,
          totalSessions: s.total_sessions ?? 0,
          mismatchCount: s.mismatch_count ?? 0,
          criticalCount: s.critical_count ?? 0,
          lopCount: s.lop_count ?? 0,
          avgDevPct: s.avg_dev_pct,
          trend: s.trend,
          flag: s.flag,
        }));
        setData({ suppliers, loading: false, error: null });
      });

    return () => { cancelled = true; };
  }, []);

  return data;
}
