import type { FleetAlert } from './types';

export const mockFleetAlerts: FleetAlert[] = [
  {
    id: 'FA-001',
    type: 'SUPPLIER_FLAG',
    supplierName: 'BunkerGuard Demo Supplier Gamma Pte Ltd',
    supplierReputation: 38,
    triggerSessionId: '2026-016',
    triggerReason: 'Systematic underfueling pattern confirmed - MPA notified 2026-06-10',
    patternDetected: '9 of 22 sessions flagged with >2% short delivery - 4 critical incidents',
    estimatedTotalLoss: 32405,
    affectedSessionIds: ['2026-012', '2026-016', '2026-019', '2026-021'],
    recommendation: 'DO NOT ENGAGE - Suspend all future deliveries pending MPA investigation',
    createdAt: new Date(Date.now() - 30 * 60000).toISOString(),
  },
  {
    id: 'FA-002',
    type: 'SUPPLIER_FLAG',
    supplierName: 'OceanBunker International',
    supplierReputation: 0,
    triggerSessionId: '',
    triggerReason: 'MPA licence verification FAILED - NOT REGISTERED',
    patternDetected: 'Unlicensed supplier attempting to engage',
    estimatedTotalLoss: 0,
    affectedSessionIds: [],
    recommendation: 'DO NOT ENGAGE under any circumstances - Report to MPA immediately',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60000).toISOString(),
  },
  {
    id: 'FA-003',
    type: 'INFO',
    supplierName: 'BunkerGuard Demo Supplier Alpha Pte Ltd',
    supplierReputation: 78,
    triggerSessionId: '2026-014',
    triggerReason: 'Stable performance with minimal discrepancies',
    patternDetected: '3 of 26 sessions flagged - no systematic pattern detected',
    estimatedTotalLoss: 890,
    affectedSessionIds: [],
    recommendation: 'Maintain standard delivery monitoring protocol',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60000).toISOString(),
  },
];

export const getAlertsBySupplier = (supplierName: string) =>
  mockFleetAlerts.filter(a => a.supplierName === supplierName);
