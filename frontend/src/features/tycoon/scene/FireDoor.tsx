// Red "해고" (dismissal) door. Dragging an agent onto it removes them from the
// project. Glows when an agent is hovered over its drop zone.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { agentDrag } from "./agentDrag";

function makeSign(): THREE.CanvasTexture | null {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 192;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#dc2626";
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(16, 20, 480, 150, 30);
    ctx.fill();
  } else {
    ctx.fillRect(16, 20, 480, 150);
  }
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 120px sans-serif";
  ctx.fillText("해고", 256, 102);
  return new THREE.CanvasTexture(c);
}

export function FireDoor({ position }: { position: [number, number, number] }) {
  const grp = useRef<THREE.Group>(null);
  const doorMat = useRef<THREE.MeshStandardMaterial>(null);
  const sign = useMemo(() => makeSign(), []);
  useEffect(() => () => sign?.dispose(), [sign]);

  useFrame(() => {
    const hot = agentDrag.activeId !== null && agentDrag.hoverRole === "FIRE";
    if (doorMat.current) {
      const target = hot ? 0.8 : 0.06;
      doorMat.current.emissiveIntensity += (target - doorMat.current.emissiveIntensity) * 0.2;
    }
    if (grp.current) {
      const s = hot ? 1.06 : 1;
      grp.current.scale.setScalar(grp.current.scale.x + (s - grp.current.scale.x) * 0.2);
    }
  });

  return (
    <group ref={grp} position={position}>
      {/* Wall panel */}
      <mesh position={[0, 6, 0]} castShadow receiveShadow>
        <boxGeometry args={[11, 12, 1]} />
        <meshStandardMaterial color="#e7e3d6" roughness={1} />
      </mesh>
      {/* Door frame */}
      <mesh position={[0, 4.4, 0.55]}>
        <boxGeometry args={[5.2, 8.8, 0.5]} />
        <meshStandardMaterial color="#7f1d1d" roughness={0.6} />
      </mesh>
      {/* Red door */}
      <mesh position={[0, 4.2, 0.82]} castShadow>
        <boxGeometry args={[4.4, 8.2, 0.5]} />
        <meshStandardMaterial ref={doorMat} color="#dc2626" emissive="#ef4444" emissiveIntensity={0.06} roughness={0.5} />
      </mesh>
      {/* Handle */}
      <mesh position={[1.5, 4.2, 1.12]}>
        <sphereGeometry args={[0.28, 14, 14]} />
        <meshStandardMaterial color="#fde68a" metalness={0.5} roughness={0.3} />
      </mesh>
      {/* 해고 sign above the door */}
      {sign && (
        <mesh position={[0, 10.9, 0.7]}>
          <planeGeometry args={[7, 2.6]} />
          <meshBasicMaterial map={sign} transparent side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}
