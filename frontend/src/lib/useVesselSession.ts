import { useEffect, useState } from 'react';
import { supabase, SessionRow, RiskScoreRow, SupplierRow } from './supabase';

export interface VesselSessionData {
  session: SessionRow | null;
  risk: RiskScoreRow | null;
  supplier: SupplierRow | null;
  loading: boolean;
  error: string | null;
}

/** Fetch the joined session + risk + supplier data for a vessel's current
 *  Supabase session_id. Returns nulls when the vessel has no session (idle). */
export function useVesselSession(sessionId: string | undefined): VesselSessionData {
  const [data, setData] = useState<VesselSessionData>({
    session: null, risk: null, supplier: null, loading: false, error: null,
  });

  useEffect(() => {
    if (!sessionId) {
      setData({ session: null, risk: null, supplier: null, loading: false, error: null });
      return;
    }

    let cancelled = false;
    setData((d) => ({ ...d, loading: true, error: null }));

    async function load() {
      try {
        const [sessionRes, riskRes] = await Promise.all([
          supabase.from('sessions').select('*').eq('session_id', sessionId).maybeSingle(),
          supabase.from('risk_scores').select('*').eq('session_id', sessionId).maybeSingle(),
        ]);
        if (sessionRes.error) throw sessionRes.error;
        if (riskRes.error)    throw riskRes.error;

        const session = (sessionRes.data ?? null) as SessionRow | null;
        const risk = (riskRes.data ?? null) as RiskScoreRow | null;

        let supplier: SupplierRow | null = null;
        if (session?.supplier_id) {
          const sup = await supabase
            .from('suppliers')
            .select('*')
            .eq('id', session.supplier_id)
            .maybeSingle();
          if (sup.error) throw sup.error;
          supplier = (sup.data ?? null) as SupplierRow | null;
        }

        if (!cancelled) {
          setData({ session, risk, supplier, loading: false, error: null });
        }
      } catch (e: any) {
        if (!cancelled) {
          setData((d) => ({ ...d, loading: false, error: e?.message ?? String(e) }));
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [sessionId]);

  return data;
}
