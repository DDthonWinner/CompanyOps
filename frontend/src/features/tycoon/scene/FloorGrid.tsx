export function FloorGrid() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[30, 20]} />
        <meshStandardMaterial color="#eef3ff" />
      </mesh>
      <gridHelper args={[30, 30, "#c7c4d7", "#dce9ff"]} position={[0, 0, 0]} />
    </group>
  );
}
