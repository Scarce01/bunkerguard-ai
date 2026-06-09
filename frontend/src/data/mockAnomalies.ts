import type { Anomaly, AnomalyRule } from './types';

export const mockAnomalies: Anomaly[] = [
  // FLAGSHIP INCIDENT: A02-2026-06-10T14:32:00Z (SES-2026-016)
  {
    id: 'A02-2026-06-10T14:32:00Z',
    sessionId: '2026-016',
    ruleId: 'A02',
    ruleName: 'Quantity Final Mismatch',
    severity: 'CRITICAL',
    finding: 'Quantity Final Mismatch',
    evidence: 'MFM Final: 481.2 MT vs BDN Declared: 500.0 MT',
    timestamp: '2026-06-10T14:32:00Z',
    acknowledged: false,
    resolved: false,
    sourceA: '481.2 MT (MFM)',
    sourceB: '500.0 MT (BDN)',
    deviation: '18.8 MT (3.76%)',
  },

  // SECONDARY INCIDENT: A01 Quantity Trajectory Deviation (SES-2026-019)
  {
    id: 'A01-2026-06-08T11:15:00Z',
    sessionId: '2026-019',
    ruleId: 'A01',
    ruleName: 'Quantity Trajectory Deviation',
    severity: 'HIGH',
    finding: 'Quantity Trajectory Deviation',
    evidence: 'MFM Cumulative: 117.3 MT vs Expected: 121.0 MT',
    timestamp: '2026-06-08T11:15:00Z',
    acknowledged: false,
    resolved: false,
    sourceA: 'MFM trajectory',
    sourceB: 'BDN declared',
    deviation: '3.06%',
  },

  // SES-2026-012 Critical Anomaly
  {
    id: 'A02-2026-05-28T16:45:00Z',
    sessionId: '2026-012',
    ruleId: 'A02',
    ruleName: 'Quantity Final Mismatch',
    severity: 'CRITICAL',
    finding: 'Quantity Final Mismatch',
    evidence: 'MFM Final: 629.6 MT vs BDN Declared: 650.0 MT',
    timestamp: '2026-05-28T16:45:00Z',
    acknowledged: false,
    resolved: false,
    sourceA: '629.6 MT (MFM)',
    sourceB: '650.0 MT (BDN)',
    deviation: '20.4 MT (3.14%)',
  },

  // SES-2026-021 Critical Anomaly
  {
    id: 'A02-2026-05-26T09:22:00Z',
    sessionId: '2026-021',
    ruleId: 'A02',
    ruleName: 'Quantity Final Mismatch',
    severity: 'CRITICAL',
    finding: 'Quantity Final Mismatch',
    evidence: 'MFM Final: 50.05 MT vs BDN Declared: 52.0 MT',
    timestamp: '2026-05-26T09:22:00Z',
    acknowledged: false,
    resolved: false,
    sourceA: '50.05 MT (MFM)',
    sourceB: '52.0 MT (BDN)',
    deviation: '1.95 MT (3.75%)',
  },

  // SES-2026-022 Critical Anomaly
  {
    id: 'A02-2026-05-24T13:18:00Z',
    sessionId: '2026-022',
    ruleId: 'A02',
    ruleName: 'Quantity Final Mismatch',
    severity: 'CRITICAL',
    finding: 'Quantity Final Mismatch',
    evidence: 'MFM Final: 121.7 MT vs BDN Declared: 125.0 MT',
    timestamp: '2026-05-24T13:18:00Z',
    acknowledged: false,
    resolved: false,
    sourceA: '121.7 MT (MFM)',
    sourceB: '125.0 MT (BDN)',
    deviation: '3.3 MT (2.64%)',
  },

  // Additional anomaly for SES-2026-016
  {
    id: 'A01-2026-06-10T14:15:00Z',
    sessionId: '2026-016',
    ruleId: 'A01',
    ruleName: 'Quantity Trajectory Deviation',
    severity: 'HIGH',
    finding: 'Quantity Trajectory Deviation',
    evidence: 'Projected final qty deviates >2%',
    timestamp: '2026-06-10T14:15:00Z',
    acknowledged: false,
    resolved: false,
    sourceA: 'MFM trajectory',
    sourceB: 'BDN declared',
    deviation: '2.8%',
  },

  // Meter health issue for SES-2026-016
  {
    id: 'A07-2026-06-10T12:45:00Z',
    sessionId: '2026-016',
    ruleId: 'A07',
    ruleName: 'Meter Health',
    severity: 'MEDIUM',
    finding: 'Meter Health',
    evidence: 'Drive gain above normal range',
    timestamp: '2026-06-10T12:45:00Z',
    acknowledged: false,
    resolved: false,
  },
];

