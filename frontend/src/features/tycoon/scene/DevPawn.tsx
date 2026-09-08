import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { dispatchSelection } from "../selectionEvent";
import { CityMascot } from "./CityMascot";

const ORB_COLOR: Record<string, string> = {
  WORKING: "#059669",
  IDLE: "#767586",
  WAITING: "#d97706",
  BLOCKED: "#ba1a1a",
  ASSIGNED: "#4f46e5",
};

const MASCOT_SCALE = 1.9;
const FACE = Math.PI / 4; // face the iso camera so the mascot's front is visible

type Mood = "typing" | "thinking" | "blocked";
function moodOf(status: string): Mood {
  if (status === "WORKING") return "typing";
  if (status === "BLOCKED") return "blocked";
  return "thinking"; // IDLE / WAITING / ASSIGNED
}

function makeBubble(mood: Mood): THREE.CanvasTexture | null {
  if (mood === "typing") return null;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 192;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const blocked = mood === "blocked";
  ctx.fillStyle = blocked ? "#fee2e2" : "#ffffff";
  ctx.strokeStyle = blocked ? "#ef4444" : "#cbd5e1";
  ctx.lineWidth = 8;
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(18, 14, 220, 112, 36);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(78, 150, 14, 0, Math.PI * 2);
    ctx.arc(52, 176, 8, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(18, 14, 220, 112);
  }
  ctx.fillStyle = blocked ? "#dc2626" : "#475569";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 84px sans-serif";
  ctx.fillText(blocked ? "!" : "• • •", 128, 66);
  return new THREE.CanvasTexture(c);
}

function makeNameTag(name: string): THREE.CanvasTexture | null {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(10, 20, 492, 88, 44);
    ctx.fill();
  } else {
    ctx.fillRect(10, 20, 492, 88);
  }
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 52px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const label = name.length > 20 ? `${name.slice(0, 19)}…` : name;
  ctx.fillText(label, 256, 66);
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
  const mascot = useRef<THREE.Group>(null);
  const bubble = useRef<THREE.Group>(null);

  const mood = moodOf(status);
  const phase = useMemo(() => (projectAgentId.charCodeAt(0) % 10) * 0.63, [projectAgentId]);
  const tag = useMemo(() => makeNameTag(name), [name]);
  const bubbleTex = useMemo(() => makeBubble(mood), [mood]);
  useEffect(() => () => tag?.dispose(), [tag]);
  useEffect(() => () => bubbleTex?.dispose(), [bubbleTex]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (body.current) {
      const amp = mood === "typing" ? 0.08 : 0.03;
      body.current.position.y = Math.sin(t * 2.2 + phase) * amp;
    }
    if (mascot.current) {
      if (mood === "typing") {
        // Lean into the desk with a quick working bob.
        mascot.current.rotation.set(0.12 + Math.sin(t * 6 + phase) * 0.05, FACE, 0);
      } else if (mood === "thinking") {
        // Gentle pondering sway.
        mascot.current.rotation.set(0.02, FACE, Math.sin(t * 0.8 + phase) * 0.07);
      } else {
        // Blocked: small restless jitter.
        mascot.current.rotation.set(0.05, FACE, Math.sin(t * 3.2 + phase) * 0.03);
      }
    }
    if (bubble.current) bubble.current.position.y = 7.4 + Math.sin(t * 1.6 + phase) * 0.16;
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
      <group ref={body}>
        {/* Explorer mascot with a per-agent uniform color */}
        <group ref={mascot} scale={MASCOT_SCALE} rotation={[0, FACE, 0]}>
          <CityMascot uniform={color} />
        </group>

        {/* Floating status orb */}
        <mesh position={[0, 5.8, 0]}>
          <sphereGeometry args={[0.22, 14, 14]} />
          <meshStandardMaterial color={orbColor} emissive={orbColor} emissiveIntensity={0.6} toneMapped={false} />
        </mesh>

        {/* Name tag (large, faces the iso camera) */}
        {tag && (
          <mesh position={[0, 6.5, 0]} rotation={[0, FACE, 0]}>
            <planeGeometry args={[5.6, 1.4]} />
            <meshBasicMaterial map={tag} transparent side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
        )}

        {/* Thought / status bubble (large, well above the head) */}
        {bubbleTex && (
          <group ref={bubble} position={[0, 7.4, 0]}>
            <mesh rotation={[0, FACE, 0]}>
              <planeGeometry args={[2.7, 2.0]} />
              <meshBasicMaterial map={bubbleTex} transparent side={THREE.DoubleSide} toneMapped={false} />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
}
