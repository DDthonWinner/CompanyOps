// Raised studio stage + subtle isometric grid. Centered on the scene (PM suite
// sits to the right, so the stage is offset in +x to frame the whole office).
const CENTER_X = 8;

export function FloorGrid() {
  return (
    <group position={[CENTER_X, 0, 0]}>
      {/* Raised base stage */}
      <mesh position={[0, -0.6, 0]} receiveShadow>
        <boxGeometry args={[150, 1.2, 108]} />
        <meshLambertMaterial color="#fcfdff" />
      </mesh>
      {/* Subtle grid lines */}
      <gridHelper args={[150, 50, "#e2e8f0", "#f1f5f9"]} position={[0, 0.02, 0]} />
    </group>
  );
}
