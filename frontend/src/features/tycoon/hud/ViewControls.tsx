import { GlassPanel } from "../../../components/ui/GlassPanel";
import { sendCameraCmd } from "../scene/cameraControl";

// Compact on-canvas map controls, pinned to the bottom-right corner.
export function ViewControls() {
  const btn =
    "flex h-6 w-6 items-center justify-center rounded-full text-sm leading-none text-on-background/80 hover:bg-surface-high active:scale-95 transition";
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40 flex flex-col items-end gap-1.5">
      <GlassPanel level={3} className="pointer-events-auto flex flex-col items-center gap-0.5 p-1" data-testid="view-controls">
        <button className={btn} aria-label="확대" onClick={() => sendCameraCmd({ type: "zoomIn" })}>
          +
        </button>
        <button className={btn} aria-label="축소" onClick={() => sendCameraCmd({ type: "zoomOut" })}>
          −
        </button>
        <div className="my-0.5 h-px w-4 bg-outline-variant/50" />
        <button
          className="flex h-6 w-6 items-center justify-center rounded-full text-xs text-on-background/80 hover:bg-surface-high active:scale-95 transition"
          aria-label="화면 초기화"
          title="Reset view"
          onClick={() => sendCameraCmd({ type: "reset" })}
        >
          ⌖
        </button>
      </GlassPanel>
      <GlassPanel level={2} className="pointer-events-none px-2 py-0.5 text-[9px] text-on-background/50">
        드래그로 이동 · 스크롤로 확대/축소
      </GlassPanel>
    </div>
  );
}
