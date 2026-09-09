import { useEffect, type ReactNode } from "react";
import { agentMetrics } from "../../dashboard/agentMetrics";
import { GlassPanel } from "../../../components/ui/GlassPanel";
import { StatusPill } from "../../../components/ui/StatusPill";
import { useStore } from "../../../store/useStore";
import { useAgentMeta } from "../agentMeta";

// Agent popup. Anchored right-of-centre so it doesn't cover the selected agent.
// A second panel below shows the underlying agent-profile / model details.
export function AgentSheet({ open, projectAgentId, onClose }: {
  open: boolean; projectAgentId?: string; onClose: () => void;
}) {
  const snapshot = useStore((s) => s.snapshot);
  const rolesById = useStore((s) => s.rolesById);
  const meta = useAgentMeta();
  const agent = snapshot?.agents.find((a) => a.id === projectAgentId);
  const roleCode = agent ? rolesById[agent.roleId]?.code : undefined;
  const metrics = snapshot && agent ? agentMetrics(snapshot, agent) : null;
  const currentTask = metrics?.current;
  const nextTask = metrics?.next;
  const profile = agent ? meta?.profiles.find((p) => p.id === agent.agentProfileId) : undefined;
  const model = agent ? meta?.models.find((m) => m.id === agent.llmModelId) : undefined;

  const visible = open && !!agent;
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, onClose]);

  if (!visible || !agent) return null;

  const Row = ({ label, value }: { label: string; value: ReactNode }) => (
    <div className="flex items-center justify-between gap-2">
      <span className="text-on-background/60">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );

  return (
    <div className="pointer-events-none fixed left-[calc(50%+7rem)] top-1/2 z-50 flex max-h-[88vh] w-[21rem] -translate-y-1/2 flex-col gap-3">
      {/* Live status */}
      <GlassPanel
        level={4}
        role="dialog"
        aria-modal="false"
        aria-label={agent.displayName}
        data-testid="agent-sheet"
        className="pointer-events-auto overflow-auto p-5 animate-in"
        style={{ borderTop: `3px solid ${agent.displayColor}` }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ background: agent.displayColor }} />
            <h2 className="display text-lg font-semibold">{agent.displayName}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            data-testid="agent-sheet-close"
            className="rounded-full px-2 py-1 text-on-background/70 hover:bg-surface-high"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2 text-sm">
          <Row label="역할" value={`${roleCode ?? agent.roleId}${agent.isPrimaryPm ? " · PM" : ""}`} />
          <Row label="상태" value={<StatusPill status={agent.status} />} />
          <div>
            <div className="text-on-background/60">Current</div>
            <div>{currentTask?.title ?? "—"}</div>
          </div>
          <div>
            <div className="text-on-background/60">Next</div>
            <div>{nextTask?.title ?? "—"}</div>
          </div>
          {agent.activitySummary && <p className="text-on-background/70">{agent.activitySummary}</p>}
        </div>
      </GlassPanel>

      {/* Agent profile / configuration */}
      <GlassPanel level={3} data-testid="agent-profile" className="pointer-events-auto overflow-auto p-5 animate-in">
        <div className="display mb-2 text-xs font-semibold uppercase tracking-wide text-on-background/60">
          Agent Profile
        </div>
        <div className="space-y-2 text-sm">
          <Row label="프로필" value={profile?.name ?? "—"} />
          <Row label="숙련도" value={profile?.skillLevel ?? "—"} />
          <Row label="기본 역할" value={profile?.role?.name ?? profile?.role?.code ?? "—"} />
          <Row label="LLM 모델" value={model ? `${model.displayName} · ${model.grade}` : agent.llmModelId ?? "—"} />
          <div className="flex items-center justify-between gap-2">
            <span className="text-on-background/60">색상</span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: agent.displayColor }} />
              <span className="tabular text-xs">{agent.displayColor}</span>
            </span>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
