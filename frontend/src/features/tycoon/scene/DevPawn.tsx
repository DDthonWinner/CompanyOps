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

const HEAD = "#eef1fb"; // sleek light "helmet" head
const BASE_ARM = 0.98; // resting arm tilt so hands sit on the desk (−z)

type Mood = "typing" | "thinking" | "blocked";
function moodOf(status: string): Mood {
  if (status === "WORKING") return "typing";
  if (status === "BLOCKED") return "blocked";
  return "thinking"; // IDLE / WAITING / ASSIGNED
}

function makeBubble(mood: Mood): THREE.CanvasTexture | null {
  if (mood === "typing") return null;
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 96;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const blocked = mood === "blocked";
  ctx.fillStyle = blocked ? "#fee2e2" : "#ffffff";
  ctx.strokeStyle = blocked ? "#ef4444" : "#cbd5e1";
  ctx.lineWidth = 4;
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(10, 8, 108, 56, 20);
    ctx.fill();
    ctx.stroke();
    // little tail
    ctx.beginPath();
    ctx.arc(40, 74, 7, 0, Math.PI * 2);
    ctx.arc(28, 86, 4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(10, 8, 108, 56);
  }
  ctx.fillStyle = blocked ? "#dc2626" : "#475569";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 40px sans-serif";
  ctx.fillText(blocked ? "!" : "• • •", 64, 34);
  return new THREE.CanvasTexture(c);
}

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
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const bubble = useRef<THREE.Group>(null);

  const mood = moodOf(status);
  const phase = useMemo(() => (projectAgentId.charCodeAt(0) % 10) * 0.63, [projectAgentId]);
  const tag = useMemo(() => makeNameTag(name), [name]);
  const bubbleTex = useMemo(() => makeBubble(mood), [mood]);
  useEffect(() => () => tag?.dispose(), [tag]);
  useEffect(() => () => bubbleTex?.dispose(), [bubbleTex]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // Body idle bob (livelier while working).
    if (body.current) {
      const amp = mood === "typing" ? 0.1 : 0.03;
      body.current.position.y = 2.3 + Math.sin(t * 2.2 + phase) * amp;
    }
    // Arm animation per mood.
    if (armL.current && armR.current) {
      if (mood === "typing") {
        // Alternating fast taps → typing.
        armL.current.rotation.x = BASE_ARM + Math.sin(t * 9 + phase) * 0.22;
        armR.current.rotation.x = BASE_ARM + Math.sin(t * 9 + phase + Math.PI) * 0.22;
        armR.current.rotation.z = 0;
      } else if (mood === "thinking") {
        // Right hand drifts up to the head (scratch/ponder); left rests.
        const raise = (Math.sin(t * 0.9 + phase) * 0.5 + 0.5) ** 3; // mostly down, occasional lift
        armR.current.rotation.x = BASE_ARM - raise * 1.7;
        armR.current.rotation.z = -raise * 0.5;
        armL.current.rotation.x = BASE_ARM;
      } else {
        // Blocked: arms rest low with a small resigned shrug.
        armL.current.rotation.x = BASE_ARM - 0.25 + Math.sin(t * 1.5 + phase) * 0.05;
        armR.current.rotation.x = BASE_ARM - 0.25 + Math.sin(t * 1.5 + phase) * 0.05;
        armR.current.rotation.z = 0;
      }
    }
    // Thought bubble bob.
    if (bubble.current) bubble.current.position.y = 4.2 + Math.sin(t * 1.6 + phase) * 0.12;
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
        <cylinderGeometry args={[1.15, 1.35, 0.4, 20]} />
        <meshStandardMaterial color="#1e293b" roughness={0.7} metalness={0.1} />
      </mesh>
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 1.8, 12]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[0, 1.95, 0]} castShadow>
        <cylinderGeometry args={[1.45, 1.35, 0.55, 24]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>

      {/* Body (bobs) */}
      <group ref={body} position={[0, 2.3, 0]}>
        {/* Pill torso */}
        <mesh position={[0, 1.3, 0]} castShadow>
          <capsuleGeometry args={[0.62, 1.4, 8, 20]} />
          <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} />
        </mesh>
        {/* Head */}
        <mesh position={[0, 3.05, 0]} castShadow>
          <sphereGeometry args={[0.6, 24, 24]} />
          <meshStandardMaterial color={HEAD} roughness={0.5} />
        </mesh>
        {/* Visor band (front = −z, toward the monitor) */}
        <mesh position={[0, 3.08, -0.5]}>
          <boxGeometry args={[0.62, 0.24, 0.22]} />
          <meshStandardMaterial color="#334155" roughness={0.4} />
        </mesh>

        {/* Arms reaching toward the desk (−z) */}
        <group ref={armL} position={[0.56, 1.9, -0.1]} rotation={[BASE_ARM, 0, 0]}>
          <mesh position={[0, -0.7, 0]} castShadow>
            <capsuleGeometry args={[0.16, 1.0, 6, 12]} />
            <meshStandardMaterial color={color} roughness={0.55} />
          </mesh>
          <mesh position={[0, -1.35, 0]} castShadow>
            <sphereGeometry args={[0.2, 12, 12]} />
            <meshStandardMaterial color={HEAD} roughness={0.5} />
          </mesh>
        </group>
        <group ref={armR} position={[-0.56, 1.9, -0.1]} rotation={[BASE_ARM, 0, 0]}>
          <mesh position={[0, -0.7, 0]} castShadow>
            <capsuleGeometry args={[0.16, 1.0, 6, 12]} />
            <meshStandardMaterial color={color} roughness={0.55} />
          </mesh>
          <mesh position={[0, -1.35, 0]} castShadow>
            <sphereGeometry args={[0.2, 12, 12]} />
            <meshStandardMaterial color={HEAD} roughness={0.5} />
          </mesh>
        </group>

        {/* Floating status orb */}
        <mesh position={[0, 3.95, 0]}>
          <sphereGeometry args={[0.2, 14, 14]} />
          <meshStandardMaterial color={orbColor} emissive={orbColor} emissiveIntensity={0.6} toneMapped={false} />
        </mesh>

        {/* Thought / status bubble */}
        {bubbleTex && (
          <group ref={bubble} position={[0, 4.2, 0]}>
            <mesh rotation={[0, Math.PI / 4, 0]}>
              <planeGeometry args={[1.5, 1.1]} />
              <meshBasicMaterial map={bubbleTex} transparent side={THREE.DoubleSide} toneMapped={false} />
            </mesh>
          </group>
        )}

        {/* Name tag */}
        {tag && (
          <mesh position={[0, 4.95, 0]} rotation={[0, Math.PI / 4, 0]}>
            <planeGeometry args={[3.0, 0.75]} />
            <meshBasicMaterial map={tag} transparent side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
        )}
      </group>
    </group>
  );
}
