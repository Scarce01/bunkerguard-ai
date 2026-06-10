import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/** Sessions that are currently transferring fuel offshore (between barge + ship).
 *  Distinct from sessions parked at a terminal — those appear via vessel_status.
 *
 *  Anchorage coordinates aren't on the `sessions` row (the demo schema
 *  doesn't have lat/lng), so we derive them from `port` text. Real production
 *  would either store lat/lng directly on `sessions` or join the
 *  `anchorage_geofences` table by anchorage_id. */
export interface ActiveDelivery {
  session_id: string;
  vessel_name: string;
  barge_name: string | null;
  supplier_name: string | null;
  port: string | null;
  fuel_grade: string | null;
  bdn_qty_mt: number | null;
  mfm_qty_mt: number | null;
  dev_pct: number | null;
  risk_score: number | null;
  risk_category: string | null;
  verdict: string | null;
  lng: number;
  lat: number;
}

/* Singapore bunkering anchorage coordinates — used to place a delivery pin
 * offshore on the dashboard map. Coordinates are approximate centres of the
 * MPA-published anchorage polygons. */
const ANCHORAGE_COORDS: Record<string, [number, number]> = {
  'eastern':  [103.965, 1.205],   // Eastern Bunkering Anchorage A
  'western':  [103.665, 1.180],   // Western Bunkering Anchorage
  'sudong':   [103.695, 1.205],   // Sudong Bunkering Anchorage
  'changi':   [104.025, 1.295],   // Changi General Purpose
  'jurong':   [103.685, 1.215],   // Jurong Anchorage (offshore, south of Jurong island)
  'sembawang':[103.835, 1.460],   // Sembawang
  'pasir':    [103.965, 1.295],   // Pasir Panjang
};

function deriveCoords(port: string | null | undefined): [number, number] {
  if (!port) return [103.83, 1.21];   // central SG fallback
  const p = port.toLowerCase();
  for (const [key, c] of Object.entries(ANCHORAGE_COORDS)) {
    if (p.includes(key)) return c;
  }
  return [103.83, 1.21];
}

/** Demo target — the canonical live session featured on the Live Session
 *  page. Keep the dashboard pin in lock-step with it so the operator sees
 *  the same vessel / barge / supplier / quantities in both places. */
const FOCUS_SESSION_ID = 'SES-2026-016';

/** Returns sessions that should appear as live-delivery pins on the
 *  dashboard map. We prioritise the focus demo session (so the dashboard
 *  pin matches the Live Session page exactly), then fall back to any other
 *  ACTIVE / HALTED rows. */
export function useActiveDeliveries() {
  const [deliveries, setDeliveries] = useState<ActiveDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // First, fetch the focus session by ID — this is the one the Live
      // Session page locks to, and we want the dashboard pin to mirror it.
      const focusRes = await supabase
        .from('sessions')
        .select('*')
        .eq('session_id', FOCUS_SESSION_ID)
        .limit(1);

      // Then pull any other operationally-live sessions to show alongside.
      // `status` is a Postgres enum (session_status_type). Adding values not
      // in the enum makes the whole query fail with 22P02, so we stick to the
      // ones the demo schema actually defines: ACTIVE (live transfer) +
      // HALTED (paused mid-transfer — still operationally "in flight").
      const { data: otherData, error } = await supabase
        .from('sessions')
        .select('*')
        .in('status', ['ACTIVE', 'HALTED'])
        .neq('session_id', FOCUS_SESSION_ID)
        .order('created_at', { ascending: false });
      // Splice focus row to the front so it renders as the primary live pin.
      const data = [...(focusRes.data ?? []), ...(otherData ?? [])];
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setDeliveries([]);
      } else {
        const rows = (data ?? []).map((row: any) => {
          const [lng, lat] = deriveCoords(row.port);
          return {
            session_id:    row.session_id,
            vessel_name:   row.vessel_name ?? '—',
            barge_name:    row.barge_name,
            supplier_name: row.supplier_name,
            port:          row.port,
            fuel_grade:    row.fuel_grade,
            bdn_qty_mt:    row.bdn_qty_mt,
            mfm_qty_mt:    row.mfm_qty_mt,
            dev_pct:       row.dev_pct,
            risk_score:    row.risk_score,
            risk_category: row.risk_category,
            verdict:       row.verdict,
            lng, lat,
          } as ActiveDelivery;
        });
        setDeliveries(rows);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { deliveries, loading, error };
}
