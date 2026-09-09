import { useEffect, useRef } from "react";
import { useStore, type DashboardPanel } from "../../store/useStore";
import { ActiveTaskList } from "./ActiveTaskList";
import { ActivityTimeline } from "./ActivityTimeline";
import { PlanReviewPanel } from "./PlanReviewPanel";
import { QASection } from "./QASection";
import { RecentArtifacts } from "./RecentArtifacts";
import { TokenUsage } from "./TokenUsage";

const TABS: [DashboardPanel, string][] = [["overview", "요약"], ["tasks", "작업"], ["plan", "계획 검토"], ["quality", "품질"], ["resources", "토큰"], ["activity", "활동"], ["artifacts", "결과물"]];
export function DashboardDetails() {
  const ui = useStore((s) => s.ui);
  const selected = ui.dashboardPanel ?? "overview";
  const select = useStore((s) => s.setDashboardPanel);
  const snapshot = useStore((s) => s.snapshot);
  const root = useRef<HTMLElement>(null);
  const panel = TABS.some(([id]) => id === selected) ? selected : "overview";
  useEffect(() => {
    if (panel !== "overview") root.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [panel, ui]);
  const pendingPlans = snapshot?.plans.filter((p) => p.status === "REVIEW" || p.status === "FINAL_APPROVAL_PENDING").length ?? 0;
  return <section ref={root} aria-label="프로젝트 상세 탐색" className="scroll-mb-24" data-testid="dashboard-details">
    <div role="tablist" aria-label="프로젝트 상세" className="mb-3 flex gap-1 overflow-x-auto rounded-xl border border-outline-variant/60 bg-white/70 p-1">
      {TABS.map(([id, label], index) => <button key={id} type="button" role="tab" id={`dashboard-tab-${id}`} aria-controls={`dashboard-panel-${id}`} aria-selected={panel === id} tabIndex={panel === id ? 0 : -1}
        onClick={() => select(id)} onKeyDown={(event) => {
          let next = index;
          if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
          else if (event.key === "ArrowLeft") next = (index + TABS.length - 1) % TABS.length;
          else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = TABS.length - 1;
          else return;
          event.preventDefault(); select(TABS[next][0]); document.getElementById(`dashboard-tab-${TABS[next][0]}`)?.focus();
        }} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition focus-visible:outline-primary ${panel === id ? "bg-primary text-white shadow-sm" : "text-on-background/60 hover:bg-surface"}`}>
        {label}{id === "tasks" ? ` · ${snapshot?.tasks.length ?? 0}` : id === "plan" && pendingPlans ? ` · ${pendingPlans}` : ""}
      </button>)}
    </div>
    <div role="tabpanel" id={`dashboard-panel-${panel}`} aria-labelledby={`dashboard-tab-${panel}`} tabIndex={0} className={`${panel === "overview" ? "" : "max-h-[340px] overflow-auto overscroll-contain"} rounded-xl focus-visible:outline-primary`}>
      {panel === "overview" && <div className="grid gap-3 md:grid-cols-3"><QASection compact onExpand={() => select("quality")} /><ActivityTimeline compact onExpand={() => select("activity")} /><RecentArtifacts compact onExpand={() => select("artifacts")} /></div>}
      {panel === "tasks" && <ActiveTaskList />}
      <div hidden={panel !== "plan"}><PlanReviewPanel /></div>
      {panel === "quality" && <QASection />}
      {panel === "resources" && <><TokenUsage /><p className="px-4 py-2 text-xs text-on-background/55">AI 활용 Score와 Feedback은 프로젝트 완료 후 확인할 수 있습니다.</p></>}
      {panel === "activity" && <ActivityTimeline />}
      {panel === "artifacts" && <RecentArtifacts />}
    </div>
  </section>;
}
