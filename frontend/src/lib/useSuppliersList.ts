import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { aggregateSupplierCarbon, mapCarbonSession, type CarbonRiskLevel } from './carbon';

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
  totalCarbonExposure: number;
  carbonRiskLevel: CarbonRiskLevel;
  carbonEstimatedFromAvailableData: boolean;
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

    Promise.all([
      supabase.from('suppliers').select('*').order('reputation_score', { ascending: true, nullsFirst: true }),
      supabase.from('sessions').select('*'),
    ]).then(([supplierResult, sessionResult]) => {
        if (cancelled) return;
        if (supplierResult.error || sessionResult.error) {
          setData({ suppliers: [], loading: false, error: supplierResult.error?.message ?? sessionResult.error?.message ?? 'Unable to load suppliers' });
          return;
        }
        const carbonBySupplier = new Map(
          aggregateSupplierCarbon((sessionResult.data ?? []).map((row: any) => mapCarbonSession(row)))
            .map((row) => [row.supplier, row]),
        );
        const suppliers: SupplierListRow[] = (supplierResult.data ?? []).map((s: any) => {
          const carbon = carbonBySupplier.get(s.name);
          return ({
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
          totalCarbonExposure: carbon?.carbonTco2e ?? Number(s.estimated_carbon_tco2e ?? 0),
          carbonRiskLevel: carbon?.carbonRiskLevel ?? s.carbon_risk_level ?? 'LOW',
          carbonEstimatedFromAvailableData: carbon?.estimatedFromAvailableData ?? s.estimated_carbon_tco2e == null,
        });
        });
        setData({ suppliers, loading: false, error: null });
      });

    return () => { cancelled = true; };
  }, []);

  return data;
}
