import { useEffect, useState } from 'react';
import { supabase, SessionRow, RiskScoreRow, AnomalyRow } from './supabase';

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
  session: SessionRow | null;
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
  const [data, setData] = useState<LiveSessionData>({
    session: null,
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
        const [sessionRes, riskRes, anomalyRes, mfmRes, llmRes] = await Promise.all([
          supabase.from('sessions').select('*').eq('session_id', sessionId).maybeSingle(),
          supabase.from('risk_scores').select('*').eq('session_id', sessionId).maybeSingle(),
          supabase.from('anomalies').select('*').eq('session_id', sessionId).order('triggered_at', { ascending: false }),
          supabase.from('mfm_stream').select('*').eq('session_id', sessionId).order('seq_no', { ascending: true }),
          supabase.from('llm_outputs').select('*').eq('session_id', sessionId).eq('stage', 4).maybeSingle(),
        ]);
        if (sessionRes.error) throw sessionRes.error;
        if (riskRes.error)    throw riskRes.error;
        if (anomalyRes.error) throw anomalyRes.error;
        if (mfmRes.error)     throw mfmRes.error;
        if (llmRes.error)     throw llmRes.error;

        if (!cancelled) {
          setData({
            session: (sessionRes.data ?? null) as SessionRow | null,
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
  }, [sessionId]);

  return data;
}
