import type { SupplierReputation } from './types';
import { mockSessions } from './mockSessions';

// SUP-001: BunkerGuard Demo Supplier Alpha Pte Ltd
const supplierAlpha: SupplierReputation = {
  supplierName: 'BunkerGuard Demo Supplier Alpha Pte Ltd',
  licence: 'MPA-BKR-2024-0081',
  status: 'ACTIVE',
  reputationScore: 78,
  previousScore: 79,
  scoreChange: -1,
  averageDiscrepancyPercent: 0.31,
  disputeRate: 0.0,
  criticalAnomalyFrequency: 0.038, // 1/26
  documentComplianceRate: 1.0,
  trendDirection: 'STABLE',
  historicalTransactions: mockSessions.filter(s => s.supplierName === 'BunkerGuard Demo Supplier Alpha Pte Ltd'),
  reputationHistory: [
    { date: '2026-04-28', score: 79 },
    { date: '2026-05-05', score: 79 },
    { date: '2026-05-12', score: 78 },
    { date: '2026-05-19', score: 78 },
    { date: '2026-05-26', score: 78 },
    { date: '2026-06-02', score: 78 },
  ],
};

// SUP-002: BunkerGuard Demo Supplier Beta Pte Ltd
const supplierBeta: SupplierReputation = {
  supplierName: 'BunkerGuard Demo Supplier Beta Pte Ltd',
  licence: 'MPA-BKR-2023-0142',
  status: 'ACTIVE',
  reputationScore: 58,
  previousScore: 59,
  scoreChange: -1,
  averageDiscrepancyPercent: 1.22,
  disputeRate: 0.1, // 2/20
  criticalAnomalyFrequency: 0.05, // 1/20
  documentComplianceRate: 0.9,
  trendDirection: 'STABLE',
  historicalTransactions: mockSessions.filter(s => s.supplierName === 'BunkerGuard Demo Supplier Beta Pte Ltd'),
  reputationHistory: [
    { date: '2026-04-28', score: 60 },
    { date: '2026-05-05', score: 59 },
    { date: '2026-05-12', score: 59 },
    { date: '2026-05-19', score: 58 },
    { date: '2026-05-26', score: 58 },
    { date: '2026-06-02', score: 58 },
  ],
};

// SUP-003: BunkerGuard Demo Supplier Gamma Pte Ltd (FLAGGED - High Risk)
const supplierGamma: SupplierReputation = {
  supplierName: 'BunkerGuard Demo Supplier Gamma Pte Ltd',
  licence: 'MPA-BKR-2024-0092',
  status: 'FLAGGED',
  reputationScore: 38,
  previousScore: 45,
  scoreChange: -7,
  averageDiscrepancyPercent: 2.31,
  disputeRate: 0.136, // 3/22
  criticalAnomalyFrequency: 0.182, // 4/22
  documentComplianceRate: 0.68,
  trendDirection: 'DOWN',
  historicalTransactions: mockSessions.filter(s => s.supplierName === 'BunkerGuard Demo Supplier Gamma Pte Ltd'),
  reputationHistory: [
    { date: '2026-04-28', score: 62 },
    { date: '2026-05-05', score: 58 },
    { date: '2026-05-12', score: 52 },
    { date: '2026-05-19', score: 48 },
    { date: '2026-05-26', score: 45 },
    { date: '2026-06-02', score: 38 },
  ],
};

// SUP-004: OceanBunker International (NOT REGISTERED)
const supplierOceanBunker: SupplierReputation = {
  supplierName: 'OceanBunker International',
  licence: 'NOT REGISTERED',
  status: 'SUSPENDED',
  reputationScore: 0,
  previousScore: 0,
  scoreChange: 0,
  averageDiscrepancyPercent: 0,
  disputeRate: 0,
  criticalAnomalyFrequency: 1.0,
  documentComplianceRate: 0.0,
  trendDirection: 'STABLE',
  historicalTransactions: mockSessions.filter(s => s.supplierName === 'OceanBunker International'),
  reputationHistory: [
    { date: '2026-06-02', score: 0 },
  ],
};

export const mockSupplierReputation: SupplierReputation = supplierGamma; // Default to Gamma for investigation
export const mockAllSuppliers: SupplierReputation[] = [
  supplierGamma,   // Worst first (for AI targeting)
  supplierBeta,
  supplierAlpha,
  supplierOceanBunker,
];

export const getSupplierByName = (name: string) =>
  mockAllSuppliers.find(s => s.supplierName === name) || mockAllSuppliers[0];
