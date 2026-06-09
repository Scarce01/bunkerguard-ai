import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ModelErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
  resetKey?: string;
  onError?: (error: Error) => void;
}

interface ModelErrorBoundaryState {
  failed: boolean;
}

export class ModelErrorBoundary extends Component<
  ModelErrorBoundaryProps,
  ModelErrorBoundaryState
> {
  state: ModelErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ModelErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    console.error('[3d-model] failed to render', error);
    this.props.onError?.(error);
  }

  componentDidUpdate(previousProps: ModelErrorBoundaryProps) {
    if (
      this.state.failed
      && previousProps.resetKey !== this.props.resetKey
    ) {
      this.setState({ failed: false });
    }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function ModelUnavailable({
  title = '3D visualization unavailable',
  detail = 'Live operational data remains available.',
  action,
}: {
  title?: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      minHeight: 240,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at center, #0B2238 0%, #050E18 100%)',
      color: '#E5F2FF',
    }}>
      <div style={{ maxWidth: 360, padding: 24, textAlign: 'center' }}>
        <div style={{
          color: '#7FA5D3',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1.4,
          textTransform: 'uppercase',
        }}>
          Model fallback
        </div>
        <div style={{ marginTop: 8, fontSize: 17, fontWeight: 700 }}>{title}</div>
        <div style={{ marginTop: 6, color: '#8BB4D6', fontSize: 12, lineHeight: 1.5 }}>
          {detail}
        </div>
        {action && <div style={{ marginTop: 16 }}>{action}</div>}
      </div>
    </div>
  );
}
