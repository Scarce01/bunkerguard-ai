/**
 * Singapore bunkering terminal metadata.
 *
 * Coordinates are approximate WGS-84 lat/lng of each terminal's centroid.
 * bbox/center are taken from the source Blender file (meters, world-local).
 * status is mock for now — drive from real telemetry later.
 */

export type TerminalStatus = 'online' | 'degraded' | 'offline' | 'unavailable';

export interface TerminalInfo {
  id: string;          // T01..T10
  name: string;
  operator: string;
  location: string;
  lat: number;
  lng: number;
  status: TerminalStatus;
  glb: string | null;  // public path; null = no model
  /** World-local bounding box size in meters (X, Y, Z) from the .blend file. */
  bboxSize: [number, number, number];
  /** World-local center in meters. */
  center: [number, number, number];
  meshCount: number;
  throughput: string;  // mock metric
  vesselsBerthed: number;
  /**
   * Optional override for the camera framing ratio.
   * Default is ~0.38 — works for plots where the bbox extends well past the
   * visible installation. For tightly-packed terminals where the bbox already
   * hugs the land area (e.g. T07 Stolthaven), bump closer to 1 so the model
   * isn't framed inside a giant empty square.
   */
  frameRatio?: number;
}

/** A vessel berthed at the terminal, rendered as a 3D model in the viewer. */
export interface VesselSpot {
  /** Optional Supabase session_id this vessel is currently engaged with.
   *  Vessel HUD fetches sessions + bdn_records + suppliers by this key. */
  sessionId?: string;
  id: string;        // V01, V02, V03 …
  name: string;
  /** Position in scene coords (terminal-local, Y-up).
   *  X/Z are meters from terminal center. Y is sea level (0). */
  pos: [number, number, number];
  /** Rotation around Y, degrees. */
  rotY: number;
  /** Scale multiplier (vessel GLB ships at 322 m — scale 0.22 → ~70 m boat). */
  scale: number;
  /** Hull tint applied as a multiplier to the GLB's existing materials.
   *  Defaults to white (no tint). Use bright distinct colors so vessels read
   *  against the terminal — the GLB's grey hull blends into pier geometry. */
  color?: string;
  /** Mock metadata so the per-vessel HUD has something to show until AWS/
   *  Supabase telemetry is wired in. */
  status?: 'loading' | 'transit' | 'idle';
  cargo?: string;
}

/**
 * Bunkering vessels per terminal. Only T01 (JPUT) populated for now —
 * scale and water immersion still being dialled in visually before extending
 * to the other terminals. Vessel GLB bbox is 322 m; scale 0.25 → ~80 m boat,
 * which is realistic for a bunkering tanker.
 *
 * Y = -1.5 sinks the keel slightly so the waterline reads on the hull instead
 * of the vessel hovering on top of the sea plane.
 */
