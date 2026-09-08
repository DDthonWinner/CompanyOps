import { GlassPanel } from "../../components/ui/GlassPanel";
import { Button } from "../../components/ui/Button";
import { useStore } from "../../store/useStore";

export function WebGLFallback() {
  const setActiveTab = useStore((s) => s.setActiveTab);
  return (
    <div className="flex h-full items-center justify-center p-6">
      <GlassPanel level={4} className="max-w-md p-6 text-center">
        <h2 className="display mb-2 text-lg font-semibold">3D 뷰를 표시할 수 없습니다</h2>
        <p className="mb-4 text-sm text-on-background/70">
          WebGL을 사용할 수 없는 환경입니다. 기능 상태와 선택은 Dashboard에서 계속 확인할 수 있습니다.
        </p>
        <Button onClick={() => setActiveTab("dashboard")} data-testid="webgl-fallback-dashboard">
          Dashboard로 이동
        </Button>
      </GlassPanel>
    </div>
  );
}

export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}
