import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Environment, Html } from '@react-three/drei';
import * as THREE from 'three';
import { VESSEL_GLB } from '../../../data/terminals';

interface SceneProps {
  /** [BDN qty MT, MFM qty MT] — drives the hose-flow animation speed. */
  bdnQty: number;
  mfmQty: number;
  /** Current drive_gain_pct from the latest mfm packet. Spikes >20% tint the hose yellow → orange. */
  driveGainPct: number;
  /** ISO string of latest packet — used as a key to subtly bump the live indicator. */
  recordedAt: string | null;
  /** Vessel name pair, only used for labels. */
  commercialVesselName: string;
  bargeVesselName: string;
  /** Visualization toggle: outside-the-zone shows a red geofence ring + warning tag. */
  outsideGeofence: boolean;
  /** Camera mode. Top-down is the monitoring default; iso is used when the
   *  dashboard map dives into this delivery (`?view=iso`). */
  cameraMode?: 'top' | 'iso';
}

const COMMERCIAL_POS: [number, number, number] = [ 60, 0, 0];
const BARGE_POS:      [number, number, number] = [-90, 0, -8];

/** Distance from the COMMERCIAL bow → BARGE stern that must fit horizontally
 *  in the camera frame, with padding for vessel hulls + name labels. */
const FRAME_HALF_WIDTH = 130;   // ≈ (60 - -90)/2 + 55 padding for hull + labels
const FRAME_HALF_DEPTH = 80;    // vertical extent (Z axis) we want visible

/* ─── Centred shared vessel scene ─────────────────────────────────────── */

function VesselModel({
  position, rotationY, scale, color,
}: { position: [number, number, number]; rotationY: number; scale: number; color?: string }) {
  const gltf = useGLTF(VESSEL_GLB);
  const centeredScene = useMemo(() => {
    const s = gltf.scene.clone(true);
    s.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(s);
    const center = new THREE.Vector3();
    box.getCenter(center);
    s.position.x -= center.x;
    s.position.z -= center.z;
    s.position.y -= box.min.y;
    s.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const m = o as THREE.Mesh;
        m.castShadow = false;
        m.receiveShadow = false;
        if (color) {
          const tint = new THREE.Color(color);
          const apply = (mat: THREE.Material) => {
            const std = mat as THREE.MeshStandardMaterial;
            const cloned = std.clone();
            if ((cloned as any).color) (cloned as any).color = tint.clone();
            cloned.needsUpdate = true;
            return cloned;
          };
          if (Array.isArray(m.material)) m.material = m.material.map(apply);
          else if (m.material) m.material = apply(m.material);
        }
      }
    });
    return s;
  }, [gltf, color]);

  return (
    <group position={position} rotation={[0, (rotationY * Math.PI) / 180, 0]} scale={scale}>
      <primitive object={centeredScene} />
    </group>
  );
}

/* ─── Animated fuel hose between barge and receiving vessel ───────────── */

