import { createContext, useContext, useEffect, useState, useMemo, ReactNode } from 'react';

/**
 * Single synchronised "now" clock for the whole app.
 *
 * Why: Dashboard, Live Session, and Sessions tabs all derive time-varying
 * values (progress %, cumulative MT, ETA, relative timestamps). Before this
 * context, each page mounted its own `Date.now()` snapshot and they drifted
 * apart by hundreds of milliseconds — at any given second the same active
 * session could read 67% on Dashboard, 68% on Live Session, and 66% on
 * Sessions. With one shared tick, every consumer renders the same instant.
 *
 * Cadence:
 *   - `now`     — 1 Hz tick, drives wall-clock displays + relative times
 *   - `refetchTick` — coarser tick (5 s by default) used as a useEffect dep
 *     to re-run Supabase queries. Pages that subscribe to `refetchTick`
 *     refetch together, so the underlying snapshot they share is updated
 *     in lock-step.
 */
interface NowClockValue {
  now: number;          // ms since epoch, updated every 1 s
  refetchTick: number;  // monotonic counter, increments every REFETCH_MS
  refetchMs: number;    // for callers that need the cadence (e.g. to label)
}

/* Polling cadence — used only as a fallback. Supabase Realtime push is the
 * primary channel for sessions / risk / anomalies / mfm updates (sub-200ms
 * latency). This refetch tick still runs in case Realtime is disabled on a
 * table or the WebSocket drops; 30 s is enough to catch a stale view
 * without flooding PostgREST. */
const REFETCH_MS = 30_000;

const NowClockContext = createContext<NowClockValue | null>(null);

export function NowClockProvider({ children }: { children: ReactNode }) {
  const [now, setNow]                 = useState<number>(() => Date.now());
  const [refetchTick, setRefetchTick] = useState<number>(0);

  useEffect(() => {
    const wall = setInterval(() => setNow(Date.now()), 1000);
    const fetch = setInterval(() => setRefetchTick((n) => n + 1), REFETCH_MS);
    return () => { clearInterval(wall); clearInterval(fetch); };
  }, []);

  const value = useMemo<NowClockValue>(
    () => ({ now, refetchTick, refetchMs: REFETCH_MS }),
    [now, refetchTick],
  );

  return <NowClockContext.Provider value={value}>{children}</NowClockContext.Provider>;
}

/** Subscribe to the synchronised clock. Safe to call outside the provider —
 *  falls back to a static `Date.now()` snapshot + tick=0 so isolated tests
 *  don't crash. */
export function useNowClock(): NowClockValue {
  const ctx = useContext(NowClockContext);
  if (ctx) return ctx;
  // Fallback: static snapshot so unwrapped components don't crash.
  return { now: Date.now(), refetchTick: 0, refetchMs: REFETCH_MS };
}

/** Sub-hook for components that only want the wall clock (no rerender on
 *  refetchTick changes). */
export function useNow(): number {
  return useNowClock().now;
}

/** Sub-hook for hooks that only need the refetch tick — useful as a
 *  useEffect dependency to refetch Supabase in lockstep across pages. */
export function useRefetchTick(): number {
  return useNowClock().refetchTick;
}

/** Compact UI badge showing the synchronised clock + refetch heartbeat.
 *  Mount in the TopBar so the operator can see all panels are aligned. */
export function SyncBadge() {
  const { now, refetchTick, refetchMs } = useNowClock();
  const t = new Date(now);
  const hh = String(t.getHours()).padStart(2, '0');
  const mm = String(t.getMinutes()).padStart(2, '0');
  const ss = String(t.getSeconds()).padStart(2, '0');
  return (
    <div
      title={`Synced clock — all panels refetch every ${refetchMs / 1000}s (tick #${refetchTick})`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 9px',
        background: 'rgba(46,168,255,0.07)',
        border: '1px solid rgba(46,168,255,0.22)',
        borderRadius: 4,
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: '#2EA8FF',
        boxShadow: '0 0 6px #2EA8FF',
        animation: 'livePulse 2s ease-in-out infinite',
      }} />
      <span style={{ fontSize: 9, fontWeight: 700, color: '#7FA5D3', letterSpacing: 1.2 }}>SYNC</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#E5F2FF' }}>{hh}:{mm}:{ss}</span>
    </div>
  );
}
