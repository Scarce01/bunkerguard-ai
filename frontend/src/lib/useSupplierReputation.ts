import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface AdaptedReputationTransaction {
  id: string;
  sessionNumber: string;
  startTime: string;
  vesselName: string;
  bdnQuantity: number;
  mfmQuantity: number;
  mismatchMT: number;
  mismatchPercent: number;
  riskScore: { total: number };
  verdict: string;
}

export interface AdaptedSupplierReputation {
  supplierName: string;
  licence: string;
  status: string;
  reputationScore: number;
  previousScore: number;
  scoreChange: string;
  averageDiscrepancyPercent: number;
  disputeRate: number;
  criticalAnomalyFrequency: number;
  documentComplianceRate: number;
  trendDirection: string;
  reputationHistory: Array<{ month: string; score: number }>;
  historicalTransactions: AdaptedReputationTransaction[];
}

export interface SupplierReputationData {
  supplier: AdaptedSupplierReputation | null;
  loading: boolean;
  error: string | null;
}

/** Default to the demo's worst-reputation supplier (Gamma) when no id is given. */
export function useSupplierReputation(supplierId: string = 'SUP-003'): SupplierReputationData {
  const [data, setData] = useState<SupplierReputationData>({ supplier: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    setData((d) => ({ ...d, loading: true, error: null }));

    async function load() {
      try {
        const [supRes, txRes] = await Promise.all([
          supabase.from('suppliers').select('*').eq('id', supplierId).maybeSingle(),
          supabase.from('historical_transactions')
            .select('*')
            .eq('supplier_id', supplierId)
            .order('delivery_date', { ascending: false }),
        ]);
        if (supRes.error) throw supRes.error;
        if (txRes.error) throw txRes.error;

        const s: any = supRes.data;
        if (!s) {
          if (!cancelled) setData({ supplier: null, loading: false, error: null });
          return;
        }
        const tx: any[] = txRes.data ?? [];

        // Build a 6-month reputation history from the transactions (one point
        // per month, supplier reputation derived from rolling avg).
        const monthMap = new Map<string, { score: number; count: number }>();
        tx.forEach((t) => {
          const d = new Date(t.delivery_date);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const entry = monthMap.get(key) ?? { score: 0, count: 0 };
          entry.score += (100 - Math.min(100, t.risk_score ?? 0));
          entry.count += 1;
          monthMap.set(key, entry);
        });
        const reputationHistory = Array.from(monthMap.entries())
          .sort()
          .map(([month, agg]) => ({
            month: month.split('-')[1] + '/' + month.slice(2, 4),
            score: Math.round(agg.score / Math.max(1, agg.count)),
          }));

        const supplier: AdaptedSupplierReputation = {
          supplierName: s.name ?? '—',
          licence: s.mpa_licence ?? '—',
          status: s.flag ?? 'MONITORING',
          reputationScore: s.reputation_score ?? 0,
          previousScore: (s.reputation_score ?? 0) + 7, // demo delta
          scoreChange: `-7`,
          averageDiscrepancyPercent: Math.abs(Number(s.avg_dev_pct ?? 0)) * 100,
          disputeRate: (s.lop_count ?? 0) / Math.max(1, s.total_sessions ?? 1),
          criticalAnomalyFrequency: (s.critical_count ?? 0) / Math.max(1, s.total_sessions ?? 1),
          documentComplianceRate: 1 - ((s.mismatch_count ?? 0) / Math.max(1, s.total_sessions ?? 1)),
          trendDirection: s.trend ?? 'STABLE',
          reputationHistory: reputationHistory.length > 0 ? reputationHistory : [
            { month: 'Jan/26', score: s.reputation_score ?? 0 },
          ],
          historicalTransactions: tx.map((t) => {
            const num = (t.session_id?.match(/(\d+)$/) ?? [])[1] ?? t.session_id;
            return {
              id: t.session_id,
              sessionNumber: num,
              startTime: `${t.delivery_date}T00:00:00Z`,
              vesselName: t.vessel_name ?? '—',
              bdnQuantity: Number(t.bdn_qty_mt ?? 0),
              mfmQuantity: Number(t.mfm_qty_mt ?? 0),
              mismatchMT: Math.abs(Number(t.discrepancy_mt ?? 0)),
              mismatchPercent: Math.abs(Number(t.discrepancy_pct ?? 0)),
              riskScore: { total: Number(t.risk_score ?? 0) },
              verdict: t.verdict ?? 'PENDING',
            };
          }),
        };

        if (!cancelled) setData({ supplier, loading: false, error: null });
      } catch (e: any) {
        if (!cancelled) setData((d) => ({ ...d, loading: false, error: e?.message ?? String(e) }));
      }
    }

    load();
    return () => { cancelled = true; };
  }, [supplierId]);

  return data;
}
