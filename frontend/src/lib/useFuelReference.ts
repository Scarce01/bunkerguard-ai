import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface FuelParameter {
  grade: string;
  category: string | null;
  max_density_kg_m3: number | null;
  max_viscosity_50c_cst: number | null;
  max_sulphur_pct: number | null;
  min_flash_point_c: number | null;
  marpol_applicable: boolean;
}

export interface FuelPrice {
  grade: string;
  price_usd_per_mt: number;
  source: string | null;
  update_frequency: string | null;
  verification_status: string | null;
  recorded_at: string;
}

/** One-shot fetch of the full fuel reference tables (small + immutable). */
export function useFuelReference() {
  const [params, setParams] = useState<Map<string, FuelParameter>>(new Map());
  const [prices, setPrices] = useState<Map<string, FuelPrice>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase.from('fuel_parameters').select('*'),
      supabase.from('fuel_prices').select('*').order('recorded_at', { ascending: false }),
    ]).then(([pRes, prRes]) => {
      if (cancelled) return;
      const pMap = new Map<string, FuelParameter>();
      ((pRes.data ?? []) as any[]).forEach((row) => pMap.set(row.grade, row as FuelParameter));
      // Latest price per grade
      const prMap = new Map<string, FuelPrice>();
      ((prRes.data ?? []) as any[]).forEach((row) => {
        if (!prMap.has(row.grade)) prMap.set(row.grade, row as FuelPrice);
      });
      setParams(pMap);
      setPrices(prMap);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return {
    loading,
    params,
    prices,
    /** Look up parameter spec for a fuel grade (handles partial matches). */
    paramFor(grade: string | null | undefined): FuelParameter | undefined {
      if (!grade) return undefined;
      if (params.has(grade)) return params.get(grade);
      // partial match — e.g. "VLSFO 380" -> "VLSFO RMG 380"
      const key = [...params.keys()].find((k) =>
        k.toLowerCase().includes(grade.toLowerCase().slice(0, 6)) ||
        grade.toLowerCase().includes(k.toLowerCase().slice(0, 6)),
      );
      return key ? params.get(key) : undefined;
    },
    priceFor(grade: string | null | undefined): FuelPrice | undefined {
      if (!grade) return undefined;
      if (prices.has(grade)) return prices.get(grade);
      const key = [...prices.keys()].find((k) =>
        k.toLowerCase().includes(grade.toLowerCase().slice(0, 6)) ||
        grade.toLowerCase().includes(k.toLowerCase().slice(0, 6)),
      );
      return key ? prices.get(key) : undefined;
    },
  };
}
