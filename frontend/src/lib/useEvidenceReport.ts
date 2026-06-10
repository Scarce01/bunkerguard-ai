import { useCallback, useEffect, useRef, useState } from 'react';
import { apiUrl } from './api';

export interface EvidenceReportSection {
  heading: string;
  body: string;
}

export interface EvidenceReport {
  report_id: string;
  session_id: string;
  generated_at?: string;
  sign_off_status?: string;
  report_hash?: string;
  // The actual schema varies — we render whatever sections come back. The
  // service returns at least these top-level keys; we render them as
  // markdown-ish blocks.
  executive_summary?: string;
  session_identification?: any;
  delivery_data?: any;
  anomalies_detected?: any[];
  risk_assessment?: any;
  recommended_actions?: string[];
  llm_explanation?: string;
  // Catch-all
  [k: string]: any;
}

export type GenStep = 'fetch' | 'mfm' | 'anomalies' | 'claude' | 'hash' | 'store';

export interface EvidenceReportState {
  status: 'idle' | 'generating' | 'complete' | 'error';
  steps: Record<GenStep, 'pending' | 'active' | 'done'>;
  report: EvidenceReport | null;
  hashedAt: string | null;
  anchorTx: string | null;
  anchored: boolean;
  error: string | null;
  storeError: string | null;
}

const INITIAL_STEPS: EvidenceReportState['steps'] = {
  fetch: 'pending',
  mfm: 'pending',
  anomalies: 'pending',
  claude: 'pending',
  hash: 'pending',
  store: 'pending',
};

const INITIAL: EvidenceReportState = {
  status: 'idle',
  steps: INITIAL_STEPS,
  report: null,
  hashedAt: null,
  anchorTx: null,
  anchored: false,
  error: null,
  storeError: null,
};

/** Generate (or fetch + show) the evidence report for one session.
 *  Manages the 6-step pipeline display with mostly-simulated timing — the real
 *  Claude call is the only step that actually waits. */
export function useEvidenceReport() {
  const [state, setState] = useState<EvidenceReportState>(INITIAL);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  useEffect(() => () => clearTimers(), []);

  const reset = useCallback(() => {
    clearTimers();
    setState(INITIAL);
  }, []);

  const generate = useCallback(async (sessionId: string) => {
    clearTimers();
    setState({ ...INITIAL, status: 'generating' });

    // Animate the first 3 prep steps quickly while the real Claude call runs.
    const tick = (step: GenStep, delay: number) => {
      timers.current.push(window.setTimeout(() => {
        setState((s) =>
          s.status === 'generating'
            ? { ...s, steps: { ...s.steps, [step]: 'done' } }
            : s,
        );
      }, delay));
    };
    setState((s) => ({ ...s, steps: { ...s.steps, fetch: 'active' } }));
    tick('fetch', 300);
    timers.current.push(window.setTimeout(() => {
      setState((s) => ({ ...s, steps: { ...s.steps, mfm: 'active' } }));
    }, 300));
    tick('mfm', 700);
    timers.current.push(window.setTimeout(() => {
      setState((s) => ({ ...s, steps: { ...s.steps, anomalies: 'active' } }));
    }, 700));
    tick('anomalies', 1100);
    timers.current.push(window.setTimeout(() => {
      setState((s) => ({ ...s, steps: { ...s.steps, claude: 'active' } }));
    }, 1100));

    try {
      const res = await fetch(apiUrl('/api/evidence-report'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        const msg = json?.error ?? `proxy ${res.status}`;
        clearTimers();
        setState((s) => ({
          ...s,
          status: 'error',
          error: msg,
          steps: { ...s.steps, claude: 'done' },
        }));
        return;
      }

      // Mark Claude done; quickly tick hash + store to "complete".
      setState((s) => ({ ...s, steps: { ...s.steps, claude: 'done', hash: 'active' } }));
      timers.current.push(window.setTimeout(() => {
        setState((s) => ({ ...s, steps: { ...s.steps, hash: 'done', store: 'active' } }));
      }, 350));
      timers.current.push(window.setTimeout(() => {
        setState({
          status: 'complete',
          steps: { fetch: 'done', mfm: 'done', anomalies: 'done', claude: 'done', hash: 'done', store: 'done' },
          report: json.report,
          hashedAt: json.hashed_at ?? null,
          anchorTx: json.anchor_tx ?? null,
          anchored: !!json.anchored,
          error: null,
          storeError: json.store_error ?? null,
        });
      }, 700));
    } catch (e: any) {
      clearTimers();
      setState((s) => ({ ...s, status: 'error', error: e?.message ?? String(e) }));
    }
  }, []);

  return { state, generate, reset };
}