function FuelHose({ from, to, flowSpeed, driveGain }: {
  from: [number, number, number]; to: [number, number, number];
  flowSpeed: number; driveGain: number;
}) {
  const curve = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    mid.y += 6;
    const cpA = mid.clone(); cpA.x = a.x * 0.65 + b.x * 0.35;
    const cpB = mid.clone(); cpB.x = a.x * 0.35 + b.x * 0.65;
    return new THREE.CubicBezierCurve3(a, cpA, cpB, b);
  }, [from, to]);

  const tubeGeo = useMemo(
    () => new THREE.TubeGeometry(curve, 80, 0.8, 16, false),
    [curve],
  );
  // Slightly larger sleeve geometry — receives the inner light glow.
  const sleeveGeo = useMemo(
    () => new THREE.TubeGeometry(curve, 80, 1.05, 16, false),
    [curve],
  );

  // Hose body stays a muted steel — the moving bars are what carries colour.
  const baseColor = new THREE.Color('#2C3F55');
  // Bars: clear bunkering-green. driveGain > 22% nudges toward red (warning).
  const flowColor = new THREE.Color(driveGain > 22 ? '#FF6B6B' : driveGain > 18 ? '#FFD23B' : '#34C98C');

  // Sleeve glow breathes subtly so the hose feels "energised".
  const sleeveRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    const m = sleeveRef.current;
    if (!m) return;
    const t = performance.now() * 0.001;
    m.opacity = 0.18 + Math.sin(t * (1 + flowSpeed * 0.02) * 4) * 0.07;
  });

  /* ── Light-bar flow: discrete glowing bars travel along the hose from the
   *    delivering barge to the receiving vessel, evenly spaced so they read
   *    as "one by one" rather than a continuous river. Solid colour, no per-
   *    bar breathing — the spacing carries the rhythm.                   */
  const STRIP_COUNT = 6;
  const stripRefs = useRef<THREE.Mesh[]>([]);
  const tmpPos    = useMemo(() => new THREE.Vector3(),      []);
  const tmpTan    = useMemo(() => new THREE.Vector3(),      []);
  const tmpQuat   = useMemo(() => new THREE.Quaternion(),   []);
  const tmpUp     = useMemo(() => new THREE.Vector3(0,1,0), []);

  useFrame(() => {
    const t = performance.now() * 0.00045 * (0.5 + flowSpeed * 0.014);
    for (let i = 0; i < STRIP_COUNT; i++) {
      const u = (t + i / STRIP_COUNT) % 1;
      const m = stripRefs.current[i];
      if (!m) continue;
      curve.getPoint(u, tmpPos);
      curve.getTangent(u, tmpTan).normalize();
      m.position.copy(tmpPos);
      m.position.y += 0.1;
      tmpQuat.setFromUnitVectors(tmpUp, tmpTan);
      m.quaternion.copy(tmpQuat);
      // Fade in at start, fade out at end — so bars "spawn" from the barge
      // and "land" at the vessel cleanly instead of popping at u=0 / u=1.
      const edgeFade = Math.min(1, u / 0.08) * Math.min(1, (1 - u) / 0.08);
      const mat = m.material as THREE.MeshBasicMaterial;
      if (mat) mat.opacity = 0.95 * edgeFade;
    }
  });

  /* ── Arrival halo at the receiver end — a pulsing ring that pops every
   *    time a strip "lands". Visual cue that energy is being delivered.   */
  const haloRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const m = haloRef.current;
    if (!m) return;
    const t = performance.now() * 0.001;
    const pulse = (Math.sin(t * 3.4 * (0.6 + flowSpeed * 0.012)) + 1) * 0.5; // 0..1
    const s = 1.5 + pulse * 1.8;
    m.scale.set(s, 1, s);
    const mat = m.material as THREE.MeshBasicMaterial;
    if (mat) mat.opacity = 0.35 + (1 - pulse) * 0.45;
  });

  return (
    <>
      {/* Hose body (solid rubber) */}
      <mesh geometry={tubeGeo}>
        <meshStandardMaterial color={baseColor} roughness={0.6} metalness={0.15} />
      </mesh>
      {/* Outer sleeve — soft additive glow so the hose feels lit from within */}
      <mesh geometry={sleeveGeo}>
        <meshBasicMaterial
          ref={sleeveRef as any}
          color={flowColor}
          transparent
          opacity={0.22}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Green light-bars travelling one by one toward the receiver */}
      {Array.from({ length: STRIP_COUNT }).map((_, i) => (
        <mesh
          key={i}
          ref={(m) => { if (m) stripRefs.current[i] = m as THREE.Mesh; }}
        >
          {/* Short bright bar — wider than hose so it visibly "wraps" it */}
          <cylinderGeometry args={[1.05, 1.05, 3.2, 14, 1, false]} />
          <meshBasicMaterial
            color={flowColor}
            transparent
            opacity={0.95}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}

      {/* Arrival halo on the water at the receiver end */}
      <mesh ref={haloRef} position={[to[0], 0.05, to[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.4, 2.4, 48]} />
        <meshBasicMaterial
          color={flowColor}
          transparent
          opacity={0.55}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </>
  );
}

/* ─── MPA anchorage geofence ring on the sea surface ──────────────────── */

function GeofenceRing({ outside }: { outside: boolean }) {
  const color = outside ? '#FF5656' : '#00D47E';
  // Ring around the operation. Scale (in scene units) corresponds to the
  // anchorage_geofences.geofence_radius_m (2000 m) — we visualise at a
  // demo-friendly 130 units so it sits just inside the camera frame.
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-15, 0.02, 0]}>
        <ringGeometry args={[125, 130, 96]} />
        <meshBasicMaterial color={color} transparent opacity={0.75} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-15, 0.01, 0]}>
        <ringGeometry args={[118, 125, 96]} />
        <meshBasicMaterial color={color} transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

/* ─── Responsive camera (top-down or isometric) ──────────────────────────
 *  Top-down: monitoring view — both vessels read clearly, hose flow visible.
 *  Isometric: dive view — used when the dashboard map navigates here with
 *  `?view=iso`. Camera sits at 30° elevation, 45° rotation, classic iso. */

