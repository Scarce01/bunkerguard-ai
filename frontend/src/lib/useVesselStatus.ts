import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface VesselStatusRow {
  vessel_id: string;
  vessel_name: string;
  vessel_imo: string | null;
  current_status: 'IDLE' | 'LOADING' | 'STANDBY' | 'EN_ROUTE' | 'DELIVERING' | 'MAINTENANCE';
  current_terminal_id: string | null;
  berth_label: string | null;
  cargo_grade: string | null;
  cargo_loaded_mt: number | null;
  cargo_capacity_mt: number | null;
  loading_rate_m3h: number | null;
  etd_local: string | null;
  next_session_id: string | null;
  next_customer: string | null;
  last_session_id: string | null;
  crew_verified: boolean;
  mpa_tag_verified: boolean;
  recommended_action: string | null;
  last_event: string | null;
  updated_at: string;
}

/** Fetch the live operational status of a bunker vessel.
 *  Returns `null` if the vessel isn't seeded yet — the HUD falls back to
 *  in-app metadata in that case so the demo never shows a blank panel. */
export function useVesselStatus(vesselId: string | null | undefined) {
  const [status, setStatus] = useState<VesselStatusRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vesselId) { setStatus(null); return; }
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      const { data, error } = await supabase
        .from('vessel_status')
        .select('*')
        .eq('vessel_id', vesselId)
        .maybeSingle();
      if (cancelled) return;
      if (error) setError(error.message);
      setStatus((data as VesselStatusRow) ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [vesselId]);

  return { status, loading, error };
}
