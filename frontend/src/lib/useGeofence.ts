import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface GeofenceRow {
  id: number;
  anchorage_name: string;
  latitude_n: number;
  longitude_e: number;
  vtis_sector: string | null;
  geofence_radius_m: number;
  verification_status: string | null;
}

/** Look up an anchorage geofence by partial name (e.g. "Eastern"). */
export function useGeofence(nameFragment: string) {
  const [geofence, setGeofence] = useState<GeofenceRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from('anchorage_geofences')
      .select('*')
      .ilike('anchorage_name', `%${nameFragment}%`)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setGeofence((data ?? null) as GeofenceRow | null);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [nameFragment]);

  return { geofence, loading };
}
