/**
 * Single source of truth for "where is this session right now?"
 *
 * Every page that displays time-varying values for an ACTIVE bunkering
 * session (Dashboard pin, Live Session telemetry, Sessions list mismatch %)
 * runs the row through this function with the shared NowClock `now`. By
 * construction the answers agree across tabs at any instant.
 *
 * For COMPLETED / HALTED / DISPUTED sessions the stored snapshot is returned
 * verbatim — the deal is done, nothing to advance.
 *
 * For ACTIVE / BUNKERING / PENDING sessions the stored `mfm_qty_mt` /
 * `dev_mt` are treated as the FINAL targets and linearly scaled by
 * `progress_t = clamp((now - started_at) / duration, 0, 1)`. Deviation %
 * is intrinsic to the meter behaviour and held constant.
 *
 * Inputs accepted are deliberately loose (any object with the usual session
 * fields) so this works on SessionRow, AdaptedSessionListRow, and the
 * ActiveDelivery shape without ceremony.
 */

export interface DeriveInput {
  session_id?: string;
  status?: string | null;
  bdn_qty_mt?: number | null;
  mfm_qty_mt?: number | null;
  dev_mt?: number | null;
  dev_pct?: number | null;
  /** Either an ISO string (created_at) or a YYYY-MM-DD + HH:MM:SS pair. */
  created_at?: string | null;
  start_time?: string | null;     // "HH:MM:SS" local
  delivery_date?: string | null;  // "YYYY-MM-DD"
  duration_h?: number | null;
}

export interface DerivedLive {
  /** Linear ramp from 0 → 1 across the session window. NaN-safe. */
  progressT: number;
  /** 0..100, derived `progressT * 100`. Rounded for display. */
  progressPct: number;
  /** Current cumulative MT — advances from 0 to stored mfm_qty_mt. */
  cumMt: number;
  /** Current deviation MT — advances from 0 to stored dev_mt. */
  devMt: number;
  /** Intrinsic deviation %, not scaled by progress. */
  devPct: number;
  /** True iff the row is in an ongoing phase (status drives the choice). */
  isOngoing: boolean;
  /** Phase label for UI badges. */
  phase: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  /** Seconds remaining until projected completion (Infinity if no duration). */
  etaRemainingSec: number;
  /** Projected completion ISO, or null if duration unknown. */
  etaIso: string | null;
}

const ONGOING_STATUSES = new Set([
  'ACTIVE', 'BUNKERING', 'IN_PROGRESS', 'PENDING',
]);

/** Session IDs that the demo always renders as "live in progress",
 *  regardless of the stored `status`. The focus demo session lives in
 *  Supabase as COMPLETED (the deal is closed historically) but we want
 *  every tab — Dashboard pin, Live Session, Sessions list — to show it
 *  perpetually mid-transfer for the demo so the time-series behaviour is
 *  visible. The shared-clock invariant still holds: whatever percentage
 *  one tab shows, the others show the same at the same instant. */
export const LIVE_DEMO_SESSIONS = new Set<string>([
  'SES-2026-016',
]);

function parseStartedAt(row: DeriveInput): number | null {
  // Prefer the explicit start_time + delivery_date pair (matches what
  // useSessionsList already computes). Fall back to created_at.
  if (row.start_time && row.delivery_date) {
    // Treat as Singapore local time (UTC+8) — anchorage operations are SGT.
    const iso = `${row.delivery_date}T${row.start_time}+08:00`;
    const t = Date.parse(iso);
    if (!Number.isNaN(t)) return t;
  }
  if (row.created_at) {
    const t = Date.parse(row.created_at);
    if (!Number.isNaN(t)) return t;
  }
  return null;
}

/** Default duration assumed when the row has no duration_h. Singapore VLSFO
 *  bunker deliveries are typically 3–6 h; 4 h is a reasonable middle. */
const DEFAULT_DURATION_H = 4;

/** Optional override from the real mfm_stream — when present the deriver
 *  uses the looped packet's cumulative_mt instead of a linear ramp. The
 *  shape of the curve then matches actual telemetry (flow varies, drive
 *  gain spikes, anomalies cluster) rather than a perfectly straight
 *  line. */
export interface DeriveOverride {
  cumMt?: number | null;
  progressT?: number | null;
}

export function deriveSessionLive(
  row: DeriveInput,
  now: number,
  override?: DeriveOverride,
): DerivedLive {
  const status   = (row.status ?? '').toUpperCase();
  const forceLive = !!row.session_id && LIVE_DEMO_SESSIONS.has(row.session_id);
  const isOngoing = forceLive || ONGOING_STATUSES.has(status);

  const startedAt = parseStartedAt(row);
  const durationH = Number(row.duration_h ?? DEFAULT_DURATION_H);
  const durationMs = durationH * 3_600_000;

  const finalMfm = Number(row.mfm_qty_mt ?? 0);
  const finalDev = Number(row.dev_mt ?? 0);
  const finalDevPct = Number(row.dev_pct ?? 0);

  // Non-ongoing: return the stored snapshot unchanged so historical rows
  // never appear to "move backwards" on the screen.
  if (!isOngoing || startedAt == null) {
    return {
      progressT: status === 'COMPLETED' ? 1 : 0,
      progressPct: status === 'COMPLETED' ? 100 : 0,
      cumMt: finalMfm,
      devMt: finalDev,
      devPct: finalDevPct,
      isOngoing: false,
      phase: status === 'COMPLETED' ? 'COMPLETED' : 'PENDING',
      etaRemainingSec: 0,
      etaIso: null,
    };
  }

  // Looping demo window: if the row's started_at is older than the
  // duration, modulo it so the progress bar perpetually advances. The
  // important invariant is that EVERY tab calls this with the same `now`,
  // so 47% on Dashboard is 47% on Live Session and on Sessions at the
  // same instant. Without this loop, demo data would freeze at 100% the
  // moment the seed clock rolled past.
  const rawElapsedMs = Math.max(0, now - startedAt);
  const elapsedMs = durationMs > 0 ? rawElapsedMs % durationMs : 0;
  const synthT = durationMs > 0
    ? Math.min(1, Math.max(0, elapsedMs / durationMs))
    : 0;

  // Prefer the real-stream override when supplied — the looped MFM packet
  // gives a curve with actual shape (flow ramps + spikes + plateau) rather
  // than a straight synthetic ramp.
  const progressT = override?.progressT != null ? override.progressT : synthT;
  const cumMt = override?.cumMt != null
    ? Number(override.cumMt)
    : finalMfm * progressT;
  // Deviation ramps to its final value in lock-step with progress —
  // matches the physical reality that the shortage accumulates with
  // the delivery, not all at once at the end.
  const devMt = finalDev * progressT;

  return {
    progressT,
    progressPct: Math.round(progressT * 100),
    cumMt,
    devMt,
    devPct: finalDevPct, // intrinsic — don't scale
    isOngoing: true,
    phase: progressT >= 1 ? 'COMPLETED' : 'IN_PROGRESS',
    etaRemainingSec: Math.max(0, (durationMs - elapsedMs) / 1000),
    etaIso: new Date(startedAt + durationMs).toISOString(),
  };
}

/** Relative-time formatter that uses the shared NowClock instead of
 *  calling Date.now() directly. Output: "12m", "3h", "in future". */
export function relativeTimeFrom(iso: string | null | undefined, now: number): string {
  if (!iso) return '—';
  const ms = now - new Date(iso).getTime();
  if (ms < 0)          return 'in future';
  if (ms < 60_000)     return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000)  return `${Math.round(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h`;
  return                  `${Math.round(ms / 86_400_000)}d`;
}
