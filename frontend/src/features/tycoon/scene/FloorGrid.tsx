// Clean studio stage: a soft off-white slab with a faint (rectangular) grid and
// a subtle recessed base for depth. Sized snugly to the desks (no empty floor).
import { useEffect, useMemo } from "react";
import * as THREE from "three";

const CENTER_X = 18;
const W = 132; // x span
const D = 82; // z span (widened so the office reads less narrow)
const CELL = 6;
const WALL_H = 16; // short far-side walls (2× the previous height)

export function FloorGrid() {
  const gridTex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, 64, 64);
      ctx.strokeStyle = "rgba(150,120,60,0.14)";
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
      {/* Recessed base lip — a deeper wood tone */}
      <mesh position={[0, -1.1, 0]} receiveShadow>
        <boxGeometry args={[W + 7, 1.4, D + 7]} />
        <meshStandardMaterial color="#d9c185" roughness={1} />
      </mesh>
      {/* Main stage — warm light-oak floor */}
      <mesh position={[0, -0.3, 0]} receiveShadow>
        <boxGeometry args={[W, 1.2, D]} />
        <meshStandardMaterial color="#ecd8a6" roughness={0.9} metalness={0} />
      </mesh>
      {/* Faint grid overlay */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.31, 0]}>
        <planeGeometry args={[W, D]} />
        <meshBasicMaterial map={gridTex} transparent depthWrite={false} />
      </mesh>

      {/* Two walls on the far sides (furthest from the camera: −x and −z) */}
      <mesh position={[0, WALL_H / 2, -D / 2]} receiveShadow castShadow>
        <boxGeometry args={[W, WALL_H, 1.4]} />
        <meshStandardMaterial color="#e7e3d6" roughness={1} />
      </mesh>
      <mesh position={[-W / 2, WALL_H / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[1.4, WALL_H, D]} />
        <meshStandardMaterial color="#eeeae0" roughness={1} />
      </mesh>
    </group>
  );
}