export const VESSELS_BY_TERMINAL: Record<string, VesselSpot[]> = {
  // T07's plot is 733 × 733 m with frameRatio 0.55 → framing radius ≈ 200 m,
  // so vessels sit around z ≈ -200 (in front of the jetties) to be in view.
  // Scale 0.25 → ~80 m boat, realistic for a Singapore bunkering tanker.
  // Y = -1.5 dips the keel below the water plane so the hull's waterline
  // reads on the model instead of the boat floating on top.
  // Vessel GLB centered bbox: 137.8 × 18.1 m. At scale 0.4 → 55 m × 7.2 m,
  // a realistic Singapore bunkering tanker. Y=-2 drops the keel ~2 m below
  // the sea plane so the waterline reads on the hull.
  // Z = 130/145 places the boats just south of the jetty ends, in the visible
  // water area between the terminal and the camera-frame edge.
  // Vessels berthed **alongside** each T07 jetty. The GLB hull's long axis
  // sits on its local +X, so rotY = 90° turns the hull 90° CW around Y and
  // makes the keel run N↔S — parallel to the jetty (which extends N↔S).
  //
  //   - rotY = 90° → hull parallel to the jetty length
  //   - X positions are clear of the jetty mesh (50 m + east of each pier
  //     centreline) so the vessel doesn't intersect with port geometry.
  //   - Z = 100 sits the vessel beside the mid-section of its jetty, not at
  //     the south terminus.
  //   - Y = 3 m floats the keel above the water plane.
  //   - color: distinct hull tint per vessel so they read clearly against the
  //     grey port — restored after the earlier "use GLB original" pass that
  //     left them looking too pale at distance.
  // Z = 70 pushes the vessels south of the land mass so the 82 m hull
  // (137 × 0.6) no longer pokes into the terminal at its forward end.
  // V03 moved from x = 240 → 200 so it lines up with the actual rightmost
  // jetty instead of floating in open water past the eastern shoreline.
  // rotY = 270° points each bow to open water (south); the bow-side iso
  // camera then lands offshore instead of inside the tank yard.
  // V01 + V02 share the **middle** jetty — one on each side of the pier:
  //   V01 on the west side  (x ≈ -25 m, just clear of the jetty wall)
  //   V02 on the east side  (x ≈ +85 m, mirror offset on the opposite side)
  // V03 keeps its own jetty alone on the right (x ≈ 200).
  // All three at z = 70 (south of the land mass so bows don't intersect it).
  T07: [
    {
      id: 'V01', name: 'BUNKER KING I', pos: [-25, 3, 70], rotY: 270, scale: 0.6,
      status: 'loading', cargo: 'VLSFO 380 cSt · 480 MT',
      sessionId: 'SES-2026-001',  // clean delivery (MAERSK HONAM + Supplier Alpha, risk 12 LOW)
    },
    {
      id: 'V02', name: 'BUNKER KING II', pos: [85, 3, 70], rotY: 270, scale: 0.6,
      status: 'idle', cargo: 'MGO DMA · 220 MT',
      // no sessionId — idle at berth, between contracts
    },
    {
      id: 'V03', name: 'BUNKER KING III', pos: [200, 3, 70], rotY: 270, scale: 0.6,
      status: 'transit', cargo: 'HSFO 380 cSt · 640 MT',
      sessionId: 'SES-2026-016',  // the top-risk session — Live Session tab focuses here
    },
  ],
};

/* ─── Terminal-scoped dashboard data ──────────────────────────────────── */
/* When a terminal is opened in 3D, the right + bottom dashboard panels
 * switch from network-wide aggregates to data scoped to that one terminal.
 * Real schedule + telemetry plugs in later — for now T07 has mock data,
 * other terminals fall back to a "no data yet" placeholder. */

export interface TerminalCriticalEvent {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  label: string;
  detail: string;
  time: string;
  color: string;
}
export interface TerminalSupplierRow {
  name: string;
  risk: number;
  sessions: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  color: string;
}
export interface TerminalSupplierSignal {
  name: string;
  score: number;
  color: string;
  status: string;
  trend: string;
  trendLabel: string;
  trendColor: string;
}
export interface TerminalRiskBreakdownItem { label: string; value: number; color: string; }
export interface TerminalDashboardData {
  /** Right column — AI Recommendation card */
  ai: {
    recommendation: string;            // headline (red)
    recommendationColor: string;
    confidence: number;                // 0..100
    signals: string[];                 // bullet list
    action: string;                    // one-line action
  };
  /** Right column — Top Risk Session card */
  topRisk: {
    vesselName: string;
    sessionId: string;
    supplier: string;
    riskScore: number;
    riskLevel: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
    riskColor: string;
    breakdown: TerminalRiskBreakdownItem[];
    metrics: { label: string; value: string; color: string }[];
  };
  /** Right column — Supplier Signals card */
  signals: TerminalSupplierSignal[];
  /** Bottom — Critical Events card */
  events: TerminalCriticalEvent[];
  /** Bottom — Supplier Watchlist table */
  watchlist: TerminalSupplierRow[];
  /** KPI strip overrides shown at top of dashboard while a terminal is open */
  kpi: {
    criticalAlerts: number;
    activeSessions: number;
    supplierFlags: number;
    lossPrevented: string; // e.g. "$12K"
  };
}

/** Same shape as TerminalDashboardData — when a vessel's green dot is clicked
 *  the right + bottom panels swap to its scoped data. Keyed `${terminalId}:${vesselId}`. */
