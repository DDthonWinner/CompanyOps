import { Sheet } from "../../../components/ui/Sheet";
import { StatusPill } from "../../../components/ui/StatusPill";
import { ROLE_LABEL, roleColor } from "../../../lib/roles";
import { useStore } from "../../../store/useStore";

export function DeskSheet({ open, roleCode, onClose }: {
  open: boolean; roleCode?: string; onClose: () => void;
}) {
  const snapshot = useStore((s) => s.snapshot);
  const rolesById = useStore((s) => s.rolesById);
  const codeOf = (id: string | null | undefined) => (id ? rolesById[id]?.code : undefined);

  const tasks = snapshot?.tasks.filter((t) => codeOf(t.roleId) === roleCode) ?? [];
  const agents = snapshot?.agents.filter((a) => codeOf(a.roleId) === roleCode && a.status !== "REMOVED") ?? [];
  const inbox = tasks.filter((t) => t.status === "TODO" || t.status === "WAITING");
  const review = tasks.filter((t) => t.status === "REVIEW");
  const outbox = tasks.filter((t) => t.status === "COMPLETED");

  return (
    <Sheet open={open && !!roleCode} onClose={onClose}
           title={`${ROLE_LABEL[roleCode ?? ""] ?? roleCode} Desk`}
           accentColor={roleColor(roleCode)} testId="desk-sheet">
      <div className="space-y-3 text-sm">
        <div className="text-on-background/60">배정 Agent: {agents.length}</div>
        <Section title="Inbox (TODO/WAITING)" tasks={inbox} />
        <Section title="REVIEW" tasks={review} />
        <Section title="Outbox (COMPLETED)" tasks={outbox} />
      </div>
    </Sheet>
  );
}

function Section({ title, tasks }: { title: string; tasks: Array<{ id: string; title: string; status: string }> }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-on-background/60">{title}</div>
      {tasks.length === 0 ? (
        <div className="text-xs text-on-background/40">작업 없음</div>
      ) : (
        <ul className="space-y-1">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2">
              <span className="truncate">{t.title}</span>
              <StatusPill status={t.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
