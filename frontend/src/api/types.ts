// Client types mirroring the U1 snapshot (06 §4.2). See functional-design/domain-entities.md.

export type ExecStatus =
  | "TODO" | "RUNNING" | "WAITING" | "BLOCKED" | "REVIEW" | "COMPLETED" | "FAILED" | "CANCELLED";

export interface ProjectSummary {
  id: string;
  name: string;
  status: string;
  budgetLevel: "HIGH" | "MEDIUM" | "LOW";
  budgetAmount: number;
  projectSize: string;
  maxAgentCount: number;
  assignedAgentCount: number;
  workingAgentCount: number;
  hasPrimaryPm: boolean;
  progressPercent: number;
  progressCurrent: number;
  progressTotal: number;
  emptyLabel: string | null;
  activePlanId: string | null;
  completedAt: string | null;
}

export interface Agent {
  id: string;
  roleId: string;
  displayName: string;
  displayColor: string;
  iconKey: string;
  status: string;
  isPrimaryPm: boolean;
  currentTaskId: string | null;
  nextTaskId: string | null;
  activitySummary: string | null;
  llmModelId: string;
  tokenTotal?: number | null;
}

export interface Task {
  id: string;
  sprintMilestoneId: string | null;
  assignedProjectAgentId: string | null;
  roleId: string | null;
  title: string;
  description?: string | null;
  status: ExecStatus;
  executionMode: string | null;
  priority: string;
  sortOrder: number;
  dependencyTaskIds: string[];
  waitReasons: string[];
  tokenTotal?: number | null;
}

export interface TokenUsageSummary {
  collected: boolean;
  demo: boolean;
  totalInput: number;
  totalOutput: number;
  total: number;
  byRole: Record<string, number>;
  byAgent: Record<string, number>;
}

export interface Milestone {
  id: string;
  title: string;
  roleId: string | null;
  displayColor: string | null;
  sortOrder: number;
  status: string;
  progressCurrent: number;
  progressTotal: number;
  progressPercent: number;
  emptyLabel: string | null;
  resultVersion: number | null;
  reviewStatus: string | null;
  additionalValidation: string | null;
}

export interface Snapshot {
  revision: number;
  project: ProjectSummary;
  agents: Agent[];
  tasks: Task[];
  milestones: Milestone[];
  plans: Array<{ id: string; version: number; status: string; request?: string; steps?: unknown[] }>;
  pendingDecisions: Array<{ id: string; reason?: string; options?: unknown[]; scopeTaskIds?: string[] }>;
  qaRuns: Array<{ id: string; taskId: string; runStatus: string; technicalGate: string; results?: unknown; demo?: boolean }>;
  git: Array<{ taskId: string; status: string; commitSha?: string | null; branchUrl?: string | null }>;
  tokenUsage?: TokenUsageSummary;
}

export interface ProjectListItem {
  id: string;
  name: string;
  status: string;
  budgetLevel: string;
  budgetAmount: number;
  projectSize?: string;
  assignedAgentCount: number;
  maxAgentCount: number;
  hasPrimaryPm: boolean;
}

export type TycoonSelectionType = "agent" | "desk" | "monitor" | "inbox" | "outbox";
export interface TycoonSelection {
  projectId: string;
  type: TycoonSelectionType;
  projectAgentId?: string;
  roleCode?: string;
}

export interface ErrorEnvelope {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string | null;
}
