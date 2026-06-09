// Comprehensive mock data for Live Session monitoring

export type SessionStatus = 'ACTIVE' | 'MONITORING' | 'RESOLVED' | 'ESCALATED';
export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'NORMAL';
export type AnomalyType = 'QUANTITY_MISMATCH' | 'MFM_DRIFT' | 'SUPPLIER_PATTERN' | 'DOCUMENT_MISMATCH' | 'AIS_ANOMALY';

export interface LiveSession {
  id: number;
  sessionNumber: number;
  vesselName: string;
  bargeName: string;
  supplierName: string;
  location: string;
  status: SessionStatus;
  riskLevel: RiskLevel;
  riskScore: number;
  anomalyType: AnomalyType;

  // BDN & MFM data
  bdnQuantity: number;
  mfmRecorded: number;
  shortageMT: number;
  deviationPercent: number;

  // Telemetry
  flowRate: number;
  temperature: number;
  density: number;
  transferProgress: number;
  etaMinutes: number;
  activeAlerts: number;

  // AI Verdict
  verdict: string;
  verdictConfidence: number;
  reasoning: string[];

  // Map positioning
  vesselX: number;
  vesselY: number;
  bargeX: number;
  bargeY: number;

  // Timestamps
  startTime: string;
  lastUpdate: string;
}