export const VESSEL_DASHBOARDS: Record<string, TerminalDashboardData> = {
  'T07:V01': {
    ai: {
      recommendation: 'CONTINUE LOADING',
      recommendationColor: '#00D98E',
      confidence: 91,
      signals: [
        'BUNKER KING I · loading rate 240 m³/h',
        'A02 density sample within spec',
        'Crew & MPA tags · verified',
        'ETA depart 14:30 SGT · on schedule',
      ],
      action: 'Standard end-of-pump checks',
    },
    topRisk: {
      vesselName: 'BUNKER KING I',
      sessionId: 'SES-T07-V01-042',
      supplier: 'Stolthaven Bunkering',
      riskScore: 18,
      riskLevel: 'LOW',
      riskColor: '#00D98E',
      breakdown: [
        { label: 'Flow rate variance',  value: 4, color: '#00D98E' },
        { label: 'Density sample',      value: 6, color: '#00D98E' },
        { label: 'Crew compliance',     value: 4, color: '#00D98E' },
        { label: 'Berth integrity',     value: 4, color: '#00D98E' },
      ],
      metrics: [
        { label: 'Cargo',      value: 'VLSFO 380 cSt', color: '#D8E8F8' },
        { label: 'Quantity',   value: '480 MT',         color: '#D8E8F8' },
        { label: 'Confidence', value: '94%',            color: '#4A9EFF' },
      ],
    },
    signals: [
      { name: 'Stolthaven Bunkering', score: 18, color: '#00D98E', status: 'Loading party · verified', trend: '—', trendLabel: '0', trendColor: '#7FA5D3' },
      { name: 'MPA Inspector',        score: 0,  color: '#00D98E', status: 'On-site · last check 06m',   trend: '✓', trendLabel: 'OK', trendColor: '#00D98E' },
    ],
    events: [
      { severity: 'MEDIUM',   label: 'Loading rate -8% baseline', detail: 'Pump 3 reduced flow · investigating', time: '6m',  color: '#4A9EFF' },
      { severity: 'CRITICAL', label: 'Berth 2 fender wear',       detail: 'Maintenance ticket #ST-2026-114',     time: '1h',  color: '#FF5656' },
    ],
    watchlist: [
      { name: 'Stolthaven Bunkering Singapore', risk: 18, sessions: '0/12', severity: 'LOW', color: '#00D98E' },
    ],
    kpi: {
      criticalAlerts: 1,
      activeSessions: 1,
      supplierFlags: 0,
      lossPrevented: '$0.4K',
    },
  },
  'T07:V02': {
    ai: {
      recommendation: 'STANDBY · IDLE',
      recommendationColor: '#4A9EFF',
      confidence: 88,
      signals: [
        'BUNKER KING II · idle at berth 4',
        'Cargo discharged 02:14 SGT',
        'Awaiting next nomination',
        'Crew change scheduled 16:00 SGT',
      ],
      action: 'Hold berth · monitor for tasking',
    },
    topRisk: {
      vesselName: 'BUNKER KING II',
      sessionId: 'SES-T07-V02-029',
      supplier: 'Vopak Chemicals Asia',
      riskScore: 12,
      riskLevel: 'LOW',
      riskColor: '#00D98E',
      breakdown: [
        { label: 'Idle dwell time',    value: 3, color: '#00D98E' },
        { label: 'Berth occupancy',    value: 4, color: '#00D98E' },
        { label: 'Crew compliance',    value: 3, color: '#00D98E' },
        { label: 'Documentation',      value: 2, color: '#00D98E' },
      ],
      metrics: [
        { label: 'Cargo',     value: 'MGO DMA',   color: '#D8E8F8' },
        { label: 'Quantity',  value: '220 MT',    color: '#D8E8F8' },
        { label: 'Idle for',  value: '2h 14m',    color: '#4A9EFF' },
      ],
    },
    signals: [
      { name: 'Vopak Chemicals',  score: 28, color: '#00D98E', status: 'Last session 02:14 · OK', trend: '—', trendLabel: '0',  trendColor: '#7FA5D3' },
    ],
    events: [
      { severity: 'MEDIUM', label: 'Density sample late', detail: 'A04 sample +18 min vs standard', time: '22m', color: '#4A9EFF' },
    ],
    watchlist: [
      { name: 'Vopak Chemicals Asia', risk: 28, sessions: '1/8', severity: 'LOW', color: '#00D98E' },
    ],
    kpi: { criticalAlerts: 0, activeSessions: 0, supplierFlags: 0, lossPrevented: '$0.0K' },
  },
  'T07:V03': {
    ai: {
      recommendation: 'TRANSIT · ETA +35m',
      recommendationColor: '#FFA940',
      confidence: 79,
      signals: [
        'BUNKER KING III · transit to berth 6',
        'Tug coordination drift · +35 min',
        'Cargo HSFO 380 cSt · 640 MT',
        'AIS heading 092° · 6.4 kts',
      ],
      action: 'Reschedule berth window · notify supplier',
    },
    topRisk: {
      vesselName: 'BUNKER KING III',
      sessionId: 'SES-T07-V03-051',
      supplier: 'Hin Leong Marine',
      riskScore: 46,
      riskLevel: 'MODERATE',
      riskColor: '#FFA940',
      breakdown: [
        { label: 'ETA drift',         value: 18, color: '#FFA940' },
        { label: 'Tug coordination',  value: 12, color: '#FFA940' },
        { label: 'Supplier history',  value: 10, color: '#FFA940' },
        { label: 'Documentation',     value: 6,  color: '#4A9EFF' },
      ],
      metrics: [
        { label: 'Cargo',    value: 'HSFO 380 cSt', color: '#D8E8F8' },
        { label: 'Quantity', value: '640 MT',        color: '#D8E8F8' },
        { label: 'ETA',      value: '+35 min',       color: '#FFA940' },
      ],
    },
    signals: [
      { name: 'Hin Leong Marine', score: 52, color: '#FFA940', status: '3/15 sessions · ETA drift', trend: '↓', trendLabel: '-4', trendColor: '#FFA940' },
    ],
    events: [
      { severity: 'HIGH', label: 'Tug coordination drift', detail: 'ETA +35 min vs schedule', time: '2h',  color: '#FFA940' },
    ],
    watchlist: [
      { name: 'Hin Leong Marine Pte Ltd', risk: 52, sessions: '3/15', severity: 'MEDIUM', color: '#FFA940' },
    ],
    kpi: { criticalAlerts: 0, activeSessions: 1, supplierFlags: 1, lossPrevented: '$1.7K' },
  },
};

