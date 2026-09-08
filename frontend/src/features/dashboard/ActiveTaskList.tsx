import { GlassPanel } from "../../components/ui/GlassPanel";
import { StatusPill } from "../../components/ui/StatusPill";
import { useStore } from "../../store/useStore";
import type { ExecStatus } from "../../api/types";

const COLUMNS: ExecStatus[] = ["TODO", "RUNNING", "WAITING", "REVIEW", "COMPLETED", "BLOCKED"];

export function ActiveTaskList() {
  const snapshot = useStore((s) => s.snapshot);
  if (!snapshot) return null;
  return (
    <GlassPanel level={2} className="p-4">
      <h3 className="display mb-3 text-sm font-semibold">Tasks</h3>
      <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
        {COLUMNS.map((col) => {
          const tasks = snapshot.tasks.filter((t) => t.status === col);
          return (
            <div key={col}>
              <div className="mb-1 flex items-center gap-1 text-xs">
                <StatusPill status={col} />
                <span className="tabular text-on-background/50">{tasks.length}</span>
              </div>
              <ul className="space-y-1">
                {tasks.map((t) => (
                  <li
                    key={t.id}
                    className="rounded border border-outline-variant bg-surface-lowest p-1.5 text-xs"
                    title={t.waitReasons.length ? `대기: ${t.waitReasons.join(", ")}` : undefined}
                  >
                    {t.title}
                    {t.waitReasons.length > 0 && (
                      <div className="mt-0.5 text-[10px] text-amber-700">⏸ {t.waitReasons.join(", ")}</div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </GlassPanel>
  );
}
