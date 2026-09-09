import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { Icon } from "../../components/ui/Icon";
import { useStore } from "../../store/useStore";
import { AgentMatchingPanel } from "./AgentMatchingPanel";
import { AgentOverview } from "./AgentOverview";
import { WorkspaceBrief } from "./WorkspaceBrief";
import { AttentionCenter } from "./AttentionCenter";
import { CommandInput } from "./CommandInput";
import { DevelopmentFlow } from "./DevelopmentFlow";
import { FeedbackSection } from "./FeedbackSection";
import { DashboardDetails } from "./DashboardDetails";
import { HeaderStrip } from "./HeaderStrip";
import { ProjectCreateDialog } from "./ProjectCreateDialog";

export function DashboardView() {
  const activeProjectId = useStore((s) => s.activeProjectId);
  const snapshot = useStore((s) => s.snapshot);
  const [createOpen, setCreateOpen] = useState(false);
  const selectPanel = useStore((s) => s.setDashboardPanel);
  const status = snapshot?.project.status;
  const needsTeam = status === "DRAFT" || status === "AGENT_MATCHING" || status === "READY";

  return (
    <div data-testid="dash-view" className="h-full w-full overflow-auto px-3 pb-28 sm:px-6">
      <div className="mx-auto max-w-[1280px] space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2 pt-2">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-background/45">
              Your Development Control Center
            </div>
            <h1 className="display text-2xl font-bold">프로젝트 워크스페이스</h1>
          </div>
          <div className="flex flex-wrap gap-2">
          {activeProjectId && <Button variant="ghost" onClick={() => selectPanel("tasks")}>작업 살펴보기 ↗</Button>}
          <Button onClick={() => setCreateOpen(true)} data-testid="project-create-open">
            <Icon name="add" size={16} /> 새 프로젝트
          </Button>
          </div>
        </div>

        {!activeProjectId && (
          <GlassPanel level={2} className="p-6 text-sm text-on-background/70">
            프로젝트를 선택하거나 <b>새 프로젝트</b>를 생성하세요.
          </GlassPanel>
        )}

        {activeProjectId && <HeaderStrip />}

        {activeProjectId && needsTeam && <AgentMatchingPanel />}

        {activeProjectId && !needsTeam && (
          <>
            {/* Center flow + Attention Center (04 §23) */}
            <div className="flex flex-col gap-4 lg:flex-row">
              <div className="order-2 min-w-0 flex-1 lg:order-1">
                <DevelopmentFlow />
              </div>
              <div id="dashboard-attention" className="order-1 flex w-full flex-col gap-3 lg:order-2 lg:w-80 lg:flex-shrink-0">
                <AttentionCenter />
                <WorkspaceBrief />
              </div>
            </div>

            {/* Agent roster (current & next step) */}
            <div id="dashboard-agents"><AgentOverview key={activeProjectId} /></div>

            <DashboardDetails key={activeProjectId} />
            {status === "COMPLETED" && <FeedbackSection />}
          </>
        )}
      </div>

      {/* bottom command bar */}
      <div className="fixed bottom-4 left-1/2 z-30 w-[min(1100px,94vw)] -translate-x-1/2">
        {activeProjectId && <CommandInput />}
      </div>

      <ProjectCreateDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
