import { useEffect, useState } from 'react';

/* ────────────────────────────────────────────────────────────────
 * useAgentOutput — fires a live LLM call for the Compliance or
 * Decision agent through the /api/agent-output Vite proxy.
 *
 * The proxy resolves the actual provider (Anthropic today, Bedrock
 * later — or any future provider added to src/lib/llm-provider.ts —
 * including a Kiro provider if/when it lands). The key never leaves
 * the Node side; the FE just consumes the resulting bullet lines.
 *
 * `enabled=false` short-circuits so we don't burn tokens on dormant
 * agents. `contextKey` is a stable string the caller derives from the
 * inputs — changing it triggers a re-run.
 * ──────────────────────────────────────────────────────────────── */

export interface AgentOutputResponse {
  ok: boolean;
  agent: 'compliance' | 'decision';
  lines: string[];
  confidence?: number;
  provider?: string;
  modelId?: string;
  error?: string;
}

export function useAgentOutput(
  agent: 'compliance' | 'decision',
  context: Record<string, unknown> | null,
  enabled: boolean,
  contextKey: string,
) {
  const [data, setData] = useState<AgentOutputResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !context) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const r = await fetch('/api/agent-output', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent, context }),
        });
        const j = (await r.json()) as AgentOutputResponse;
        if (cancelled) return;
        if (!j.ok) {
          setError(j.error ?? `agent-output ${r.status}`);
          setData(null);
        } else {
          setData(j);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // contextKey is the actual reactive trigger — re-fire only when the
    // semantic inputs change (not every render's new object reference).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent, contextKey, enabled]);

  return { output: data, loading, error };
}
