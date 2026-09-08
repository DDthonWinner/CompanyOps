// Center "Agent workspace" — the PM → Frontend/Backend → QA development flow (04 §6, §23).
// Node cards sit on a faint drafting grid with animated dashed connectors + a QA feedback loop.
import { GlassPanel } from "../../components/ui/GlassPanel";
import { Icon } from "../../components/ui/Icon";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { fmtTokens } from "../../lib/format";
import { ROLE_LABEL, roleColor, roleIcon } from "../../lib/roles";
import type { Agent, Snapshot } from "../../api/types";
import { useStore } from "../../store/useStore";
import { agentMetrics } from "./agentMetrics";

const STATUS_DOT: Record<string, string> = {
  WORKING: "#059669",
  WAITING: "#d97706",
  BLOCKED: "#ba1a1a",
  IDLE: "#767586",
  ASSIGNED: "#767586",
};

const STATUS_LABEL: Record<string, string> = {
  WORKING: "Working",
  WAITING: "Waiting for you",
  BLOCKED: "Blocked",
  IDLE: "Idle",
  ASSIGNED: "Ready",
};

// Absolute anchor per node (percent of the stage) — connectors reference the same points.
const POS: Record<string, React.CSSProperties> = {
  PM: { left: "50%", top: "2%", transform: "translateX(-50%)" },
  FRONTEND: { left: "1%", top: "40%" },
  BACKEND: { right: "1%", top: "40%" },
  QA: { left: "50%", bottom: "2%", transform: "translateX(-50%)" },
};

function FlowNode({ role, agent, snapshot }: { role: string; agent: Agent | null; snapshot: Snapshot }) {
  const openAgentSheet = useStore((s) => s.openAgentSheet);
  const color = roleColor(role);
  const m = agent ? agentMetrics(snapshot, agent) : null;
  const status = agent?.status ?? "ASSIGNED";
  const dot = STATUS_DOT[status] ?? "#767586";

  return (
    <button
      type="button"
      disabled={!agent}
      onClick={() => agent && openAgentSheet(agent.id)}
      className="card-lift w-[190px] rounded-hud border border-outline-variant bg-white p-3 text-left shadow-[0_8px_24px_rgba(11,28,48,0.10)] disabled:opacity-60"
    >
      <div className="flex items-center gap-2">
        <span
          className="grid h-8 w-8 place-items-center rounded-lg"
          style={{ background: `${color}1a`, color }}
        >
          <Icon name={roleIcon(role)} size={18} fill />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold" style={{ color }}>
            {ROLE_LABEL[role] ?? role}
          </div>
          <div className="truncate text-[11px] text-on-background/55">
            {agent?.displayName ?? "미배정"}
          </div>
        </div>
        <span className="pulse-orb h-2.5 w-2.5 rounded-full" style={{ background: dot }} />
      </div>

      <div className="mt-2 truncate text-[11px] text-on-background/70">
        {m?.current?.title ?? agent?.activitySummary ?? "대기 중인 작업 없음"}
      </div>

      <div className="mt-2">
        <ProgressBar value={m?.percent ?? 0} color={color} height={7} />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1" style={{ color: dot }}>
          <span className="msym" style={{ fontSize: 13 }} aria-hidden>
            fiber_manual_record
          </span>
          {STATUS_LABEL[status] ?? status}
        </span>
        <span className="tabular text-on-background/55">
          {m ? fmtTokens(m.tokenTotal) : "미수집"}
        </span>
      </div>
    </button>
  );
}

export function DevelopmentFlow() {
  const snapshot = useStore((s) => s.snapshot);
  const rolesById = useStore((s) => s.rolesById);
  const connection = useStore((s) => s.connection);
  if (!snapshot) return null;

  const byRole: Record<string, Agent | null> = { PM: null, FRONTEND: null, BACKEND: null, QA: null };
  for (const a of snapshot.agents) {
    if (a.status === "REMOVED") continue;
    const code = rolesById[a.roleId]?.code;
    if (code && code in byRole && !byRole[code]) byRole[code] = a;
  }

  const legend = [
    { code: "PM", label: "Project Management" },
    { code: "FRONTEND", label: "Frontend" },
    { code: "BACKEND", label: "Backend" },
    { code: "QA", label: "QA" },
  ];

  return (
    <GlassPanel level={3} className="p-4" data-testid="development-flow">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="display flex items-center gap-1.5 text-sm font-semibold">
            <Icon name="account_tree" size={18} className="text-primary" />
            Agent workspace
          </h3>
          <p className="text-[11px] text-on-background/55">에이전트를 선택해 현재 작업을 확인하세요</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-secondary/30 bg-secondary/10 px-2 py-0.5 text-[11px] font-medium text-secondary">
          {connection === "CONNECTED" ? "실시간 동기화" : `${connection} · 마지막 수신 상태`}
        </span>
      </div>

      {/* Desktop: absolute node graph with connectors */}
      <div className="relative mx-auto hidden h-[360px] w-full max-w-[640px] grid-faint rounded-xl md:block">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id="flow-line" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#e11d48" />
              <stop offset="50%" stopColor="#4f46e5" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>
          </defs>
          {/* PM → FE, PM → BE, FE → QA, BE → QA */}
          <path d="M50,14 L14,42" className="flow-dash" stroke="url(#flow-line)" strokeWidth="0.5" fill="none" />
          <path d="M50,14 L86,42" className="flow-dash" stroke="url(#flow-line)" strokeWidth="0.5" fill="none" />
          <path d="M16,62 L46,86" className="flow-dash" stroke="url(#flow-line)" strokeWidth="0.5" fill="none" />
          <path d="M84,62 L54,86" className="flow-dash" stroke="url(#flow-line)" strokeWidth="0.5" fill="none" />
          {/* QA feedback loop → Backend */}
          <path
            d="M66,82 C92,78 94,66 88,58"
            stroke="#0284c7"
            strokeWidth="0.4"
            strokeDasharray="2 2"
            fill="none"
            opacity="0.7"
          />
        </svg>
        <span className="absolute right-[6%] top-[68%] rounded-full bg-qa/10 px-2 py-0.5 text-[10px] font-medium text-qa">
          ↻ QA FEEDBACK
        </span>

        {(["PM", "FRONTEND", "BACKEND", "QA"] as const).map((role) => (
          <div key={role} className="absolute" style={POS[role]}>
            <FlowNode role={role} agent={byRole[role]} snapshot={snapshot} />
          </div>
        ))}
      </div>

      {/* Mobile / narrow: stacked cards, no connectors */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:hidden">
        {(["PM", "FRONTEND", "BACKEND", "QA"] as const).map((role) => (
          <div key={role} className="flex justify-center">
            <FlowNode role={role} agent={byRole[role]} snapshot={snapshot} />
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-4 border-t border-outline-variant pt-2">
        {legend.map((l) => (
          <span key={l.code} className="flex items-center gap-1.5 text-[11px] text-on-background/60">
            <span className="h-2 w-2 rounded-full" style={{ background: roleColor(l.code) }} />
            {l.label}
          </span>
        ))}
      </div>
    </GlassPanel>
  );
}
