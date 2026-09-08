import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { useStore } from "../../store/useStore";

export function RecentArtifacts({ compact = false, onExpand }: { compact?: boolean; onExpand?: () => void }) {
  const snapshot = useStore((s) => s.snapshot);
  const git = snapshot?.git ?? [];
  return (
    <GlassPanel level={2} className="h-full p-4">
      <div className="mb-2 flex items-center justify-between gap-2"><h3 className="display text-sm font-semibold">Artifacts · {git.length}</h3>{onExpand && <Button variant="ghost" onClick={onExpand} aria-label="결과물 전체 보기">전체 ↗</Button>}</div>
      {git.length === 0 && <div className="text-xs text-on-background/50">게시된 결과물이 없습니다.</div>}
      <ul className="space-y-1 text-xs">
        {(compact ? git.slice(-3).reverse() : [...git].reverse()).map((g) => (
          <li key={g.taskId} className="flex items-center justify-between gap-2">
            <span className="truncate">{snapshot?.tasks.find((t) => t.id === g.taskId)?.title ?? `Task ${g.taskId.slice(0, 8)}`} · {g.status}</span>
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
