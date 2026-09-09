import { useEffect, useState } from "react";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { useStore } from "../../store/useStore";
import { AgentMatchingPanel } from "./AgentMatchingPanel";
import { AgentOverview } from "./AgentOverview";
import { WorkspaceBrief } from "./WorkspaceBrief";
import { AttentionCenter } from "./AttentionCenter";
import { DevelopmentFlow } from "./DevelopmentFlow";
import { FeedbackSection } from "./FeedbackSection";
import { DashboardDetails } from "./DashboardDetails";
import { HeaderStrip } from "./HeaderStrip";

export function DashboardView() {
  const activeProjectId = useStore((s) => s.activeProjectId);
  const snapshot = useStore((s) => s.snapshot);
  const [feedbackRequest, setFeedbackRequest] = useState<{ pid: string; id: number } | null>(null);
  useEffect(() => { setFeedbackRequest(null); }, [activeProjectId]);
  const status = snapshot?.project.status;
  const needsTeam = status === "DRAFT" || status === "AGENT_MATCHING" || status === "READY";

  return (
    <div data-testid="dash-view" className="h-full w-full overflow-auto px-3 pb-6 sm:px-6">
      <div className="mx-auto max-w-[1280px] space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2 pt-2">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-background/45">
              Your Development Control Center
            </div>
            <h1 className="display text-2xl font-bold">프로젝트 워크스페이스</h1>
          </div>
        </div>

        {!activeProjectId && (
          <GlassPanel level={2} className="p-6 text-sm text-on-background/70">
프로젝트를 선택하세요. 새 프로젝트는 상단 바 또는 Tycoon Office에서 생성할 수 있습니다.
          </GlassPanel>
        )}

        {activeProjectId && <HeaderStrip onFeedback={() => setFeedbackRequest({ pid: activeProjectId, id: Date.now() })} />}

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
                <WorkspaceBrief key={activeProjectId} />
              </div>
            </div>

            {/* Agent roster (current & next step) */}
            <div id="dashboard-agents"><AgentOverview key={activeProjectId} /></div>

            <DashboardDetails key={activeProjectId} />
          </>
        )}
        {activeProjectId && snapshot && (
          <section aria-label="AI 활용 분석 및 Feedback" className="border-t border-outline-variant/70 pt-6">
            <FeedbackSection requestId={feedbackRequest?.pid === activeProjectId ? feedbackRequest.id : undefined} />
          </section>
        )}
      </div>

    </div>
  );
}
