import { useState } from 'react';
import { supplierLogoFor, supplierInitials } from '../../../lib/supplierLogos';

/**
 * Renders a supplier's logo from `public/suppliers/<key>.png`, with a
 * graceful text-initials chip fallback when the file is missing or fails
 * to load. White rounded background keeps brand colours readable on the
 * dark dashboard.
 */
export interface SupplierLogoProps {
  /** Supplier id (`SUP-001` etc.) or name — id wins when both available. */
  id?: string | null;
  /** Full supplier name — used for the fallback initials + alt text. */
  name: string;
  /** Square edge length in px. Defaults to 48. */
  size?: number;
  /** Optional border colour (matches the card's risk-tier border). */
  borderColor?: string;
}

export function SupplierLogo({ id, name, size = 48, borderColor }: SupplierLogoProps) {
  const url = supplierLogoFor(id) ?? supplierLogoFor(name);
  const [failed, setFailed] = useState(false);
  const showFallback = !url || failed;

  return (
    <div
      style={{
        width: size, height: size,
        borderRadius: size / 6,
        background: '#FFFFFF',
        // Subtle ring picks up the card's risk tier when supplied.
        border: `1px solid ${borderColor ?? 'rgba(255,255,255,0.18)'}`,
        boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, overflow: 'hidden',
      }}
      title={name}
    >
      {showFallback ? (
        <span style={{
          fontSize: size * 0.36, fontWeight: 800,
          color: '#1F2A3A', letterSpacing: '0.04em',
          fontFamily: "'Inter', system-ui, sans-serif",
        }}>
          {supplierInitials(name)}
        </span>
      ) : (
        <img
          src={url ?? ''}
          alt={`${name} logo`}
          onError={() => setFailed(true)}
          draggable={false}
          /* Source PNGs are 1920×1080 with the brand mark + wordmark
           * centred in the middle ~60% of the frame and a fat horizontal
           * letterbox of whitespace on either side. `object-fit: cover`
           * on a square tile crops the horizontal letterboxing away
           * (1920×1080 → fits the 1080 height into the tile, overflows
           * width and clips it equally each side). The wordmark stays
           * fully readable. */
          style={{
            width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center',
            display: 'block',
          }}
        />
      )}
    </div>
  );
}
