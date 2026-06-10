import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { useNowClock } from './useNowClock';
import { deriveSessionLive } from './sessionDerive';
import { useStreamCache, loopedPacketAt } from './useLiveStream';

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
  /** Cumulative MFM-measured volume so far — advances each tick from the
   *  shared clock. Matches what Live Session and Sessions show. */
  mfm_qty_mt: number | null;
  dev_pct: number | null;
  /** 0..100 progress through the bunkering window. */
  progress_pct: number;
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
 *  dashboard map.
 *
 *  Strict policy: only the focus demo session is returned, so the dashboard
 *  pin can never drift away from what the Live Session tab shows. Clicking
 *  the pin therefore always navigates to the exact same Supabase row that
 *  the sidebar's "Live Session" link opens — identical vessel, barge,
 *  supplier, BDN/MFM quantities, risk, anomalies, AI verdict. */
export function useActiveDeliveries() {
  const { now, refetchTick } = useNowClock();
  const { streams } = useStreamCache();
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Demo strategy: fetch the focus row ONCE from Supabase, then let the
   * 1 Hz wall clock + `loopedPacketAt()` replay the mock MFM stream below.
   * That replay is what produces the visible "live" motion on the
   * dashboard pin and Live Session page — cumulative MT ticking up, flow
   * rate flickering, progress % advancing — without ever needing a new
   * row from the database.
   *
   * The shared 30 s refetchTick still acts as a heartbeat in case the
   * underlying row gets edited mid-demo (e.g. a manual UPDATE in the SQL
   * editor) — cheap insurance, no flicker. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('session_id', FOCUS_SESSION_ID)
        .limit(1);
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setRawRows([]);
      } else {
        setRawRows(data ?? []);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetchTick]);

  // Apply the shared-clock deriver every render — the dashboard pin's
  // mfm_qty_mt, dev_pct, and progress_pct will read identically to what
  // the Live Session telemetry and Sessions list show at the same instant.
  const deliveries = useMemo<ActiveDelivery[]>(() => {
    return rawRows.map((row: any) => {
      const [lng, lat] = deriveCoords(row.port);
      // Real-stream override when this session has a cached mfm_stream —
      // pin tooltip reads the SAME looped packet the Live Session tab is
      // showing at this same instant.
      const pkts = streams.get(row.session_id);
      const looped = pkts ? loopedPacketAt(pkts, now) : null;
      const derived = deriveSessionLive(row, now, looped ? {
        cumMt: looped.cumMt,
        progressT: looped.progressT,
      } : undefined);
      return {
        session_id:    row.session_id,
        vessel_name:   row.vessel_name ?? '—',
        barge_name:    row.barge_name,
        supplier_name: row.supplier_name,
        port:          row.port,
        fuel_grade:    row.fuel_grade,
        bdn_qty_mt:    row.bdn_qty_mt,
        mfm_qty_mt:    Number(derived.cumMt.toFixed(2)),
        dev_pct:       derived.devPct,
        progress_pct:  derived.progressPct,
        risk_score:    row.risk_score,
        risk_category: row.risk_category,
        verdict:       row.verdict,
        lng, lat,
      } as ActiveDelivery;
    });
  }, [rawRows, now, streams]);

  return { deliveries, loading, error };
}
