// Minor non-interactive white decorations (plants) for a more finished studio.
const LEAVES = 7;

function Plant({ position, scale = 1 }: { position: [number, number]; scale?: number }) {
  return (
    <group position={[position[0], 0, position[1]]} scale={scale}>
      <mesh position={[0, 1.2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.2, 0.9, 2.4, 20]} />
        <meshLambertMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0, 2.35, 0]}>
        <cylinderGeometry args={[1.15, 1.15, 0.2, 20]} />
        <meshLambertMaterial color="#f1f5f9" />
      </mesh>
      {Array.from({ length: LEAVES }).map((_, i) => {
        const angle = (i / LEAVES) * Math.PI * 2;
        const h = 3.2 + (i % 3) * 0.6;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * 0.4, 2.4 + h / 2, Math.sin(angle) * 0.4]}
            rotation={[Math.sin(angle) * 0.28, 0, -Math.cos(angle) * 0.28]}
            castShadow
          >
            <coneGeometry args={[0.5, h, 5]} />
            <meshLambertMaterial color="#ffffff" />
          </mesh>
        );
      })}
    </group>
  );
}

export function Decor() {
  return (
    <group>
      <Plant position={[-30, 30]} scale={1.1} />
      <Plant position={[-30, -30]} scale={1.2} />
      <Plant position={[30, 32]} scale={1.1} />
      <Plant position={[58, 22]} scale={1.15} />
      <Plant position={[58, -24]} scale={1.0} />
    </group>
  );
}
