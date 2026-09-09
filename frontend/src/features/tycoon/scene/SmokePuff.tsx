// A short-lived puff of smoke: white puffs expand, rise, and fade, then remove.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const DURATION = 0.7;

export function SmokePuff({ position, onDone }: { position: [number, number, number]; onDone: () => void }) {
  const group = useRef<THREE.Group>(null);
  const start = useRef<number | null>(null);
  const puffs = useMemo(
    () => Array.from({ length: 7 }, (_, i) => ({ angle: (i / 7) * Math.PI * 2, r: 0.5 + (i % 3) * 0.35 })),
    [],
  );

  useFrame((state) => {
    if (start.current == null) start.current = state.clock.elapsedTime;
    const k = (state.clock.elapsedTime - start.current) / DURATION;
    if (k >= 1) {
      onDone();
      return;
    }
    const g = group.current;
    if (!g) return;
    g.scale.setScalar(1 + k * 2.4);
    g.position.y = position[1] + k * 3;
    for (const child of g.children) {
      const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      mat.opacity = (1 - k) * 0.92;
    }
  });

  return (
    <group ref={group} position={position}>
      {puffs.map((p, i) => (
        <mesh key={i} position={[Math.cos(p.angle) * p.r, 1, Math.sin(p.angle) * p.r]}>
          <sphereGeometry args={[0.8, 12, 12]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.9} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
