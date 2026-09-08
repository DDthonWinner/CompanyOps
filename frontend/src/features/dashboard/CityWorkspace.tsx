import { Component, lazy, Suspense, useState, type ReactNode } from "react";
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { StatusPill } from "../../components/ui/StatusPill";
import { ROLE_LABEL, roleColor } from "../../lib/roles";
import { useStore } from "../../store/useStore";
import { cityModel } from "./cityModel";
import { DevelopmentFlow } from "./DevelopmentFlow";

const CityScene = lazy(() => import("./CityScene"));
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <div role="status" className="flex h-full items-center justify-center p-6 text-center text-sm">3D 도시를 표시할 수 없습니다. 아래 에이전트 목록이나 흐름도를 이용하세요.</div>
      : this.props.children;
  }
}

export function CityWorkspace() {
  const snapshot = useStore((s) => s.snapshot);
  const roles = useStore((s) => s.rolesById);
  const connection = useStore((s) => s.connection);
  const openAgent = useStore((s) => s.openAgentSheet);
  const openDesk = useStore((s) => s.openDeskSheet);
  const [view, setView] = useState<"city" | "flow">("city");
  const [effects, setEffects] = useState(true);
  const [reset, setReset] = useState(0);
  if (!snapshot) return null;
  const nodes = cityModel(snapshot, roles);
  const select = (role: string) => {
    const node = nodes.find((n) => n.role === role);
    if (node?.agents.length === 1) openAgent(node.agents[0].agent.id);
    else openDesk(role);
  };
  return (
    <GlassPanel level={3} className="min-w-0 overflow-hidden p-4" data-testid="city-workspace">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="display text-sm font-semibold">Agent workspace</h3>
          <p className="text-xs text-on-background/60">PM → Frontend / Backend → QA</p>
        </div>
        <div className="flex gap-1" role="group" aria-label="작업 공간 보기">
          <Button variant={view === "city" ? "solid" : "ghost"} aria-pressed={view === "city"} onClick={() => setView("city")}>3D 도시</Button>
          <Button variant={view === "flow" ? "solid" : "ghost"} aria-pressed={view === "flow"} onClick={() => setView("flow")}>흐름도</Button>
        </div>
      </div>
      {view === "flow" ? <div className="mt-3"><DevelopmentFlow /></div> : <>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-on-background/60">{connection === "CONNECTED" ? "실시간 동기화" : `${connection} · 마지막 수신 상태`}</span>
          <div className="flex flex-wrap gap-1">
            <Button variant="ghost" aria-pressed={effects} onClick={() => setEffects(!effects)}>시각 효과 {effects ? "켜짐" : "꺼짐"}</Button>
            <Button variant="ghost" onClick={() => setReset((v) => v + 1)}>시점 초기화</Button>
          </div>
        </div>
        <div className="relative mt-2 h-[300px] overflow-hidden rounded-xl border border-outline-variant/50 bg-[#f0effa] sm:h-[390px]" aria-label="AI 개발 도시. 건물 선택은 아래 부서와 에이전트 버튼으로도 가능합니다.">
          <SceneBoundary key={snapshot.project.id}>
            <Suspense fallback={<div role="status" className="p-6 text-sm">3D 도시를 준비하고 있어요…</div>}>
              <CityScene nodes={nodes} effects={effects && connection === "CONNECTED"} reset={reset} onSelect={select} />
            </Suspense>
          </SceneBoundary>
        </div>
        <p className="mt-2 text-[11px] text-on-background/60">드래그로 회전 · 스크롤로 확대 · 건물 선택으로 상세 보기 · 빛 경로는 역할 흐름을 나타냅니다</p>
        <div className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-4">
          {nodes.map((node) => <div key={node.role} className="min-w-0 rounded-xl border border-outline-variant/60 bg-white/80 p-2.5">
            <button type="button" onClick={() => select(node.role)} className="w-full rounded text-left text-xs font-semibold focus-visible:outline-primary" style={{ color: roleColor(node.role) }}>
              {ROLE_LABEL[node.role]} · {node.percent}%
            </button>
            <ProgressBar value={node.percent} color={roleColor(node.role)} height={4} />
            <p className="my-1 text-[10px] text-on-background/60">{node.total ? `${node.completed}/${node.total} 작업 완료` : "작업 없음"}</p>
            {!node.agents.length && <p className="text-xs text-on-background/60">미배정</p>}
            {node.agents.map(({ agent, metrics }) => <button key={agent.id} type="button" onClick={() => openAgent(agent.id)} className="mt-1 block w-full rounded text-left focus-visible:outline-primary" aria-label={`${agent.displayName} 상세 보기`}>
              <span className="block truncate text-xs font-medium">{agent.displayName}</span>
              <StatusPill status={agent.status} />
              <span className="mt-1 block truncate text-[10px] text-on-background/60" title={metrics.current?.title}>{metrics.current?.title ?? "현재 작업 없음"}</span>
            </button>)}
          </div>)}
        </div>
      </>}
    </GlassPanel>
  );
}
