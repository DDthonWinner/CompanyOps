import { useEffect } from "react";
import { agentMetrics } from "../../dashboard/agentMetrics";
import { GlassPanel } from "../../../components/ui/GlassPanel";
import { StatusPill } from "../../../components/ui/StatusPill";
import { useStore } from "../../../store/useStore";

// Agent profile popup. Anchored right-of-centre so it doesn't cover the selected
// agent (which the camera focuses to the middle of the screen).
export function AgentSheet({ open, projectAgentId, onClose }: {
  open: boolean; projectAgentId?: string; onClose: () => void;
}) {
  const snapshot = useStore((s) => s.snapshot);
  const rolesById = useStore((s) => s.rolesById);
  const agent = snapshot?.agents.find((a) => a.id === projectAgentId);
  const roleCode = agent ? rolesById[agent.roleId]?.code : undefined;
  const metrics = snapshot && agent ? agentMetrics(snapshot, agent) : null;
  const currentTask = metrics?.current;
  const nextTask = metrics?.next;

  const visible = open && !!agent;
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, onClose]);

  if (!visible || !agent) return null;

  return (
    <GlassPanel
      level={4}
      role="dialog"
      aria-modal="false"
      aria-label={agent.displayName}
      data-testid="agent-sheet"
      className="pointer-events-auto fixed top-1/2 left-[calc(50%+7rem)] z-50 max-h-[76vh] w-[21rem] -translate-y-1/2 overflow-auto p-5 animate-in"
      style={{ borderTop: `3px solid ${agent.displayColor}` }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: agent.displayColor }} />
          <h2 className="display text-lg font-semibold">{agent.displayName}</h2>
        </div>
        <button
          onClick={onClose}
          aria-label="닫기"
          data-testid="agent-sheet-close"
          className="rounded-full px-2 py-1 text-on-background/70 hover:bg-surface-high"
        >
          ✕
        </button>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-on-background/60">역할</span>
          <span>{roleCode ?? agent.roleId}{agent.isPrimaryPm ? " · PM" : ""}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-on-background/60">상태</span>
          <StatusPill status={agent.status} />
        </div>
        <div>
          <div className="text-on-background/60">Current</div>
          <div>{currentTask?.title ?? "—"}</div>
        </div>
        <div>
          <div className="text-on-background/60">Next</div>
          <div>{nextTask?.title ?? "—"}</div>
        </div>
        {agent.activitySummary && <p className="text-on-background/70">{agent.activitySummary}</p>}
      </div>
    </GlassPanel>
  );
}
