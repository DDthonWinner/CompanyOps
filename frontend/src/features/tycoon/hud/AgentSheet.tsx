import { agentMetrics } from "../../dashboard/agentMetrics";
import { Sheet } from "../../../components/ui/Sheet";
import { StatusPill } from "../../../components/ui/StatusPill";
import { useStore } from "../../../store/useStore";

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

  return (
    <Sheet open={open && !!agent} onClose={onClose} title={agent?.displayName ?? "Agent"}
           accentColor={agent?.displayColor} testId="agent-sheet">
      {agent && (
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
          {agent.activitySummary && (
            <p className="text-on-background/70">{agent.activitySummary}</p>
          )}
        </div>
      )}
    </Sheet>
  );
}
