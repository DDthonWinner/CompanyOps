// Role visuals (Design §5.2). Desks use role color; agents may override with their own.
export const ROLE_COLOR: Record<string, string> = {
  FRONTEND: "#4f46e5",
  BACKEND: "#059669",
  DATABASE: "#d97706",
  QA: "#0284c7",
  DEVOPS: "#0284c7",
  PM: "#e11d48",
  DESIGN: "#4f46e5",
};

export const INBOX_COLOR = "#2563eb";
export const OUTBOX_COLOR = "#059669";

// Desks rendered in the office (05 §4.1). QA is an auxiliary desk.
export const DESK_ROLES = ["FRONTEND", "BACKEND", "DATABASE", "PM", "QA"] as const;
export type DeskRole = (typeof DESK_ROLES)[number];

export const ROLE_LABEL: Record<string, string> = {
  FRONTEND: "Frontend",
  BACKEND: "Backend",
  DATABASE: "Database",
  QA: "QA",
  DEVOPS: "DevOps",
  PM: "PM",
  DESIGN: "Design",
};

export function roleColor(code: string | undefined): string {
  return (code && ROLE_COLOR[code]) || "#4f46e5";
}
