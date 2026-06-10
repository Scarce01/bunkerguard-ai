export const EMISSION_FACTORS_TCO2E_PER_MT = {
  VLSFO: 3.114,
  HSFO: 3.114,
  MGO: 3.206,
  LNG: 2.75,
  'BIOFUEL BLEND': 2.1,
} as const;

export const CARBON_MONITORING_THRESHOLD_TCO2E = 5000;
export type CarbonRiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface CarbonExposure {
  fuelGrade: string;
  emissionFactor: number;
  estimatedTco2e: number;
  carbonRiskLevel: CarbonRiskLevel;
  supplierTotalTco2e: number;
  usedFallbackFuelGrade: boolean;
}

export interface CarbonSession {
  sessionId: string;
  supplier: string;
  fuel: string;
  totalFuelMt: number;
  carbonTco2e: number;
  financialExposure: number;
  riskScore: number;
  flaggedSessions: number;
  carbonRiskLevel: CarbonRiskLevel;
  date: string | null;
  estimatedFromAvailableData: boolean;
}

export interface SupplierCarbon {
  supplier: string;
  fuel: string;
  totalFuelMt: number;
  carbonTco2e: number;
  financialExposure: number;
  riskScore: number;
  flaggedSessions: number;
  carbonRiskLevel: CarbonRiskLevel;
  contributionPercent: number;
  trend: Array<{ date: string; tco2e: number }>;
  estimatedFromAvailableData: boolean;
}

export function normalizeFuelGrade(fuelGrade?: string | null): {
  fuelGrade: keyof typeof EMISSION_FACTORS_TCO2E_PER_MT;
  usedFallback: boolean;
} {
  const grade = (fuelGrade ?? '').trim().toUpperCase();
  if (grade.includes('BIO')) return { fuelGrade: 'BIOFUEL BLEND', usedFallback: false };
  if (grade.includes('LNG')) return { fuelGrade: 'LNG', usedFallback: false };
  if (grade.includes('MGO') || grade === 'DMA' || grade === 'DMZ') return { fuelGrade: 'MGO', usedFallback: false };
  if (grade.includes('HSFO') || grade.includes('HFO')) return { fuelGrade: 'HSFO', usedFallback: false };
  if (grade.includes('VLSFO')) return { fuelGrade: 'VLSFO', usedFallback: false };
  return { fuelGrade: 'VLSFO', usedFallback: true };
}

export function getCarbonRiskLevel(totalTco2e: number): CarbonRiskLevel {
  if (totalTco2e >= 10000) return 'CRITICAL';
  if (totalTco2e >= CARBON_MONITORING_THRESHOLD_TCO2E) return 'HIGH';
  if (totalTco2e >= 2500) return 'MODERATE';
  return 'LOW';
}

export function calculateCarbonExposure(
  quantityMt: number | null | undefined,
  fuelGrade?: string | null,
  supplierTotalTco2e?: number,
): CarbonExposure {
  const quantity = Math.max(0, Number(quantityMt) || 0);
  const normalized = normalizeFuelGrade(fuelGrade);
  const emissionFactor = EMISSION_FACTORS_TCO2E_PER_MT[normalized.fuelGrade];
  const estimatedTco2e = Number((quantity * emissionFactor).toFixed(3));
  const supplierTotal = Number((supplierTotalTco2e ?? estimatedTco2e).toFixed(3));
  return {
    fuelGrade: normalized.fuelGrade,
    emissionFactor,
    estimatedTco2e,
    carbonRiskLevel: getCarbonRiskLevel(supplierTotal),
    supplierTotalTco2e: supplierTotal,
    usedFallbackFuelGrade: normalized.usedFallback,
  };
}

function numberOr(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function mapCarbonSession(row: any, riskRow?: any): CarbonSession {
  const quantity = numberOr(row.total_fuel_mt, numberOr(row.mfm_qty_mt, numberOr(row.bdn_qty_mt, 0)));
  const calculated = calculateCarbonExposure(quantity, row.fuel_grade);
  const hasPersistedCarbon = row.emission_factor_tco2e_per_mt != null && row.estimated_carbon_tco2e != null;
  const factor = hasPersistedCarbon ? numberOr(row.emission_factor_tco2e_per_mt, calculated.emissionFactor) : calculated.emissionFactor;
  const carbon = hasPersistedCarbon
    ? numberOr(row.estimated_carbon_tco2e, quantity * factor)
    : Number((quantity * factor).toFixed(3));
  const riskScore = numberOr(riskRow?.final_risk_score, numberOr(row.risk_score, 0));
  const category = String(riskRow?.risk_category ?? row.risk_category ?? '').toUpperCase();
  return {
    sessionId: row.session_id ?? row.id ?? '',
    supplier: row.supplier_name ?? 'Unknown supplier',
    fuel: row.fuel_grade || calculated.fuelGrade,
    totalFuelMt: quantity,
    carbonTco2e: carbon,
    financialExposure: numberOr(
      row.financial_exposure_usd,
      numberOr(riskRow?.estimated_impact_usd, numberOr(riskRow?.estimated_financial_impact_usd, 0)),
    ),
    riskScore,
    flaggedSessions: riskScore >= 46 || category === 'HIGH' || category === 'CRITICAL' ? 1 : 0,
    carbonRiskLevel: getCarbonRiskLevel(carbon),
    date: row.delivery_date ?? row.session_date ?? row.created_at ?? null,
    estimatedFromAvailableData: !hasPersistedCarbon || calculated.usedFallbackFuelGrade,
  };
}

export function aggregateSupplierCarbon(sessions: CarbonSession[]): SupplierCarbon[] {
  const groups = new Map<string, SupplierCarbon>();
  sessions.forEach((session) => {
    const current = groups.get(session.supplier) ?? {
      supplier: session.supplier,
      fuel: session.fuel,
      totalFuelMt: 0,
      carbonTco2e: 0,
      financialExposure: 0,
      riskScore: 0,
      flaggedSessions: 0,
      carbonRiskLevel: 'LOW' as CarbonRiskLevel,
      contributionPercent: 0,
      trend: [],
      estimatedFromAvailableData: false,
    };
    current.totalFuelMt += session.totalFuelMt;
    current.carbonTco2e += session.carbonTco2e;
    current.financialExposure += session.financialExposure;
    current.riskScore = Math.max(current.riskScore, session.riskScore);
    current.flaggedSessions += session.flaggedSessions;
    current.estimatedFromAvailableData ||= session.estimatedFromAvailableData;
    if (session.date) current.trend.push({ date: session.date, tco2e: session.carbonTco2e });
    groups.set(session.supplier, current);
  });
  const total = sessions.reduce((sum, session) => sum + session.carbonTco2e, 0);
  return Array.from(groups.values())
    .map((supplier) => ({
      ...supplier,
      totalFuelMt: Number(supplier.totalFuelMt.toFixed(3)),
      carbonTco2e: Number(supplier.carbonTco2e.toFixed(3)),
      financialExposure: Number(supplier.financialExposure.toFixed(2)),
      carbonRiskLevel: getCarbonRiskLevel(supplier.carbonTco2e),
      contributionPercent: total > 0 ? Number(((supplier.carbonTco2e / total) * 100).toFixed(1)) : 0,
      trend: supplier.trend.sort((a, b) => a.date.localeCompare(b.date)),
    }))
    .sort((a, b) => b.carbonTco2e - a.carbonTco2e);
}
