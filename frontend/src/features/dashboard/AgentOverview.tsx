import { GlassPanel } from "../../components/ui/GlassPanel";
import { StatusPill } from "../../components/ui/StatusPill";
import { useStore } from "../../store/useStore";

export function AgentOverview() {
  const snapshot = useStore((s) => s.snapshot);
  const rolesById = useStore((s) => s.rolesById);
  const openAgentSheet = useStore((s) => s.openAgentSheet);
  if (!snapshot) return null;
  const agents = snapshot.agents.filter((a) => a.status !== "REMOVED");

  return (
    <GlassPanel level={2} className="p-4">
      <h3 className="display mb-3 text-sm font-semibold">AI Agents</h3>
      {agents.length === 0 && <div className="text-xs text-on-background/50">배정된 Agent가 없습니다.</div>}
      <div className="grid grid-cols-2 gap-2">
        {agents.map((a) => {
          const current = snapshot.tasks.find((t) => t.id === a.currentTaskId);
          return (
            <button
              key={a.id}
              onClick={() => openAgentSheet(a.id)}
              className="flex flex-col items-start gap-1 rounded-lg border border-outline-variant bg-surface-lowest p-2 text-left hover:bg-surface-low"
            >
              <div className="flex w-full items-center justify-between">
                <span className="text-sm font-medium" style={{ color: a.displayColor }}>
                  {a.displayName}
                </span>
                <StatusPill status={a.status} />
              </div>
              <span className="text-xs text-on-background/50">
                {rolesById[a.roleId]?.code ?? "—"}
              </span>
              {current && <span className="truncate text-xs">▶ {current.title}</span>}
            </button>
          );
        })}
      </div>
    </GlassPanel>
  );
}
