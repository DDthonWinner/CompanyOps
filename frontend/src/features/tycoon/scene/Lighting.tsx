// Performance-limited lighting (05 §3.1.1): ambient + 1 directional (shadow) + 1 fill.
export function Lighting() {
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight
        position={[6, 10, 6]}
        intensity={0.9}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight position={[-6, 6, -4]} intensity={0.35} />
    </>
  );
}