export const LIVE_SESSIONS: LiveSession[] = [
  {
    id: 1,
    sessionNumber: 16,
    vesselName: 'MAERSK HONAM',
    bargeName: 'MT FUEL STAR 7',
    supplierName: 'BunkerGuard Demo Supplier Gamma Pte Ltd',
    location: 'Singapore Eastern Anchorage',
    status: 'ACTIVE',
    riskLevel: 'CRITICAL',
    riskScore: 78,
    anomalyType: 'QUANTITY_MISMATCH',
    bdnQuantity: 500.0,
    mfmRecorded: 481.2,
    shortageMT: 18.8,
    deviationPercent: 3.76,
    flowRate: 45.2,
    temperature: 22.3,
    density: 991.2,
    transferProgress: 96,
    etaMinutes: 8,
    activeAlerts: 3,
    verdict: 'REFUSE TO SIGN BDN',
    verdictConfidence: 92,
    reasoning: [
      'Shortage: 18.8 MT (3.76%)',
      'Supplier Gamma: 9/22 flagged',
      'MFM evidence verified',
      'MPA threshold exceeded',
      'Systematic pattern detected'
    ],
    vesselX: 35,
    vesselY: 45,
    bargeX: 65,
    bargeY: 55,
    startTime: '2026-06-10 10:15',
    lastUpdate: '2026-06-10 14:42'
  },
  {
    id: 2,
    sessionNumber: 19,
    vesselName: 'MSC OSCAR',
    bargeName: 'MT FUEL STAR 5',
    supplierName: 'BunkerGuard Demo Supplier Gamma Pte Ltd',
    location: 'Singapore Western Anchorage',
    status: 'MONITORING',
    riskLevel: 'HIGH',
    riskScore: 67,
    anomalyType: 'QUANTITY_MISMATCH',
    bdnQuantity: 121.0,
    mfmRecorded: 117.3,
    shortageMT: 3.7,
    deviationPercent: 3.06,
    flowRate: 52.8,
    temperature: 24.1,
    density: 989.5,
    transferProgress: 99,
    etaMinutes: 3,
    activeAlerts: 2,
    verdict: 'MONITOR CLOSELY',
    verdictConfidence: 78,
    reasoning: [
      'Quantity trajectory deviation detected',
      'Related to SES-2026-016',
      'Supplier Gamma pattern confirmed',
      'Continue monitoring'
    ],
    vesselX: 28,
    vesselY: 35,
    bargeX: 72,
    bargeY: 48,
    startTime: '2026-06-08 09:30',
    lastUpdate: '2026-06-08 13:38'
  },
  {
    id: 3,
    sessionNumber: 14,
    vesselName: 'MSC OSCAR',
    bargeName: 'MT VICTORY 12',
    supplierName: 'BunkerGuard Demo Supplier Alpha Pte Ltd',
    location: 'Singapore Eastern Anchorage',
    status: 'RESOLVED',
    riskLevel: 'NORMAL',
    riskScore: 15,
    anomalyType: 'AIS_ANOMALY',
    bdnQuantity: 420.0,
    mfmRecorded: 419.8,
    shortageMT: 0.2,
    deviationPercent: 0.05,
    flowRate: 0,
    temperature: 22.8,
    density: 990.3,
    transferProgress: 100,
    etaMinutes: 0,
    activeAlerts: 0,
    verdict: 'APPROVED',
    verdictConfidence: 95,
    reasoning: [
      'Minor deviation: 0.2 MT (0.05%)',
      'Within MPA tolerance',
      'Supplier Alpha verified',
      'Transfer complete'
    ],
    vesselX: 75,
    vesselY: 58,
    bargeX: 45,
    bargeY: 42,
    startTime: '2026-06-01 09:00',
    lastUpdate: '2026-06-01 13:22'
  },
  {
    id: 4,
    sessionNumber: 12,
    vesselName: 'CMA CGM ANTOINE DE SAINT EXUPERY',
    bargeName: 'MT FUEL STAR 7',
    supplierName: 'BunkerGuard Demo Supplier Gamma Pte Ltd',
    location: 'Singapore Eastern Anchorage',
    status: 'ESCALATED',
    riskLevel: 'CRITICAL',
    riskScore: 85,
    anomalyType: 'QUANTITY_MISMATCH',
    bdnQuantity: 650.0,
    mfmRecorded: 629.6,
    shortageMT: 20.4,
    deviationPercent: 3.14,
    flowRate: 41.5,
    temperature: 23.7,
    density: 992.1,
    transferProgress: 97,
    etaMinutes: 5,
    activeAlerts: 4,
    verdict: 'REFUSE TO SIGN BDN',
    verdictConfidence: 89,
    reasoning: [
      'Shortage: 20.4 MT (3.14%)',
      'Supplier Gamma: 9/22 flagged',
      'MFM suppression detected',
      'Escalated to P&I Club'
    ],
    vesselX: 42,
    vesselY: 52,
    bargeX: 68,
    bargeY: 48,
    startTime: '2026-05-28 11:45',
    lastUpdate: '2026-05-28 16:40'
  },
  {
    id: 5,
    sessionNumber: 21,
    vesselName: 'EVER GIVEN',
    bargeName: 'MT FUEL STAR 5',
    supplierName: 'BunkerGuard Demo Supplier Gamma Pte Ltd',
    location: 'Singapore Western Anchorage',
    status: 'MONITORING',
    riskLevel: 'CRITICAL',
    riskScore: 85,
    anomalyType: 'QUANTITY_MISMATCH',
    bdnQuantity: 52.0,
    mfmRecorded: 50.05,
    shortageMT: 1.95,
    deviationPercent: 3.75,
    flowRate: 48.3,
    temperature: 23.2,
    density: 988.9,
    transferProgress: 99,
    etaMinutes: 2,
    activeAlerts: 1,
    verdict: 'REFUSE TO SIGN BDN',
    verdictConfidence: 87,
    reasoning: [
      'Shortage: 1.95 MT (3.75%)',
      'Supplier Gamma pattern confirmed',
      'MPA threshold exceeded',
      'Recommendation: REFUSE TO SIGN'
    ],
    vesselX: 55,
    vesselY: 62,
    bargeX: 38,
    bargeY: 35,
    startTime: '2026-05-26 08:00',
    lastUpdate: '2026-05-26 09:35'
  },
  {
    id: 6,
    sessionNumber: 22,
    vesselName: 'MAERSK HONAM',
    bargeName: 'MT ENERGY STAR 3',
    supplierName: 'BunkerGuard Demo Supplier Beta Pte Ltd',
    location: 'Singapore Eastern Anchorage',
    status: 'ACTIVE',
    riskLevel: 'CRITICAL',
    riskScore: 72,
    anomalyType: 'QUANTITY_MISMATCH',
    bdnQuantity: 125.0,
    mfmRecorded: 121.7,
    shortageMT: 3.3,
    deviationPercent: 2.64,
    flowRate: 46.7,
    temperature: 22.5,
    density: 990.8,
    transferProgress: 99,
    etaMinutes: 1,
    activeAlerts: 1,
    verdict: 'APPROVED',
    verdictConfidence: 88,
    reasoning: [
      'Minimal deviation: 3.2 MT (0.58%)',
      'Well within tolerance',
      'Supplier verified',
      'AIS anomaly resolved'
    ],
    vesselX: 62,
    vesselY: 40,
    bargeX: 48,
    bargeY: 58,
    startTime: '2026-06-01 13:15',
    lastUpdate: '2026-06-01 14:43'
  },
  {
    id: 7,
    sessionNumber: 18,
    vesselName: 'MV Crimson Wave',
    bargeName: 'OceanFuel Barge 08',
    supplierName: 'OceanFuel',
    location: 'Singapore Western Anchorage',
    status: 'MONITORING',
    riskLevel: 'HIGH',
    riskScore: 68,
    anomalyType: 'MFM_DRIFT',
    bdnQuantity: 750.0,
    mfmRecorded: 742.3,
    shortageMT: 7.7,
    deviationPercent: 1.03,
    flowRate: 50.2,
    temperature: 24.8,
    density: 987.6,
    transferProgress: 99,
    etaMinutes: 2,
    activeAlerts: 2,
    verdict: 'MONITOR CLOSELY',
    verdictConfidence: 76,
    reasoning: [
      'MFM drift detected',
      'Shortage: 7.7 MT (1.03%)',
      'Below threshold but concerning',
      'Monitor until completion'
    ],
    vesselX: 45,
    vesselY: 38,
    bargeX: 70,
    bargeY: 62,
    startTime: '2026-06-01 11:00',
    lastUpdate: '2026-06-01 14:36'
  },
  {
    id: 8,
    sessionNumber: 17,
    vesselName: 'MV Eastern Dawn',
    bargeName: 'MegaFuel Barge 02',
    supplierName: 'MegaFuel',
    location: 'Singapore Eastern Anchorage',
    status: 'RESOLVED',
    riskLevel: 'HIGH',
    riskScore: 71,
    anomalyType: 'QUANTITY_MISMATCH',
    bdnQuantity: 400.0,
    mfmRecorded: 392.4,
    shortageMT: 7.6,
    deviationPercent: 1.90,
    flowRate: 0,
    temperature: 22.1,
    density: 991.8,
    transferProgress: 100,
    etaMinutes: 0,
    activeAlerts: 0,
    verdict: 'PROTEST FILED',
    verdictConfidence: 85,
    reasoning: [
      'Shortage: 7.6 MT (1.90%)',
      'Supplier: 3/6 flagged',
      'Below 2% threshold',
      'Letter of protest filed'
    ],
    vesselX: 58,
    vesselY: 48,
    bargeX: 42,
    bargeY: 52,
    startTime: '2026-06-01 10:15',
    lastUpdate: '2026-06-01 13:45'
  },
  {
    id: 9,
    sessionNumber: 21,
    vesselName: 'MV Silver Horizon',
    bargeName: 'SinoMarine Barge 15',
    supplierName: 'SinoMarine',
    location: 'Singapore Western Anchorage',
    status: 'ACTIVE',
    riskLevel: 'MODERATE',
    riskScore: 58,
    anomalyType: 'DOCUMENT_MISMATCH',
    bdnQuantity: 650.0,
    mfmRecorded: 644.5,
    shortageMT: 5.5,
    deviationPercent: 0.85,
    flowRate: 47.9,
    temperature: 23.6,
    density: 989.2,
    transferProgress: 99,
    etaMinutes: 3,
    activeAlerts: 1,
    verdict: 'REVIEW REQUIRED',
    verdictConfidence: 74,
    reasoning: [
      'Document timestamp mismatch',
      'Shortage: 5.5 MT (0.85%)',
      'Within tolerance',
      'Verify documentation before signing'
    ],
    vesselX: 52,
    vesselY: 55,
    bargeX: 65,
    bargeY: 45,
    startTime: '2026-06-01 12:30',
    lastUpdate: '2026-06-01 14:41'
  },
  {
    id: 10,
    sessionNumber: 13,
    vesselName: 'MV Jade Navigator',
    bargeName: 'PrimeBunker Barge 05',
    supplierName: 'PrimeBunker',
    location: 'Singapore Eastern Anchorage',
    status: 'RESOLVED',
    riskLevel: 'NORMAL',
    riskScore: 35,
    anomalyType: 'AIS_ANOMALY',
    bdnQuantity: 520.0,
    mfmRecorded: 518.2,
    shortageMT: 1.8,
    deviationPercent: 0.35,
    flowRate: 0,
    temperature: 22.4,
    density: 990.5,
    transferProgress: 100,
    etaMinutes: 0,
    activeAlerts: 0,
    verdict: 'APPROVED',
    verdictConfidence: 97,
    reasoning: [
      'Minimal deviation: 1.8 MT (0.35%)',
      'Well within tolerance',
      'AIS verified',
      'Transfer approved'
    ],
    vesselX: 48,
    vesselY: 42,
    bargeX: 72,
    bargeY: 58,
    startTime: '2026-06-01 08:30',
    lastUpdate: '2026-06-01 12:10'
  }
];

