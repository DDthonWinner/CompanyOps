import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { useStore } from "../../store/useStore";

interface Evt { id: string; revision: number; type: string; entityId: string | null; occurredAt: string }

export function ActivityTimeline({ compact = false, onExpand }: { compact?: boolean; onExpand?: () => void }) {
  const pid = useStore((s) => s.activeProjectId);
  const revision = useStore((s) => s.snapshot?.revision ?? 0);
  const [events, setEvents] = useState<Evt[]>([]);
  const [loadState, setLoadState] = useState("loading");

  useEffect(() => {
    if (!pid) return;
    let cancelled = false;
    setLoadState("loading");
    api.getActivity(pid, 0, 50).then((e) => { if (!cancelled) { setEvents(e); setLoadState("ready"); } }).catch(() => { if (!cancelled) setLoadState("error"); });
    return () => { cancelled = true; };
  }, [pid, revision]);

  return (
    <GlassPanel level={2} className="h-full p-4">
      <div className="mb-2 flex items-center justify-between gap-2"><h3 className="display text-sm font-semibold">Recent activity</h3>{onExpand && <Button variant="ghost" onClick={onExpand} aria-label="활동 전체 보기">전체 ↗</Button>}</div>
      {loadState !== "ready" && <p role="status" className="text-xs text-on-background/50">{loadState === "error" ? "활동 기록을 불러오지 못했습니다." : "활동을 불러오는 중…"}</p>}
      {loadState === "ready" && events.length === 0 && <div className="text-xs text-on-background/50">활동 기록이 없습니다.</div>}
      <ul className="max-h-48 space-y-1 overflow-auto text-xs">
        {[...events].reverse().slice(0, compact ? 3 : 50).map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-2">
            <details className="min-w-0 flex-1"><summary className="cursor-pointer truncate">{e.type}</summary><p className="mt-1 break-all text-on-background/50">대상: {e.entityId ?? "프로젝트"}</p></details>
            <span className="tabular text-on-background/40">
              #{e.revision} · {new Date(e.occurredAt).toLocaleTimeString()}
            </span>
          </li>
        ))}
      </ul>
    </GlassPanel>
  );
}
