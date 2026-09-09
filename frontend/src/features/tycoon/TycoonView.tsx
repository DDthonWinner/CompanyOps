import { useMemo } from "react";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { useStore } from "../../store/useStore";
import { ProjectCreationGate } from "./ProjectCreationGate";
import { TycoonCanvas } from "./TycoonCanvas";
import { WebGLFallback, isWebGLAvailable } from "./WebGLFallback";
import { AgentList } from "./hud/AgentList";
import { CommandDock } from "./hud/CommandDock";
import { HireButton } from "./hud/HireButton";
import { SideHUD } from "./hud/SideHUD";
import { VelocityPod } from "./hud/VelocityPod";
import { ViewControls } from "./hud/ViewControls";

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

  if (!activeProjectId) return <ProjectCreationGate />;
  if (!webgl) return <WebGLFallback />;
  if (!snapshot) return <Empty msg="로딩 중…" />;

  return (
    <div className="relative h-full w-full">
      <TycoonCanvas snapshot={snapshot} />
      {/* Left column: project summary + agent roster, hugging the top-left corner */}
      <div className="pointer-events-none absolute bottom-4 left-4 top-4 flex w-64 flex-col gap-3">
        <SideHUD />
        <AgentList />
      </div>
      {/* Right column: hire CTA + sprint milestones, hugging the top-right corner */}
      <div className="pointer-events-none fixed bottom-4 right-4 top-4 z-50 flex w-72 flex-col gap-3">
        <HireButton />
        <VelocityPod />
      </div>
      <ViewControls />
      <CommandDock />
    </div>
  );
}