function ResponsiveCamera({ mode = 'top' }: { mode?: 'top' | 'iso' }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const persp = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    const fovRad = (persp.fov * Math.PI) / 180;
    const distForHoriz = FRAME_HALF_WIDTH / (Math.tan(fovRad / 2) * aspect);
    const distForVert  = FRAME_HALF_DEPTH / Math.tan(fovRad / 2);
    const dist = Math.max(distForHoriz, distForVert) * 1.10;  // +10% padding

    if (mode === 'iso') {
      // True isometric: 35° elevation, 45° rotation.
      const elev = (35 * Math.PI) / 180;
      const rot  = (45 * Math.PI) / 180;
      const r = dist * 0.95;
      const x = -15 + r * Math.cos(elev) * Math.cos(rot);
      const y =       r * Math.sin(elev);
      const z =  12 + r * Math.cos(elev) * Math.sin(rot);
      persp.position.set(x, y, z);
    } else {
      persp.position.set(-15, dist, 12);
    }
    persp.lookAt(-15, 0, 0);
    persp.updateProjectionMatrix();
  }, [camera, size.width, size.height, mode]);
  return null;
}

/* ─── Scene root ──────────────────────────────────────────────────────── */

function Scene({ bdnQty, mfmQty, driveGainPct, commercialVesselName, bargeVesselName, outsideGeofence, cameraMode }: SceneProps) {
  const flowSpeed = bdnQty > 0 ? (mfmQty / bdnQty) * 100 : 50;

  return (
    <>
      <ResponsiveCamera mode={cameraMode ?? 'top'} />
      <color attach="background" args={['#031424']} />
      <fog attach="fog" args={['#031424', 100, 600]} />

      {/* Top-down lighting */}
      <hemisphereLight args={['#a7ccef', '#0a1825', 0.6]} />
      <directionalLight position={[60, 100, 30]} intensity={1.4} color="#fff5e6" />

      {/* Water plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
        <planeGeometry args={[600, 400]} />
        <meshStandardMaterial color="#073049" roughness={0.45} metalness={0.6} />
      </mesh>

      <GeofenceRing outside={outsideGeofence} />

      {/* Commercial vessel — scaled larger to read as a big cargo ship. */}
      <Suspense fallback={null}>
        {/* In real Singapore bunkering ops the BUNKER VESSEL (delivering) is
            the larger tanker that pulls alongside the smaller receiving ship. */}
        <VesselModel position={COMMERCIAL_POS} rotationY={90} scale={0.55} />
        <VesselModel position={BARGE_POS}      rotationY={90} scale={1.4} />
        <Environment preset="city" />
      </Suspense>

      {/* Direction: barge ALLI (delivering) → commercial vessel (receiving).
       *  Bars spawn at `from` and land at `to`, so the arrival halo pulses on
       *  the receiver side. */}
      <FuelHose
        from={[BARGE_POS[0] - 14, 4, BARGE_POS[2] + 3]}
        to={[COMMERCIAL_POS[0] + 22, 4, COMMERCIAL_POS[2] + 6]}
        flowSpeed={flowSpeed}
        driveGain={driveGainPct}
      />

      {/* Vessel name labels (Html overlay) */}
      <Html position={[COMMERCIAL_POS[0], 20, COMMERCIAL_POS[2] - 18]} center distanceFactor={300}>
        <div style={{
          background: 'rgba(8,19,31,0.92)',
          border: '1px solid rgba(46,168,255,0.45)',
          color: '#E5F2FF',
          padding: '4px 9px',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.6,
          whiteSpace: 'nowrap',
        }}>
          🚢 {commercialVesselName}
          <div style={{ fontSize: 8, color: '#FF5656', marginTop: 2 }}>
            RECEIVING · MFM 481.2 MT
          </div>
        </div>
      </Html>
      <Html position={[BARGE_POS[0], 14, BARGE_POS[2] - 12]} center distanceFactor={300}>
        <div style={{
          background: 'rgba(8,19,31,0.92)',
          border: '1px solid rgba(0,212,126,0.45)',
          color: '#E5F2FF',
          padding: '4px 9px',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.6,
          whiteSpace: 'nowrap',
        }}>
          ⛴ {bargeVesselName}
          <div style={{ fontSize: 8, color: '#00D47E', marginTop: 2 }}>
            DELIVERING · BDN 500 MT
          </div>
        </div>
      </Html>

      {/* Outside-zone warning when geofence breached */}
      {outsideGeofence && (
        <Html position={[-15, 30, 60]} center distanceFactor={250}>
          <div style={{
            background: 'rgba(255,86,86,0.92)',
            color: '#fff',
            padding: '5px 10px',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.6,
            border: '1px solid #fff',
            boxShadow: '0 0 14px #FF5656',
            whiteSpace: 'nowrap',
          }}>
            🚨 VESSEL OUTSIDE EASTERN ANCHORAGE
          </div>
        </Html>
      )}
    </>
  );
}

export function LiveSessionScene(props: SceneProps) {
  return (
    <Canvas
      shadows={false}
      dpr={[1, 2]}
      camera={{ position: [-15, 230, 15], fov: 50, near: 1, far: 1500 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, outputColorSpace: THREE.SRGBColorSpace }}
    >
      <Scene {...props} />
    </Canvas>
  );
}
