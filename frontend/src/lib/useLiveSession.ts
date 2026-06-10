import { useEffect, useMemo, useState } from 'react';
import { supabase, SessionRow, RiskScoreRow, AnomalyRow } from './supabase';
import { useNowClock } from './useNowClock';
import { deriveSessionLive, DerivedLive } from './sessionDerive';
import { useLiveStream } from './useLiveStream';

export interface MfmPacket {
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
  meter_serial: string | null;
  expected_mt: number | null;
  deviation_pct: number | null;
}

export interface LlmOutputRow {
  id: number;
  session_id: string;
  stage: number;
  model: string;
  prompt_tokens: number;
  output_tokens: number;
  payload: {
    summary?: string;
    concerns?: string[];
    recommended_action?: string;
    confidence?: number;
    tool_use_chain?: Array<{
      step: number;
      tool: string;
      input?: string;
      trigger?: string;
      output?: any;
    }>;
  };
}

export interface LiveSessionData {
  /** Session row with `mfm_qty_mt` / `dev_mt` / `dev_pct` overwritten by the
   *  shared-clock deriver while the session is in an ONGOING status. For
   *  COMPLETED rows it's the stored snapshot. */
  session: SessionRow | null;
  /** The raw row from Supabase, before deriver scaling. Useful for the
   *  agent workflow which needs the final targets to verify against. */
  sessionRaw: SessionRow | null;
  /** Per-tick derived live state — progress %, cum MT, ETA. */
  live: DerivedLive | null;
  risk: RiskScoreRow | null;
  anomalies: AnomalyRow[];
  mfm: MfmPacket[];
  llm: LlmOutputRow | null;
  loading: boolean;
  error: string | null;
}

/** Fetch all the joined data needed to render one Live Session view.
 *  Returns nulls/empties while loading. Re-fetches when sessionId changes. */
export function useLiveSession(sessionId: string): LiveSessionData {
  const { now, refetchTick } = useNowClock();
  // Looped mfm_stream playback — null when sessionId isn't pre-cached
  // (e.g. it's not in LIVE_DEMO_SESSIONS). The deriver gracefully falls
  // back to the linear ramp in that case.
  const stream = useLiveStream(sessionId);
  const [data, setData] = useState<LiveSessionData>({
    session: null,
    sessionRaw: null,
    live: null,
    risk: null,
    anomalies: [],
    mfm: [],
    llm: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    setData((d) => ({ ...d, loading: true, error: null }));

    async function load() {
      try {
        // llm_outputs stage 5 carries Chief Engineer sign-offs. We grab
        // the most recent row (one signer can sign + later override) and
        // derive sign_off_status from its payload — no separate sign_offs
        // table needed.
        const [sessionRes, riskRes, anomalyRes, mfmRes, llmRes, signOffRes] = await Promise.all([
          supabase.from('sessions').select('*').eq('session_id', sessionId).maybeSingle(),
          supabase.from('risk_scores').select('*').eq('session_id', sessionId).maybeSingle(),
          supabase.from('anomalies').select('*').eq('session_id', sessionId).order('triggered_at', { ascending: false }),
          supabase.from('mfm_stream').select('*').eq('session_id', sessionId).order('seq_no', { ascending: true }),
          supabase.from('llm_outputs').select('*').eq('session_id', sessionId).eq('stage', 4).maybeSingle(),
          supabase.from('llm_outputs').select('*').eq('session_id', sessionId).eq('stage', 5).order('id', { ascending: false }).limit(1).maybeSingle(),
        ]);
        if (sessionRes.error) throw sessionRes.error;
        if (riskRes.error)    throw riskRes.error;
        if (anomalyRes.error) throw anomalyRes.error;
        if (mfmRes.error)     throw mfmRes.error;
        if (llmRes.error)     throw llmRes.error;
        if (signOffRes.error) throw signOffRes.error;

        if (!cancelled) {
          // Inject the latest sign-off verdict onto the session row so
          // every reader (AgentWorkflow's initial state, the Sessions
          // list, the Dashboard pin) sees a consistent value without
          // needing to know about llm_outputs internals.
          const rawSession = (sessionRes.data ?? null) as SessionRow | null;
          const signOffAction = signOffRes.data?.payload?.action as string | undefined;
          const sessionWithSignOff = rawSession && signOffAction
            ? { ...rawSession, sign_off_status: signOffAction as any }
            : rawSession;

          setData({
            session: sessionWithSignOff,
            sessionRaw: sessionWithSignOff,
            live: null,
            risk: (riskRes.data ?? null) as RiskScoreRow | null,
            anomalies: (anomalyRes.data ?? []) as AnomalyRow[],
            mfm: (mfmRes.data ?? []) as MfmPacket[],
            llm: (llmRes.data ?? null) as LlmOutputRow | null,
            loading: false,
            error: null,
          });
        }
      } catch (e: any) {
        if (!cancelled) {
          setData((d) => ({ ...d, loading: false, error: e?.message ?? String(e) }));
        }
      }
    }

    load();
    return () => { cancelled = true; };
    // Refetch in lock-step with Dashboard / Sessions. The shared clock is
    // a slow heartbeat (30 s) — enough to pick up any edits made in the
    // SQL editor mid-demo without flooding PostgREST. The visible "live"
    // motion comes from looping the stored mfm_stream packets through the
    // 1 Hz wall clock below, not from new database writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, refetchTick]);

  // Run the shared-clock deriver on the raw row. Feed in the looped
  // stream packet's cumulative_mt as the override so the curve has REAL
  // shape (flow ramps + plateaus + the actual final shortage), not a
  // straight synthetic line.
  const derived = useMemo<DerivedLive | null>(() => {
    if (!data.sessionRaw) return null;
    return deriveSessionLive(data.sessionRaw as any, now, stream ? {
      cumMt: stream.cumMt,
      progressT: stream.progressT,
    } : undefined);
  }, [data.sessionRaw, now, stream]);

  const sessionLive = useMemo<SessionRow | null>(() => {
    if (!data.sessionRaw || !derived) return data.sessionRaw;
    if (!derived.isOngoing) return data.sessionRaw;
    return {
      ...data.sessionRaw,
      mfm_qty_mt: Number(derived.cumMt.toFixed(2)),
      dev_mt: Number(derived.devMt.toFixed(2)),
      dev_pct: derived.devPct,
    };
  }, [data.sessionRaw, derived]);

  // When the looped stream is live, replace `mfm` with the packets-so-far
  // window. The LiveSessionPage uses `mfm[mfm.length-1]` for the telemetry
  // card; that now points at the CURRENT looped packet, so flow rate,
  // density, temp, drive gain all advance with real shape.
  const mfmLive = useMemo<MfmPacket[]>(() => {
    if (!stream) return data.mfm;
    // Same shape; we just truncate to the loop position.
    return stream.upTo as unknown as MfmPacket[];
  }, [data.mfm, stream]);

  return { ...data, session: sessionLive, live: derived, mfm: mfmLive };
}
