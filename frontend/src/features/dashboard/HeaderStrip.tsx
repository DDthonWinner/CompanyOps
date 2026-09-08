import { useStore } from "../../store/useStore";

export function HeaderStrip() {
  const snapshot = useStore((s) => s.snapshot);
  if (!snapshot) return null;
  const p = snapshot.project;
  const running = snapshot.tasks.filter((t) => t.status === "RUNNING").length;
  const waiting = snapshot.tasks.filter((t) => t.status === "WAITING" || t.status === "BLOCKED").length;
  return (
    <div className="flex flex-wrap items-center gap-6" data-testid="dash-progress">
      <Metric label="진행률" value={p.progressTotal === 0 ? "작업 없음" : `${p.progressPercent}%`} />
      <Metric label="완료/전체" value={`${p.progressCurrent}/${p.progressTotal}`} />
      <Metric label="실행 중 Agent" value={String(p.workingAgentCount)} />
      <Metric label="진행 중 Task" value={String(running)} />
      <Metric label="대기 Task" value={String(waiting)} />
      <Metric label="상태" value={p.status} mono={false} />
    </div>
  );
}

function Metric({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-on-background/50">{label}</div>
      <div className={`${mono ? "tabular" : "display"} text-lg`}>{value}</div>
    </div>
  );
}
