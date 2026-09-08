import { GlassPanel } from "../../components/ui/GlassPanel";
import { useStore } from "../../store/useStore";

export function RecentArtifacts() {
  const snapshot = useStore((s) => s.snapshot);
  const git = snapshot?.git ?? [];
  return (
    <GlassPanel level={2} className="p-4">
      <h3 className="display mb-2 text-sm font-semibold">Recent Commits</h3>
      {git.length === 0 && <div className="text-xs text-on-background/50">게시된 결과물이 없습니다.</div>}
      <ul className="space-y-1 text-xs">
        {git.map((g) => (
          <li key={g.taskId} className="flex items-center justify-between gap-2">
            <span className="truncate">Task {g.taskId.slice(0, 8)} · {g.status}</span>
            {g.commitSha && (
              g.branchUrl ? (
                <a className="tabular text-primary underline" href={g.branchUrl} target="_blank" rel="noreferrer">
                  {g.commitSha.slice(0, 8)}
                </a>
              ) : (
                <span className="tabular text-on-background/50">{g.commitSha.slice(0, 8)}</span>
              )
            )}
          </li>
        ))}
      </ul>
    </GlassPanel>
  );
}