export const TERMINAL_DASHBOARDS: Record<string, TerminalDashboardData> = {
  T07: {
    ai: {
      recommendation: 'MONITOR · ROUTINE OPS',
      recommendationColor: '#00D98E',
      confidence: 86,
      signals: [
        'MV Pearl · loading VLSFO 480 MT',
        'Stolthaven supplier · 0/12 flagged',
        'A01 quantity tolerance nominal',
        'Last MPA inspection 14 d ago · PASS',
      ],
      action: 'Approve BDN after standard checks',
    },
    topRisk: {
      vesselName: 'MV PEARL',
      sessionId: 'SES-T07-024',
      supplier: 'Stolthaven Bunkering',
      riskScore: 22,
      riskLevel: 'LOW',
      riskColor: '#00D98E',
      breakdown: [
        { label: 'Quantity match',       value: 6,  color: '#00D98E' },
        { label: 'Data integrity',       value: 4,  color: '#00D98E' },
        { label: 'Supplier history',     value: 8,  color: '#4A9EFF' },
        { label: 'Regulatory compliance',value: 4,  color: '#00D98E' },
      ],
      metrics: [
        { label: 'Cargo',      value: 'VLSFO 480 MT', color: '#D8E8F8' },
        { label: 'Deviation',  value: '0.18%',        color: '#00D98E' },
        { label: 'Confidence', value: '94%',          color: '#4A9EFF' },
      ],
    },
    signals: [
      { name: 'Stolthaven Bunkering', score: 18, color: '#00D98E', status: '0/12 sessions flagged', trend: '↑', trendLabel: '+3', trendColor: '#00D98E' },
      { name: 'Vopak Chemicals',      score: 28, color: '#00D98E', status: '1/8 sessions · 0 LOP',   trend: '—', trendLabel: '0',  trendColor: '#7FA5D3' },
      { name: 'Hin Leong Marine',     score: 52, color: '#FFA940', status: '3/15 sessions',          trend: '↓', trendLabel: '-4', trendColor: '#FFA940' },
    ],
    events: [
      { severity: 'HIGH',     label: 'Loading rate -8% baseline', detail: 'V01 · MV PEARL · pump 3 reduced flow', time: '6m',  color: '#FFA940' },
      { severity: 'MEDIUM',   label: 'Density sample late',       detail: 'V02 · MV TITAN · A04 sample +18 min',   time: '22m', color: '#4A9EFF' },
      { severity: 'CRITICAL', label: 'Berth 2 fender wear',       detail: 'Maintenance ticket #ST-2026-114',       time: '1h',  color: '#FF5656' },
      { severity: 'HIGH',     label: 'Tug coordination drift',    detail: 'V03 · MV NOVA · ETA +35 min',           time: '2h',  color: '#FFA940' },
    ],
    watchlist: [
      { name: 'Stolthaven Bunkering Singapore', risk: 18, sessions: '0/12', severity: 'LOW',    color: '#00D98E' },
      { name: 'Vopak Chemicals Asia',           risk: 28, sessions: '1/8',  severity: 'LOW',    color: '#00D98E' },
      { name: 'Hin Leong Marine Pte Ltd',       risk: 52, sessions: '3/15', severity: 'MEDIUM', color: '#FFA940' },
    ],
    kpi: {
      criticalAlerts: 1,
      activeSessions: 3,
      supplierFlags: 0,
      lossPrevented: '$2.1K',
    },
  },
};

