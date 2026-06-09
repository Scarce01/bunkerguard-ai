import * as THREE from 'three';

interface ProceduralVesselProps {
  hullColor?: string;
  deckColor?: string;
}

/** Lightweight fallback ship used when the optional vessel GLB is unavailable. */
export function ProceduralVessel({
  hullColor = '#243746',
  deckColor = '#C8D4DC',
}: ProceduralVesselProps) {
  return (
    <group>
      <mesh position={[0, 5, 0]}>
        <boxGeometry args={[112, 10, 25]} />
        <meshStandardMaterial color={hullColor} roughness={0.65} metalness={0.25} />
      </mesh>
      <mesh position={[53, 6, 0]} rotation={[0, 0, -Math.PI / 4]}>
        <boxGeometry args={[17, 8, 24]} />
        <meshStandardMaterial color={hullColor} roughness={0.65} metalness={0.25} />
      </mesh>
      <mesh position={[-35, 13, 0]}>
        <boxGeometry args={[22, 12, 19]} />
        <meshStandardMaterial color={deckColor} roughness={0.55} />
      </mesh>
      <mesh position={[-38, 21, 0]}>
        <boxGeometry args={[13, 5, 13]} />
        <meshStandardMaterial color="#E7EDF2" roughness={0.5} />
      </mesh>
      {[-12, 10, 32].map((x) => (
        <mesh key={x} position={[x, 12, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[7, 7, 18, 20]} />
          <meshStandardMaterial color="#8E5D3F" roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[-38, 27, 0]}>
        <cylinderGeometry args={[0.7, 0.7, 9, 10]} />
        <meshStandardMaterial color="#AFC4D4" />
      </mesh>
      <mesh position={[-38, 31.5, 0]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[6, 0.7, 0.7]} />
        <meshStandardMaterial color="#AFC4D4" />
      </mesh>
      <mesh position={[0, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[130, 32]} />
        <meshBasicMaterial
          color={new THREE.Color('#2EA8FF')}
          transparent
          opacity={0.08}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
