import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/** Lightweight row shape — matches the subset of mockSession fields the
 *  SessionsPage table uses. Risk subscores are derived from sessions.risk_score
 *  alone (we don't need the full 4-dim breakdown on the list view). */
export interface AdaptedSessionListRow {
  id: string;
  sessionNumber: string;
  vesselName: string;
  vesselIMO: string;
  supplierName: string;
  bargeName: string;
  location: string;
  fuelGrade: string;
  status: string;
  verdict: string;
  startTime: string;
  bdnQuantity: number;
  mfmQuantity: number;
  mismatchMT: number;
  mismatchPercent: number;
  riskScore: { total: number; level: string };
}

export interface SessionsListData {
  sessions: AdaptedSessionListRow[];
  loading: boolean;
  error: string | null;
}

export function useSessionsList(): SessionsListData {
  const [data, setData] = useState<SessionsListData>({ sessions: [], loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    setData((d) => ({ ...d, loading: true, error: null }));

    async function load() {
      try {
        const { data: rows, error } = await supabase
          .from('sessions')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;

        const sessions: AdaptedSessionListRow[] = (rows ?? []).map((s: any) => {
          const num = (s.session_id?.match(/(\d+)$/) ?? [])[1] ?? s.session_id;
          const startISO = s.start_time && s.delivery_date
            ? `${s.delivery_date}T${s.start_time}+08:00`
            : s.created_at ?? new Date().toISOString();
          return {
            id: s.session_id,
            sessionNumber: num,
            vesselName: s.vessel_name ?? '—',
            vesselIMO: s.vessel_imo ?? '—',
            supplierName: s.supplier_name ?? '—',
            bargeName: s.barge_name ?? '—',
            location: s.port ?? '—',
            fuelGrade: s.fuel_grade ?? '—',
            status: s.status ?? 'PENDING',
            verdict: s.verdict ?? 'PENDING',
            startTime: startISO,
            bdnQuantity: Number(s.bdn_qty_mt ?? 0),
            mfmQuantity: Number(s.mfm_qty_mt ?? 0),
            mismatchMT: Math.abs(Number(s.dev_mt ?? 0)),
            mismatchPercent: Math.abs(Number(s.dev_pct ?? 0)),
            riskScore: {
              total: Number(s.risk_score ?? 0),
              level: s.risk_category ?? 'LOW',
            },
          };
        });

        if (!cancelled) setData({ sessions, loading: false, error: null });
      } catch (e: any) {
        if (!cancelled) setData((d) => ({ ...d, loading: false, error: e?.message ?? String(e) }));
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return data;
}
