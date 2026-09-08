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

  // Command surface (used by U5; included on the shared client for reuse)
  postCommand: (projectId: string, body: Record<string, unknown>) =>
    request(`/api/projects/${projectId}/commands`, {
      method: "POST",
      body: JSON.stringify({ requestId: newRequestId(), ...body }),
    }),
};
