import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { calculateCarbonExposure } from './carbon';

/* ─── Shape returned to SessionDetailPage ─────────────────────────────
 * Matches the mockSession structure the existing 549-line UI expects.
 * Built by joining Supabase tables: sessions + bdn_records + risk_scores
 * + mfm_stream + llm_outputs + anomalies (all by session_id).
 */

export interface AdaptedMfmReading {
  timestamp: string;
  cumulativeMass: number;
  massFlowRate: number;
  density: number;
  temperature: number;
}

export interface AdaptedSession {
  id: string;
  sessionNumber: string;
  vesselName: string;
  vesselIMO: string;
  supplierName: string;
  bargeName: string;
  status: string;
  verdict: string;
  startTime: string;
  location: string;
  fuelGrade: string;

  bdnQuantity: number;
  mfmQuantity: number;
  mismatchMT: number;
  mismatchPercent: number;
  carbonExposure: {
    quantityMt: number;
    fuelGrade: string;
    emissionFactor: number;
    estimatedTco2e: number;
    carbonRiskLevel: string;
    estimatedFromAvailableData: boolean;
  };

  riskScore: {
    total: number;
    level: string;
    quantityMismatch: number;
    dataIntegrity: number;
    regulatoryCompliance: number;
    supplierHistory: number;
  };

  bdnRecord: {
    reference: string;
    vesselName: string;
    vesselIMO: string;
    supplierName: string;
    supplierLicence: string;
    bargeName: string;
    bargeIMO: string;
    port: string;
    productGrade: string;
    sulphurPercent: number;
    density15C: number;
    flashPoint: number;
    quantityMT: number;
    sampleSeal: string;
    supplierSigned: boolean;
    officerSigned: boolean;
    validationStatus: string;
  };

  mfmStream: {
    readings: AdaptedMfmReading[];
    duration: number;
    finalQuantity: number;
    averageFlowRate: number;
    averageDensity: number;
  };
}

export interface AdaptedAnomaly {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: string;
  finding: string;
  evidence: string;
  timestamp: string;
  acknowledged: boolean;
  resolved: boolean;
}

export interface AdaptedBlockchainRecord {
  bdnHash: string;
  mfmHash: string;
  validationHash: string;
  transactionHash: string;
  blockNumber: number;
  timestamp: string;
}

