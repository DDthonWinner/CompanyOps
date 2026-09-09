// Ambient office decoration, varied by the project's budget tier.
//  HIGH   → lounge (rug + sofa + armchair + coffee table), floor lamps, wall art, big plants.
//  MEDIUM → a modest rug, a plant, one piece of wall art.
//  LOW    → sparse: stacked moving boxes + a lone small plant.
// Common to all tiers: a water cooler and a wall clock. Palette stays soft/warm to
// match the studio (no clashing saturated blocks).
import * as THREE from "three";

// Back wall sits at world z ≈ -41, left wall at world x ≈ -48 (see FloorGrid).
const BACK_Z = -40.2;
const LEFT_X = -47.2;

function WaterCooler({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 1.4, 0]} castShadow>
        <boxGeometry args={[1.6, 2.8, 1.6]} />
        <meshStandardMaterial color="#f3f5fb" roughness={0.7} />
      </mesh>
      <mesh position={[0, 3.4, 0]}>
        <cylinderGeometry args={[0.7, 0.7, 1.4, 16]} />
        <meshStandardMaterial color="#8fc7ff" transparent opacity={0.7} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[1.7, 0.3, 1.7]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>
    </group>
  );
}

function WallClock({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} rotation={[0, Math.PI / 2, 0]}>
      <mesh>
        <cylinderGeometry args={[1.5, 1.5, 0.3, 24]} />
        <meshStandardMaterial color="#ffffff" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[0.12, 0.9, 0.12]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      <mesh position={[0.35, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.1, 0.7, 0.1]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
    </group>
  );
}

function Plant({ position, scale = 1, foliage = "#c9e7d2" }: { position: [number, number, number]; scale?: number; foliage?: string }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 1.0, 0]} castShadow>
        <cylinderGeometry args={[1.0, 0.75, 2.0, 20]} />
        <meshStandardMaterial color="#ffffff" roughness={0.85} />
      </mesh>
      <mesh position={[0, 3.1, 0]} castShadow>
        <icosahedronGeometry args={[1.4, 1]} />
        <meshStandardMaterial color={foliage} roughness={0.8} flatShading />
      </mesh>
      <mesh position={[0.8, 2.4, 0.3]} castShadow>
        <icosahedronGeometry args={[0.8, 1]} />
        <meshStandardMaterial color={foliage} roughness={0.8} flatShading />
      </mesh>
    </group>
  );
}

function Rug({ position, size, color }: { position: [number, number, number]; size: [number, number]; color: string }) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
  );
}

function Sofa({ position, color = "#dfe4ee" }: { position: [number, number, number]; color?: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
        <boxGeometry args={[7, 0.8, 2.6]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.7, -1.1]} castShadow>
        <boxGeometry args={[7, 1.6, 0.5]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      {[-3.4, 3.4].map((x) => (
        <mesh key={x} position={[x, 1.4, 0]} castShadow>
          <boxGeometry args={[0.5, 1.2, 2.6]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function CoffeeTable({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 1.0, 0]} castShadow>
        <boxGeometry args={[3.4, 0.25, 2]} />
        <meshStandardMaterial color="#e7d8b8" roughness={0.6} />
      </mesh>
      {[[-1.4, -0.8], [1.4, -0.8], [-1.4, 0.8], [1.4, 0.8]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.5, z]}>
          <cylinderGeometry args={[0.12, 0.12, 1, 8]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.3} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function FloorLamp({ position, glow = "#ffdca8" }: { position: [number, number, number]; glow?: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.8, 0.9, 0.2, 16]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, 4.5, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 9, 10]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, 9.3, 0]}>
        <coneGeometry args={[1.4, 1.6, 20, 1, true]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 8.9, 0]}>
        <sphereGeometry args={[0.7, 14, 14]} />
        <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={0.9} toneMapped={false} />
      </mesh>
    </group>
  );
}

function WallArt({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[4.4, 3.2, 0.3]} />
        <meshStandardMaterial color="#ffffff" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0, 0.2]}>
        <planeGeometry args={[3.6, 2.4]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
    </group>
  );
}

function Boxes({ position }: { position: [number, number, number] }) {
  const box = (p: [number, number, number], s: number, r = 0) => (
    <mesh position={p} rotation={[0, r, 0]} castShadow receiveShadow>
      <boxGeometry args={[s, s, s]} />
      <meshStandardMaterial color="#c9a978" roughness={1} />
    </mesh>
  );
  return (
    <group position={position}>
      {box([0, 1.4, 0], 2.8)}
      {box([2.6, 1.1, 0.6], 2.2, 0.3)}
      {box([0.4, 3.4, -0.3], 2.0, -0.2)}
    </group>
  );
}

export function OfficeDecor({ tier }: { tier: string }) {
  return (
    <group>
      {/* Common */}
      <WaterCooler position={[-44, 0, 8]} />
      <WallClock position={[LEFT_X, 12, 6]} />

      {tier === "HIGH" && (
        <>
          <Rug position={[8, 0.34, 33]} size={[28, 15]} color="#c7d2fe" />
          <Sofa position={[2, 0, 37]} />
          <CoffeeTable position={[2, 0, 32.5]} />
          <Sofa position={[20, 0, 34]} color="#e8e0f0" />
          <FloorLamp position={[-8, 0, 31]} />
          <FloorLamp position={[42, 0, 26]} />
          <WallArt position={[-12, 10.5, BACK_Z]} color="#818cf8" />
          <WallArt position={[6, 11, BACK_Z]} color="#34d399" />
          <WallArt position={[24, 10.5, BACK_Z]} color="#f59e0b" />
          <Plant position={[54, 0, 20]} scale={1.4} foliage="#bfe3cd" />
          <Plant position={[-44, 0, -22]} scale={1.3} foliage="#c9e7d2" />
        </>
      )}

      {tier === "MEDIUM" && (
        <>
          <Rug position={[8, 0.34, 32]} size={[20, 11]} color="#e5e7f2" />
          <WallArt position={[6, 10.5, BACK_Z]} color="#93c5fd" />
          <Plant position={[52, 0, 18]} scale={1.2} />
          <FloorLamp position={[40, 0, 28]} glow="#ffe8c4" />
        </>
      )}

      {tier === "LOW" && (
        <>
          <Boxes position={[-42, 0, -24]} />
          <Boxes position={[46, 0, 24]} />
          <Plant position={[-40, 0, 26]} scale={0.9} />
        </>
      )}
    </group>
  );
}
