import { ReactNode } from 'react';

interface SectionPanelProps {
  title?: string;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
  action?: ReactNode;
}

export function SectionPanel({ title, children, className = '', noPadding = false, action }: SectionPanelProps) {
  return (
    <div
      className={`border border-border rounded-2xl ${className}`}
      style={{
        background: 'rgba(18, 31, 53, 0.72)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
      }}
    >
      {title && (
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground tracking-tight">{title}</h3>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-6'}>
        {children}
      </div>
    </div>
  );
}
