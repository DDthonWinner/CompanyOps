import { useState } from "react";
import { GlassPanel } from "../../../components/ui/GlassPanel";
import { StatusPill } from "../../../components/ui/StatusPill";
import { useStore } from "../../../store/useStore";

export function VelocityPod() {
  const snapshot = useStore((s) => s.snapshot);
  const connection = useStore((s) => s.connection);
  const [expanded, setExpanded] = useState<string | null>(null);
  if (!snapshot) return null;

  return (
    <GlassPanel
      level={2}
      className="pointer-events-auto w-full max-h-[calc(100vh-11rem)] overflow-auto p-4"
      data-testid="velocity-pod"
    >
      <div className="display mb-2 text-sm font-semibold">Active Sprint Milestones</div>
      <div className="mb-3 flex items-center gap-2 text-xs text-on-background/60">
        <span className={`h-2 w-2 rounded-full ${connection === "CONNECTED" ? "bg-emerald-500 motion-safe:animate-pulse" : "bg-amber-500"}`} />
        <span>{connection === "CONNECTED" ? "실시간 연결" : "연결 확인 중"}</span>
        <span className="ml-auto">작업 중 {snapshot.agents.filter((a) => a.status === "WORKING").length}명</span>
      </div>
      {snapshot.milestones.length === 0 && (
        <div className="text-xs text-on-background/50">작업 없음</div>
      )}
      <ul className="space-y-2">
        {snapshot.milestones.map((m) => {
          const isOpen = expanded === m.id;
          const tasks = snapshot.tasks.filter((t) => t.sprintMilestoneId === m.id);
          const active = tasks.filter((t) => ["RUNNING", "REVIEW", "BLOCKED"].includes(t.status));
          return (
            <li key={m.id} data-testid={`velocitypod-milestone-${m.id}`}>
              <button
                className="flex w-full items-center justify-between gap-2 text-left"
                onClick={() => setExpanded(isOpen ? null : m.id)}
                aria-expanded={isOpen}
              >
                <span className="truncate text-sm font-medium">{m.title}</span>
                <span className="tabular text-xs text-on-background/60">
                  {m.progressTotal === 0 ? "작업 없음" : `${m.progressCurrent}/${m.progressTotal}`}
                </span>
              </button>
              {m.progressTotal > 0 && (
                <div className="mt-1.5 flex items-center gap-2">
                  <span
                    className="tabular w-9 shrink-0 text-left text-xs font-bold"
                    style={{ color: m.displayColor ?? "#4f46e5" }}
                  >
                    {m.progressPercent}%
                  </span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-high">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${m.progressPercent}%`, backgroundColor: m.displayColor ?? "#4f46e5" }}
                    />
                  </div>
                </div>
              )}
              {m.reviewStatus && (
                <div className="mt-1">
                  <StatusPill status={m.reviewStatus} testId={`mr-status-${m.id}`} />
                </div>
              )}
              {active.length > 0 && (
                <ul className="mt-2 space-y-1.5 rounded-lg bg-surface-high/50 p-2" aria-label={`${m.title} 현재 작업`}>
                  {active.map((t) => {
                    const agent = snapshot.agents.find((a) => a.id === t.assignedProjectAgentId);
                    return <li key={t.id} className="text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.status === "RUNNING" ? "bg-emerald-500 motion-safe:animate-pulse" : t.status === "BLOCKED" ? "bg-red-500" : "bg-amber-500"}`} />
                        <span className="min-w-0 flex-1 truncate" title={t.title}>{t.title}</span>
                        <span className="shrink-0 text-on-background/60">{t.status === "RUNNING" ? "개발 중" : t.status === "REVIEW" ? "검토 중" : "결정 대기"}</span>
                      </div>
                      {agent && <div className="ml-3 mt-0.5 truncate text-on-background/50">{agent.displayName}</div>}
                    </li>;
                  })}
                </ul>
              )}
              {isOpen && (
                <ul className="mt-1 space-y-1 border-l border-outline-variant pl-2">
                  {tasks.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate">{t.title}</span>
                      <StatusPill status={t.status} />
                    </li>
                  ))}
                  {tasks.length === 0 && <li className="text-xs text-on-background/50">작업 없음</li>}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </GlassPanel>
  );
}