export const anomalyRules: AnomalyRule[] = [
  {
    id: 'A01',
    name: 'Quantity Trajectory Deviation',
    triggerCondition: 'Projected final quantity deviates >1% from BDN',
    severity: 'HIGH',
    checkFrequency: 'Every 5 minutes during bunkering',
    dataSources: ['MFM Stream', 'BDN Record'],
  },
  {
    id: 'A02',
    name: 'Quantity Final Mismatch',
    triggerCondition: 'Final MFM quantity ≠ BDN quantity',
    severity: 'CRITICAL',
    checkFrequency: 'On completion',
    dataSources: ['MFM Final', 'BDN Record'],
  },
  {
    id: 'A03',
    name: 'Density Deviation',
    triggerCondition: 'MFM density deviates >2 kg/m³ from BDN',
    severity: 'MEDIUM',
    checkFrequency: 'Continuous',
    dataSources: ['MFM Stream', 'BDN Record'],
  },
  {
    id: 'A04',
    name: 'Flow Rate Anomaly',
    triggerCondition: 'Flow rate spike or drop >20%',
    severity: 'MEDIUM',
    checkFrequency: 'Continuous',
    dataSources: ['MFM Stream'],
  },
  {
    id: 'A05',
    name: 'Reverse Flow',
    triggerCondition: 'Negative flow rate detected',
    severity: 'CRITICAL',
    checkFrequency: 'Continuous',
    dataSources: ['MFM Stream'],
  },
  {
    id: 'A06',
    name: 'Meter Fault',
    triggerCondition: 'MFM hardware fault signal',
    severity: 'CRITICAL',
    checkFrequency: 'Continuous',
    dataSources: ['MFM Diagnostics'],
  },
  {
    id: 'A07',
    name: 'Meter Health',
    triggerCondition: 'Drive gain, sensor health outside normal range',
    severity: 'MEDIUM',
    checkFrequency: 'Continuous',
    dataSources: ['MFM Diagnostics'],
  },
  {
    id: 'A08',
    name: 'Sulphur Non-Compliance',
    triggerCondition: 'Sulphur % exceeds IMO 2020 limit (0.5%) or ECA limit (0.1%)',
    severity: 'CRITICAL',
    checkFrequency: 'On BDN validation',
    dataSources: ['BDN Record', 'Lab Report'],
  },
  {
    id: 'A09',
    name: 'Flash Point Violation',
    triggerCondition: 'Flash point below minimum threshold',
    severity: 'CRITICAL',
    checkFrequency: 'On BDN validation',
    dataSources: ['BDN Record', 'Lab Report'],
  },
  {
    id: 'A10',
    name: 'Grade Mismatch',
    triggerCondition: 'BDN grade ≠ Ordered grade',
    severity: 'HIGH',
    checkFrequency: 'On BDN validation',
    dataSources: ['BDN Record', 'Purchase Order'],
  },
];

export const getAnomaliesForSession = (sessionId: string) =>
  mockAnomalies.filter(a => a.sessionId === sessionId);

export const getUnacknowledgedAnomalies = () =>
  mockAnomalies.filter(a => !a.acknowledged);
