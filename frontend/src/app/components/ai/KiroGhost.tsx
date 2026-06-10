/* ────────────────────────────────────────────────────────────────
 * Kiro — the BunkerGuard agent mascot.
 *
 * The image lives at /kiro.svg (public folder). To swap in the exact
 * picture the team sent, replace public/kiro.svg with the real asset
 * (or drop a PNG and change KIRO_SRC below). Everything in the app
 * pulls from KIRO_SRC, so one file = one source of truth.
 *
 * Two render modes:
 *   <KiroGhostBadge />   → HTML <img> avatar for React layouts
 *                         (workflow cards, conversation toasts, sidebar)
 *   <KiroGhostNode />    → inline SVG <image> for embedding inside a
 *                         parent SVG canvas (NetworkGraph nodes use this)
 *
 * Per-agent colouring is preserved via the outer halo / glow — the
 * Kiro picture itself is unchanged.
 * ──────────────────────────────────────────────────────────────── */

/** Path to the Kiro image. Drop a PNG/SVG at this path and everything
 *  downstream picks it up — see public/kiro.svg. */
const KIRO_SRC = '/kiro.svg';

/** Optional per-agent avatar overrides. The Investigator agent is the only
 *  one that doesn't render Kiro — it renders the Exa logo, because Exa is
 *  the third-party intelligence tool that powers it. Pass `src` directly
 *  on a badge / node to opt out of the default Kiro mascot. */
export const AGENT_AVATAR_SRC = {
  exa:  '/exa.svg',
  kiro: KIRO_SRC,
} as const;

/** HTML badge — uses the Kiro image directly, framed in the agent's
 *  brand-tint halo so per-agent colouring is preserved. */
export function KiroGhostBadge({
  color = '#2EA8FF',
  size = 32,
  shape = 'rounded',
  ringed = true,
  style,
  title,
  src = KIRO_SRC,
}: {
  /** Brand tint for the halo ring. Defaults to BunkerGuard blue. */
  color?: string;
  size?: number;
  /** rounded square (default) or perfect circle */
  shape?: 'rounded' | 'circle';
  /** Show the coloured ring + glow around the image. Set false for a
   *  bare image (e.g. inline inside an already-coloured chip). */
  ringed?: boolean;
  style?: React.CSSProperties;
  title?: string;
  /** Override the default Kiro mascot image. Pass `AGENT_AVATAR_SRC.exa`
   *  for the Investigator agent (Exa-powered). */
  src?: string;
}) {
  const radius = shape === 'circle' ? size / 2 : Math.round(size * 0.26);
  return (
    <div
      title={title}
      style={{
        width: size, height: size, flexShrink: 0,
        borderRadius: radius,
        background: ringed ? `${color}22` : 'transparent',
        border: ringed ? `1px solid ${color}` : 'none',
        boxShadow: ringed ? `0 2px 8px ${color}44` : undefined,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        ...style,
      }}>
      <img
        src={src}
        alt="agent"
        width={size}
        height={size}
        draggable={false}
        style={{
          width: '100%', height: '100%',
          objectFit: 'contain',
          display: 'block',
          // The image already has its own rounded corners + purple bg,
          // so the wrapper ring just frames it.
        }}
      />
    </div>
  );
}

/** Inline SVG node — embeds the Kiro image inside a parent <svg> at
 *  (cx, cy) using percentage coordinates (the NetworkGraph convention).
 *  A pulse + colour halo sit behind it so the per-agent colour still
 *  reads through. */
export function KiroGhostNode({
  cx, cy, size = 7, color = '#2EA8FF', hovered = false, lit = false, idx = 0, src = KIRO_SRC,
}: {
  cx: number; cy: number;
  /** Image width as a % of the parent SVG. */
  size?: number;
  color?: string;
  hovered?: boolean;
  lit?: boolean;
  idx?: number;
  /** Override the default Kiro mascot image (e.g. Exa logo for Investigator). */
  src?: string;
}) {
  return (
    <g>
      {/* Outer pulse — marks "live" agents */}
      <circle
        cx={`${cx}%`} cy={`${cy}%`}
        r={size * 0.9}
        fill="none"
        stroke={color}
        strokeWidth="0.8"
        opacity="0.3"
      >
        <animate attributeName="r" values={`${size * 0.9};${size * 1.5};${size * 0.9}`} dur="3.5s" begin={`${idx * 0.5}s`} repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.35;0;0.35" dur="3.5s" begin={`${idx * 0.5}s`} repeatCount="indefinite"/>
      </circle>
      {/* Coloured halo behind the ghost */}
      <circle
        cx={`${cx}%`} cy={`${cy}%`}
        r={size * 0.75}
        fill={color}
        opacity={hovered ? 0.32 : lit ? 0.22 : 0.14}
        style={{ transition: 'all 200ms' }}
      />
      {/* The agent image — anchored on (cx, cy). Images carry their own
          background colour so we don't need an inner disc. */}
      <image
        href={src}
        x={`${cx - size * 0.55}%`}
        y={`${cy - size * 0.55}%`}
        width={`${size * 1.1}%`}
        height={`${size * 1.1}%`}
        preserveAspectRatio="xMidYMid meet"
        style={{
          filter: hovered
            ? `drop-shadow(0 0 4px ${color})`
            : `drop-shadow(0 0 2px ${color}88)`,
          transition: 'filter 200ms',
        }}
      />
    </g>
  );
}
