// Per-agent derivations for the dashboard. The backend leaves agent.currentTaskId /
// nextTaskId / activitySummary null today, so we derive them from task state (same
// round(100·completed/total) rule as the server) and fall back to server values if set.
import type { Agent, Snapshot, Task } from "../../api/types";

export interface AgentMetrics {
  tasks: Task[];
  completed: number;
  total: number; // CANCELLED excluded
  percent: number;
  current: Task | null;
  next: Task | null;
  tokenTotal: number | null;
}

const ACTIVE_ORDER: Record<string, number> = { RUNNING: 0, REVIEW: 1, WAITING: 2, BLOCKED: 3 };

export function agentMetrics(snapshot: Snapshot, agent: Agent): AgentMetrics {
  // Tasks are assigned by role (assignedProjectAgentId is usually null); match the
  // agent's own tasks first, else fall back to same-role unassigned tasks.
  const tasks = snapshot.tasks
    .filter(
      (t) =>
        t.assignedProjectAgentId === agent.id ||
        (t.assignedProjectAgentId == null && t.roleId != null && t.roleId === agent.roleId),
    )
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const eligible = tasks.filter((t) => t.status !== "CANCELLED");
  const completed = eligible.filter((t) => t.status === "COMPLETED").length;
  const total = eligible.length;
  const percent = total > 0 ? Math.round((100 * completed) / total) : 0;

  // Current: server value wins, else the most "active" assigned task.
  let current: Task | null = agent.currentTaskId
    ? tasks.find((t) => t.id === agent.currentTaskId) ?? null
    : null;
  if (!current) {
    const active = tasks
      .filter((t) => t.status in ACTIVE_ORDER)
      .sort((a, b) => (ACTIVE_ORDER[a.status] ?? 9) - (ACTIVE_ORDER[b.status] ?? 9));
    current = active[0] ?? null;
  }

  // Next: server value wins, else next not-started task after the current one.
  let next: Task | null = agent.nextTaskId
    ? tasks.find((t) => t.id === agent.nextTaskId) ?? null
    : null;
  if (!next) {
    next = tasks.find((t) => t.id !== current?.id && (t.status === "TODO" || t.status === "WAITING")) ?? null;
  }

  // Per-agent tokens: server value if present, else sum of matched tasks' tokens.
  let tokenTotal = agent.tokenTotal ?? null;
  if (tokenTotal == null) {
    const summed = tasks.reduce((acc, t) => (t.tokenTotal != null ? acc + t.tokenTotal : acc), 0);
    const anyToken = tasks.some((t) => t.tokenTotal != null);
    tokenTotal = anyToken ? summed : null;
  }

  return { tasks, completed, total, percent, current, next, tokenTotal };
}
