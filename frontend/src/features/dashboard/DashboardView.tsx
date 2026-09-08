import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { useStore } from "../../store/useStore";
import { ActiveTaskList } from "./ActiveTaskList";
import { AgentMatchingPanel } from "./AgentMatchingPanel";
import { AgentOverview } from "./AgentOverview";
import { AttentionCenter } from "./AttentionCenter";
import { CommandInput } from "./CommandInput";
import { FeedbackSection } from "./FeedbackSection";
import { HeaderStrip } from "./HeaderStrip";
import { PlanReviewPanel } from "./PlanReviewPanel";
import { ProjectCreateDialog } from "./ProjectCreateDialog";
import { QASection } from "./QASection";
import { RecentArtifacts } from "./RecentArtifacts";
import { ActivityTimeline } from "./ActivityTimeline";

export function DashboardView() {
  const activeProjectId = useStore((s) => s.activeProjectId);
  const snapshot = useStore((s) => s.snapshot);
  const [createOpen, setCreateOpen] = useState(false);
  const status = snapshot?.project.status;
  const needsTeam = status === "DRAFT" || status === "AGENT_MATCHING" || status === "READY";

  return (
    <div data-testid="dash-view" className="h-full w-full overflow-auto px-6 pb-28">
      <div className="mx-auto max-w-[1200px] space-y-4">
        <div className="flex items-center justify-between pt-2">
          <HeaderStrip />
          <Button onClick={() => setCreateOpen(true)} data-testid="project-create-open">+ 새 프로젝트</Button>
        </div>

        {!activeProjectId && (
          <GlassPanel level={2} className="p-6 text-sm text-on-background/70">
            프로젝트를 선택하거나 <b>새 프로젝트</b>를 생성하세요.
          </GlassPanel>
        )}

        {activeProjectId && needsTeam && <AgentMatchingPanel />}

        {activeProjectId && (
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="order-2 flex-1 space-y-4 md:order-1">
              <AgentOverview />
              <PlanReviewPanel />
              <ActiveTaskList />
              <QASection />
              <div className="grid gap-4 md:grid-cols-2">
                <ActivityTimeline />
                <RecentArtifacts />
              </div>
              <FeedbackSection />
            </div>
            <div className="order-1 w-full md:order-2 md:w-80 md:flex-shrink-0">
              <AttentionCenter />
            </div>
          </div>
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
