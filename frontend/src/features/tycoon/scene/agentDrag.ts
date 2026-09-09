// Imperative (non-reactive) drag state, read every frame by DevPawn / DomainDesk /
// PMSuite and by CameraControls (to suppress panning while an agent is dragged).
import * as THREE from "three";

export const agentDrag = {
  activeId: null as string | null, // agent currently held/dragging
  suppressPan: false, // set on pointerdown over an agent so the camera doesn't pan
  didDrag: false, // true right after a drag, so the click→select is skipped
  ground: new THREE.Vector3(), // live pointer position projected onto the floor
  hoverRole: null as string | null, // desk role currently under the dragged agent
};

// Multiply every material under `obj` by `k` (1 = opaque). Base opacity/flags are
// captured once so repeated calls compose correctly.
export function applyOpacity(obj: THREE.Object3D | null, k: number): void {
  if (!obj) return;
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const m = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (!m) return;
    const mats = Array.isArray(m) ? m : [m];
    for (const mat of mats) {
      const ud = mat.userData as { baseOpacity?: number; baseTransparent?: boolean };
      if (ud.baseOpacity === undefined) {
        ud.baseOpacity = mat.opacity;
        ud.baseTransparent = mat.transparent;
      }
      mat.opacity = ud.baseOpacity * k;
      mat.transparent = ud.baseTransparent || k < 0.999;
      mat.depthWrite = !mat.transparent;
    }
  });
}
