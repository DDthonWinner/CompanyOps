// Role relationships share the tycoon desk catalog; execution order belongs to Task dependencies.
import "./developmentFlow.css";
import { useId } from "react";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { Icon } from "../../components/ui/Icon";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { fmtTokens } from "../../lib/format";
import { ROLE_LABEL, roleColor, roleIcon } from "../../lib/roles";
import { useStore } from "../../store/useStore";
import { flowModel, type FlowNodeData, type FlowRole } from "./flowModel";

// Directed lanes distinguish dispatch, validation handoff, and PM feedback.
const EXECUTION_ROLES = ["FRONTEND", "BACKEND", "DATABASE"] as const;
const EXECUTION_X = { FRONTEND: 240, BACKEND: 500, DATABASE: 760 };
const FLOW_EDGES = [
  ...EXECUTION_ROLES.map((role) => ({ from: "PM", to: role, kind: "dispatch", path: `M500 178 V195 Q500 207 ${EXECUTION_X[role]} 207 V238` })),
  ...EXECUTION_ROLES.map((role) => ({ from: role, to: "QA", kind: "handoff", path: `M${EXECUTION_X[role]} 386 V408 Q${EXECUTION_X[role]} 423 500 423 V446` })),
  { from: "PM", to: "QA", kind: "control", path: "M620 102 H900 Q944 102 944 138 V483 Q944 520 900 520 H624" },
  { from: "QA", to: "PM", kind: "feedback", path: "M380 520 H100 Q56 520 56 482 V140 Q56 102 100 102 H376" },
];
const EDGE_COLOR: Record<string, string> = { dispatch: "#6366d9", handoff: "#0284c7", control: "#e11d48", feedback: "#d97706" };

function FlowNode({ node }: { node: FlowNodeData }) {
  const openAgent = useStore((s) => s.openAgentSheet);
  const openDesk = useStore((s) => s.openDeskSheet);
  const assigned = node.agents.length > 0;
  const color = assigned ? roleColor(node.role) : "#94a3b8";
  const status = node.blocked ? "차단/실패" : node.running ? "실행 중" : node.waiting ? "대기/검토" : "대기";
  const single = node.agents.length === 1 ? node.agents[0] : null;
  const working = node.agents.filter(({ agent }) => agent.status === "WORKING").length;
  return (
    <button type="button" disabled={!assigned} aria-label={`${ROLE_LABEL[node.role]} ${assigned ? "상세 보기" : "미배정 · 비활성"}`}
      onClick={() => node.agents.length === 1 ? openAgent(node.agents[0].agent.id) : openDesk(node.role)}
      className={`flow-role-card w-full rounded-hud border border-outline-variant p-3 text-left ${assigned ? "card-lift bg-white shadow-[0_8px_24px_rgba(11,28,48,0.10)]" : "flow-role-inactive bg-slate-50"}`}
      style={{ borderTop: `3px solid ${color}` }}>
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `${color}1a`, color }}>
          <Icon name={roleIcon(node.role)} size={18} fill />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold" style={{ color }}>{ROLE_LABEL[node.role]}</div>
          <div className="truncate text-[10px] text-on-background/55">{node.role === "PM" ? "계획 · 배정 · 결과 조율" : node.role === "QA" ? "검증 · 결과 보고" : "실행 · 결과 보고"}</div>
        </div>
      </div>
      <div className="mt-2 truncate text-[11px] text-on-background/70" title={node.agents.map(({ agent }) => agent.displayName).join(", ")}>
        {node.agents.length ? `배정 ${node.agents.length}명 · 작업 중 ${working}명` : "미배정"}
      </div>
      <div className="mt-1 truncate text-[11px] text-on-background/60">
        {!assigned ? "에이전트 배정 후 활성화" : single ? single.metrics.current?.title ?? single.agent.activitySummary ?? single.agent.displayName : "역할 선택으로 전체 작업 확인"}
      </div>
      <ProgressBar value={assigned ? node.percent : 0} color={color} height={6} className="mt-2" />
      <div className="mt-2 flex justify-between gap-1 text-[10px] text-on-background/60">
        <span>{assigned ? status : "비활성"}{single ? ` · ${fmtTokens(single.metrics.tokenTotal)}` : ""}</span>
        <span className="tabular">{node.total ? `${node.completed}/${node.total} 완료` : "작업 없음"}</span>
      </div>

    </button>
  );
}

