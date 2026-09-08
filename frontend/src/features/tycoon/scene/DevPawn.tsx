import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { dispatchSelection } from "../selectionEvent";

const ORB_COLOR: Record<string, string> = {
  WORKING: "#059669",
  IDLE: "#767586",
  WAITING: "#d97706",
  BLOCKED: "#ba1a1a",
  ASSIGNED: "#4f46e5",
};

export function DevPawn({
  projectId,
  projectAgentId,
  color,
  status,
  position,
}: {
  projectId: string;
  projectAgentId: string;
  color: string;
  status: string;
  position: [number, number, number];
}) {
  const group = useRef<THREE.Group>(null);
  // Only WORKING gets the active bob (FR-TY-6); others rest.
  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    const amp = status === "WORKING" ? 0.12 : 0.03;
    group.current.position.y = position[1] + Math.sin(t * 2) * amp;
  });

  return (
    <group
      ref={group}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        dispatchSelection({ projectId, type: "agent", projectAgentId });
      }}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "auto")}
    >
      <mesh castShadow position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.22, 0.28, 0.7, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh castShadow position={[0, 0.85, 0]}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color="#f8f9ff" />
      </mesh>
      {/* floating status orb */}
      <mesh position={[0, 1.3, 0]}>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshStandardMaterial
          color={ORB_COLOR[status] ?? "#767586"}
          emissive={ORB_COLOR[status] ?? "#767586"}
          emissiveIntensity={0.4}
        />
      </mesh>
    </group>
  );
}
