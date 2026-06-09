import { ReactNode } from 'react';

interface KpiMetricProps {
  label: string;
  value: string | number;
  sublabel?: string;
  variant?: 'default' | 'critical' | 'warning' | 'success' | 'primary';
  icon?: ReactNode;
  large?: boolean;
}

const variantColors = {
  default: 'text-foreground',
  critical: 'text-critical',
  warning: 'text-warning',
  success: 'text-success',
  primary: 'text-primary',
};

export function KpiMetric({ label, value, sublabel, variant = 'default', icon, large = false }: KpiMetricProps) {
  const valueColor = variantColors[variant];

  return (
    <div className="flex flex-col">
      <div className="text-xs text-foreground-muted mb-1 uppercase tracking-wide">{label}</div>
      <div className="flex items-baseline gap-2">
        {icon && <div className="self-center">{icon}</div>}
        <div className={`${large ? 'text-4xl' : 'text-2xl'} font-bold ${valueColor}`}>
          {value}
        </div>
      </div>
      {sublabel && (
        <div className={`text-xs mt-1 ${variant === 'default' ? 'text-foreground-muted' : valueColor}`}>
          {sublabel}
        </div>
      )}
    </div>
  );
}
