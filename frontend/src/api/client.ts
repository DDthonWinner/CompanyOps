// HTTP client for the U1 contract (06 §4). Attaches requestId; surfaces the error envelope.
import type { ProjectListItem, Snapshot, ErrorEnvelope } from "./types";

const BASE = (import.meta.env?.VITE_API_BASE ?? "http://127.0.0.1:8000").replace(/\/$/, "");

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(env: ErrorEnvelope, status: number) {
    super(env.message || env.code);
    this.code = env.code;
    this.status = status;
    this.details = env.details;
  }
}

export function newRequestId(): string {
  // crypto.randomUUID is available in modern browsers; fall back for safety.
  return globalThis.crypto?.randomUUID?.() ?? `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(
      (body as ErrorEnvelope) ?? { code: "HTTP_ERROR", message: res.statusText },
      res.status,
    );
  }
  return body as T;
}

export const api = {
  base: BASE,
  listProjects: () => request<{ items: ProjectListItem[]; total: number } | ProjectListItem[]>("/api/projects"),
  listRoles: () => request<Array<{ id: string; code: string; name: string }>>("/api/roles"),
  getSnapshot: (projectId: string) => request<Snapshot>(`/api/projects/${projectId}/snapshot`),
  eventsUrl: (projectId: string) => `${BASE}/api/projects/${projectId}/events`,

  // ---- reads (metadata) ----
  listAgentProfiles: () =>
    request<Array<{ id: string; name: string; role: { code: string; name: string }; skillLevel: string;
      defaultLlmModel?: { id: string; displayName: string }; defaultColor?: string; defaultIconKey?: string; isActive: boolean }>>(
      "/api/agent-profiles",
    ),
  listLlmModels: () =>
    request<Array<{ id: string; displayName: string; grade: string; isActive: boolean }>>("/api/llm-models"),

  // ---- PM writes (01 §5) ----
  createProject: (body: Record<string, unknown>) =>
    request("/api/projects", { method: "POST", body: JSON.stringify(body) }),
  recommendAgents: (pid: string, body: Record<string, unknown>) =>
    request(`/api/projects/${pid}/agent-recommendations`, { method: "POST", body: JSON.stringify(body) }),
  assignAgents: (pid: string, body: Record<string, unknown>) =>
    request(`/api/projects/${pid}/agents`, { method: "POST", body: JSON.stringify(body) }),
  createMilestone: (pid: string, body: Record<string, unknown>) =>
    request(`/api/projects/${pid}/sprint-milestones`, { method: "POST", body: JSON.stringify(body) }),
  createTask: (pid: string, body: Record<string, unknown>) =>
    request(`/api/projects/${pid}/tasks`, { method: "POST", body: JSON.stringify(body) }),

  // ---- orchestration (06 §4.2) ----
  postCommand: (pid: string, body: Record<string, unknown>) =>
    request(`/api/projects/${pid}/commands`, {
      method: "POST",
      body: JSON.stringify({ requestId: newRequestId(), ...body }),
    }),
  planFeedback: (pid: string, planId: string, expectedVersion: number, feedback: string) =>
    request(`/api/projects/${pid}/plans/${planId}/feedback`, {
      method: "POST",
      body: JSON.stringify({ requestId: newRequestId(), expectedVersion, feedback }),
    }),
  planReviewComplete: (pid: string, planId: string, expectedVersion: number) =>
    request(`/api/projects/${pid}/plans/${planId}/review-complete`, {
      method: "POST",
      body: JSON.stringify({ requestId: newRequestId(), expectedVersion }),
    }),
  planApprove: (pid: string, planId: string, expectedVersion: number) =>
    request(`/api/projects/${pid}/plans/${planId}/approve`, {
      method: "POST",
      body: JSON.stringify({ requestId: newRequestId(), expectedVersion }),
    }),
  resolveDecision: (pid: string, decisionId: string, expectedRevision: number | undefined, answer: string) =>
    request(`/api/projects/${pid}/decisions/${decisionId}/resolve`, {
      method: "POST",
      body: JSON.stringify({ requestId: newRequestId(), expectedRevision, answer }),
    }),
  getMilestoneResult: (pid: string, milestoneId: string) =>
    request<{ id: string; version: number; reviewStatus: string; additionalValidation: string; snapshot?: unknown }>(
      `/api/projects/${pid}/sprint-milestones/${milestoneId}/result`,
    ),
  reviewMilestoneResult: (pid: string, milestoneId: string, body: Record<string, unknown>) =>
    request(`/api/projects/${pid}/sprint-milestones/${milestoneId}/result/reviews`, {
      method: "POST",
      body: JSON.stringify({ requestId: newRequestId(), ...body }),
    }),
  publishTask: (pid: string, taskId: string, body: Record<string, unknown>) =>
    request(`/api/projects/${pid}/tasks/${taskId}/publish`, {
      method: "POST",
      body: JSON.stringify({ requestId: newRequestId(), ...body }),
    }),
  getQaRun: (pid: string, runId: string) =>
    request(`/api/projects/${pid}/qa-runs/${runId}`),
  getTaskArtifacts: (pid: string, taskId: string) =>
    request<Array<{ id: string; version: number; generationStatus: string; filePaths: string[] }>>(
      `/api/projects/${pid}/tasks/${taskId}/artifacts`,
    ),
  getActivity: (pid: string, cursor = 0, limit = 50) =>
    request<Array<{ id: string; revision: number; type: string; entityId: string | null; occurredAt: string }>>(
      `/api/projects/${pid}/activity?cursor=${cursor}&limit=${limit}`,
    ),

  // ---- UF (02 §9.2, global paths) ----
  getUtilization: (pid: string) =>
    request<{ items?: unknown[] } | unknown[]>(`/api/utilization?projectId=${pid}`),
  getReportMetrics: (reportId: string) => request(`/api/utilization/${reportId}/metrics`),
  getFeedbacks: (reportId: string) => request(`/api/utilization/${reportId}/feedbacks`),
  createFeedback: (reportId: string, body: Record<string, unknown>) =>
    request(`/api/utilization/${reportId}/feedbacks`, { method: "POST", body: JSON.stringify(body) }),
  updateFeedback: (feedbackId: string, body: Record<string, unknown>) =>
    request(`/api/feedbacks/${feedbackId}`, { method: "PUT", body: JSON.stringify(body) }),

  // ---- Dev Admin: generic table CRUD (local/contest tool, no auth) ----
  adminListTables: () => request<{ tables: AdminTable[] }>("/api/admin/tables"),
  adminGetRows: (table: string, limit = 50, offset = 0, orderBy?: string) =>
    request<AdminRowsResponse>(
      `/api/admin/tables/${table}?limit=${limit}&offset=${offset}${orderBy ? `&orderBy=${orderBy}` : ""}`,
    ),
  adminCreateRow: (table: string, row: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/api/admin/tables/${table}`, {
      method: "POST",
      body: JSON.stringify(row),
    }),
  adminUpdateRow: (table: string, pk: string, patch: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/api/admin/tables/${table}/${encodeURIComponent(pk)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  adminDeleteRow: (table: string, pk: string) =>
    request<{ deleted: boolean }>(`/api/admin/tables/${table}/${encodeURIComponent(pk)}`, {
      method: "DELETE",
    }),
};

export interface AdminColumn {
  name: string;
  type: string;
  primaryKey: boolean;
  nullable: boolean;
  hasDefault: boolean;
  foreignKey: string | null;
}

export interface AdminTable {
  name: string;
  rowCount: number;
  primaryKey: string[];
  columns: AdminColumn[];
}

export interface AdminRowsResponse {
  table: string;
  columns: AdminColumn[];
  primaryKey: string[];
  rows: Record<string, unknown>[];
  total: number;
  limit: number;
  offset: number;
}
