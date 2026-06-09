import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  TERMINALS,
  TerminalInfo,
  statusColor,
  statusLabel,
} from '../../../data/terminals';

interface Props {
  /**
   * Fired after the cinematic flyTo finishes — by then the 3D viewer should
   * mount and take over. Until this fires the map stays interactive.
   */
  onSelect: (t: TerminalInfo) => void;
  /**
   * Fired the moment a pin is clicked, before the flyTo completes. The host
   * can use it to start fading the map out / the 3D viewer in over the dive.
   */
  onPinClick?: (t: TerminalInfo) => void;
  /**
   * Increment from the parent each time the user returns from the 3D viewer.
   * The map flies back to the Singapore overview so the pin overlay aligns
   * with the visible coastline again.
   */
  resetSignal?: number;
}

/** Default overview camera — south-of-Singapore so all 10 pins are framed. */
const OVERVIEW_VIEW = {
  center: [103.78, 1.24] as [number, number],
  zoom: 10.4,
  pitch: 35,
  bearing: -8,
};

/* CartoDB dark-matter is a free, no-key vector style with accurate SG coastline. */
const STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

export function SingaporeMap({ onSelect, onPinClick, resetSignal }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [diving, setDiving] = useState<string | null>(null);  // id of pin being dived-into

  /** Fly back to the overview camera whenever the parent signals a return. */
  useEffect(() => {
    if (resetSignal === undefined || resetSignal === 0) return;
    let cancelled = false;
    const tryReset = (attempt: number) => {
      const m = mapRef.current;
      if (cancelled) return;
      if (!m) {
        if (attempt < 20) setTimeout(() => tryReset(attempt + 1), 80);
        return;
      }
      // Cancel any in-flight flyTo (e.g. the dive) before resetting,
      // then animate gently back to the overview.
      m.stop();
      m.flyTo({
        center: OVERVIEW_VIEW.center,
        zoom: OVERVIEW_VIEW.zoom,
        pitch: OVERVIEW_VIEW.pitch,
        bearing: OVERVIEW_VIEW.bearing,
        duration: 900,
        essential: true,
        curve: 1.4,
      });
    };
    tryReset(0);
    return () => { cancelled = true; };
  }, [resetSignal]);

  /** Cinematic flyTo dive: swoop into the pin then hand off to the 3D viewer. */
  function dive(t: TerminalInfo) {
    const m = mapRef.current;
    if (!m || diving) return;
    setDiving(t.id);
    onPinClick?.(t);
    // Two-stage easing: pitch up first (60° tilt), zoom in tight, slight bearing rotation.
    m.flyTo({
      center: [t.lng, t.lat],
      zoom: 15.6,
      pitch: 62,
      bearing: -22,
      duration: 1800,
      essential: true,
      curve: 1.6,
    });
    // Hand off slightly before the flyTo finishes so the 3D scene's fade-in overlaps the final zoom frames.
    window.setTimeout(() => {
      onSelect(t);
      setDiving(null);
    }, 1500);
  }

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: OVERVIEW_VIEW.center,
      zoom: OVERVIEW_VIEW.zoom,
      minZoom: 9,
      maxZoom: 16,
      pitch: OVERVIEW_VIEW.pitch,
      bearing: OVERVIEW_VIEW.bearing,
      attributionControl: { compact: true },
      dragRotate: true,
      pitchWithRotate: true,
      cooperativeGestures: false,
    });
    mapRef.current = map;

    map.on('load', () => {
      // Tint water deeper navy + dim land for the BunkerGuard look
      const layers = map.getStyle().layers || [];
      for (const layer of layers) {
        const id = layer.id;
        try {
          if (id.startsWith('water')) {
            map.setPaintProperty(id, 'fill-color', '#020812');
          } else if (id.includes('background')) {
            map.setPaintProperty(id, 'background-color', '#050e1a');
          } else if (id.includes('landuse') || id === 'land' || id.includes('park')) {
            map.setPaintProperty(id, 'fill-color', '#0a1b2a');
          } else if (id.startsWith('road')) {
            try { map.setPaintProperty(id, 'line-color', 'rgba(60,90,120,0.35)'); } catch {}
          } else if (id.includes('label') || id.includes('place')) {
            try { map.setPaintProperty(id, 'text-color', 'rgba(180,210,235,0.5)'); } catch {}
            try { map.setPaintProperty(id, 'text-halo-color', 'rgba(2,8,18,0.9)'); } catch {}
          }
        } catch { /* ignore unsupported props per layer */ }
      }

      // Add a soft glow ring under each terminal location to draw the eye
      map.addSource('terminal-rings', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: TERMINALS.map(t => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [t.lng, t.lat] },
            properties: { id: t.id, status: t.status },
          })),
        },
      });
      map.addLayer({
        id: 'terminal-rings-glow',
        type: 'circle',
        source: 'terminal-rings',
        paint: {
          'circle-radius': 22,
          'circle-color': [
            'match', ['get', 'status'],
            'online', '#00D47E',
            'degraded', '#FFA940',
            'offline', '#FF3333',
            '#4A6B88'
          ],
          'circle-opacity': 0.12,
          'circle-blur': 0.7,
        },
      });
    });

    map.on('error', () => { /* swallow tile fetch flickers */ });

    return () => map.remove();
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#02060A' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Pin overlay positioned via map.project — re-rendered every frame via state subscription */}
      <PinOverlay
        map={mapRef}
        hovered={hovered}
        setHovered={setHovered}
        onSelect={dive}
        diving={diving}
      />

      {/* Dive vignette — radial darkness closing in as the camera plunges */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, transparent 0%, transparent 35%, rgba(2,6,10,0.85) 100%)',
        opacity: diving ? 1 : 0,
        transition: 'opacity 1.2s ease-in',
        zIndex: 3,
      }} />

      {/* Chromatic streak / motion-blur flash during dive */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(circle at center, rgba(46,168,255,0.15) 0%, transparent 40%)',
        opacity: diving ? 1 : 0,
        transform: diving ? 'scale(2.5)' : 'scale(1)',
        transition: 'opacity 1.5s ease-out, transform 1.6s cubic-bezier(0.7,0,0.84,0)',
        zIndex: 4,
        mixBlendMode: 'screen',
      }} />

      {/* Cloud layer — billowing puffs streaming past the camera on the way down */}
      {diving && <CloudPass />}

      {/* Header banner */}
      <div style={{
        position: 'absolute',
        left: 14, top: 14,
        background: 'rgba(8,19,31,0.88)',
        border: '1px solid rgba(46,168,255,0.28)',
        borderRadius: 8,
        padding: '10px 14px',
        backdropFilter: 'blur(10px)',
        pointerEvents: 'none',
        zIndex: 2,
      }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#2EA8FF',
          textTransform: 'uppercase', letterSpacing: 1.5 }}>Singapore Bunkering Network</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#EFF4F9', marginTop: 1 }}>
          10 Terminals · 28 Vessels Berthed
        </div>
        <div style={{ fontSize: 10, color: '#557A96', marginTop: 2 }}>
          Click any pin to inspect terminal in 3D
        </div>
      </div>

      {/* Legend */}
      <div style={{
        position: 'absolute',
        left: 14, bottom: 14,
        background: 'rgba(8,19,31,0.88)',
        border: '1px solid rgba(46,168,255,0.28)',
        borderRadius: 8,
        padding: '8px 12px',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        gap: 14,
        pointerEvents: 'none',
        zIndex: 2,
      }}>
        {(['online','degraded','offline','unavailable'] as const).map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: statusColor(s),
              boxShadow: `0 0 6px ${statusColor(s)}80`,
            }} />
            <span style={{ fontSize: 9.5, color: '#8BB4D6', fontWeight: 600, letterSpacing: 0.5 }}>
              {statusLabel(s)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Cloud pass — wispy clouds streaming past the camera during the dive ── */

/**
 * 14 soft puff layers radiating outward from the dive target. Each puff
 * starts small + nearly invisible near center, billows up as it streaks
 * past, then thins out at the edge — like rushing down through scattered
 * morning cloud cover.
 */
/**
 * 40 cloud puffs across three depth layers:
 *  - FAR   (12): small, slow, slight blur, more opaque (look like distant clouds)
 *  - MID   (16): medium speed/size
 *  - NEAR  (12): large, fast, heavily blurred (foreground wisps streaming past)
 *
 * Each puff travels along a curved path via translateX + a subtle Y wobble +
 * slow rotation, then scales up and fades, so the motion reads as billowing
 * volumetric cloud rather than a uniform radial sweep.
 */
function CloudPass() {
  // Hard-coded so render is deterministic and bug-resistant.
  // Format: [angleDeg, layer, sizePx, delayS, durationS, alpha, hue]
  const puffs: Array<{
    angle: number; layer: 'far' | 'mid' | 'near';
    size: number; delay: number; dur: number; alpha: number; hue: number;
  }> = [
    // FAR layer (slow, smaller, less blur)
    { angle:   0, layer: 'far', size: 110, delay: 0.00, dur: 2.0, alpha: 0.55, hue: 215 },
    { angle:  30, layer: 'far', size: 130, delay: 0.30, dur: 2.2, alpha: 0.50, hue: 218 },
    { angle:  60, layer: 'far', size: 100, delay: 0.50, dur: 1.9, alpha: 0.60, hue: 212 },
    { angle:  90, layer: 'far', size: 140, delay: 0.10, dur: 2.4, alpha: 0.55, hue: 220 },
    { angle: 120, layer: 'far', size: 115, delay: 0.40, dur: 2.0, alpha: 0.50, hue: 210 },
    { angle: 150, layer: 'far', size: 125, delay: 0.20, dur: 2.1, alpha: 0.58, hue: 218 },
    { angle: 180, layer: 'far', size: 105, delay: 0.55, dur: 1.9, alpha: 0.52, hue: 215 },
    { angle: 210, layer: 'far', size: 135, delay: 0.05, dur: 2.3, alpha: 0.60, hue: 222 },
    { angle: 240, layer: 'far', size: 115, delay: 0.35, dur: 2.0, alpha: 0.48, hue: 208 },
    { angle: 270, layer: 'far', size: 125, delay: 0.15, dur: 2.2, alpha: 0.55, hue: 216 },
    { angle: 300, layer: 'far', size: 110, delay: 0.45, dur: 1.9, alpha: 0.50, hue: 213 },
    { angle: 330, layer: 'far', size: 130, delay: 0.25, dur: 2.1, alpha: 0.56, hue: 220 },

    // MID layer (medium speed/size)
    { angle:  15, layer: 'mid', size: 200, delay: 0.10, dur: 1.5, alpha: 0.60, hue: 215 },
    { angle:  37, layer: 'mid', size: 180, delay: 0.32, dur: 1.4, alpha: 0.55, hue: 218 },
    { angle:  68, layer: 'mid', size: 220, delay: 0.18, dur: 1.6, alpha: 0.62, hue: 212 },
    { angle:  93, layer: 'mid', size: 195, delay: 0.45, dur: 1.5, alpha: 0.58, hue: 220 },
    { angle: 113, layer: 'mid', size: 205, delay: 0.08, dur: 1.5, alpha: 0.55, hue: 216 },
    { angle: 138, layer: 'mid', size: 215, delay: 0.38, dur: 1.6, alpha: 0.60, hue: 222 },
    { angle: 163, layer: 'mid', size: 185, delay: 0.20, dur: 1.4, alpha: 0.52, hue: 210 },
    { angle: 192, layer: 'mid', size: 230, delay: 0.05, dur: 1.7, alpha: 0.65, hue: 218 },
    { angle: 217, layer: 'mid', size: 195, delay: 0.42, dur: 1.5, alpha: 0.55, hue: 214 },
    { angle: 247, layer: 'mid', size: 210, delay: 0.15, dur: 1.6, alpha: 0.58, hue: 220 },
    { angle: 277, layer: 'mid', size: 175, delay: 0.50, dur: 1.4, alpha: 0.50, hue: 212 },
    { angle: 297, layer: 'mid', size: 220, delay: 0.25, dur: 1.6, alpha: 0.60, hue: 218 },
    { angle: 322, layer: 'mid', size: 195, delay: 0.35, dur: 1.5, alpha: 0.55, hue: 216 },
    { angle: 348, layer: 'mid', size: 215, delay: 0.12, dur: 1.6, alpha: 0.62, hue: 222 },
    { angle:   8, layer: 'mid', size: 200, delay: 0.40, dur: 1.5, alpha: 0.55, hue: 218 },
    { angle: 354, layer: 'mid', size: 185, delay: 0.18, dur: 1.5, alpha: 0.58, hue: 214 },

    // NEAR layer (large, fast, heavily blurred)
    { angle:  22, layer: 'near', size: 340, delay: 0.05, dur: 1.0, alpha: 0.75, hue: 215 },
    { angle:  55, layer: 'near', size: 380, delay: 0.18, dur: 1.1, alpha: 0.80, hue: 220 },
    { angle:  98, layer: 'near', size: 320, delay: 0.30, dur: 1.0, alpha: 0.70, hue: 216 },
    { angle: 132, layer: 'near', size: 400, delay: 0.08, dur: 1.2, alpha: 0.82, hue: 222 },
    { angle: 175, layer: 'near', size: 350, delay: 0.22, dur: 1.0, alpha: 0.75, hue: 218 },
    { angle: 208, layer: 'near', size: 380, delay: 0.35, dur: 1.1, alpha: 0.78, hue: 220 },
    { angle: 240, layer: 'near', size: 330, delay: 0.12, dur: 1.0, alpha: 0.72, hue: 215 },
    { angle: 268, layer: 'near', size: 395, delay: 0.25, dur: 1.1, alpha: 0.80, hue: 222 },
    { angle: 295, layer: 'near', size: 360, delay: 0.05, dur: 1.0, alpha: 0.75, hue: 218 },
    { angle: 320, layer: 'near', size: 410, delay: 0.32, dur: 1.2, alpha: 0.82, hue: 220 },
    { angle: 345, layer: 'near', size: 340, delay: 0.15, dur: 1.0, alpha: 0.74, hue: 216 },
    { angle:   3, layer: 'near', size: 390, delay: 0.28, dur: 1.1, alpha: 0.78, hue: 220 },
  ];

  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      overflow: 'hidden',
      zIndex: 5,
      mixBlendMode: 'screen',
    }}>
      {puffs.map((p, i) => {
        // Per-layer animation choices
        const blur = p.layer === 'near' ? 26 : p.layer === 'mid' ? 14 : 7;
        const anim = p.layer === 'near' ? 'cloudPuffNear'
                   : p.layer === 'mid'  ? 'cloudPuffMid'
                                        : 'cloudPuffFar';
        // Wisp-shape ratio: clouds are wider than tall (1.6:1)
        const w = p.size * 1.6;
        const h = p.size * 0.9;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: '50%', top: '50%',
              width: 0, height: 0,
              transform: `rotate(${p.angle}deg)`,
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0, top: 0,
                width: `${w}px`,
                height: `${h}px`,
                marginLeft: `${-w / 2}px`,
                marginTop: `${-h / 2}px`,
                // Soft elliptical billow — wider than tall, with stacked highlights
                // for a more cumulus-looking interior.
                background: `
                  radial-gradient(ellipse 60% 70% at 35% 40%, hsla(${p.hue}, 80%, 99%, ${p.alpha}) 0%, hsla(${p.hue}, 70%, 95%, ${p.alpha * 0.7}) 35%, transparent 70%),
                  radial-gradient(ellipse 75% 80% at 65% 55%, hsla(${p.hue}, 65%, 94%, ${p.alpha * 0.85}) 0%, hsla(${p.hue}, 60%, 88%, ${p.alpha * 0.5}) 40%, transparent 75%),
                  radial-gradient(ellipse 90% 70% at 50% 50%, hsla(${p.hue}, 55%, 85%, ${p.alpha * 0.55}) 0%, transparent 80%)
                `,
                animation: `${anim} ${p.dur}s cubic-bezier(0.36, 0.04, 0.56, 1) ${p.delay}s forwards`,
                opacity: 0,
                filter: `blur(${blur}px)`,
                borderRadius: '50%',
              }}
            />
          </div>
        );
      })}
      <style>{`
        /* Each layer uses slightly different drift to suggest depth.
           Y wobble + rotation create the "billowing" cloud feel. */
        @keyframes cloudPuffNear {
          0%   { opacity: 0;    transform: translate( 0vmax, 0)        rotate(0deg)   scale(0.4); }
          18%  { opacity: 0.95; }
          50%  { opacity: 1; transform: translate( 20vmax, -1.5vmax)  rotate( 6deg)  scale(1.0); }
          80%  { opacity: 0.8; }
          100% { opacity: 0;    transform: translate( 65vmax,  2vmax)  rotate(12deg)  scale(1.7); }
        }
        @keyframes cloudPuffMid {
          0%   { opacity: 0;    transform: translate( 0vmax, 0)        rotate(0deg)   scale(0.5); }
          22%  { opacity: 0.85; }
          55%  { opacity: 0.9;  transform: translate( 14vmax,  1vmax)   rotate(-4deg)  scale(1.0); }
          85%  { opacity: 0.5; }
          100% { opacity: 0;    transform: translate( 50vmax, -1.5vmax) rotate(-8deg)  scale(1.5); }
        }
        @keyframes cloudPuffFar {
          0%   { opacity: 0;    transform: translate( 0vmax, 0)        rotate(0deg)   scale(0.6); }
          25%  { opacity: 0.65; }
          60%  { opacity: 0.7;  transform: translate( 9vmax,  0.5vmax)  rotate( 3deg)  scale(1.0); }
          90%  { opacity: 0.3; }
          100% { opacity: 0;    transform: translate( 32vmax, -0.8vmax) rotate( 7deg)  scale(1.3); }
        }
      `}</style>
    </div>
  );
}

