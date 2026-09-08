import type { Agent, Snapshot } from "../../api/types";
import { agentMetrics } from "./agentMetrics";

export const CITY_ROLES = ["PM", "FRONTEND", "BACKEND", "QA"] as const;
export type CityRole = typeof CITY_ROLES[number];
export const CITY_POSITION: Record<CityRole, [number, number, number]> = {
  PM: [-3.5, 0, -2.5], FRONTEND: [-3.5, 0, 3], BACKEND: [3.5, 0, -2.5], QA: [3.5, 0, 3],
};
export function cityModel(snapshot: Snapshot, roles: Record<string, { code: string }>) {
  return CITY_ROLES.map((role) => {
    const agents = snapshot.agents.filter((a) => a.status !== "REMOVED" && roles[a.roleId]?.code === role);
    const agentIds = new Set(agents.map((a) => a.id));
    const tasks = snapshot.tasks.filter((t) => t.status !== "CANCELLED" &&
      (t.roleId ? roles[t.roleId]?.code === role : !!t.assignedProjectAgentId && agentIds.has(t.assignedProjectAgentId)));
    const completed = tasks.filter((t) => t.status === "COMPLETED").length;
    return {
      role, agents: agents.map((agent: Agent) => ({ agent, metrics: agentMetrics(snapshot, agent) })),
      total: tasks.length, completed, percent: tasks.length ? Math.round(100 * completed / tasks.length) : 0,
      // Never animate REVIEW / WAITING merely because the agent still reports WORKING.
      running: tasks.some((t) => t.status === "RUNNING"),
      blocked: tasks.some((t) => t.status === "BLOCKED" || t.status === "FAILED"),
      waiting: tasks.some((t) => t.status === "WAITING" || t.status === "REVIEW"),
    };
  });
}
export type CityNode = ReturnType<typeof cityModel>[number];
