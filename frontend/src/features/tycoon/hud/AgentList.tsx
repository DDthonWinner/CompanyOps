import { GlassPanel } from "../../../components/ui/GlassPanel";
import { DESK_ROLES, ROLE_LABEL } from "../../../lib/roles";
import { useStore } from "../../../store/useStore";

const STATUS_COLOR: Record<string, string> = {
  WORKING: "#059669",
  IDLE: "#767586",
  WAITING: "#d97706",
  BLOCKED: "#ba1a1a",
  ASSIGNED: "#4f46e5",
};

// Selectable roster on the left. Selecting an agent opens its sheet and focuses
// the camera on it (same path as clicking the mascot in the 3D scene).
export function AgentList() {
  const snapshot = useStore((s) => s.snapshot);
  const rolesById = useStore((s) => s.rolesById);
  const openSheet = useStore((s) => s.openSheet);
  const openAgentSheet = useStore((s) => s.openAgentSheet);
  const setCamera = useStore((s) => s.setCamera);
  if (!snapshot) return null;

  const codeOf = (roleId: string) => rolesById[roleId]?.code;
  const agents = snapshot.agents.filter((a) => a.status !== "REMOVED");
  const order = [...DESK_ROLES];
  const grouped = order
    .map((code) => ({ code, list: agents.filter((a) => codeOf(a.roleId) === code) }))
    .filter((g) => g.list.length > 0);

  const select = (id: string) => {
    openAgentSheet(id);
    setCamera(id);
  };

  return (
    <GlassPanel
      level={2}
      className="pointer-events-auto absolute left-6 top-[17rem] max-h-[calc(100vh-21rem)] w-64 overflow-auto p-3"
      data-testid="agent-list"
    >
      <div className="display mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-on-background/60">
        <span>Agents</span>
        <span className="tabular text-on-background/40">{agents.length}</span>
      </div>
      <div className="space-y-2">
        {grouped.map(({ code, list }) => (
          <div key={code}>
            <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-on-background/40">
              {ROLE_LABEL[code] ?? code}
            </div>
            <ul className="space-y-0.5">
              {list.map((a) => {
                const sel = openSheet?.kind === "agent" && openSheet.id === a.id;
                return (
                  <li key={a.id}>
                    <button
                      data-testid={`agent-list-item-${a.id}`}
                      onClick={() => select(a.id)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                        sel ? "bg-primary/15 ring-1 ring-primary/40" : "hover:bg-surface-high"
                      }`}
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: a.displayColor }} />
                      <span className="flex-1 truncate">{a.displayName}</span>
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: STATUS_COLOR[a.status] ?? "#767586" }}
                        title={a.status}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}