export function DevelopmentFlow() {
  const markerId = useId().replace(/:/g, "");
  const snapshot = useStore((s) => s.snapshot);
  const roles = useStore((s) => s.rolesById);
  const connection = useStore((s) => s.connection);
  if (!snapshot) return null;
  const nodes = flowModel(snapshot, roles);
  const getNode = (role: FlowRole) => nodes.find((node) => node.role === role)!;
  return (
    <GlassPanel level={3} className="orchestration-flow p-3" data-testid="development-flow">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="display flex items-center gap-1.5 text-sm font-semibold"><Icon name="account_tree" size={18} className="text-primary" />Development flow</h3>
        <span className="text-[11px] text-on-background/55">{connection === "CONNECTED" ? "실시간 동기화" : `${connection} · 마지막 수신 상태`}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-on-background/60">
        <span className="rounded-full bg-primary/10 px-2 py-1 font-semibold text-primary">PM ORCHESTRATION</span>
        <span>계획에서 실행으로, 검증에서 다음 계획으로</span>
      </div>
      <div className="flow-stage grid-faint">
        <svg viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true" className="flow-connectors">
          <defs>{Object.entries(EDGE_COLOR).map(([kind, color]) => <marker key={kind} id={`${markerId}-${kind}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill={color} /></marker>)}</defs>
          {FLOW_EDGES.map((edge) => {
            const active = nodes.some((node) => node.role === edge.from && node.agents.length > 0) && nodes.some((node) => node.role === edge.to && node.agents.length > 0);
            return <g key={`${edge.from}-${edge.to}`} data-active={active}>
            <path data-testid={`flow-link-${edge.from}-${edge.to}`} d={edge.path}
              stroke={active ? EDGE_COLOR[edge.kind] : "#cbd5e1"} strokeDasharray={active ? undefined : "4 6"} strokeWidth="1.2" strokeOpacity="0.25" vectorEffect="non-scaling-stroke" fill="none"
              markerEnd={active ? `url(#${markerId}-${edge.kind})` : undefined} />
            {active && <path className={`flow-stream flow-stream-${edge.kind}`} d={edge.path}
              stroke={EDGE_COLOR[edge.kind]} strokeWidth="2.2" vectorEffect="non-scaling-stroke" fill="none" />}
          </g>; })}
        </svg>
        <section className="flow-plan" aria-label="계획 및 조율">
          <h4 className="flow-stage-title"><span>01</span> 계획 · 조율</h4>
          <FlowNode node={getNode("PM")} />
        </section>
        <div className="flow-caption flow-dispatch"><Icon name="arrow_downward" size={13} /> 작업 분배</div>
        <section className="flow-execution" aria-label="역할별 실행">
          <h4 className="flow-stage-title"><span>02</span> 역할별 실행</h4>
          <div className="flow-execution-cards">{EXECUTION_ROLES.map((role) => <FlowNode key={role} node={getNode(role)} />)}</div>
        </section>
        <div className="flow-caption flow-handoff"><Icon name="arrow_downward" size={13} /> 결과 전달 · 검증</div>
        <section className="flow-validation" aria-label="QA 검증">
          <h4 className="flow-stage-title"><span>03</span> 검증 · 결과 보고</h4>
          <FlowNode node={getNode("QA")} />
        </section>
        <div className="flow-loop-label flow-control-label"><span className="flow-direction-arrow" aria-hidden="true">↓</span> 검증 지시</div>
        <div className="flow-loop-label flow-feedback-label"><span className="flow-direction-arrow" aria-hidden="true">↑</span> 결과 보고 · 재계획</div>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-outline-variant pt-3 text-[11px] text-on-background/65" aria-label="흐름 안내">
        <span className="flex items-center gap-1 text-primary"><Icon name="alt_route" size={14} /> PM → 역할별 작업 배정</span>
        <span className="flex items-center gap-1 text-qa"><Icon name="merge" size={14} /> FE · BE · DB → QA</span>
        <span className="flex items-center gap-1 text-[#b45309]"><Icon name="subdirectory_arrow_left" size={14} /> QA → PM 피드백</span>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-on-background/55">PM은 QA에도 직접 검증을 지시하고, 결과에 따라 후속 계획을 조율합니다. 역할 간 기본 흐름이며 실제 실행 순서는 Task 의존성과 승인 조건을 따릅니다.</p>
    </GlassPanel>
  );
}
