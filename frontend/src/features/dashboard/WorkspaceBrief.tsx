import { GlassPanel } from "../../components/ui/GlassPanel";
import { Icon } from "../../components/ui/Icon";
import { useStore } from "../../store/useStore";
import { fmtTokens } from "../../lib/format";

const PLAN_LABEL: Record<string, string> = {
  REVIEW: "피드백 검토 중", FINAL_APPROVAL_PENDING: "최종 실행 승인 대기",
  APPROVED_WAITING: "실행 조건 대기", EXECUTING: "실행 중", COMPLETED: "완료",
};
/** All project summaries remain visible alongside the development flow. */
export function WorkspaceBrief() {
  const snapshot = useStore((s) => s.snapshot);
  const select = useStore((s) => s.setDashboardPanel);
  if (!snapshot) return null;
  const plan = [...snapshot.plans].filter((p) => p.status !== "SUPERSEDED").sort((a, b) => b.version - a.version)[0];
  const usage = snapshot.tokenUsage;
  const tasks = snapshot.tasks.filter((task) => task.status !== "CANCELLED");
  const running = tasks.filter((task) => task.status === "RUNNING");
  const waiting = tasks.filter((task) => ["WAITING", "BLOCKED", "REVIEW"].includes(task.status));
  const next = [...running, ...waiting, ...tasks.filter((task) => task.status === "TODO")].slice(0, 1);
  const failedGates = snapshot.qaRuns.filter((run) => ["FAILED", "ERROR"].includes(run.technicalGate)).length;
  const published = snapshot.git.filter((item) => item.status === "PUSHED");
  const rowStyle = "block w-full min-w-0 rounded-lg border border-outline-variant/60 bg-surface-lowest p-2.5 text-left transition hover:border-primary/50 focus-visible:outline-primary";

  return <GlassPanel level={2} className="hidden min-w-0 flex-1 flex-col p-3 lg:flex" data-testid="workspace-brief">
    <h3 className="display mb-2 flex items-center gap-1.5 text-xs font-semibold"><Icon name="space_dashboard" size={16} className="text-primary" />프로젝트 요약</h3>
    <div className="flex flex-1 flex-col justify-between gap-2 text-xs">
      <section className="space-y-2" aria-label="사용량과 계획">
        <button type="button" onClick={() => select("resources")} className={rowStyle}>
          <span className="flex items-center justify-between gap-2"><span className="text-[11px] font-semibold">Token Usage</span><Icon name="north_east" size={13} className="text-primary" /></span>
          <span className="mt-1 flex items-baseline gap-2"><strong className="tabular text-xl text-primary">{fmtTokens(usage?.collected ? usage.total : null)}</strong>{usage?.demo && <span className="text-[10px] text-on-background/45">데모 데이터</span>}</span>
          <span className="mt-1 block text-[10px] text-on-background/55">{usage?.collected ? `Input ${fmtTokens(usage.totalInput)} · Output ${fmtTokens(usage.totalOutput)}` : "실행 후 토큰 사용량 집계"}</span>
        </button>
        <button type="button" onClick={() => select("plan")} className={rowStyle}>
          <span className="flex items-center justify-between gap-2"><span className="text-[11px] font-semibold">현재 계획</span><Icon name="north_east" size={13} className="text-primary" /></span>
          <span className="mt-1 block text-xs font-medium">{plan ? `v${plan.version} · ${PLAN_LABEL[plan.status] ?? plan.status}` : "등록된 계획 없음"}</span>
          <span className="mt-1 block truncate text-[10px] text-on-background/55" title={plan?.request}>{plan?.request || "계획과 실행 상태를 확인하세요"}</span>
        </button>
      </section>
      <section className="space-y-1 border-t border-outline-variant/60 pt-2" aria-label="작업 요약">
        <h4 className="text-[11px] font-semibold">작업</h4>
        <div className="grid grid-cols-3 gap-2 rounded-lg bg-primary/5 p-1 text-center"><Count label="실행" value={running.length} /><Count label="대기·검토" value={waiting.length} /><Count label="완료" value={tasks.filter((task) => task.status === "COMPLETED").length} /></div>
        {next.length ? next.map((task) => <button key={task.id} onClick={() => select("tasks")} className="block w-full truncate rounded p-1 text-left text-[11px] text-on-background/65 hover:bg-surface-high" title={task.title}>{task.title}</button>) : <p className="p-2 text-on-background/55">진행할 작업이 없습니다.</p>}
        <More onClick={() => select("tasks")}>전체 작업 보기</More>
      </section>
      <section className="space-y-1 border-t border-outline-variant/60 pt-2" aria-label="품질 요약">
        <h4 className="text-[11px] font-semibold">품질</h4>
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-primary/5 p-1 text-center"><Count label="QA 완료" value={snapshot.qaRuns.filter((run) => run.runStatus === "COMPLETED").length} /><Count label="Gate 실패·오류" value={failedGates} /></div>
        <p className="px-1 text-[11px] text-on-background/60">Milestone 결과 승인 대기 · {snapshot.milestones.filter((milestone) => milestone.reviewStatus === "PENDING").length}건</p>
        {!snapshot.qaRuns.length && <p className="px-1 text-[11px] text-on-background/50">아직 QA 실행 결과가 없습니다.</p>}
        <More onClick={() => select("quality")}>QA 상세 보기</More>
      </section>
      <section className="space-y-1 border-t border-outline-variant/60 pt-2" aria-label="결과물 요약">
        <h4 className="text-[11px] font-semibold">결과물</h4>
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-primary/5 p-1 text-center"><Count label="게시 완료" value={published.length} /><Count label="게시 실패" value={snapshot.git.filter((item) => item.status === "FAILED").length} /></div>
        {published.slice(-1).reverse().map((item, index) => <p key={`${item.taskId}-${index}`} className="truncate px-1 text-[11px] text-on-background/60">{tasks.find((task) => task.id === item.taskId)?.title ?? item.commitSha ?? "게시된 결과물"}</p>)}
        {!published.length && <p className="px-1 text-[11px] text-on-background/50">아직 게시된 결과물이 없습니다.</p>}
        <More onClick={() => select("artifacts")}>결과물 상세 보기</More>
      </section>
    </div>
  </GlassPanel>;
}
function Count({ label, value }: { label: string; value: number }) {
  return <div><strong className="tabular block text-base text-primary">{value}</strong><span className="text-[10px] text-on-background/55">{label}</span></div>;
}
function More({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex items-center gap-1 rounded px-1 py-1 text-[11px] text-primary hover:bg-primary/5">{children}<Icon name="north_east" size={12} /></button>;
}
