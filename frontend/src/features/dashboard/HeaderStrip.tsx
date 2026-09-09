// Hero status card (04 §3, §23): phase, weight-free progress, live/wait counts, attention count.
import { GlassPanel } from "../../components/ui/GlassPanel";
import { Icon } from "../../components/ui/Icon";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { ROLE_LABEL } from "../../lib/roles";
import { useStore } from "../../store/useStore";
import { deriveAttention } from "./attention";

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Draft", color: "#767586" },
  AGENT_MATCHING: { label: "팀 매칭", color: "#d97706" },
  READY: { label: "Ready", color: "#0284c7" },
  ACTIVE: { label: "Developing", color: "#059669" },
  COMPLETED: { label: "Completed", color: "#4648d4" },
  ARCHIVED: { label: "Archived", color: "#767586" },
};

export function HeaderStrip({ onFeedback }: { onFeedback?: () => void }) {
  const selectPanel = useStore((s) => s.setDashboardPanel);
  const snapshot = useStore((s) => s.snapshot);
  const rolesById = useStore((s) => s.rolesById);
  if (!snapshot) return null;
  const p = snapshot.project;
  const agents = snapshot.agents.filter((agent) => agent.status !== "REMOVED");
  const workingAgentCount = agents.filter((agent) => agent.status === "WORKING").length;
  const running = snapshot.tasks.filter((t) => t.status === "RUNNING");
  const waiting = snapshot.tasks.filter((t) => t.status === "WAITING" || t.status === "BLOCKED").length;
  const attention = deriveAttention(snapshot).length;
  const badge = STATUS_BADGE[p.status] ?? { label: p.status, color: "#767586" };

  // Derive current phase from the roles of running tasks (作業 수준 표시).
  const phases = [...new Set(running.map((t) => (t.roleId ? rolesById[t.roleId]?.code : null)).filter(Boolean))];
  const phaseLabel = phases.length
    ? phases.map((c) => ROLE_LABEL[c as string] ?? c).join(" · ")
    : "대기 중";

  return (
    <GlassPanel level={4} className="w-full p-4" data-testid="dash-progress">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
        {/* Left: status + title + phase */}
        <div className="min-w-0 lg:w-64">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
            style={{ color: badge.color, background: `${badge.color}1a` }}
          >
            <span className="pulse-orb h-1.5 w-1.5 rounded-full" style={{ background: badge.color }} />
            {badge.label}
          </span>
          <h2 className="display mt-1.5 truncate text-xl font-bold">{p.name}</h2>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-on-background/55">
            <Icon name="bolt" size={13} /> {p.status === "COMPLETED" ? "프로젝트 완료 · AI 활용 분석 준비" : `현재 단계: ${phaseLabel}`}
          </div>
          {p.status === "COMPLETED" && onFeedback && <button type="button" onClick={onFeedback} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:brightness-110 focus-visible:outline-primary" data-testid="header-feedback-generate"><Icon name="insights" size={16} />AI Feedback 생성<Icon name="arrow_downward" size={14} /></button>}
        </div>

        {/* Middle: progress */}
        <div className="flex-1">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-on-background/55">전체 진행률</span>
            <span className="tabular text-2xl font-bold text-primary">
              {p.progressTotal === 0 ? "—" : `${p.progressPercent}%`}
            </span>
          </div>
          <ProgressBar value={p.progressTotal === 0 ? 0 : p.progressPercent} height={10} className="mt-1" />
          <div className="mt-1 text-[11px] text-on-background/50">
            {p.progressTotal === 0 ? "작업 없음" : `${p.progressTotal}개 작업 중 ${p.progressCurrent}개 완료`}
          </div>
        </div>

        {/* Right: KPI tiles */}
        <div className="grid grid-cols-3 gap-3 lg:w-72">
          <Kpi label="활성 에이전트" value={`${workingAgentCount}`} sub={`/ ${agents.length}`} icon="smart_toy" onClick={() => document.getElementById("dashboard-agents")?.scrollIntoView({ block: "center", behavior: "smooth" })} />
          <Kpi label="진행 중 작업" value={String(running.length)} sub={waiting ? `${waiting} 대기` : undefined} icon="pending_actions" onClick={() => selectPanel("tasks")} />
          <Kpi label="확인 필요" value={String(attention)} icon="notifications_active" alert={attention > 0} onClick={() => document.getElementById("dashboard-attention")?.scrollIntoView({ block: "center", behavior: "smooth" })} />
        </div>
      </div>
    </GlassPanel>
  );
}

function Kpi({
  label,
  value,
  sub,
  icon,
  alert = false,
  onClick,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  alert?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick}
      className="text-left transition hover:bg-surface-low focus-visible:outline-primary rounded-xl border border-outline-variant bg-surface-lowest px-2.5 py-2"
      style={alert ? { borderColor: "#d97706", background: "#d977061a" } : undefined}
    >
      <div className="flex items-center gap-1 text-[10px] text-on-background/50">
        <Icon name={icon} size={12} style={alert ? { color: "#d97706" } : undefined} />
        {label}
      </div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className={`tabular text-xl font-bold ${alert ? "text-[#b45309]" : ""}`}>{value}</span>
        {sub && <span className="tabular text-[11px] text-on-background/45">{sub}</span>}
      </div>
    </button>
  );
}
