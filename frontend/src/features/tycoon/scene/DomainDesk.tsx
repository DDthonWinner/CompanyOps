import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { INBOX_COLOR, OUTBOX_COLOR, ROLE_LABEL } from "../../../lib/roles";
import { dispatchSelection } from "../selectionEvent";
import { Monitor } from "./Monitor";

const DESK_LENGTH = 22;
const DESK_WIDTH = 5.2;
const DESK_HEIGHT = 3.2;

// Leg foot positions (6 legs) around the desktop.
const LEGS: Array<[number, number]> = [
  [-DESK_LENGTH / 2 + 1.2, -DESK_WIDTH / 2 + 0.8],
  [DESK_LENGTH / 2 - 1.2, -DESK_WIDTH / 2 + 0.8],
  [-DESK_LENGTH / 2 + 1.2, DESK_WIDTH / 2 - 0.8],
  [DESK_LENGTH / 2 - 1.2, DESK_WIDTH / 2 - 0.8],
  [0, -DESK_WIDTH / 2 + 0.8],
  [0, DESK_WIDTH / 2 - 0.8],
];

function tint(hex: string, amount: number): string {
  return new THREE.Color(hex).lerp(new THREE.Color("#ffffff"), amount).getStyle();
}

function makeBadge(text: string, hex: string): THREE.CanvasTexture | null {
  const c = document.createElement("canvas");
  c.width = 360;
  c.height = 70;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = hex;
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(10, 10, 340, 50, 14);
    ctx.fill();
  } else {
    ctx.fillRect(10, 10, 340, 50);
  }
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(text, 180, 44);
  return new THREE.CanvasTexture(c);
}

function PaperStack({ count, y }: { count: number; y: number }) {
  return (
    <>
      {Array.from({ length: Math.min(6, Math.max(1, count)) }).map((_, i) => (
        <mesh key={i} position={[0, y + i * 0.11, 0]} rotation={[0, ((i % 3) - 1) * 0.09, 0]} castShadow>
          <boxGeometry args={[2.2, 0.08, 2.9]} />
          <meshLambertMaterial color="#ffffff" />
        </mesh>
      ))}
    </>
  );
}

export function DomainDesk({
  roleCode,
  projectId,
  position,
  color,
  percent,
  steps,
  inboxCount,
  outboxCount,
}: {
  roleCode: string;
  projectId: string;
  position: [number, number]; // [x, z]
  color: string;
  percent: number;
  steps: string;
  inboxCount: number;
  outboxCount: number;
}) {
  const [pulse, setPulse] = useState(1);
  const bounce = () => {
    setPulse(1.06);
    setTimeout(() => setPulse(1), 180);
  };
  const selectDesk = (type: "desk" | "inbox" | "outbox") => {
    if (type === "desk") bounce();
    dispatchSelection({ projectId, type, roleCode });
  };

  const surface = useMemo(() => tint(color, 0.78), [color]);
  const mat = useMemo(() => tint(color, 0.6), [color]);
  const badge = useMemo(() => makeBadge(`● ${(ROLE_LABEL[roleCode] ?? roleCode).toUpperCase()} DESK`, color), [roleCode, color]);
  useEffect(() => () => badge?.dispose(), [badge]);

  const hover = {
    onPointerOver: () => (document.body.style.cursor = "pointer"),
    onPointerOut: () => (document.body.style.cursor = "auto"),
  };

  return (
    <group position={[position[0], 0, position[1]]} scale={pulse}>
      {/* Domain floor mat */}
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[DESK_LENGTH + 6, DESK_WIDTH + 9]} />
        <meshLambertMaterial color={mat} transparent opacity={0.88} />
      </mesh>

      {/* Desktop (tinted) + accent trim */}
      <mesh
        position={[0, DESK_HEIGHT, 0]}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          selectDesk("desk");
        }}
        {...hover}
      >
        <boxGeometry args={[DESK_LENGTH, 0.52, DESK_WIDTH]} />
        <meshLambertMaterial color={surface} />
      </mesh>
      <mesh position={[0, DESK_HEIGHT - 0.22, 0]}>
        <boxGeometry args={[DESK_LENGTH + 0.15, 0.28, DESK_WIDTH + 0.15]} />
        <meshLambertMaterial color={color} />
      </mesh>

      {/* Legs */}
      {LEGS.map(([lx, lz], i) => (
        <mesh key={i} position={[lx, (DESK_HEIGHT - 0.2) / 2, lz]} castShadow>
          <cylinderGeometry args={[0.32, 0.32, DESK_HEIGHT - 0.2, 12]} />
          <meshLambertMaterial color="#64748b" />
        </mesh>
      ))}

      {/* Big monitor */}
      <group position={[0, DESK_HEIGHT + 0.25, -DESK_WIDTH / 2 + 1.2]}>
        <Monitor
          title={ROLE_LABEL[roleCode] ?? roleCode}
          steps={steps}
          percent={percent}
          color={color}
          onSelect={() => selectDesk("desk")}
        />
      </group>

      {/* Inbox (royal blue) */}
      <group position={[-DESK_LENGTH / 2 + 2.5, DESK_HEIGHT + 0.25, 0.4]}>
        <mesh
          position={[0, 0.35, 0]}
          castShadow
          onClick={(e) => {
            e.stopPropagation();
            selectDesk("inbox");
          }}
          {...hover}
        >
          <boxGeometry args={[2.8, 0.7, 3.5]} />
          <meshLambertMaterial color={INBOX_COLOR} />
        </mesh>
        <PaperStack count={inboxCount} y={0.75} />
        <mesh position={[0, 0.9, 1.82]}>
          <boxGeometry args={[1.8, 0.6, 0.12]} />
          <meshLambertMaterial color="#1d4ed8" />
        </mesh>
      </group>

      {/* Outbox (emerald) */}
      <group position={[DESK_LENGTH / 2 - 2.5, DESK_HEIGHT + 0.25, 0.4]}>
        <mesh
          position={[0, 0.35, 0]}
          castShadow
          onClick={(e) => {
            e.stopPropagation();
            selectDesk("outbox");
          }}
          {...hover}
        >
          <boxGeometry args={[2.8, 0.7, 3.5]} />
          <meshLambertMaterial color={OUTBOX_COLOR} />
        </mesh>
        <PaperStack count={outboxCount} y={0.75} />
        <mesh position={[0, 0.9, 1.82]}>
          <boxGeometry args={[1.8, 0.6, 0.12]} />
          <meshLambertMaterial color="#047857" />
        </mesh>
      </group>

      {/* Floating domain badge */}
      {badge && (
        <mesh position={[0, DESK_HEIGHT + 7.4, -DESK_WIDTH / 2 + 1.2]} rotation={[0, Math.PI / 4, 0]}>
          <planeGeometry args={[6.2, 1.2]} />
          <meshBasicMaterial map={badge} transparent side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}
