import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { aggregateSupplierCarbon, getCarbonRiskLevel, mapCarbonSession, type CarbonSession, type SupplierCarbon } from './carbon';

export interface CarbonExposureData {
  sessions: CarbonSession[];
  suppliers: SupplierCarbon[];
  totalTco2e: number;
  averagePerSession: number;
  carbonRiskLevel: ReturnType<typeof getCarbonRiskLevel>;
  estimatedFromAvailableData: boolean;
  loading: boolean;
  error: string | null;
}

export function useCarbonExposure(): CarbonExposureData {
  const [data, setData] = useState<CarbonExposureData>({
    sessions: [], suppliers: [], totalTco2e: 0, averagePerSession: 0,
    carbonRiskLevel: 'LOW', estimatedFromAvailableData: false, loading: true, error: null,
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase.from('sessions').select('*').order('delivery_date', { ascending: true }),
      supabase.from('risk_scores').select('*'),
    ]).then(([sessionResult, riskResult]) => {
      if (cancelled) return;
      if (sessionResult.error || riskResult.error) {
        setData((current) => ({
          ...current, loading: false,
          error: sessionResult.error?.message ?? riskResult.error?.message ?? 'Unable to load carbon data',
        }));
        return;
      }
      const risks = new Map((riskResult.data ?? []).map((row: any) => [row.session_id, row]));
      const sessions = (sessionResult.data ?? []).map((row: any) => mapCarbonSession(row, risks.get(row.session_id)));
      const suppliers = aggregateSupplierCarbon(sessions);
      const totalTco2e = sessions.reduce((sum, row) => sum + row.carbonTco2e, 0);
      setData({
        sessions,
        suppliers,
        totalTco2e,
        averagePerSession: sessions.length ? totalTco2e / sessions.length : 0,
        carbonRiskLevel: getCarbonRiskLevel(totalTco2e),
        estimatedFromAvailableData: sessions.some((row) => row.estimatedFromAvailableData),
        loading: false,
        error: null,
      });
    });
    return () => { cancelled = true; };
  }, []);

  return data;
}
