import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { useNowClock } from './useNowClock';
import { deriveSessionLive, LIVE_DEMO_SESSIONS } from './sessionDerive';
import { useStreamCache, loopedPacketAt } from './useLiveStream';

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
  /** Live: ramped from 0 → stored mfm_qty_mt while ACTIVE; stored value
   *  verbatim once COMPLETED. Identical to the value shown on the
   *  Dashboard pin and the Live Session telemetry at the same instant. */
  mfmQuantity: number;
  mismatchMT: number;
  mismatchPercent: number;
  /** 0..100 — progress through the bunkering window. Drives the row's
   *  inline progress bar. Defined for COMPLETED (100) and not-started
   *  (0) too. */
  progressPct: number;
  /** Stored "final" values — the targets, for the audit column. */
  bdnQuantityFinal: number;
  mfmQuantityFinal: number;
  riskScore: { total: number; level: string };
}

export interface SessionsListData {
  sessions: AdaptedSessionListRow[];
  loading: boolean;
  error: string | null;
}

export function useSessionsList(): SessionsListData {
  const { now, refetchTick } = useNowClock();
  const { streams } = useStreamCache();
  // `rawRows` holds the unscaled rows so we can re-derive each second
  // without going back to Supabase. Refetch happens on refetchTick (5 s).
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  // Bumped by the `bunkerguard:sessions-changed` window event so a
  // freshly-uploaded BDN appears in the list immediately, without
  // waiting for the next 30 s NowClock tick.
  const [eventTick, setEventTick] = useState(0);

  useEffect(() => {
    const handler = () => setEventTick((n) => n + 1);
    window.addEventListener('bunkerguard:sessions-changed', handler);
    return () => window.removeEventListener('bunkerguard:sessions-changed', handler);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      try {
        const { data: rows, error } = await supabase
          .from('sessions')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        if (!cancelled) {
          setRawRows(rows ?? []);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) { setError(e?.message ?? String(e)); setLoading(false); }
      }
    }

    load();
    return () => { cancelled = true; };
    // Refetch on the shared 30 s heartbeat OR immediately when the
    // upload drawer dispatched `bunkerguard:sessions-changed` after
    // inserting a new row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetchTick, eventTick]);

  // Derive every render: every 1 s the shared clock ticks, the deriver
  // re-runs against the raw rows. Pure → memoised on (rawRows, now).
  const sessions = useMemo<AdaptedSessionListRow[]>(() => {
    return rawRows.map((s: any) => {
      const num = (s.session_id?.match(/(\d+)$/) ?? [])[1] ?? s.session_id;
      const startISO = s.start_time && s.delivery_date
        ? `${s.delivery_date}T${s.start_time}+08:00`
        : s.created_at ?? new Date(now).toISOString();

      // Looped real-data override when this session's mfm_stream is cached
      // — Sessions list row shows the SAME cumulative MT and progress %
      // the Live Session telemetry and Dashboard pin are showing at this
      // instant.
      const pkts = streams.get(s.session_id);
      const looped = pkts ? loopedPacketAt(pkts, now) : null;
      const derived = deriveSessionLive(s, now, looped ? {
        cumMt: looped.cumMt,
        progressT: looped.progressT,
      } : undefined);
      const bdnFinal = Number(s.bdn_qty_mt ?? 0);
      const mfmFinal = Number(s.mfm_qty_mt ?? 0);

      /* Demo-live override — the focus session is COMPLETED in Supabase
       * but the app presents it as actively bunkering everywhere else
       * (Live Session loops its real mfm_stream, Dashboard pin pulses,
       * Sessions filter treats it as ACTIVE). Mirror that here so the
       * status pill and the verdict pill on this row match the rest of
       * the app — no operator confusion between tabs. */
      const isDemoLive = LIVE_DEMO_SESSIONS.has(String(s.session_id));
      const displayStatus = isDemoLive ? 'ACTIVE' : (s.status ?? 'PENDING');
      const displayVerdict = isDemoLive ? 'PENDING' : (s.verdict ?? 'PENDING');

      return {
        id: s.session_id,
        sessionNumber: num,
        vesselName: s.vessel_name ?? '—',
        vesselIMO: s.vessel_imo ?? '—',
        supplierName: s.supplier_name ?? '—',
        bargeName: s.barge_name ?? '—',
        location: s.port ?? '—',
        fuelGrade: s.fuel_grade ?? '—',
        status: displayStatus,
        verdict: displayVerdict,
        startTime: startISO,
        // BDN is the contracted quantity — always show the full target.
        bdnQuantity: bdnFinal,
        // MFM measured-so-far comes from the deriver while ACTIVE, from
        // the stored row once COMPLETED.
        mfmQuantity: Number(derived.cumMt.toFixed(2)),
        mismatchMT: Math.abs(Number(derived.devMt.toFixed(2))),
        mismatchPercent: Math.abs(derived.devPct),
        progressPct: derived.progressPct,
        bdnQuantityFinal: bdnFinal,
        mfmQuantityFinal: mfmFinal,
        riskScore: {
          total: Number(s.risk_score ?? 0),
          level: s.risk_category ?? 'LOW',
        },
      } as AdaptedSessionListRow;
    });
  }, [rawRows, now, streams]);

  return { sessions, loading, error };
}
