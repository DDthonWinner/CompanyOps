import { useMemo } from "react";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { useStore } from "../../store/useStore";
import { TycoonCanvas } from "./TycoonCanvas";
import { WebGLFallback, isWebGLAvailable } from "./WebGLFallback";
import { CommandDock } from "./hud/CommandDock";
import { SideHUD } from "./hud/SideHUD";
import { VelocityPod } from "./hud/VelocityPod";

function Empty({ msg }: { msg: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <GlassPanel level={2} className="px-6 py-4 text-sm text-on-background/60">{msg}</GlassPanel>
    </div>
  );
}

export function TycoonView() {
  const activeProjectId = useStore((s) => s.activeProjectId);
  const snapshot = useStore((s) => s.snapshot);
  const webgl = useMemo(() => isWebGLAvailable(), []);

  if (!activeProjectId) return <Empty msg="프로젝트를 선택하세요" />;
  if (!webgl) return <WebGLFallback />;
  if (!snapshot) return <Empty msg="로딩 중…" />;

  return (
    <div className="relative h-full w-full">
      <TycoonCanvas snapshot={snapshot} />
      <SideHUD />
      <VelocityPod />
      <CommandDock />
    </div>
  );
}
