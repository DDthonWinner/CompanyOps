// Big desk monitor: metal stand + dark frame + high-res CanvasTexture screen.
// Screen shows only the essentials at a large, readable size: a progress bar,
// the done/remaining task count, and the completion percentage.
import { useEffect, useMemo } from "react";
import * as THREE from "three";

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
    return;
  }
  ctx.fillRect(x, y, w, h);
}

function draw(canvas: HTMLCanvasElement, done: number, total: number, percent: number, color: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  ctx.clearRect(0, 0, W, canvas.height);
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, W, canvas.height);

  const left = Math.max(0, total - done);

  // Big completion percentage
  ctx.fillStyle = color;
  ctx.font = "bold 168px sans-serif";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`${percent}%`, 56, 210);

  // Done / remaining count
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "bold 66px monospace";
  ctx.fillText(`${done} DONE`, 56, 320);
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(`· ${left} LEFT`, 380, 320);

  // Progress bar track + fill
  ctx.fillStyle = "#1e293b";
  roundRect(ctx, 56, 384, 912, 82, 41);
  ctx.fillStyle = color;
  roundRect(ctx, 56, 384, Math.max(82, (912 * percent) / 100), 82, 41);
}

export function Monitor({
  done,
  total,
  percent,
  color,
  width = 18,
  height = 7.2,
  onSelect,
}: {
  done: number;
  total: number;
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
    draw(canvas, done, total, percent, color);
    texture.needsUpdate = true;
  }, [canvas, texture, done, total, percent, color]);

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
