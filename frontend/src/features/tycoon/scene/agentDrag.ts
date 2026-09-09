// Imperative (non-reactive) drag state, read every frame by DevPawn and by
// CameraControls (to suppress panning while an agent is being dragged).
import * as THREE from "three";

export const agentDrag = {
  activeId: null as string | null, // agent currently held/dragging
  suppressPan: false, // set on pointerdown over an agent so the camera doesn't pan
  didDrag: false, // true right after a drag, so the click→select is skipped
  ground: new THREE.Vector3(), // live pointer position projected onto the floor
};
