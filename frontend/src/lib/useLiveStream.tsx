import {
  createContext, useContext, useEffect, useMemo, useState, ReactNode,
} from 'react';
import { supabase } from './supabase';
import { useNowClock } from './useNowClock';
import { LIVE_DEMO_SESSIONS } from './sessionDerive';

/**
 * Live MFM-stream playback cache.
 *
 * Why this exists: the bare deriver in sessionDerive.ts ramps cumulative
 * MT linearly between 0 and the stored snapshot. That's fine for a quick
 * demo, but the user wants the time-series to come from REAL Supabase
 * data — `mfm_stream` table — so flow rate, density, temperature, drive
 * gain, and the per-packet anomaly markers all advance with shape, not
 * a straight line.
 *
 * Design: at mount (and on every 5 s refetchTick) we pre-load every
 * mfm_stream row for the sessions in LIVE_DEMO_SESSIONS — a handful of
 * sessions, a few thousand rows total. The cache keys them by session_id.
 *
 * Read path: `useLiveStream(sessionId)` maps the shared NowClock `now`
 * → an index in the packet array via a LOOPING window. Because every
 * page computes the index from the same `now`, every page sees the same
 * packet at the same instant. The 67% / 410.43 MT / 482 kg·m⁻³ values
 * the Dashboard pin shows are LITERALLY the same row of `mfm_stream` the
 * Live Session telemetry card and the Sessions list are reading.
 */

export interface StreamPacket {
  id: number;
  session_id: string;
  seq_no: number;
  recorded_at: string;
  flow_rate_mt_h: number | null;
  cumulative_mt: number | null;
  density_op: number | null;
  density_15c: number | null;
  temp_c: number | null;
  drive_gain_pct: number | null;
  tube_freq_hz: number | null;
  direction: string | null;
  status_code: number | null;
}

interface StreamCacheValue {
  /** session_id → packets sorted by seq_no asc. */
  streams: Map<string, StreamPacket[]>;
  loading: boolean;
}

const StreamCacheContext = createContext<StreamCacheValue>({
  streams: new Map(), loading: true,
});

/** Fallback loop length used when the recorded packet timespan is too
 *  small for a visibly-advancing demo (or the data is synthetic with
 *  identical timestamps). */
const FALLBACK_LOOP_MS = 4 * 60 * 60 * 1000;  // 4 hours

/** How long ONE full pass through the cached packets should take on
 *  screen, regardless of the recording's natural span.
 *
 *  Real `mfm_stream` recordings span hours of port operations — playing
 *  them back at 1:1 means each packet sits on screen for ~10 minutes and
 *  the demo audience sees nothing change. We compress the playback to a
 *  short wall-clock window so the cumulative-MT curve, flow-rate
 *  variations, drive-gain spikes, and anomaly markers all advance
 *  visibly within a single demo segment.
 *
 *  This warps the loop window; the SEQUENCE of values and the
 *  shared-clock invariant ("all three tabs read the same packet at the
 *  same instant") are unchanged. */
const PLAYBACK_DURATION_MS = 5 * 60 * 1000;  // 5 minutes per full pass

export function LiveStreamProvider({ children }: { children: ReactNode }) {
  const { refetchTick } = useNowClock();
  const [streams, setStreams] = useState<Map<string, StreamPacket[]>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ids = Array.from(LIVE_DEMO_SESSIONS);
      if (ids.length === 0) { setLoading(false); return; }
      const { data, error } = await supabase
        .from('mfm_stream')
        .select('*')
        .in('session_id', ids)
        .order('session_id', { ascending: true })
        .order('seq_no', { ascending: true });
      if (cancelled) return;
      if (error) {
        // Surface in console but don't block the rest of the app.
        // eslint-disable-next-line no-console
        console.warn('[LiveStream] failed to load mfm_stream:', error.message);
        setLoading(false);
        return;
      }
      const m = new Map<string, StreamPacket[]>();
      for (const p of (data ?? []) as StreamPacket[]) {
        const arr = m.get(p.session_id) ?? [];
        arr.push(p); m.set(p.session_id, arr);
      }
      setStreams(m);
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetchTick]);

  const value = useMemo<StreamCacheValue>(() => ({ streams, loading }), [streams, loading]);
  return <StreamCacheContext.Provider value={value}>{children}</StreamCacheContext.Provider>;
}

export interface LoopedPacket {
  packet: StreamPacket;
  /** All packets up to (and including) the current loop position — handy
   *  for charts / anomaly overlays that want history-so-far. */
  upTo: StreamPacket[];
  /** 0..1 progress through the loop window. */
  progressT: number;
  /** Cumulative MT — straight from the looped packet. */
  cumMt: number;
  /** Looped window length in ms (real span between first/last packet,
   *  or fallback). */
  durationMs: number;
  /** Index into the original packet array. */
  index: number;
}

/** Convert `now` → looped packet position. Pure / deterministic — same
 *  inputs always produce the same output, which is what makes all three
 *  tabs agree by construction. */
export function loopedPacketAt(packets: StreamPacket[], now: number): LoopedPacket | null {
  if (!packets.length) return null;

  // Wall-clock loop position: 0..1 across a fixed PLAYBACK_DURATION_MS.
  // Anchored to epoch so every page tab computes the same position from
  // the same `now`.
  const durationMs = PLAYBACK_DURATION_MS;
  const offset = ((now % durationMs) + durationMs) % durationMs;
  const progressT = offset / durationMs;

  // Map the wall-clock position to a packet index. We respect the natural
  // recording cadence: if real recorded_at timestamps span > 1 minute
  // we use them to weight position (so the curve's natural pacing is
  // preserved); otherwise fall back to even spacing across packets.
  const firstT = Date.parse(packets[0].recorded_at);
  const lastT  = Date.parse(packets[packets.length - 1].recorded_at);
  const naturalSpan = lastT - firstT;

  let idx = 0;
  if (naturalSpan > 60_000) {
    const targetRecorded = firstT + progressT * naturalSpan;
    let lo = 0, hi = packets.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      const t = Date.parse(packets[mid].recorded_at);
      if (t <= targetRecorded) { idx = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
  } else {
    idx = Math.min(packets.length - 1, Math.floor(progressT * packets.length));
  }

  return {
    packet: packets[idx],
    upTo: packets.slice(0, idx + 1),
    progressT,
    cumMt: Number(packets[idx].cumulative_mt ?? 0),
    durationMs,
    index: idx,
  };
}

/** Subscribe to the looped real-data playback for one session. Returns
 *  null if the session isn't in the LIVE_DEMO_SESSIONS cache. */
export function useLiveStream(sessionId: string | null | undefined): LoopedPacket | null {
  const { streams } = useContext(StreamCacheContext);
  const { now } = useNowClock();
  return useMemo(() => {
    if (!sessionId) return null;
    const arr = streams.get(sessionId);
    if (!arr || !arr.length) return null;
    return loopedPacketAt(arr, now);
  }, [sessionId, streams, now]);
}

/** Raw cache access — used by hooks that loop multiple sessions and
 *  don't want to call useLiveStream() in a loop (which would violate
 *  the rules of hooks). */
export function useStreamCache(): StreamCacheValue {
  return useContext(StreamCacheContext);
}
