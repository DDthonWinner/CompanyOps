import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
const FACE_CAMERA = Math.PI / 4; // idle-at-rest / planning → face the viewer
const FACE_MONITOR = Math.PI; // working → turn to the desk monitor (−z)
const HOLD_MS = 200; // press-and-hold before an agent can be dragged
const WALK_SPEED = 3.6; // world units / second — a leisurely idle stroll
const DWELL_MIN = 10; // seconds an idle agent lingers at a point of interest

type State = "working" | "idle" | "planning" | "blocked";
function stateOf(status: string): State {
  if (status === "WORKING") return "working";
  if (status === "IDLE") return "idle";
  if (status === "BLOCKED") return "blocked";
  return "planning"; // WAITING / ASSIGNED
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
  onFire,
  wanderPoints,
  obstacles,
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
  onFire: (agentId: string) => void;
  wanderPoints: Array<{ pos: [number, number]; standY?: number }>;
  obstacles: Array<[number, number, number, number]>; // desk footprints to avoid
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
  const recallVersion = useTycoonStore((s) => s.recallVersion);
  const recallRef = useRef(recallVersion);
  recallRef.current = recallVersion;
  const lastRecall = useRef(recallVersion);
  const isSelected = useStore(
    (s) => s.openSheet?.kind === "agent" && s.openSheet.id === projectAgentId,
  );
  const [hovered, setHovered] = useState(false);

  const st = stateOf(status);
  const phase = useMemo(() => (projectAgentId.charCodeAt(0) % 10) * 0.63, [projectAgentId]);
  const tag = useMemo(() => makeNameTag(name), [name]);
  const bubbleTex = useMemo(
    () => (st === "planning" || st === "blocked" ? makeBubble(status) : null),
    [st, status],
  );
  useEffect(() => () => tag?.dispose(), [tag]);
  useEffect(() => () => bubbleTex?.dispose(), [bubbleTex]);

  // Idle wander state.
  const wt = useRef({ x: position[0], z: position[1], standY: 0 });
  const dwelling = useRef(false);
  const dwellEnd = useRef(0);
  const returning = useRef(false); // running back to the desk (recall)
  const stall = useRef(0);
  const prevD = useRef(Infinity);
  const pickPOI = useCallback(() => {
    // Occasionally head back to the desk; otherwise a random spot *within a radius*
    // of a point of interest so agents don't stack on the exact same coordinate.
    if (wanderPoints.length === 0 || Math.random() < 0.2) {
      return { x: seat.current.x, z: seat.current.z, standY: 0 };
    }
    const p = wanderPoints[Math.floor(Math.random() * wanderPoints.length)];
    const R = 4.5;
    return {
      x: p.pos[0] + (Math.random() - 0.5) * 2 * R,
      z: p.pos[1] + (Math.random() - 0.5) * 2 * R,
      standY: p.standY ?? 0,
    };
  }, [wanderPoints]);

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
  const latest = useRef({ resolveDeskAt, roleCode, onPuff, onFire });
  latest.current = { resolveDeskAt, roleCode, onPuff, onFire };

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
        const { resolveDeskAt: resolve, roleCode: role, onPuff: puff, onFire: fire } = latest.current;
        const drop = resolve(agentDrag.ground.x, agentDrag.ground.z);
        agentDrag.activeId = null;
        agentDrag.hoverRole = null;
        agentDrag.didDrag = true;
        setTimeout(() => {
          agentDrag.didDrag = false;
        }, 0);
        if (drop === "FIRE") {
          puff([agentDrag.ground.x, 0, agentDrag.ground.z]);
          fire(projectAgentId);
        } else if (drop && drop !== role) {
          reassign(projectAgentId, drop);
          puff([agentDrag.ground.x, 0, agentDrag.ground.z]);
        }
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
    if (agentDrag.activeId) return;
    agentDrag.suppressPan = true;
    pressing.current = true;
    projectGround(e.clientX, e.clientY);
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => {
      if (!pressing.current) return;
      agentDrag.activeId = projectAgentId;
      agentDrag.didDrag = true;
    }, HOLD_MS);
  };

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05); // clamp spikes (tab switches)
    const dragging = agentDrag.activeId === projectAgentId;
    const cur = pos.current;

    // ---- Idle wandering: roam between office points of interest ----
    let wanderActive = false;
    if (st === "idle" && !dragging) {
      wanderActive = true;
      if (lastRecall.current !== recallRef.current) {
        lastRecall.current = recallRef.current;
        wt.current = { x: seat.current.x, z: seat.current.z, standY: 0 };
        dwelling.current = false;
        returning.current = true; // run back to the desk
        stall.current = 0;
      }
      const arrived = Math.abs(wt.current.x - cur.x) + Math.abs(wt.current.z - cur.z) < 1.2;
      if (arrived) {
        returning.current = false;
        if (!dwelling.current) {
          dwelling.current = true;
          dwellEnd.current = t + DWELL_MIN + Math.random() * 15;
        } else if (t > dwellEnd.current) {
          dwelling.current = false;
          wt.current = pickPOI();
        }
      } else {
        dwelling.current = false;
      }
    }

    // ---- Position ----
    let walking = false;
    if (dragging) {
      cur.x += (agentDrag.ground.x - cur.x) * 0.4;
      cur.z += (agentDrag.ground.z - cur.z) * 0.4;
      cur.y += (2.2 - cur.y) * 0.4;
    } else if (wanderActive) {
      const dx = wt.current.x - cur.x;
      const dz = wt.current.z - cur.z;
      const d = Math.hypot(dx, dz);
      if (!dwelling.current && d > 0.05) {
        // Constant speed (walk normally, run when recalled).
        const spd = returning.current ? WALK_SPEED * 2 : WALK_SPEED;
        const step = Math.min(spd * dt, d);
        let nx = cur.x + (dx / d) * step;
        let nz = cur.z + (dz / d) * step;
        // Axis-separated sliding so agents don't phase through desks.
        const M = 2.6;
        for (const o of obstacles)
          if (nx > o[0] - M && nx < o[1] + M && cur.z > o[2] - M && cur.z < o[3] + M) { nx = cur.x; break; }
        for (const o of obstacles)
          if (nx > o[0] - M && nx < o[1] + M && nz > o[2] - M && nz < o[3] + M) { nz = cur.z; break; }
        cur.x = nx;
        cur.z = nz;
        walking = d > 0.5;
        // Retarget if stuck against a desk with no progress.
        if (!returning.current) {
          if (d > prevD.current - 0.02) stall.current += dt;
          else stall.current = 0;
          prevD.current = d;
          if (stall.current > 2) {
            wt.current = pickPOI();
            stall.current = 0;
            prevD.current = Infinity;
          }
        }
      } else {
        cur.x += dx * 0.1;
        cur.z += dz * 0.1;
        stall.current = 0;
        prevD.current = Infinity;
      }
      cur.y += ((dwelling.current ? wt.current.standY : 0) - cur.y) * 0.08;
    } else {
      cur.x += (seat.current.x - cur.x) * 0.09;
      cur.z += (seat.current.z - cur.z) * 0.09;
      cur.y += (0 - cur.y) * 0.09;
      walking = Math.abs(seat.current.x - cur.x) + Math.abs(seat.current.z - cur.z) > 0.8;
    }

    if (root.current) {
      root.current.position.copy(cur);
      if (dragging) {
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
      // Face the direction of travel while walking; otherwise face monitor/camera.
      const headX = wanderActive ? wt.current.x : seat.current.x;
      const headZ = wanderActive ? wt.current.z : seat.current.z;
      let targetY: number;
      if (walking && !dragging) targetY = Math.atan2(headX - cur.x, headZ - cur.z);
      else if ((st === "working" || st === "planning") && !dragging) targetY = FACE_MONITOR;
      else targetY = FACE_CAMERA;
      let diff = targetY - mascot.current.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      mascot.current.rotation.y += diff * 0.15;
      if (st === "working" && !dragging && !walking) {
        mascot.current.rotation.x = 0.14 + Math.sin(t * 4 + phase) * 0.03;
        mascot.current.rotation.z = 0;
      } else if (st === "planning" && !dragging && !walking) {
        mascot.current.rotation.x = 0.08; // lean at the desk, still
        mascot.current.rotation.z = 0;
      } else {
        mascot.current.rotation.x = 0;
        mascot.current.rotation.z = 0;
      }
    }

    if (body.current) {
      if (st === "blocked" && !dragging) {
        // Jump in place occasionally.
        const cyc = (t * 0.42 + phase) % 1;
        body.current.position.y = cyc < 0.45 ? Math.sin((cyc / 0.45) * Math.PI) * 1.7 : 0;
      } else if (walking) {
        const f = returning.current ? 15 : 8;
        body.current.position.y = Math.abs(Math.sin(t * f + phase)) * (returning.current ? 0.22 : 0.16);
      } else if (st === "working") {
        body.current.position.y = Math.sin(t * 2.2 + phase) * 0.06;
      } else {
        body.current.position.y = Math.sin(t * 2.2 + phase) * 0.03;
      }
    }

    if (armL.current && armR.current) {
      if (dragging) {
        armL.current.rotation.set(0, 0, 0);
        armR.current.rotation.set(0, 0, 0);
      } else if (st === "blocked") {
        // Arms up, waving.
        const w = Math.sin(t * 12 + phase) * 0.35;
        armL.current.rotation.set(-2.3 + w, 0, 0);
        armR.current.rotation.set(-2.3 - w, 0, 0);
      } else if (walking) {
        const f = returning.current ? 16 : 8;
        const a = returning.current ? 0.6 : 0.4;
        const s = Math.sin(t * f + phase) * a;
        armL.current.rotation.set(s, 0, 0);
        armR.current.rotation.set(-s, 0, 0);
      } else if (st === "working") {
        // Arms out onto the desk; hands tap up/down alternately → typing.
        armL.current.rotation.set(-1.45 + Math.sin(t * 9 + phase) * 0.16, 0, 0);
        armR.current.rotation.set(-1.45 + Math.sin(t * 9 + phase + Math.PI) * 0.16, 0, 0);
      } else {
        // planning + idle-at-rest → arms still
        armL.current.rotation.set(0, 0, 0);
        armR.current.rotation.set(0, 0, 0);
      }
    }
    if (bubble.current) {
      bubble.current.position.y = 12.0 + Math.sin(t * 1.6 + phase) * 0.18;
      if (st === "planning") {
        // Blink: appear → hold → disappear → gone → reappear.
        const c = (t * 0.5 + phase) % 1;
        const s = c < 0.15 ? c / 0.15 : c < 0.7 ? 1 : c < 0.85 ? 1 - (c - 0.7) / 0.15 : 0;
        bubble.current.scale.setScalar(s);
      } else {
        bubble.current.scale.setScalar(1);
      }
    }

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
  const dragged = agentDrag.activeId === projectAgentId;

  return (
    <group
      ref={root}
      position={[position[0], 0, position[1]]}
      onPointerDown={onPointerDown}
      onClick={(e) => {
        e.stopPropagation();
        if (agentDrag.didDrag) return;
        dispatchSelection({ projectId, type: "agent", projectAgentId });
        setCamera(projectAgentId);
      }}
      onPointerOver={() => {
        document.body.style.cursor = "grab";
        setHovered(true);
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
        setHovered(false);
      }}
    >
      {/* Red hover outline — warns that press-and-hold will pick this agent up */}
      {hovered && !dragged && (
        <mesh position={[0, 0.44, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.9, 3.5, 44]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.9} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      )}
      {/* Selection highlight ring */}
      {isSelected && (
        <mesh position={[0, 0.42, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[3.6, 4.3, 48]} />
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

        {/* Thought / status bubble (planning or blocked) */}
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
