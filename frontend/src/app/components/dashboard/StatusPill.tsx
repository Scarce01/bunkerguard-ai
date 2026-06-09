import type { SessionStatus, RiskLevel, AnomalySeverity } from '../../../data/types';

interface StatusPillProps {
  status: SessionStatus | RiskLevel | AnomalySeverity | string;
  size?: 'sm' | 'md' | 'lg';
}

const statusColors: Record<string, string> = {
  // Session Status
  BUNKERING: 'bg-primary/10 text-primary border-primary/20',
  COMPLETED: 'bg-success/10 text-success border-success/20',
  ALERT: 'bg-warning/10 text-warning border-warning/20',
  REFUSED: 'bg-critical/10 text-critical border-critical/20',

  // Risk Level
  LOW: 'bg-success/10 text-success border-success/20',
  MODERATE: 'bg-warning/10 text-warning border-warning/20',
  HIGH: 'bg-warning/10 text-warning border-warning/20',
  CRITICAL: 'bg-critical/10 text-critical border-critical/20',

  // Anomaly Severity
  MEDIUM: 'bg-warning/10 text-warning border-warning/20',

  // Verdict
  APPROVED: 'bg-success/10 text-success border-success/20',
  UNDER_REVIEW: 'bg-warning/10 text-warning border-warning/20',
  PENDING: 'bg-foreground-muted/10 text-foreground-muted border-foreground-muted/20',

  // Supplier Status
  ACTIVE: 'bg-success/10 text-success border-success/20',
  FLAGGED: 'bg-critical/10 text-critical border-critical/20',
  SUSPENDED: 'bg-destructive/10 text-destructive border-destructive/20',

  // Validation Status
  VALID: 'bg-success/10 text-success border-success/20',
  MISMATCH: 'bg-critical/10 text-critical border-critical/20',
  MISSING: 'bg-foreground-muted/10 text-foreground-muted border-foreground-muted/20',
};

const sizeClasses = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3.5 py-1.5 text-xs',
  lg: 'px-4 py-2 text-sm',
};

export function StatusPill({ status, size = 'md' }: StatusPillProps) {
  const colorClass = statusColors[status] || 'bg-foreground-muted/10 text-foreground-muted border-foreground-muted/20';
  const sizeClass = sizeClasses[size];

  return (
    <span className={`inline-flex items-center justify-center text-center font-bold rounded-full border tracking-wide ${colorClass} ${sizeClass}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