/* ─── Pin overlay tracks the map and re-projects pins each frame ────── */

interface PinOverlayProps {
  map: React.RefObject<maplibregl.Map | null>;
  hovered: string | null;
  setHovered: (id: string | null) => void;
  onSelect: (t: TerminalInfo) => void;
  diving: string | null;
}

function PinOverlay({ map, hovered, setHovered, onSelect, diving }: PinOverlayProps) {
  const [, force] = useState(0);

  /**
   * Re-project pins every frame whenever the map exists. Simpler and more
   * reliable than juggling map.on/off subscriptions — those broke when the
   * map wasn't ready at mount and missed direct setCenter/setZoom calls
   * (which don't always emit the same events as flyTo).
   */
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      if (map.current) force(x => (x + 1) & 0xffff);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [map]);

  const m = map.current;
  if (!m) return null;
  const container = m.getContainer();
  const w = container.clientWidth;

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      zIndex: 1,
    }}>
      {TERMINALS.map(t => {
        const p = m.project([t.lng, t.lat]);
        const onRight = p.x > w * 0.65;
        const isHover = hovered === t.id;
        const isDiving = diving === t.id;
        const otherDiving = diving !== null && diving !== t.id;
        const color = statusColor(t.status);
        const disabled = t.status === 'unavailable';
        return (
          <div
            key={t.id}
            style={{
              position: 'absolute',
              left: p.x,
              top: p.y,
              transform: 'translate(-50%, -50%)',
              pointerEvents: diving ? 'none' : 'auto',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.55 : (otherDiving ? 0.15 : 1),
              transition: 'opacity 600ms ease',
            }}
            onClick={() => !disabled && !diving && onSelect(t)}
            onMouseEnter={() => setHovered(t.id)}
            onMouseLeave={() => setHovered(null)}
          >
            {/* Pulse */}
            {!disabled && (
              <div className="bg-pulse-ring" style={{
                position: 'absolute',
                left: '50%', top: '50%',
                width: 14, height: 14,
                marginLeft: -7, marginTop: -7,
                borderRadius: '50%',
                background: color,
                opacity: 0.3,
                animation: 'bgPulse 2.6s ease-in-out infinite',
                filter: 'blur(2px)',
              }} />
            )}
            {/* Diving expansion ring */}
            {isDiving && (
              <div style={{
                position: 'absolute',
                left: '50%', top: '50%',
                width: 14, height: 14,
                marginLeft: -7, marginTop: -7,
                borderRadius: '50%',
                border: `2px solid ${color}`,
                animation: 'diveRing 1.5s ease-out forwards',
                pointerEvents: 'none',
              }} />
            )}
            {/* Core dot */}
            <div style={{
              position: 'relative',
              width: isDiving ? 22 : (isHover ? 14 : 11),
              height: isDiving ? 22 : (isHover ? 14 : 11),
              borderRadius: '50%',
              background: color,
              border: isDiving ? `3px solid #fff` : '2px solid #fff',
              boxShadow: isDiving
                ? `0 0 0 1px rgba(0,0,0,0.4), 0 0 32px ${color}, 0 0 64px ${color}80`
                : `0 0 0 1px rgba(0,0,0,0.4), 0 0 10px ${color}80`,
              transition: 'all 220ms ease',
            }} />
            {/* Label */}
            <div style={{
              position: 'absolute',
              left: onRight ? 'auto' : 18,
              right: onRight ? 18 : 'auto',
              top: -4,
              background: isHover ? 'rgba(8,19,31,0.97)' : 'rgba(8,19,31,0.78)',
              border: `1px solid ${isHover ? color : 'rgba(46,168,255,0.25)'}`,
              padding: '4px 8px',
              borderRadius: 4,
              whiteSpace: 'nowrap',
              transition: 'all 200ms ease',
              backdropFilter: 'blur(6px)',
              opacity: isDiving ? 0 : 1,
            }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: '#E5F2FF', letterSpacing: 0.4 }}>
                {t.id} · {t.operator}
              </div>
              <div style={{ fontSize: 7.5, fontWeight: 700, color, letterSpacing: 0.8, marginTop: 1 }}>
                ● {statusLabel(t.status)}
              </div>
            </div>
          </div>
        );
      })}

      <style>{`
        @keyframes bgPulse {
          0%   { transform: scale(0.6); opacity: 0.45; }
          70%  { transform: scale(3.2); opacity: 0; }
          100% { transform: scale(3.2); opacity: 0; }
        }
        @keyframes diveRing {
          0%   { width: 14px; height: 14px; margin-left: -7px; margin-top: -7px; opacity: 0.9; }
          100% { width: 320px; height: 320px; margin-left: -160px; margin-top: -160px; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