export const TERMINALS: TerminalInfo[] = [
  {
    id: 'T01',
    name: 'Jurong Port Universal Terminal',
    operator: 'JPUT',
    location: 'Jurong Port',
    // JPUT main wharf, Jurong Port mainland
    lat: 1.3155,
    lng: 103.7100,
    status: 'online',
    glb: '/models/Terminal_01_JPUT.glb',
    bboxSize: [1833.3, 1833.3, 26.5],
    center: [0, 0, 9.3],
    meshCount: 4847,
    throughput: '12.4 MT/yr',
    vesselsBerthed: 4,
  },
  {
    id: 'T02',
    name: 'Jurong Petrochemical Tank Terminal',
    operator: 'JPTT',
    location: 'Jurong Island',
    // Tembusu sector, Jurong Island
    lat: 1.2705,
    lng: 103.6925,
    status: 'online',
    glb: '/models/Terminal_02_JPTT.glb',
    bboxSize: [800.0, 800.0, 27.5],
    center: [0, 0, 7.8],
    meshCount: 2373,
    throughput: '6.8 MT/yr',
    vesselsBerthed: 2,
  },
  {
    id: 'T03',
    name: 'Vopak Banyan Terminal',
    operator: 'Vopak',
    location: 'Banyan Basin',
    // Banyan Basin, Jurong Island
    lat: 1.2570,
    lng: 103.7035,
    status: 'online',
    glb: '/models/Terminal_03_Vopak_Banyan.glb',
    bboxSize: [1000.0, 1000.0, 26.5],
    center: [0, 0, 7.3],
    meshCount: 3212,
    throughput: '9.1 MT/yr',
    vesselsBerthed: 3,
  },
  {
    id: 'T04',
    name: 'Horizon Banyan Terminal',
    operator: 'Horizon',
    location: 'Banyan Basin',
    // Banyan Sector neighbour of Vopak Banyan
    lat: 1.2598,
    lng: 103.7090,
    status: 'degraded',
    glb: '/models/Terminal_04_Horizon_Banyan.glb',
    bboxSize: [800.0, 800.0, 25.5],
    center: [0, 0, 6.8],
    meshCount: 2268,
    throughput: '5.4 MT/yr',
    vesselsBerthed: 1,
  },
  {
    id: 'T05',
    name: 'Shell Bukom Refinery Terminal',
    operator: 'Shell',
    location: 'Pulau Bukom',
    // Shell Energy & Chemicals Park, Pulau Bukom
    lat: 1.2378,
    lng: 103.7720,
    status: 'online',
    glb: '/models/Terminal_05_Shell_Bukom.glb',
    bboxSize: [2750.0, 2750.0, 33.6],
    center: [0, 0, 12.8],
    meshCount: 7218,
    throughput: '23.7 MT/yr',
    vesselsBerthed: 6,
  },
  {
    id: 'T06',
    name: 'Tankstore Busing Terminal',
    operator: 'Tankstore',
    location: 'Pulau Busing',
    // Pulau Busing south of Pulau Bukom
    lat: 1.2178,
    lng: 103.7461,
    status: 'online',
    glb: '/models/Terminal_06_Tankstore_Busing.glb',
    bboxSize: [2291.7, 2291.7, 26.2],
    center: [0, 0, 9.1],
    meshCount: 5672,
    throughput: '14.2 MT/yr',
    vesselsBerthed: 4,
  },
  {
    id: 'T07',
    name: 'Stolthaven Terminal',
    operator: 'Stolthaven',
    location: 'Jurong Island',
    // Stolthaven Singapore, Jurong Island south coast
    lat: 1.2672,
    lng: 103.6730,
    status: 'online',
    glb: '/models/Terminal_07_Stolthaven.glb',
    bboxSize: [733.3, 733.3, 42.1],
    center: [0, 0, 15.0],
    meshCount: 4903,
    throughput: '7.1 MT/yr',
    vesselsBerthed: 2,
    // T07's bbox already hugs the plot tightly. Lower ratio = closer camera —
    // 0.55 frames the dense tank cluster + jetty without empty water around it.
    frameRatio: 0.55,
  },
  {
    id: 'T08',
    name: 'SPC Sebarok Terminal',
    operator: 'SPC',
    location: 'Pulau Sebarok',
    // SPC terminal, north-east of Pulau Sebarok
    lat: 1.2046,
    lng: 103.8070,
    status: 'online',
    glb: '/models/Terminal_08_SPC_Sebarok.glb',
    bboxSize: [600.0, 600.0, 23.5],
    center: [0, 0, 5.8],
    meshCount: 947,
    throughput: '3.2 MT/yr',
    vesselsBerthed: 1,
  },
  {
    id: 'T09',
    name: 'Vopak Sebarok Terminal',
    operator: 'Vopak',
    location: 'Pulau Sebarok',
    // Vopak terminal, west of Pulau Sebarok
    lat: 1.2030,
    lng: 103.7995,
    status: 'online',
    glb: '/models/Terminal_09_Vopak_Sebarok.glb',
    bboxSize: [900.0, 900.0, 25.5],
    center: [0, 0, 6.8],
    meshCount: 3938,
    throughput: '10.6 MT/yr',
    vesselsBerthed: 3,
  },
  {
    id: 'T10',
    name: 'Vopak Penjuru Terminal',
    operator: 'Vopak',
    location: 'Penjuru, Jurong',
    // Penjuru Crescent, mainland Jurong west
    lat: 1.3097,
    lng: 103.7275,
    status: 'online',
    glb: '/models/Terminal_10_Vopak_Penjuru.glb',
    bboxSize: [800.0, 800.0, 24.5],
    center: [0, 0, 6.3],
    meshCount: 1907,
    throughput: '4.9 MT/yr',
    vesselsBerthed: 2,
  },
];

