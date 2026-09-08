// Minimalist decor: smooth rounded planters with soft foliage — clean, not the
// "unfinished" white-cone look. Placed just inside the stage corners.
function Plant({ position, scale = 1, foliage = "#c9e7d2" }: { position: [number, number]; scale?: number; foliage?: string }) {
  return (
    <group position={[position[0], 0, position[1]]} scale={scale}>
      {/* Tapered planter */}
      <mesh position={[0, 1.0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.0, 0.75, 2.0, 24]} />
        <meshStandardMaterial color="#ffffff" roughness={0.85} />
      </mesh>
      <mesh position={[0, 2.02, 0]}>
        <cylinderGeometry args={[1.02, 1.02, 0.12, 24]} />
        <meshStandardMaterial color="#eef2fb" roughness={0.9} />
      </mesh>
      {/* Rounded foliage cluster */}
      <mesh position={[0, 3.1, 0]} castShadow>
        <icosahedronGeometry args={[1.25, 1]} />
        <meshStandardMaterial color={foliage} roughness={0.8} flatShading />
      </mesh>
      <mesh position={[0.7, 2.5, 0.3]} castShadow>
        <icosahedronGeometry args={[0.7, 1]} />
        <meshStandardMaterial color={foliage} roughness={0.8} flatShading />
      </mesh>
      <mesh position={[-0.6, 2.6, -0.2]} castShadow>
        <icosahedronGeometry args={[0.6, 1]} />
        <meshStandardMaterial color={foliage} roughness={0.8} flatShading />
      </mesh>
    </group>
  );
}

export function Decor() {
  return (
    <group>
      <Plant position={[-32, 24]} scale={1.15} foliage="#c9e7d2" />
      <Plant position={[-32, -24]} scale={1.05} foliage="#bfe0cf" />
      <Plant position={[60, 22]} scale={1.1} foliage="#cfe8d6" />
      <Plant position={[60, -22]} scale={1.0} foliage="#c9e7d2" />
    </group>
  );
}
