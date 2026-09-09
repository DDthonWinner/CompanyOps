import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "../../../store/useStore";
import { dispatchSelection } from "../selectionEvent";
import { CityMascot } from "./CityMascot";

const ORB_COLOR: Record<string, string> = {
  WORKING: "#059669",
  IDLE: "#767586",
  WAITING: "#d97706",
  BLOCKED: "#ba1a1a",
  ASSIGNED: "#4f46e5",
};

const MASCOT_SCALE = 3.0;
const FACE_CAMERA = Math.PI / 4; // idle / planning → face the viewer
const FACE_MONITOR = Math.PI; // working → turn to the desk monitor (−z)

type State = "working" | "idle" | "planning";
function stateOf(status: string): State {
  if (status === "WORKING") return "working";
  if (status === "IDLE") return "idle";
  return "planning"; // WAITING / ASSIGNED / BLOCKED
}

function makeBubble(status: string): THREE.CanvasTexture | null {
  const blocked = status === "BLOCKED";
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 192;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
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
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const mascot = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const bubble = useRef<THREE.Group>(null);
  const arms = useMemo(() => ({ left: armL, right: armR }), []);

  const setCamera = useStore((s) => s.setCamera);
  const isSelected = useStore(
    (s) => s.openSheet?.kind === "agent" && s.openSheet.id === projectAgentId,
  );

  const st = stateOf(status);
  const phase = useMemo(() => (projectAgentId.charCodeAt(0) % 10) * 0.63, [projectAgentId]);
  const tag = useMemo(() => makeNameTag(name), [name]);
  // Bubble only while planning (thinking / waiting / blocked).
  const bubbleTex = useMemo(() => (st === "planning" ? makeBubble(status) : null), [st, status]);
  useEffect(() => () => tag?.dispose(), [tag]);
  useEffect(() => () => bubbleTex?.dispose(), [bubbleTex]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (mascot.current) {
      const targetY = st === "working" ? FACE_MONITOR : FACE_CAMERA;
      mascot.current.rotation.y += (targetY - mascot.current.rotation.y) * 0.12;
      if (st === "working") {
        mascot.current.rotation.x = 0.14 + Math.sin(t * 4 + phase) * 0.03;
        mascot.current.rotation.z = 0;
      } else if (st === "planning") {
        mascot.current.rotation.x = 0.03;
        mascot.current.rotation.z = Math.sin(t * 0.8 + phase) * 0.05;
      } else {
        mascot.current.rotation.x = 0;
        mascot.current.rotation.z = 0;
      }
    }
    if (body.current) {
      body.current.position.y = Math.sin(t * 2.2 + phase) * (st === "working" ? 0.06 : 0.03);
    }
    if (armL.current && armR.current) {
      if (st === "working") {
        // Alternating taps → typing at the keyboard.
        armL.current.rotation.set(0.18 + Math.sin(t * 10 + phase) * 0.28, 0, 0);
        armR.current.rotation.set(0.18 + Math.sin(t * 10 + phase + Math.PI) * 0.28, 0, 0);
      } else if (st === "planning") {
        // Right hand drifts up to the head — scratch / ponder.
        const s = Math.sin(t * 1.1 + phase) * 0.5 + 0.5;
        armR.current.rotation.set(-0.3 * s, 0, -1.35 * s);
        armL.current.rotation.set(0, 0, 0);
      } else {
        armL.current.rotation.set(0, 0, 0);
        armR.current.rotation.set(0, 0, 0);
      }
    }
    if (bubble.current) bubble.current.position.y = 12.0 + Math.sin(t * 1.6 + phase) * 0.18;
    if (root.current) {
      const target = isSelected ? 1.08 : 1;
      root.current.scale.x += (target - root.current.scale.x) * 0.2;
      root.current.scale.setScalar(root.current.scale.x);
    }
  });

  const orbColor = ORB_COLOR[status] ?? "#767586";

  return (
    <group
      ref={root}
      position={[position[0], 0, position[1]]}
      onClick={(e) => {
        e.stopPropagation();
        dispatchSelection({ projectId, type: "agent", projectAgentId });
        setCamera(projectAgentId); // focus + zoom onto this agent
      }}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "auto")}
    >
      {/* Selection highlight ring */}
      {isSelected && (
        <mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[3.2, 4.0, 48]} />
          <meshBasicMaterial color={color} transparent opacity={0.85} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      )}

      <group ref={body}>
        {/* Explorer mascot with a per-agent uniform color + animatable arms */}
        <group ref={mascot} scale={MASCOT_SCALE} rotation={[0, FACE_CAMERA, 0]}>
          <CityMascot uniform={color} arms={arms} />
        </group>

        {/* Floating status orb */}
        <mesh position={[0, 10.4, 0]}>
          <sphereGeometry args={[0.4, 16, 16]} />
          <meshStandardMaterial
            color={orbColor}
            emissive={orbColor}
            emissiveIntensity={isSelected ? 1.1 : 0.6}
            toneMapped={false}
          />
        </mesh>

        {/* Name tag (large, sits under the agent, faces the iso camera) */}
        {tag && (
          <mesh position={[0.9, 1.45, 0.9]} rotation={[0, FACE_CAMERA, 0]}>
            <planeGeometry args={[7, 1.75]} />
            <meshBasicMaterial map={tag} transparent side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
        )}

        {/* Thought / status bubble (planning only) */}
        {bubbleTex && (
          <group ref={bubble} position={[0, 12.0, 0]}>
            <mesh rotation={[0, FACE_CAMERA, 0]}>
              <planeGeometry args={[4, 3]} />
              <meshBasicMaterial map={bubbleTex} transparent side={THREE.DoubleSide} toneMapped={false} />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
}
