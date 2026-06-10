import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/** Compact, LLM-friendly context for a single focused session. Pulls the
 *  session row, BDN, risk breakdown, anomalies, supplier history, and evidence
 *  signals so the copilot can answer "why is this score high / do I sign /
 *  what next" without asking which session the user means.
 *
 *  Returns an empty string while no session is focused or while loading.
 */
export interface FocusedSessionContext {
  text: string;
  loading: boolean;
}

export function useFocusedSessionContext(
  sessionId: string | null | undefined,
): FocusedSessionContext {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setText('');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    async function load() {
      const [sessRes, bdnRes, riskRes, anomRes] = await Promise.all([
        supabase.from('sessions').select('*').eq('session_id', sessionId).maybeSingle(),
        supabase.from('bdn_records').select('*').eq('session_id', sessionId).maybeSingle(),
        supabase.from('risk_scores').select('*').eq('session_id', sessionId).maybeSingle(),
        supabase.from('anomalies').select('*').eq('session_id', sessionId)
          .order('triggered_at', { ascending: false, nullsFirst: false }).limit(8),
      ]);

      const s: any = sessRes.data ?? {};
      const bdn: any = bdnRes.data ?? {};
      const risk: any = riskRes.data ?? {};
      const anoms: any[] = anomRes.data ?? [];

      const supplierName: string | null = s.supplier_name ?? null;
      let supplierRow: any = null;
      let supplierStats: { total: number; flagged: number } | null = null;
      if (supplierName) {
        const [supRes, histRes] = await Promise.all([
          supabase.from('suppliers').select('*').eq('name', supplierName).maybeSingle(),
          supabase.from('historical_transactions').select('session_id, dev_pct, risk_score')
            .eq('supplier_name', supplierName),
        ]);
        supplierRow = supRes.data ?? null;
        const hist = histRes.data ?? [];
        const flagged = hist.filter((h: any) => (h.risk_score ?? 0) >= 40).length;
        supplierStats = { total: hist.length, flagged };
      }

      const lines: string[] = [];
      lines.push(
        '## ACTIVE SESSION — default investigation target. ' +
        'Answer about this session immediately unless the user names a different session_id.',
      );
      lines.push(`- session_id: ${s.session_id ?? sessionId}`);
      lines.push(`- vessel: ${s.vessel_name ?? '—'} (IMO ${s.vessel_imo ?? '—'})`);
      lines.push(`- supplier: ${s.supplier_name ?? '—'}${bdn.mpa_licence ? ` · MPA ${bdn.mpa_licence}` : ''}`);
      lines.push(`- barge: ${s.barge_name ?? bdn.barge_name ?? '—'}`);
      lines.push(`- port: ${s.port ?? '—'} · grade: ${s.fuel_grade ?? '—'}`);
      lines.push(
        `- BDN ${s.bdn_qty_mt ?? '—'} MT vs MFM ${s.mfm_qty_mt ?? '—'} MT` +
        ` (Δ ${s.dev_mt ?? '—'} MT, ${s.dev_pct ?? '—'}%)`,
      );
      lines.push(
        `- verdict: ${s.verdict ?? '—'} · status: ${s.status ?? '—'}` +
        `${s.lop_issued ? ' · LoP issued' : ''}`,
      );

      lines.push('');
      lines.push(
        `### Risk breakdown — final ${risk.final_risk_score ?? s.risk_score ?? '—'}/100 ` +
        `(${risk.risk_category ?? s.risk_category ?? '—'})`,
      );
      lines.push(
        `- anomaly severity: ${risk.anomaly_severity_0_100 ?? '—'}/100 (weight 40)`,
      );
      lines.push(
        `- supplier history: ${risk.supplier_history_0_100 ?? '—'}/100 (weight 25)`,
      );
      lines.push(
        `- doc completeness: ${risk.doc_completeness_0_100 ?? '—'}/100 (weight 15)`,
      );
      lines.push(
        `- deviation: ${risk.dev_severity_0_100 ?? '—'}/100 (weight 20)`,
      );
      if (risk.estimated_financial_impact_usd != null) {
        lines.push(
          `- estimated financial impact: USD ${risk.estimated_financial_impact_usd}`,
        );
      }
      if (risk.recommended_verdict) {
        lines.push(`- recommended verdict: ${risk.recommended_verdict}`);
      }

      lines.push('');
      lines.push(`### Triggered anomalies (${anoms.length})`);
      if (anoms.length === 0) {
        lines.push('- none recorded for this session');
      } else {
        anoms.forEach((a: any) => {
          lines.push(
            `- ${a.rule ?? '—'} · ${a.rule_name ?? a.rule ?? '—'} (${a.severity ?? '—'})` +
            ` · Δ ${a.dev_pct ?? '—'}% · ${a.description ?? ''}`.slice(0, 260),
          );
        });
      }

      lines.push('');
      lines.push('### Supplier signals');
      if (supplierRow) {
        lines.push(
          `- ${supplierRow.name} · reputation ${supplierRow.reputation_score ?? '—'}/100` +
          `${supplierRow.flag ? ` · ${supplierRow.flag}` : ''}`,
        );
      } else if (supplierName) {
        lines.push(`- ${supplierName} (no enriched supplier record on file)`);
      }
      if (supplierStats) {
        lines.push(
          `- historical flag rate: ${supplierStats.flagged}/${supplierStats.total} sessions`,
        );
      }

      lines.push('');
      lines.push('### Evidence signals');
      lines.push(
        `- BDN: ${bdn.bdn_ref ? `ref ${bdn.bdn_ref}` : 'no reference'}` +
        ` · sigs: supplier ${bdn.supp_signed ? '✓' : '✗'} / officer ${bdn.officer_signed ? '✓' : '✗'}` +
        ` · MPA licence ${bdn.mpa_licence ? 'present' : 'missing'}`,
      );
      lines.push(
        `- Fuel spec: sulphur ${bdn.sulphur_pct ?? '—'}% · density ${bdn.density_15c ?? '—'} · flash ${bdn.flash_point_c ?? '—'}°C`,
      );
      if (s.blockchain_tx) {
        lines.push(`- Blockchain anchor: tx ${String(s.blockchain_tx).slice(0, 12)}…`);
      }
      if (s.evidence_sha256) {
        lines.push(`- Evidence hash: ${String(s.evidence_sha256).slice(0, 12)}…`);
      }

      if (!cancelled) {
        setText(lines.join('\n'));
        setLoading(false);
      }
    }

    load().catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return { text, loading };
}
