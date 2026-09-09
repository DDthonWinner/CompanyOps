import type { Agent, Snapshot } from "../../api/types";
import { DESK_ROLES, type DeskRole } from "../../lib/roles";
import { agentMetrics } from "./agentMetrics";

export const FLOW_ROLES: DeskRole[] = ["PM", ...DESK_ROLES.filter((role) => role !== "PM")];
export type FlowRole = DeskRole;
export function flowModel(snapshot: Snapshot, roles: Record<string, { code: string }>) {
  return FLOW_ROLES.map((role) => {
    const agents = snapshot.agents.filter((a) => a.status !== "REMOVED" && roles[a.roleId]?.code === role);
    const agentIds = new Set(agents.map((a) => a.id));
    const tasks = snapshot.tasks.filter((t) => t.status !== "CANCELLED" &&
      (t.roleId ? roles[t.roleId]?.code === role : !!t.assignedProjectAgentId && agentIds.has(t.assignedProjectAgentId)));
    const completed = tasks.filter((t) => t.status === "COMPLETED").length;
    return {
      role, agents: agents.map((agent: Agent) => ({ agent, metrics: agentMetrics(snapshot, agent) })),
      total: tasks.length, completed, percent: tasks.length ? Math.round(100 * completed / tasks.length) : 0,
      // Derive role execution state from tasks, even if an agent still reports WORKING.
      running: tasks.some((t) => t.status === "RUNNING"),
      blocked: tasks.some((t) => t.status === "BLOCKED" || t.status === "FAILED"),
      waiting: tasks.some((t) => t.status === "WAITING" || t.status === "REVIEW"),
    };
  });
}
export type FlowNodeData = ReturnType<typeof flowModel>[number];
