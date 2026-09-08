// Clean studio stage: a soft off-white slab with a faint (rectangular) grid and
// a subtle recessed base for depth. Sized snugly to the desks (no empty floor).
import { useEffect, useMemo } from "react";
import * as THREE from "three";

const CENTER_X = 12;
const W = 108; // x span
const D = 60; // z span
const CELL = 6;

export function FloorGrid() {
  const gridTex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, 64, 64);
      ctx.strokeStyle = "rgba(150,163,199,0.26)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(64, 0);
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 64);
      ctx.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(W / CELL, D / CELL);
    return t;
  }, []);
  useEffect(() => () => gridTex.dispose(), [gridTex]);

  return (
    <group position={[CENTER_X, 0, 0]}>
      {/* Recessed base lip — reads as depth under the stage */}
      <mesh position={[0, -1.1, 0]} receiveShadow>
        <boxGeometry args={[W + 7, 1.4, D + 7]} />
        <meshStandardMaterial color="#e7ebf7" roughness={1} />
      </mesh>
      {/* Main stage */}
      <mesh position={[0, -0.3, 0]} receiveShadow>
        <boxGeometry args={[W, 1.2, D]} />
        <meshStandardMaterial color="#f5f7ff" roughness={0.95} metalness={0} />
      </mesh>
      {/* Faint grid overlay */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.31, 0]}>
        <planeGeometry args={[W, D]} />
        <meshBasicMaterial map={gridTex} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}
