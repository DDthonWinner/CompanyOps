// Desk status monitor via CanvasTexture. Redraws only when data changes (throttle, FR-TY-9).
import { useEffect, useMemo } from "react";
import * as THREE from "three";

function draw(canvas: HTMLCanvasElement, label: string, percent: number, color: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#0b1c30";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = color;
  ctx.font = "bold 34px sans-serif";
  ctx.fillText(label, 18, 46);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 54px monospace";
  ctx.fillText(`${percent}%`, 18, 118);
  // progress bar
  ctx.fillStyle = "#334155";
  ctx.fillRect(18, 132, 220, 14);
  ctx.fillStyle = color;
  ctx.fillRect(18, 132, Math.max(0, Math.min(220, (220 * percent) / 100)), 14);
}

export function Monitor({ label, percent, color }: { label: string; percent: number; color: string }) {
  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 160;
    return c;
  }, []);
  const texture = useMemo(() => new THREE.CanvasTexture(canvas), [canvas]);

  useEffect(() => {
    draw(canvas, label, percent, color);
    texture.needsUpdate = true;
  }, [canvas, texture, label, percent, color]);

  return (
    <mesh position={[0, 1.7, 0]}>
      <planeGeometry args={[1.6, 1]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}