export interface SessionDetailData {
  session: AdaptedSession | null;
  anomalies: AdaptedAnomaly[];
  blockchainRecord: AdaptedBlockchainRecord | null;
  loading: boolean;
  error: string | null;
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function sessionNumberFromId(sessionId: string): string {
  // SES-2026-016 → "016"
  const m = sessionId.match(/(\d+)$/);
  return m ? m[1] : sessionId;
}

export function useSessionDetail(sessionId: string | undefined): SessionDetailData {
  const [data, setData] = useState<SessionDetailData>({
    session: null,
    anomalies: [],
    blockchainRecord: null,
    loading: !!sessionId,
    error: null,
  });

  useEffect(() => {
    if (!sessionId) {
      setData({ session: null, anomalies: [], blockchainRecord: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setData((d) => ({ ...d, loading: true, error: null }));

    async function load() {
      try {
        const [sessRes, bdnRes, riskRes, mfmRes, anomRes] = await Promise.all([
          supabase.from('sessions').select('*').eq('session_id', sessionId).maybeSingle(),
          supabase.from('bdn_records').select('*').eq('session_id', sessionId).maybeSingle(),
          supabase.from('risk_scores').select('*').eq('session_id', sessionId).maybeSingle(),
          supabase.from('mfm_stream').select('*').eq('session_id', sessionId).order('seq_no', { ascending: true }),
          supabase.from('anomalies').select('*').eq('session_id', sessionId).order('triggered_at', { ascending: false }),
        ]);
        if (sessRes.error) throw sessRes.error;
        if (bdnRes.error) throw bdnRes.error;
        if (riskRes.error) throw riskRes.error;
        if (mfmRes.error) throw mfmRes.error;
        if (anomRes.error) throw anomRes.error;

        const s: any = sessRes.data;
        if (!s) {
          if (!cancelled) {
            setData({ session: null, anomalies: [], blockchainRecord: null, loading: false, error: null });
          }
          return;
        }
        const bdn: any = bdnRes.data ?? {};
        const risk: any = riskRes.data ?? {};
        const mfm: any[] = mfmRes.data ?? [];
        const anoms: any[] = anomRes.data ?? [];

        // Risk sub-scores live as `<dim>_0_100` (0..100) in Supabase. Map them
        // to the 0..40 / 0..20 ranges the page renders.
        const quantityMismatch = Math.round(((risk.anomaly_severity_0_100 ?? 0) / 100) * 40);
        const dataIntegrity = Math.round(((risk.dev_severity_0_100 ?? 0) / 100) * 20);
        const regulatoryCompliance = Math.round(((risk.doc_completeness_0_100 ?? 0) / 100) * 20);
        const supplierHistory = Math.round(((risk.supplier_history_0_100 ?? 0) / 100) * 20);

        const readings: AdaptedMfmReading[] = mfm.map((p) => ({
          timestamp: p.recorded_at,
          cumulativeMass: Number(p.cumulative_mt ?? 0),
          massFlowRate: Number(p.flow_rate_mt_h ?? 0),
          density: Number(p.density_15c ?? p.density_op ?? 0),
          temperature: Number(p.temp_c ?? 0),
        }));

        const startISO: string = s.start_time && s.delivery_date
          ? `${s.delivery_date}T${s.start_time}+08:00`
          : s.created_at ?? new Date().toISOString();
        const deliveredQuantity = Number(s.total_fuel_mt ?? s.mfm_qty_mt ?? s.bdn_qty_mt ?? 0);
        const carbon = calculateCarbonExposure(deliveredQuantity, s.fuel_grade);
        const hasPersistedCarbon = s.emission_factor_tco2e_per_mt != null && s.estimated_carbon_tco2e != null;

        const session: AdaptedSession = {
          id: s.session_id,
          sessionNumber: sessionNumberFromId(s.session_id),
          vesselName: s.vessel_name ?? '—',
          vesselIMO: s.vessel_imo ?? '—',
          supplierName: s.supplier_name ?? '—',
          bargeName: s.barge_name ?? '—',
          status: s.status ?? 'PENDING',
          verdict: s.verdict ?? 'PENDING',
          startTime: startISO,
          location: s.port ?? '—',
          fuelGrade: s.fuel_grade ?? '—',
          bdnQuantity: Number(s.bdn_qty_mt ?? 0),
          mfmQuantity: Number(s.mfm_qty_mt ?? 0),
          mismatchMT: Math.abs(Number(s.dev_mt ?? 0)),
          mismatchPercent: Math.abs(Number(s.dev_pct ?? 0)),
          carbonExposure: {
            quantityMt: deliveredQuantity,
            fuelGrade: s.fuel_grade || carbon.fuelGrade,
            emissionFactor: Number(s.emission_factor_tco2e_per_mt ?? carbon.emissionFactor),
            estimatedTco2e: Number(s.estimated_carbon_tco2e ?? carbon.estimatedTco2e),
            carbonRiskLevel: s.carbon_risk_level ?? carbon.carbonRiskLevel,
            estimatedFromAvailableData: !hasPersistedCarbon || carbon.usedFallbackFuelGrade,
          },
          riskScore: {
            total: Number(risk.final_risk_score ?? s.risk_score ?? 0),
            level: risk.risk_category ?? s.risk_category ?? 'LOW',
            quantityMismatch,
            dataIntegrity,
            regulatoryCompliance,
            supplierHistory,
          },
          bdnRecord: {
            reference: bdn.bdn_ref ?? '—',
            vesselName: bdn.vessel_name ?? s.vessel_name ?? '—',
            vesselIMO: bdn.vessel_imo ?? s.vessel_imo ?? '—',
            supplierName: bdn.supplier_name ?? s.supplier_name ?? '—',
            supplierLicence: bdn.mpa_licence ?? s.mpa_licence ?? '—',
            bargeName: bdn.barge_name ?? s.barge_name ?? '—',
            bargeIMO: bdn.barge_imo ?? s.barge_imo ?? '—',
            port: bdn.port ?? s.port ?? '—',
            productGrade: bdn.fuel_grade ?? s.fuel_grade ?? '—',
            sulphurPercent: Number(bdn.sulphur_pct ?? 0),
            density15C: Number(bdn.density_15c ?? 0),
            flashPoint: Number(bdn.flash_point_c ?? 0),
            quantityMT: Number(bdn.qty_mt ?? s.bdn_qty_mt ?? 0),
            sampleSeal: bdn.sample_seal ?? '—',
            supplierSigned: !!bdn.supp_signed,
            officerSigned: !!bdn.officer_signed,
            validationStatus: bdn.ebdn_status ?? 'PENDING',
          },
          mfmStream: {
            readings,
            duration: Math.round(Number(s.duration_h ?? 0) * 60),
            finalQuantity: readings.length > 0 ? readings[readings.length - 1].cumulativeMass : Number(s.mfm_qty_mt ?? 0),
            averageFlowRate: avg(readings.map((r) => r.massFlowRate)),
            averageDensity: avg(readings.map((r) => r.density)),
          },
        };

        const anomalies: AdaptedAnomaly[] = anoms.map((a) => ({
          id: a.anomaly_id,
          ruleId: a.rule,
          ruleName: a.rule_name ?? a.rule,
          severity: a.severity,
          finding: a.description ?? '',
          evidence: [a.source_a, a.source_b].filter(Boolean).join(' vs '),
          timestamp: a.triggered_at,
          acknowledged: !!a.acknowledged,
          resolved: !!a.resolved,
        }));

        const blockchainRecord: AdaptedBlockchainRecord | null = s.blockchain_tx
          ? {
              bdnHash: bdn.ebdn_qr_sha256 ?? '—',
              mfmHash: mfm[mfm.length - 1]?.packet_sha256 ?? '—',
              validationHash: s.evidence_sha256 ?? '—',
              transactionHash: s.blockchain_tx,
              blockNumber: 0, // not stored; show 0 / hide if zero
              timestamp: s.updated_at ?? s.created_at ?? new Date().toISOString(),
            }
          : null;

        if (!cancelled) {
          setData({ session, anomalies, blockchainRecord, loading: false, error: null });
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
