// Orthographic pan + zoom + department focus for the tycoon office.
// No drei dependency: we drive the R3F orthographic camera directly.
//  - Drag       → pan across the ground plane (camera keeps its fixed iso offset).
//  - Wheel      → zoom (adjusts camera.zoom, not distance — keeps the iso look).
//  - CommandDock → focuses a department by lerping the look-at target.
import { useThree, useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useStore } from "../../../store/useStore";
import { CAMERA_CMD_EVENT, dragGuard, type CameraCmd } from "./cameraControl";

// Fixed 45°/35.26° isometric offset from the look-at target (matches reference).
const OFFSET = new THREE.Vector3(1, 1, 1).normalize().multiplyScalar(160);
const MIN_ZOOM = 3;
const MAX_ZOOM = 90;
// Visible world-height at the default zoom — replicates the reference framing
// (frustumSize 46 → ~92 world units) independent of screen resolution.
const FRAME_WORLD_HEIGHT = 120;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function CameraControls({
  focusPoints,
  defaultTarget,
}: {
  focusPoints: Record<string, [number, number, number]>;
  defaultTarget: [number, number, number];
}) {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const cameraTarget = useStore((s) => s.ui.camera.target);

  const target = useRef(new THREE.Vector3(...defaultTarget));
  const desired = useRef<THREE.Vector3 | null>(null);
  const didInit = useRef(false);

  // Keep the camera a fixed iso offset behind the look-at target.
  const sync = () => {
    camera.position.copy(target.current).add(OFFSET);
    camera.lookAt(target.current);
  };

  const baseZoom = () => clamp(size.height / FRAME_WORLD_HEIGHT, MIN_ZOOM, MAX_ZOOM);

  // Initial framing + re-fit on resize (only the default zoom; never fights the user).
  useEffect(() => {
    if (!didInit.current) {
      camera.zoom = baseZoom();
      camera.updateProjectionMatrix();
      didInit.current = true;
    }
    sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height]);

  // Department focus (CommandDock → store.ui.camera.target).
  useEffect(() => {
    const p = cameraTarget ? focusPoints[cameraTarget] : undefined;
    desired.current = new THREE.Vector3(...(p ?? defaultTarget));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraTarget]);

  useFrame(() => {
    if (!desired.current) return;
    target.current.lerp(desired.current, 0.12);
    if (target.current.distanceToSquared(desired.current) < 0.02) {
      target.current.copy(desired.current);
      desired.current = null;
    }
    sync();
  });

  // Drag-to-pan + wheel-to-zoom on the canvas element.
  useEffect(() => {
    const el = gl.domElement;
    let panning = false;
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();

    const onDown = (e: PointerEvent) => {
      panning = true;
      dragGuard.start();
      desired.current = null; // cancel any focus animation once the user takes over
    };
    const onMove = (e: PointerEvent) => {
      if (!panning) return;
      dragGuard.move(e.movementX, e.movementY);
      const wpp = 1 / camera.zoom; // world units per pixel (orthographic)
      right.setFromMatrixColumn(camera.matrixWorld, 0);
      right.y = 0;
      right.normalize();
      up.setFromMatrixColumn(camera.matrixWorld, 1);
      up.y = 0;
      up.normalize(); // ground-projected → pan stays locked to the floor plane
      target.current.addScaledVector(right, -e.movementX * wpp);
      target.current.addScaledVector(up, e.movementY * wpp);
      sync();
    };
    const onUp = () => {
      if (!panning) return;
      panning = false;
      dragGuard.end();
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camera.zoom = clamp(camera.zoom * Math.exp(-e.deltaY * 0.0015), MIN_ZOOM, MAX_ZOOM);
      camera.updateProjectionMatrix();
    };
    const onContext = (e: Event) => e.preventDefault();

    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("contextmenu", onContext);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("contextmenu", onContext);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl]);

  // HUD zoom / reset buttons.
  useEffect(() => {
    const onCmd = (e: Event) => {
      const cmd = (e as CustomEvent).detail as CameraCmd;
      if (cmd.type === "zoomIn") camera.zoom = clamp(camera.zoom * 1.25, MIN_ZOOM, MAX_ZOOM);
      else if (cmd.type === "zoomOut") camera.zoom = clamp(camera.zoom / 1.25, MIN_ZOOM, MAX_ZOOM);
      else if (cmd.type === "reset") {
        camera.zoom = baseZoom();
        desired.current = new THREE.Vector3(...defaultTarget);
      }
      camera.updateProjectionMatrix();
    };
    window.addEventListener(CAMERA_CMD_EVENT, onCmd);
    return () => window.removeEventListener(CAMERA_CMD_EVENT, onCmd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, size.height]);

  return null;
}
