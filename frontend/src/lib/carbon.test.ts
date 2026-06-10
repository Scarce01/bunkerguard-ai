import { describe, expect, it } from 'vitest';
import { aggregateSupplierCarbon, calculateCarbonExposure, mapCarbonSession } from './carbon';

describe('carbon exposure', () => {
  it('calculates VLSFO exposure', () => {
    const result = calculateCarbonExposure(500, 'VLSFO');
    expect(result.emissionFactor).toBe(3.114);
    expect(result.estimatedTco2e).toBe(1557);
  });

  it('falls back to VLSFO when fuel grade is missing', () => {
    const result = calculateCarbonExposure(100, null);
    expect(result.fuelGrade).toBe('VLSFO');
    expect(result.usedFallbackFuelGrade).toBe(true);
    expect(result.estimatedTco2e).toBe(311.4);
  });

  it('aggregates supplier carbon', () => {
    const suppliers = aggregateSupplierCarbon([
      mapCarbonSession({ session_id: '1', supplier_name: 'A', fuel_grade: 'VLSFO', mfm_qty_mt: 100 }),
      mapCarbonSession({ session_id: '2', supplier_name: 'A', fuel_grade: 'MGO', mfm_qty_mt: 50 }),
    ]);
    expect(suppliers[0].totalFuelMt).toBe(150);
    expect(suppliers[0].carbonTco2e).toBe(471.7);
  });

  it('maps persisted frontend carbon data without recomputing it', () => {
    const mapped = mapCarbonSession({
      session_id: '1',
      supplier_name: 'A',
      fuel_grade: 'LNG',
      total_fuel_mt: 200,
      emission_factor_tco2e_per_mt: 2.75,
      estimated_carbon_tco2e: 550,
      financial_exposure_usd: 1200,
      risk_score: 60,
    });
    expect(mapped.carbonTco2e).toBe(550);
    expect(mapped.financialExposure).toBe(1200);
    expect(mapped.flaggedSessions).toBe(1);
    expect(mapped.estimatedFromAvailableData).toBe(false);
  });
});
