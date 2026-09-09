import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "../../../store/useStore";
import { useTycoonStore } from "../tycoonStore";
import { dispatchSelection } from "../selectionEvent";
import { agentDrag, applyOpacity } from "./agentDrag";
import { CityMascot } from "./CityMascot";

const ORB_COLOR: Record<string, string> = {
  WORKING: "#059669",
  IDLE: "#767586",
  WAITING: "#d97706",
  BLOCKED: "#ba1a1a",
  ASSIGNED: "#4f46e5",
};

const MASCOT_SCALE = 2.7;
const FACE_CAMERA = Math.PI / 4; // idle / planning → face the viewer
const FACE_MONITOR = Math.PI; // working → turn to the desk monitor (−z)
const HOLD_MS = 200; // press-and-hold before an agent can be dragged

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
  roleCode,
  tier,
  resolveDeskAt,
  onPuff,
}: {
  projectId: string;
  projectAgentId: string;
  color: string;
  status: string;
  name: string;
  position: [number, number]; // [x, z] target seat on the floor
  roleCode: string; // effective desk role (for drop comparison)
  tier: string; // budget tier → badge material (gold / silver / bronze)
  resolveDeskAt: (x: number, z: number) => string | null;
  onPuff: (pos: [number, number, number]) => void;
}) {
  const badge = tier === "HIGH" ? "#f5c542" : tier === "MEDIUM" ? "#c9ccd6" : "#cd8f5a";
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const mascot = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const bubble = useRef<THREE.Group>(null);
  const arms = useMemo(() => ({ left: armL, right: armR }), []);
  const dimK = useRef(1);
  const dimApplied = useRef(1);

  const pos = useRef(new THREE.Vector3(position[0], 0, position[1]));
  const seat = useRef(new THREE.Vector3(position[0], 0, position[1]));
  useEffect(() => {
    seat.current.set(position[0], 0, position[1]);
  }, [position]);

  const setCamera = useStore((s) => s.setCamera);
  const reassign = useTycoonStore((s) => s.reassign);
  const isSelected = useStore(
    (s) => s.openSheet?.kind === "agent" && s.openSheet.id === projectAgentId,
  );

  const st = stateOf(status);
  const phase = useMemo(() => (projectAgentId.charCodeAt(0) % 10) * 0.63, [projectAgentId]);
  const tag = useMemo(() => makeNameTag(name), [name]);
  const bubbleTex = useMemo(() => (st === "planning" ? makeBubble(status) : null), [st, status]);
  useEffect(() => () => tag?.dispose(), [tag]);
  useEffect(() => () => bubbleTex?.dispose(), [bubbleTex]);

  // Pointer → ground-plane projection for dragging.
  const { camera, gl } = useThree();
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const projectGround = useCallback(
    (clientX: number, clientY: number) => {
      const rect = gl.domElement.getBoundingClientRect();
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(ndc, camera);
      ray.ray.intersectPlane(groundPlane, agentDrag.ground);
    },
    [camera, gl, ndc, ray, groundPlane],
  );

  const holdTimer = useRef<number | null>(null);
  const pressing = useRef(false);
  const latest = useRef({ resolveDeskAt, roleCode, onPuff });
  latest.current = { resolveDeskAt, roleCode, onPuff };

  // Window listeners (attached once) — drive drag position + handle drop.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (agentDrag.activeId === projectAgentId) {
        projectGround(e.clientX, e.clientY);
        agentDrag.hoverRole = latest.current.resolveDeskAt(agentDrag.ground.x, agentDrag.ground.z);
      }
    };
    const onUp = (e: PointerEvent) => {
      if (!pressing.current) return;
      pressing.current = false;
      if (holdTimer.current) {
        clearTimeout(holdTimer.current);
        holdTimer.current = null;
      }
      const wasDragging = agentDrag.activeId === projectAgentId;
      agentDrag.suppressPan = false;
      if (wasDragging) {
        projectGround(e.clientX, e.clientY);
        const { resolveDeskAt: resolve, roleCode: role, onPuff: puff } = latest.current;
        const drop = resolve(agentDrag.ground.x, agentDrag.ground.z);
        agentDrag.activeId = null;
        agentDrag.hoverRole = null;
        agentDrag.didDrag = true;
        setTimeout(() => {
          agentDrag.didDrag = false;
        }, 0);
        if (drop && drop !== role) {
          reassign(projectAgentId, drop);
          puff([agentDrag.ground.x, 0, agentDrag.ground.z]);
        }
        // otherwise the pawn simply walks back to its seat (lerp handles it)
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (holdTimer.current) clearTimeout(holdTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectAgentId, projectGround, reassign]);

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (agentDrag.activeId) return; // one agent at a time
    agentDrag.suppressPan = true; // block camera pan for this gesture
    pressing.current = true;
    projectGround(e.clientX, e.clientY);
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => {
      if (!pressing.current) return;
      agentDrag.activeId = projectAgentId; // enter hold/drag mode
      agentDrag.didDrag = true;
    }, HOLD_MS);
  };

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const dragging = agentDrag.activeId === projectAgentId;

    // Position: follow the pointer while held, else walk to the seat.
    const cur = pos.current;
    const goalX = dragging ? agentDrag.ground.x : seat.current.x;
    const goalZ = dragging ? agentDrag.ground.z : seat.current.z;
    const goalY = dragging ? 2.2 : 0;
    const speed = dragging ? 0.4 : 0.09;
    cur.x += (goalX - cur.x) * speed;
    cur.z += (goalZ - cur.z) * speed;
    cur.y += (goalY - cur.y) * speed;
    const walking = !dragging && Math.abs(goalX - cur.x) + Math.abs(goalZ - cur.z) > 0.4;

    if (root.current) {
      root.current.position.copy(cur);
      if (dragging) {
        // Jiggle like an app icon in edit mode.
        root.current.rotation.z = Math.sin(t * 22) * 0.14;
        root.current.rotation.x = Math.sin(t * 18) * 0.08;
      } else {
        root.current.rotation.z = 0;
        root.current.rotation.x = 0;
      }
      const targetScale = isSelected ? 1.08 : 1;
      root.current.scale.setScalar(root.current.scale.x + (targetScale - root.current.scale.x) * 0.2);
    }

    if (mascot.current) {
      const targetY = st === "working" && !dragging && !walking ? FACE_MONITOR : FACE_CAMERA;
      mascot.current.rotation.y += (targetY - mascot.current.rotation.y) * 0.12;
      if (dragging) {
        mascot.current.rotation.x = 0;
        mascot.current.rotation.z = 0;
      } else if (st === "working") {
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
      const amp = walking ? 0.14 : st === "working" ? 0.06 : 0.03;
      const freq = walking ? 8 : 2.2;
      body.current.position.y = Math.abs(Math.sin(t * freq + phase)) * amp * (walking ? 1 : 1);
      if (!walking && st !== "working") body.current.position.y = Math.sin(t * 2.2 + phase) * 0.03;
    }
    if (armL.current && armR.current) {
      if (dragging || walking) {
        armL.current.rotation.set(0, 0, 0);
        armR.current.rotation.set(0, 0, 0);
      } else if (st === "working") {
        armL.current.rotation.set(0.18 + Math.sin(t * 10 + phase) * 0.28, 0, 0);
        armR.current.rotation.set(0.18 + Math.sin(t * 10 + phase + Math.PI) * 0.28, 0, 0);
      } else if (st === "planning") {
        const s = Math.sin(t * 1.1 + phase) * 0.5 + 0.5;
        armR.current.rotation.set(-0.3 * s, 0, -1.35 * s);
        armL.current.rotation.set(0, 0, 0);
      } else {
        armL.current.rotation.set(0, 0, 0);
        armR.current.rotation.set(0, 0, 0);
      }
    }
    if (bubble.current) bubble.current.position.y = 12.0 + Math.sin(t * 1.6 + phase) * 0.18;

    // Fade agents already at the desk currently under the dragged agent (drop preview).
    const dim = agentDrag.activeId !== null && !dragging && agentDrag.hoverRole === roleCode;
    const targetK = dim ? 0.35 : 1;
    dimK.current += (targetK - dimK.current) * 0.25;
    if (targetK === 1 && dimK.current > 0.99) dimK.current = 1;
    if (dimK.current !== dimApplied.current) {
      applyOpacity(body.current, dimK.current);
      dimApplied.current = dimK.current;
    }
  });

  const orbColor = ORB_COLOR[status] ?? "#767586";

  return (
    <group
      ref={root}
      position={[position[0], 0, position[1]]}
      onPointerDown={onPointerDown}
      onClick={(e) => {
        e.stopPropagation();
        if (agentDrag.didDrag) return; // ignore the click that ends a drag
        dispatchSelection({ projectId, type: "agent", projectAgentId });
        setCamera(projectAgentId);
      }}
      onPointerOver={() => (document.body.style.cursor = "grab")}
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
          <CityMascot uniform={color} badge={badge} arms={arms} />
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

        {/* Name tag (sits under the agent, faces the iso camera) */}
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
