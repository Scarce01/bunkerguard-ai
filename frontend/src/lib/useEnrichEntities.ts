import { useEffect, useState } from 'react';
import type { SessionRow } from './supabase';

/* ────────────────────────────────────────────────────────────────
 * Live Exa enrichment via the new backend pipeline.
 *
 * Fires the backend `enrichment.enrich_entities(extracted)` through the
 * Vite proxy at /api/enrich. Six parallel Exa searches return structured
 * supplier / vessel / barge / port intelligence — used by the Investigator
 * agent on the Live Session page.
 *
 * `enabled=false` short-circuits so we don't spend Exa quota on low-risk
 * sessions (the Investigator threshold is risk ≥ 40).
 * ──────────────────────────────────────────────────────────────── */

export interface ExaHit {
  title: string;
  url: string;
  highlights: string[];
  published_date: string | null;
}

export interface ExaResult {
  query: string;
  hits: ExaHit[];
  fetched_at: string;
  error: string | null;
}

export interface EnrichmentResult {
  supplier: {
    supplier_name: string;
    company_profile: ExaResult;
    sanctions_check: 'POTENTIAL_MATCH_REVIEW' | 'NO_MATCH_IN_SEARCH_RESULTS';
    litigation_history: ExaResult;
    fraud_indicators: boolean;
    negative_news: ExaResult;
    compliance_findings: string[];
  };
  vessel: {
    vessel_name: string;
    imo_number: string;
    vessel_history: ExaResult;
    ownership: ExaResult;
    previous_incidents: ExaResult;
    high_risk_patterns: boolean;
  };
  barge: { barge_name: string; intelligence: ExaResult };
  port: {
    port: string;
    operational_risk: ExaResult;
    known_bunkering_disputes: ExaResult;
    regional_compliance_alerts: ExaResult;
  };
  source: 'exa';
  supplementary_only: boolean;
}

interface EnrichResponse {
  ok: boolean;
  result?: EnrichmentResult;
  error?: string;
  stderr?: string;
}

function extractedFromSession(s: SessionRow | null | undefined) {
  if (!s) return null;
  return {
    supplier_name: s.supplier_name ?? '',
    vessel_name:   s.vessel_name ?? '',
    imo_number:    s.vessel_imo ?? '',
    barge_name:    s.barge_name ?? '',
    port:          s.port ?? '',
  };
}

export function useEnrichEntities(session: SessionRow | null, enabled: boolean) {
  const [data, setData] = useState<EnrichmentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extracted = extractedFromSession(session);
  // Memo-key on the entity strings so the effect re-fires only when the
  // session row actually changes its identifying entities, not on every
  // unrelated update to risk_score / status / etc.
  const key = extracted
    ? `${extracted.supplier_name}|${extracted.vessel_name}|${extracted.imo_number}|${extracted.barge_name}|${extracted.port}`
    : '';

  useEffect(() => {
    if (!enabled || !extracted || !key) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const r = await fetch('/api/enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(extracted),
        });
        const j = (await r.json()) as EnrichResponse;
        if (cancelled) return;
        if (!j.ok || !j.result) {
          setError(j.error ?? `enrich proxy ${r.status}`);
          setData(null);
        } else {
          setData(j.result);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // key intentionally drives re-fetch; extracted is recomputed each render
    // but `key` is stable across identical entities.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return { intel: data, loading, error };
}
