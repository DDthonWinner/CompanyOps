// Staggered entrance: children start slightly below + transparent, then float up
// and fade in over a short window (delay lets floor → desks → agents cascade).
import { useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { applyOpacity } from "./agentDrag";

const DURATION = 0.45;

export function IntroGroup({
  delay = 0,
  rise = 2.5,
  children,
}: {
  delay?: number;
  rise?: number;
  children: ReactNode;
}) {
  const g = useRef<THREE.Group>(null);
  const done = useRef(false);

  useFrame((state) => {
    if (done.current || !g.current) return;
    const p = Math.max(0, Math.min(1, (state.clock.elapsedTime - delay) / DURATION));
    const e = 1 - Math.pow(1 - p, 3); // ease-out cubic
    g.current.position.y = (1 - e) * -rise;
    applyOpacity(g.current, e);
    if (p >= 1) {
      done.current = true;
      g.current.position.y = 0;
      applyOpacity(g.current, 1);
    }
  });

  return <group ref={g}>{children}</group>;
}
