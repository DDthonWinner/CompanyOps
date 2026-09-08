// Status shown with text + icon + color (FR-TY-5 / Design §12): never color alone.
const EXEC_META: Record<string, { label: string; icon: string; color: string }> = {
  TODO: { label: "TODO", icon: "○", color: "#767586" },
  RUNNING: { label: "RUNNING", icon: "▶", color: "#059669" },
  WAITING: { label: "WAITING", icon: "⏸", color: "#d97706" },
  BLOCKED: { label: "BLOCKED", icon: "■", color: "#ba1a1a" },
  REVIEW: { label: "REVIEW", icon: "◇", color: "#0284c7" },
  COMPLETED: { label: "COMPLETED", icon: "✓", color: "#059669" },
  FAILED: { label: "FAILED", icon: "✕", color: "#ba1a1a" },
  CANCELLED: { label: "CANCELLED", icon: "⊘", color: "#767586" },
  // review statuses
  PENDING: { label: "승인 대기", icon: "⧗", color: "#d97706" },
  APPROVED: { label: "승인 완료", icon: "✓", color: "#059669" },
  REVISION_REQUESTED: { label: "수정 요청", icon: "↻", color: "#d97706" },
  REJECTED: { label: "반려", icon: "✕", color: "#ba1a1a" },
};

export function StatusPill({ status, testId }: { status: string; testId?: string }) {
  const m = EXEC_META[status] ?? { label: status, icon: "•", color: "#767586" };
  return (
    <span
      data-testid={testId}
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ color: m.color, background: `${m.color}1a` }}
    >
      <span aria-hidden>{m.icon}</span>
      {m.label}
    </span>
  );
}
