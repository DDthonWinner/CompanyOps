// View-control command bus + pan/click guard for the tycoon canvas.
// Kept as CustomEvents so on-canvas HUD buttons can drive the R3F camera
// without threading refs through the component tree (mirrors selectionEvent.ts).
export type CameraCmd = { type: "zoomIn" } | { type: "zoomOut" } | { type: "reset" };

export const CAMERA_CMD_EVENT = "tycoon-camera-cmd";

export function sendCameraCmd(cmd: CameraCmd): void {
  window.dispatchEvent(new CustomEvent(CAMERA_CMD_EVENT, { detail: cmd }));
}

// Distinguishes a camera drag from a click so panning never selects an item.
// Scene click handlers call `didPan()`; the flag self-clears after the click cycle.
let moved = 0;
export const dragGuard = {
  start() {
    moved = 0;
  },
  move(dx: number, dy: number) {
    moved += Math.abs(dx) + Math.abs(dy);
  },
  end() {
    // Keep `moved` readable through the click that follows pointerup, then reset.
    setTimeout(() => {
      moved = 0;
    }, 0);
  },
  didPan() {
    return moved > 6;
  },
};
