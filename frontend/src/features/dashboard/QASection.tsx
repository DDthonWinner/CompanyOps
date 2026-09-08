import { GlassPanel } from "../../components/ui/GlassPanel";
import { StatusPill } from "../../components/ui/StatusPill";
import { useStore } from "../../store/useStore";

export function QASection() {
  const qaRuns = useStore((s) => s.snapshot?.qaRuns ?? []);
  return (
    <GlassPanel level={2} className="p-4">
      <h3 className="display mb-2 text-sm font-semibold">QA · Quality Gate</h3>
      {qaRuns.length === 0 && <div className="text-xs text-on-background/50">QA 실행 결과가 없습니다.</div>}
      <ul className="space-y-1 text-xs">
        {qaRuns.map((q) => {
          const r = (q.results ?? {}) as { total?: number; passed?: number; failed?: number };
          const gateStatus = q.technicalGate === "PASSED" ? "COMPLETED" : q.technicalGate === "FAILED" ? "FAILED" : "REVIEW";
          return (
            <li key={q.id} className="flex items-center justify-between gap-2">
              <span className="truncate">
                Task {q.taskId?.slice(0, 8)} {q.demo ? "· demo QA" : ""}
              </span>
              <span className="flex items-center gap-2">
                <span className="tabular text-on-background/60">
                  {r.passed ?? 0}P / {r.failed ?? 0}F
                </span>
                <StatusPill status={gateStatus} />
              </span>
            </li>
          );
        })}
      </ul>
    </GlassPanel>
  );
}