/**
 * Singapore map normalisation.
 * Maps lat/lng to the SVG viewBox the SingaporeMap component renders into.
 * Bounds chosen to crop on the southern waterfront (where every terminal sits).
 */
export const SG_BOUNDS = {
  minLng: 103.60,
  maxLng: 104.00,
  minLat: 1.15,
  maxLat: 1.48,
  viewW: 1000,
  viewH: 600,
};

export function latLngToXY(lat: number, lng: number): { x: number; y: number } {
  const { minLng, maxLng, minLat, maxLat, viewW, viewH } = SG_BOUNDS;
  const x = ((lng - minLng) / (maxLng - minLng)) * viewW;
  const y = ((maxLat - lat) / (maxLat - minLat)) * viewH;
  return { x, y };
}

export function statusColor(s: TerminalStatus): string {
  switch (s) {
    case 'online':      return '#00D47E';
    case 'degraded':    return '#FFA940';
    case 'offline':     return '#FF3333';
    case 'unavailable': return '#4A6B88';
  }
}

export function statusLabel(s: TerminalStatus): string {
  switch (s) {
    case 'online':      return 'ONLINE';
    case 'degraded':    return 'DEGRADED';
    case 'offline':     return 'OFFLINE';
    case 'unavailable': return 'UNAVAILABLE';
  }
}
