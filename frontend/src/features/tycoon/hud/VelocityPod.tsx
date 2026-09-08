import { useState } from "react";
import { GlassPanel } from "../../../components/ui/GlassPanel";
import { StatusPill } from "../../../components/ui/StatusPill";
import { useStore } from "../../../store/useStore";

export function VelocityPod() {
  const snapshot = useStore((s) => s.snapshot);
  const [expanded, setExpanded] = useState<string | null>(null);
  if (!snapshot) return null;

  return (
    <GlassPanel
      level={2}
      className="pointer-events-auto absolute right-4 top-4 max-h-[calc(100vh-2rem)] w-72 overflow-auto p-4"
      data-testid="velocity-pod"
    >
      <div className="display mb-2 text-sm font-semibold">Active Sprint Milestones</div>
      {snapshot.milestones.length === 0 && (
        <div className="text-xs text-on-background/50">작업 없음</div>
      )}
      <ul className="space-y-2">
        {snapshot.milestones.map((m) => {
          const isOpen = expanded === m.id;
          const tasks = snapshot.tasks.filter((t) => t.sprintMilestoneId === m.id);
          return (
            <li key={m.id} data-testid={`velocitypod-milestone-${m.id}`}>
              <button
                className="flex w-full items-center justify-between gap-2 text-left"
                onClick={() => setExpanded(isOpen ? null : m.id)}
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