export function getSessionById(id: number): LiveSession | undefined {
  return LIVE_SESSIONS.find(s => s.id === id);
}

export function getAllSuppliers(): string[] {
  return Array.from(new Set(LIVE_SESSIONS.map(s => s.supplierName))).sort();
}

export function getAnomalyTypeLabel(type: AnomalyType): string {
  const labels: Record<AnomalyType, string> = {
    QUANTITY_MISMATCH: 'Quantity Mismatch',
    MFM_DRIFT: 'MFM Drift',
    SUPPLIER_PATTERN: 'Supplier Pattern',
    DOCUMENT_MISMATCH: 'Document Mismatch',
    AIS_ANOMALY: 'AIS Anomaly'
  };
  return labels[type];
}

export function getRiskColor(level: RiskLevel): string {
  const colors: Record<RiskLevel, string> = {
    CRITICAL: '#FF5656',
    HIGH: '#FFA940',
    MODERATE: '#4A9EFF',
    NORMAL: '#00D98E'
  };
  return colors[level];
}

export function getStatusColor(status: SessionStatus): string {
  const colors: Record<SessionStatus, string> = {
    ACTIVE: '#00D98E',
    MONITORING: '#FFA940',
    RESOLVED: '#98B8D8',
    ESCALATED: '#FF5656'
  };
  return colors[status];
}
