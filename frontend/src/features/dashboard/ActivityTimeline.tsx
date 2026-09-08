import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { useStore } from "../../store/useStore";

interface Evt { id: string; revision: number; type: string; entityId: string | null; occurredAt: string }

export function ActivityTimeline() {
  const pid = useStore((s) => s.activeProjectId);
  const revision = useStore((s) => s.snapshot?.revision ?? 0);
  const [events, setEvents] = useState<Evt[]>([]);

  useEffect(() => {
    if (!pid) return;
    api.getActivity(pid, 0, 50).then((e) => setEvents(e as Evt[])).catch(() => setEvents([]));
  }, [pid, revision]);

  return (
    <GlassPanel level={2} className="p-4">
      <h3 className="display mb-2 text-sm font-semibold">Activity</h3>
      {events.length === 0 && <div className="text-xs text-on-background/50">활동 기록이 없습니다.</div>}
      <ul className="max-h-48 space-y-1 overflow-auto text-xs">
        {[...events].reverse().map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-2">
            <span className="truncate">{e.type}</span>
            <span className="tabular text-on-background/40">
              #{e.revision} · {new Date(e.occurredAt).toLocaleTimeString()}
            </span>
          </li>
        ))}
      </ul>
    </GlassPanel>
  );
}
