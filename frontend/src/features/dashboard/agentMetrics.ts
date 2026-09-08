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
  const tasks = snapshot.tasks
    .filter((t) => t.assignedProjectAgentId === agent.id)
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

  return { tasks, completed, total, percent, current, next, tokenTotal: agent.tokenTotal ?? null };
}
