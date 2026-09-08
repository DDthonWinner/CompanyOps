import { useEffect, useMemo, useRef } from "react";
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

const SKIN = "#f3c9a8";

function makeNameTag(name: string): THREE.CanvasTexture | null {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(8, 8, 240, 48, 24);
    ctx.fill();
  } else {
    ctx.fillRect(8, 8, 240, 48);
  }
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px sans-serif";
  ctx.textAlign = "center";
  const label = name.length > 18 ? `${name.slice(0, 17)}…` : name;
  ctx.fillText(label, 128, 40);
  return new THREE.CanvasTexture(c);
}

export function DevPawn({
  projectId,
  projectAgentId,
  color,
  status,
  name,
  position,
}: {
  projectId: string;
  projectAgentId: string;
  color: string;
  status: string;
  name: string;
  position: [number, number]; // [x, z] on the floor
}) {
  const body = useRef<THREE.Group>(null);
  const phase = useMemo(() => (projectAgentId.charCodeAt(0) % 10) * 0.63, [projectAgentId]);
  const tag = useMemo(() => makeNameTag(name), [name]);
  useEffect(() => () => tag?.dispose(), [tag]);

  // Only WORKING gets the active bob (FR-TY-6); others rest gently.
  useFrame((state) => {
    if (!body.current) return;
    const t = state.clock.elapsedTime;
    const amp = status === "WORKING" ? 0.12 : 0.03;
    body.current.position.y = 2.3 + Math.sin(t * 2.2 + phase) * amp;
  });

  const orbColor = ORB_COLOR[status] ?? "#767586";

  return (
    <group
      position={[position[0], 0, position[1]]}
      onClick={(e) => {
        e.stopPropagation();
        dispatchSelection({ projectId, type: "agent", projectAgentId });
      }}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "auto")}
    >
      {/* Stool */}
      <mesh position={[0, 0.2, 0]} receiveShadow>
        <cylinderGeometry args={[1.2, 1.4, 0.4, 16]} />
        <meshLambertMaterial color="#1e293b" />
      </mesh>
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 1.8, 12]} />
        <meshLambertMaterial color="#64748b" />
      </mesh>
      <mesh position={[0, 2.0, 0]} castShadow>
        <cylinderGeometry args={[1.6, 1.5, 0.6, 16]} />
        <meshLambertMaterial color={color} />
      </mesh>

      {/* Body (bobs) */}
      <group ref={body} position={[0, 2.3, 0]}>
        {/* Skirt ring */}
        <mesh position={[0, 0.25, 0]} castShadow>
          <cylinderGeometry args={[1.1, 1.3, 0.5, 18]} />
          <meshLambertMaterial color={color} />
        </mesh>
        {/* Torso */}
        <mesh position={[0, 1.5, 0]} castShadow>
          <cylinderGeometry args={[0.65, 1.1, 2.2, 18]} />
          <meshLambertMaterial color={color} />
        </mesh>
        {/* Collar */}
        <mesh position={[0, 2.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.66, 0.12, 12, 24]} />
          <meshLambertMaterial color="#ffffff" />
        </mesh>
        {/* Head */}
        <mesh position={[0, 3.4, 0]} castShadow>
          <sphereGeometry args={[0.85, 20, 20]} />
          <meshLambertMaterial color={SKIN} />
        </mesh>

        {/* Arms reaching forward onto the desk (−z), one per side */}
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.78, 1.95, -0.2]} rotation={[-1.02, 0, side * 0.14]}>
            <mesh position={[0, -0.75, 0]} castShadow>
              <cylinderGeometry args={[0.15, 0.17, 1.6, 10]} />
              <meshLambertMaterial color={color} />
            </mesh>
            {/* Hand */}
            <mesh position={[0, -1.55, 0]} castShadow>
              <sphereGeometry args={[0.2, 12, 12]} />
              <meshLambertMaterial color={SKIN} />
            </mesh>
          </group>
        ))}

        {/* Floating status orb */}
        <mesh position={[0, 4.8, 0]}>
          <sphereGeometry args={[0.24, 12, 12]} />
          <meshBasicMaterial color={orbColor} toneMapped={false} />
        </mesh>

        {/* Name tag (faces the iso camera) */}
        {tag && (
          <mesh position={[0, 5.5, 0]} rotation={[0, Math.PI / 4, 0]}>
            <planeGeometry args={[3.0, 0.75]} />
            <meshBasicMaterial map={tag} transparent side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
        )}
      </group>
    </group>
  );
}
