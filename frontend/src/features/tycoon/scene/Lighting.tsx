// Ambient + key (shadow-casting) + indigo fill, sized for the larger office stage.
export function Lighting() {
  return (
    <>
      <ambientLight intensity={0.95} />
      <directionalLight
        position={[60, 120, 55]}
        intensity={0.9}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={10}
        shadow-camera-far={360}
        shadow-camera-left={-90}
        shadow-camera-right={90}
        shadow-camera-top={90}
        shadow-camera-bottom={-90}
        shadow-bias={-0.0005}
      />
      <directionalLight position={[-70, 45, -55]} intensity={0.35} color="#818cf8" />
    </>
  );
}
