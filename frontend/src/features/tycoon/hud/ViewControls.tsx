import { GlassPanel } from "../../../components/ui/GlassPanel";
import { sendCameraCmd } from "../scene/cameraControl";

// On-canvas map controls: zoom in/out + reset framing, plus a discoverability hint.
export function ViewControls() {
  const btn =
    "flex h-9 w-9 items-center justify-center rounded-full text-lg leading-none text-on-background/80 hover:bg-surface-high active:scale-95 transition";
  return (
    <div className="pointer-events-none absolute bottom-24 right-6 flex flex-col items-end gap-2">
      <GlassPanel level={3} className="pointer-events-auto flex flex-col items-center gap-1 p-1.5" data-testid="view-controls">
        <button className={btn} aria-label="확대" onClick={() => sendCameraCmd({ type: "zoomIn" })}>
          +
        </button>
        <button className={btn} aria-label="축소" onClick={() => sendCameraCmd({ type: "zoomOut" })}>
          −
        </button>
        <div className="my-0.5 h-px w-6 bg-outline-variant/50" />
        <button
          className="flex h-9 w-9 items-center justify-center rounded-full text-base text-on-background/80 hover:bg-surface-high active:scale-95 transition"
          aria-label="화면 초기화"
          title="Reset view"
          onClick={() => sendCameraCmd({ type: "reset" })}
        >
          ⌖
        </button>
      </GlassPanel>
      <GlassPanel level={2} className="pointer-events-none px-3 py-1 text-[11px] text-on-background/50">
        드래그로 이동 · 스크롤로 확대/축소
      </GlassPanel>
    </div>
  );
}
