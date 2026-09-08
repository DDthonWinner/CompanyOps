// Big desk monitor: metal stand + dark frame + high-res CanvasTexture screen.
// Screen art ported from the reference (dark UI, tag pill, big title, progress
// bar, submetrics); redraws only when the underlying data changes (FR-TY-9).
import { useEffect, useMemo } from "react";
import * as THREE from "three";

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
    return;
  }
  ctx.fillRect(x, y, w, h); // fallback for engines without roundRect
}

function draw(canvas: HTMLCanvasElement, title: string, steps: string, percent: number, color: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  ctx.clearRect(0, 0, W, canvas.height);

  // Screen background + header bar
  ctx.fillStyle = "#090d16";
  ctx.fillRect(0, 0, W, canvas.height);
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(0, 0, W, 88);

  // "SPRINT ACTIVE" tag pill
  ctx.fillStyle = color;
  roundRect(ctx, 32, 22, 230, 44, 12);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px sans-serif";
  ctx.fillText("SPRINT ACTIVE", 48, 53);

  // Health badge
  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 24px monospace";
  ctx.fillText("● SYSTEM 100% HEALTHY", 620, 54);

  // Big title
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 54px sans-serif";
  ctx.fillText(title, 40, 190);

  // Milestone steps + percent
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "bold 36px monospace";
  ctx.fillText(`TASKS: ${steps}`, 40, 260);
  ctx.fillStyle = color;
  ctx.font = "bold 44px monospace";
  ctx.fillText(`${percent}% COMPLETED`, 620, 260);

  // Progress bar track + fill
  ctx.fillStyle = "#1e293b";
  roundRect(ctx, 40, 310, 944, 44, 22);
  ctx.fillStyle = color;
  roundRect(ctx, 40, 310, Math.max(30, (944 * percent) / 100), 44, 22);

  // Submetrics footer
  ctx.fillStyle = "#94a3b8";
  ctx.font = "28px sans-serif";
  ctx.fillText("⚡ Autonomous Agents In Sync   |   Pipeline: Optimal", 40, 430);
}

export function Monitor({
  title,
  steps,
  percent,
  color,
  width = 18,
  height = 7.2,
  onSelect,
}: {
  title: string;
  steps: string;
  percent: number;
  color: string;
  width?: number;
  height?: number;
  onSelect?: () => void;
}) {
  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 512;
    return c;
  }, []);
  const texture = useMemo(() => new THREE.CanvasTexture(canvas), [canvas]);

  useEffect(() => {
    draw(canvas, title, steps, percent, color);
    texture.needsUpdate = true;
  }, [canvas, texture, title, steps, percent, color]);

  useEffect(() => () => texture.dispose(), [texture]);

  const screenY = height / 2 + 1.6;
  return (
    <group>
      {/* Stand */}
      <mesh position={[0, 0.9, 0]} castShadow>
        <cylinderGeometry args={[0.35, 0.4, 1.8, 16]} />
        <meshStandardMaterial color="#334155" roughness={0.4} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[4.2, 0.2, 1.6]} />
        <meshStandardMaterial color="#334155" roughness={0.4} metalness={0.4} />
      </mesh>
      {/* Frame */}
      <mesh position={[0, screenY, 0]} castShadow>
        <boxGeometry args={[width, height, 0.45]} />
        <meshStandardMaterial color="#0f172a" roughness={0.35} metalness={0.2} />
      </mesh>
      {/* Screen (clickable) */}
      <mesh
        position={[0, screenY, 0.24]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.();
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "auto")}
      >
        <planeGeometry args={[width - 0.4, height - 0.4]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
}
