import { useEffect, useState } from 'react';
import { supabase, AnomalyRow, SupplierRow, SessionRow } from './supabase';
import { useNowClock } from './useNowClock';
import { relativeTimeFrom, LIVE_DEMO_SESSIONS } from './sessionDerive';

/**
 * Pulls the data the Dashboard's Critical Events and Supplier Watchlist
 * panels need. When a terminal context is set, filters anomalies down to
 * sessions docked at that terminal's port name; otherwise returns the
 * top fleet-wide events.
 *
 * Returns `null` for each field while loading so callers can fall back to
 * the existing mock data and avoid a flash of empty panels.
 */
export interface CriticalEvent {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  label: string;
  detail: string;
  time: string;        // relative, e.g. "12m", "3h"
  color: string;
}

export interface SupplierRowVM {
  name: string;
  risk: number;
  sessions: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  color: string;
}

export interface DashboardKPIs {
  criticalAlerts: number;
  activeSessions: number;
  supplierFlags: number;
  lossPrevented: string;   // formatted "$11K" etc
}

interface DashboardData {
  events: CriticalEvent[] | null;
  suppliers: SupplierRowVM[] | null;
  kpis: DashboardKPIs | null;
  loading: boolean;
  error: string | null;
}

// `relativeTime` now lives in sessionDerive.ts so every page formats
// elapsed-time strings against the same shared `now`.

function severityColor(sev: string): string {
  switch (sev) {
    case 'CRITICAL': return '#FF5656';
    case 'HIGH':     return '#FFA940';
    case 'MEDIUM':   return '#4A9EFF';
    case 'LOW':      return '#00D98E';
    default:         return '#7FA5D3';
  }
}

function supplierSeverityFromScore(score: number): { sev: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'; color: string } {
  if (score < 40)   return { sev: 'CRITICAL', color: '#FF5656' };
  if (score < 60)   return { sev: 'HIGH',     color: '#FFA940' };
  if (score < 80)   return { sev: 'MEDIUM',   color: '#4A9EFF' };
  return                { sev: 'LOW',      color: '#00D98E' };
}

export function useLiveDashboard(terminalPortNames?: string[]): DashboardData {
  const [events, setEvents] = useState<CriticalEvent[] | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierRowVM[] | null>(null);
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stringify so the effect doesn't refire on identical array references
  const portsKey = (terminalPortNames ?? []).join('|');
  // Shared clock — refetchTick advances every 5 s in lock-step across pages,
  // so the Dashboard's KPI strip pulls a fresh count at the same instant the
  // Sessions and Live Session pages reload their data.
  const { now, refetchTick } = useNowClock();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      try {
        // ─── Anomalies (joined to sessions for vessel + port context) ─────
        let anomalyQ = supabase
          .from('anomalies')
          .select(`
            anomaly_id, rule, rule_name, severity, triggered_at,
            description, dev_pct,
            session_id,
            sessions!inner ( session_id, vessel_name, port )
          `)
          .order('triggered_at', { ascending: false, nullsFirst: false })
          .limit(8);

        if (terminalPortNames && terminalPortNames.length > 0) {
          // Filter to anomalies whose session.port matches any of the
          // provided port-name fragments (LIKE %fragment%).
          const orExpr = terminalPortNames
            .map((p) => `sessions.port.ilike.%${p}%`)
            .join(',');
          anomalyQ = anomalyQ.or(orExpr);
        }

        const { data: anomalies, error: aErr } = await anomalyQ;
        if (aErr) throw aErr;

        const mappedEvents: CriticalEvent[] = (anomalies ?? []).map((a: any) => {
          const sev = (a.severity as string) || 'MEDIUM';
          const sess = a.sessions;
          return {
            severity: sev as CriticalEvent['severity'],
            label: a.rule_name || a.rule || 'Anomaly detected',
            detail: `${a.session_id ?? ''} · ${sess?.vessel_name ?? 'Unknown vessel'}`,
            time: relativeTimeFrom(a.triggered_at, now),
            color: severityColor(sev),
          };
        });

        // ─── Suppliers (network-wide watchlist, ordered by lowest reputation) ─
        const { data: suppliersData, error: sErr } = await supabase
          .from('suppliers')
          .select('id, name, total_sessions, mismatch_count, reputation_score')
          .order('reputation_score', { ascending: true, nullsFirst: false })
          .limit(6);
        if (sErr) throw sErr;

        const mappedSuppliers: SupplierRowVM[] = (suppliersData ?? []).map((s: any) => {
          const score = s.reputation_score ?? 0;
          const { sev, color } = supplierSeverityFromScore(score);
          return {
            name: s.name,
            risk: score,
            sessions: `${s.mismatch_count ?? 0}/${s.total_sessions ?? 0}`,
            severity: sev,
            color,
          };
        });

        // ─── KPIs (fleet-wide counts) ─────────────────────────────────
        const [criticalCountRes, activeCountRes, flaggedSupRes, riskRes] = await Promise.all([
          supabase.from('sessions').select('session_id', { count: 'exact', head: true }).eq('risk_category', 'CRITICAL'),
          /* Real enum value is ACTIVE, not BUNKERING — the dashboard
           * KPI used to report 0 because no row ever had 'BUNKERING'.
           * After this query the demo-live sessions are folded in below
           * (some are stored as COMPLETED but the app presents them as
           * actively bunkering). */
          supabase.from('sessions').select('session_id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
          supabase.from('suppliers').select('id', { count: 'exact', head: true }).lt('reputation_score', 70),
          supabase.from('risk_scores').select('estimated_impact_usd'),
        ]);
        const lossSum = ((riskRes.data ?? []) as any[])
          .reduce((acc, r) => acc + Number(r.estimated_impact_usd ?? 0), 0);
        const lossPretty = lossSum >= 1_000_000
          ? `$${(lossSum / 1_000_000).toFixed(1)}M`
          : lossSum >= 1_000
          ? `$${Math.round(lossSum / 1_000)}K`
          : `$${Math.round(lossSum)}`;
        /* Fold demo-live sessions that are stored as COMPLETED into the
         * Active count so the KPI matches what every other tab shows
         * (Live Session, Sessions list, dashboard pin). Skip rows already
         * counted as ACTIVE in Supabase to avoid double-counting. */
        let demoLiveAddon = 0;
        if (LIVE_DEMO_SESSIONS.size > 0) {
          const { data: demoRows } = await supabase
            .from('sessions')
            .select('session_id,status')
            .in('session_id', Array.from(LIVE_DEMO_SESSIONS));
          for (const row of (demoRows ?? []) as any[]) {
            if (row.status !== 'ACTIVE') demoLiveAddon += 1;
          }
        }
        const mappedKpis: DashboardKPIs = {
          criticalAlerts: criticalCountRes.count ?? 0,
          activeSessions: (activeCountRes.count ?? 0) + demoLiveAddon,
          supplierFlags:  flaggedSupRes.count ?? 0,
          lossPrevented:  lossPretty,
        };

        if (!cancelled) {
          setEvents(mappedEvents);
          setSuppliers(mappedSuppliers);
          setKpis(mappedKpis);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? String(e));
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
    // refetchTick re-runs the fetch every 5 s in lock-step with the other
    // hooks. `now` is intentionally NOT a dep — we don't want a fetch every
    // 1 s; we want labels (relative time) to re-render on every wall tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portsKey, refetchTick]);

  return { events, suppliers, kpis, loading, error };
}

/** Quick utility to fetch the most recent N sessions (used elsewhere later). */
export async function fetchRecentSessions(limit = 5): Promise<SessionRow[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as SessionRow[];
}
