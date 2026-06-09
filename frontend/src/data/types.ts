export type SessionStatus = 'BUNKERING' | 'COMPLETED' | 'ALERT' | 'REFUSED';
export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export type AnomalySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type Verdict = 'APPROVED' | 'REFUSED' | 'UNDER_REVIEW' | 'PENDING';

export interface BDNRecord {
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
  validationStatus: 'VALID' | 'MISMATCH' | 'MISSING';
}

export interface MFMReading {
  timestamp: string;
  cumulativeMass: number;
  massFlowRate: number;
  density: number;
  temperature: number;
}

export interface MFMStream {
  sessionId: string;
  readings: MFMReading[];
  finalQuantity: number;
  duration: number;
  averageFlowRate: number;
  averageDensity: number;
  averageTemperature: number;
}

export interface Anomaly {
  id: string;
  sessionId: string;
  ruleId: string;
  ruleName: string;
  severity: AnomalySeverity;
  finding: string;
  evidence: string;
  timestamp: string;
  acknowledged: boolean;
  resolved: boolean;
  sourceA?: string;
  sourceB?: string;
  deviation?: string;
}

export interface RiskScore {
  total: number;
  level: RiskLevel;
  quantityMismatch: number;
  dataIntegrity: number;
  regulatoryCompliance: number;
  supplierHistory: number;
}

export interface Session {
  id: string;
  sessionNumber: number;
  vesselName: string;
  vesselIMO: string;
  supplierName: string;
  bargeName: string;
  location: string;
  fuelGrade: string;
  bdnQuantity: number;
  mfmQuantity: number;
  mismatchMT: number;
  mismatchPercent: number;
  riskScore: RiskScore;
  status: SessionStatus;
  verdict: Verdict;
  estimatedLoss: number;
  startTime: string;
  endTime?: string;
  bdnRecord: BDNRecord;
  mfmStream: MFMStream;
  anomalies: Anomaly[];
  blockchainHash?: string;
  transactionHash?: string;
  blockNumber?: string;
}

export interface AnomalyRule {
  id: string;
  name: string;
  triggerCondition: string;
  severity: AnomalySeverity;
  checkFrequency: string;
  dataSources: string[];
}

export interface EvidenceReport {
  id: string;
  sessionId: string;
  generatedAt: string;
  session: Session;
  aiAnalysis: {
    summary: string;
    concerns: string[];
    recommendation: string;
    confidence: number;
  };
  lopDraft: string;
}

export interface SupplierReputation {
  supplierName: string;
  licence: string;
  status: 'ACTIVE' | 'FLAGGED' | 'SUSPENDED';
  reputationScore: number;
  previousScore: number;
  scoreChange: number;
  averageDiscrepancyPercent: number;
  disputeRate: number;
  criticalAnomalyFrequency: number;
  documentComplianceRate: number;
  trendDirection: 'UP' | 'DOWN' | 'STABLE';
  historicalTransactions: Session[];
  reputationHistory: Array<{ date: string; score: number }>;
}

export interface FleetAlert {
  id: string;
  type: 'SUPPLIER_FLAG' | 'FLEET_ALERT' | 'INFO';
  supplierName: string;
  supplierReputation: number;
  triggerSessionId: string;
  triggerReason: string;
  patternDetected: string;
  estimatedTotalLoss: number;
  affectedSessionIds: string[];
  recommendation: string;
  createdAt: string;
}

export interface BlockchainRecord {
  sessionId: string;
  bdnHash: string;
  mfmHash: string;
  validationHash: string;
  transactionHash: string;
  blockNumber: string;
  timestamp: string;
  qrCodeUrl: string;
}
