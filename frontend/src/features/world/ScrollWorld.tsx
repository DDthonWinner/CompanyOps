import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useWorldSnapshot } from "./useWorldSnapshot";
import { api } from "../../api/client";
import type { ProjectListItem } from "../../api/types";
import { useStore } from "../../store/useStore";
import { isWebGLAvailable } from "../tycoon/WebGLFallback";
import { CHAPTERS, chapterAt, clamp, segment } from "./journey";
import { useHiringProfiles } from "./useHiringProfiles";
import "./world.css";

const CityCanvas = lazy(() => import("./WorldCanvas"));
const AppShell = lazy(() => import("../../app/AppShell").then((module) => ({ default: module.AppShell })));

class SceneBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export function ScrollWorld() {
  const hiringProfiles = useHiringProfiles();
  const scroller = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const [progress, setProgress] = useState(0);
  const [entryTab, setEntryTab] = useState<"tycoon" | "dashboard">("tycoon");
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [listState, setListState] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(false);
  const webgl = useMemo(isWebGLAvailable, []);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const setActiveProject = useStore((s) => s.setActiveProject);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const selectedIndex = projects.findIndex((p) => p.id === activeProjectId);
  const selectedProject = projects.find((p) => p.id === activeProjectId);
  const chapter = chapterAt(progress);
  const arrived = progress >= 0.98;
  const officeReveal = segment(progress, 0.90, 0.99);
  const { snapshot, connection } = useWorldSnapshot(activeProjectId, progress < 0.90);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setListState("loading");
    api.listProjects().then((result) => {
      if (cancelled) return;
      const items = Array.isArray(result) ? result : result.items;
      setProjects(items);
      setListState("ready");
      const current = useStore.getState().activeProjectId;
      if (current && !items.some((p) => p.id === current)) setActiveProject(null);
    }).catch(() => { if (!cancelled) setListState("error"); });
    return () => { cancelled = true; };
  }, [retry, setActiveProject]);

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const next = clamp(node.scrollTop / Math.max(1, node.scrollHeight - node.clientHeight));
      progressRef.current = next;
      setProgress(next);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    node.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
    return () => {
      node.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const go = (at: number, tab: "tycoon" | "dashboard" = "tycoon") => {
    const node = scroller.current;
    if (!node) return;
    if (arrived && at < 0.9) setRetry((n) => n + 1);
    if (at >= 0.9) { setEntryTab(tab); setActiveTab(tab); }
    node.scrollTo({ top: at * (node.scrollHeight - node.clientHeight), behavior: reducedMotion ? "instant" : "smooth" });
  };
  const select = (index: number) => {
    if (!projects[index]) return;
    if (projects[index].id !== activeProjectId) setActiveProject(projects[index].id);
    setActiveTab("tycoon");
  };

  useEffect(() => {
    if (progress >= 0.9) setActiveTab(entryTab);
  }, [chapter, activeProjectId, entryTab, setActiveTab]);

  return (
    <div className={`world-scroll ${arrived ? "is-in-office" : ""}`} ref={scroller} data-testid="world-scroll" tabIndex={0} aria-label="CompanyOps 아이디어에서 프로젝트로 이어지는 스크롤 여정">
      <div className="world-track">
        <div className="world-stage">
          {progress < 0.995 && <div className="world-canvas" aria-hidden="true">
            {webgl && !sceneFailed && <SceneBoundary onError={() => setSceneFailed(true)}>
              <Suspense fallback={<div className="world-loading">시작 화면을 불러오는 중<span>●</span></div>}>
                <CityCanvas hiringProfiles={hiringProfiles} progress={progressRef} selectedIndex={selectedIndex} projectNames={projects.map((p) => p.name)} onSelect={select} snapshot={snapshot} reducedMotion={reducedMotion} />
              </Suspense>
            </SceneBoundary>}
          </div>}
          <div className="world-vignette" style={{ opacity: 1 - officeReveal }} />

          {!arrived && <header className="world-header">
            <button className="world-brand" onClick={() => go(0)} aria-label="CompanyOps 처음으로"><span className="world-brand-mark">C<span>↗</span></span> CompanyOps<span className="world-brand-note">A WORLD OF POSSIBILITIES</span></button>
            <button className="world-skip" onClick={() => go(1)}>오피스로 바로 가기 <span>↗</span></button>
          </header>}

          {!arrived && <div className="world-coordinate"><span className="world-live-dot" /> AI-DLC &amp; COMPANYOPS <span>IDEAS BECOME REALITY</span></div>}

          {chapter === 0 && <section className="world-copy world-intro" aria-labelledby="world-title">
            <p className="world-eyebrow">01 / POSSIBILITY — 아이디어에서 시작</p>
            <h1 id="world-title">수많은 가능성,<br /><em>시작은 당신의 아이디어부터.</em></h1>
            <p className="world-description">아이디어가 실제 프로젝트가 되는 곳.<br />AI-DLC &amp; CompanyOps와 함께라면 가능합니다.</p>
            <button className="world-primary" onClick={() => go(0.32)}>가능성을 확인하세요 <span>↗</span></button>
            {listState === "ready" && <div className="world-opening-data"><span><strong>{projects.length}</strong> PROJECTS</span><span><strong>{projects.reduce((sum, project) => sum + project.assignedAgentCount, 0)}</strong> AI AGENTS</span></div>}
          </section>}

          {chapter === 1 && <section className="world-project-panel" aria-labelledby="project-title">
            <p className="world-eyebrow">02 / PROJECT — 가능성을 프로젝트로</p>
            <h2 id="project-title">어떤 가능성을<br /><em>열어볼까요?</em></h2>
            <p className="world-description">당신의 아이디어를 프로젝트로 만들고,<br />함께할 AI 에이전트를 고용하세요.</p>
            {hiringProfiles.length > 0 && <aside className="world-hiring"><p>새로운 프로젝트에서 함께할 준비가 되어 있어요.</p><span className="world-caption">이름과 역할을 확인하고, 프로젝트에서 팀을 고용하세요.</span></aside>}
            <div className="world-project-list" aria-label="프로젝트 선택">
              {listState === "loading" && <p role="status">프로젝트를 불러오는 중…</p>}
              {listState === "error" && <div className="world-empty" role="status"><p>프로젝트 서버에 연결할 수 없습니다.</p><button className="world-text-button" onClick={() => setRetry((n) => n + 1)}>다시 불러오기 ↻</button><p className="world-caption">오피스에서 프로젝트를 시작할 수 있어요.</p></div>}
              {listState === "ready" && projects.length === 0 && <div className="world-empty"><p>아직 생성한 프로젝트가 없습니다.</p><button className="world-text-button" onClick={() => go(1, "dashboard")}>첫 프로젝트 만들러 가기 ↗</button></div>}
              {projects.map((project, index) => <button key={project.id} onClick={() => select(index)} className={`world-project ${project.id === activeProjectId ? "is-selected" : ""}`} aria-pressed={project.id === activeProjectId}>
                <span className="world-project-number">{String(index + 1).padStart(2, "0")}</span>
                <span className="world-project-detail"><strong>{project.name}</strong><span>{project.assignedAgentCount}명의 AI 팀 · {project.status}</span></span>
                <span className="world-project-arrow">{project.id === activeProjectId ? "✓" : "↗"}</span>
              </button>)}
            </div>
            <button className="world-primary" onClick={() => selectedProject ? go(0.55) : go(1, "dashboard")}>프로젝트를 시작하세요<span>↗</span></button>
          </section>}


          {chapter === 2 && <section className="world-copy world-company-copy" aria-labelledby="company-title">
            <p className="world-eyebrow">03 / COMPANYOPS — 프로젝트가 움직이는 곳</p>
            <h2 id="company-title">당신의 {selectedProject ? <span>{selectedProject.name} 프로젝트,</span> : "프로젝트,"}<br /><em>지금 이곳에서 만들어지고 있습니다.</em></h2>
            <p className="world-description">프로젝트의 규모와 상황에 맞게<br />버짓과 사용량을 설정하고 운영하세요.</p>
            {snapshot && <div className="world-company-metrics"><span>PROJECT BUDGET<strong>${snapshot.project.budgetAmount.toLocaleString()}</strong></span><span>AI TEAM<strong>{snapshot.project.assignedAgentCount}명</strong></span><span>PROGRESS<strong>{snapshot.project.progressPercent}%</strong></span></div>}
            {!selectedProject && <p className="world-caption">프로젝트를 선택하면 실제 운영 상황이 표시됩니다.</p>}
            <button className="world-primary" onClick={() => go(0.78)}>프로젝트를 확인하세요 <span>↗</span></button>
          </section>}

          {chapter === 3 && <section className="world-copy world-office-copy" style={{ opacity: 1 - officeReveal }} aria-labelledby="office-title">
            <p className="world-eyebrow">04 / AI TEAM — 실제로 일하는 에이전트들</p>
            <h2 id="office-title">당신의 팀은 지금도<br /><em>프로젝트를 완성해가고 있습니다.</em></h2>
            <p className="world-description">AI 에이전트가 어떻게 일하고 있는지,<br />무엇을 완료했고 무엇을 진행하고 있는지 확인하세요.<br />프로젝트가 끝나면 AI가 전체 과정을 분석하고 피드백합니다.</p>
            <button className="world-primary" onClick={() => go(1)}>팀의 현재 상황을 확인하세요 <span>↗</span></button>
            <p className="world-caption">{snapshot && connection === "CONNECTED" ? `최근 프로젝트 상태 · ${snapshot.agents.filter((a) => a.status === "WORKING").length}명의 에이전트가 작업 중` : "공간 연출 미리보기 · 실제 팀 현황은 프로젝트 연결 후 표시됩니다."}</p>
            {snapshot && <div className="world-team-status" aria-label="실제 AI 팀 작업 현황">{snapshot.agents.filter((agent) => agent.status !== "REMOVED").slice(0, 4).map((agent) => <div key={agent.id}><strong>{agent.displayName}</strong><span>{agent.status}</span><p>{snapshot.tasks.find((task) => task.id === agent.currentTaskId)?.title ?? agent.activitySummary ?? "다음 작업 대기 중"}</p></div>)}</div>}
          </section>}

          {(sceneFailed || !webgl) && !arrived && <p className="world-fallback" role="status">이 환경에서는 3D 장면 대신 단계별로 이동합니다. 프로젝트 선택과 오피스는 사용할 수 있습니다.</p>}

          {progress >= 0.90 && <section ref={(node) => { if (node) { if (arrived) node.removeAttribute("inert"); else node.setAttribute("inert", ""); } }} className={`world-app ${arrived ? "is-arrived" : ""}`} aria-label="프로젝트 오피스" aria-hidden={!arrived} style={{ opacity: officeReveal, transform: `scale(${0.83 + 0.17 * officeReveal}) translateY(${(1 - officeReveal) * 9}%)`, borderRadius: `${(1 - officeReveal) * 30}px` }}>
            <Suspense fallback={<div className="flex h-full items-center justify-center">오피스를 준비하는 중…</div>}><AppShell /></Suspense>
          </section>}

          {chapter === 0 && <button className="world-center-scroll" onClick={() => go(0.32)}><span>스크롤하며 가능성을 만나보세요</span><span aria-hidden="true">↓</span></button>}
          {arrived ? <button className="world-return" onClick={() => go(0.32)}>← 프로젝트 선택</button> : <footer className="world-footer">
            <span className="world-scroll-hint" style={{ visibility: chapter === 0 ? "hidden" : "visible" }}><span>↓</span> SCROLL TO EXPLORE</span>
            <nav className="world-chapters" aria-label="여정 단계">{CHAPTERS.map((item, index) => <button key={item.label} className={chapter === index ? "is-current" : ""} aria-current={chapter === index ? "step" : undefined} onClick={() => go(item.at)}><span>{String(index + 1).padStart(2, "0")}</span>{item.label}</button>)}</nav>
            <span className="world-progress">{String(Math.round(progress * 100)).padStart(2, "0")} <span>/ 100</span></span>
          </footer>}
          <div className="world-progress-line" style={{ transform: `scaleX(${progress})` }} />
        </div>
      </div>
    </div>
  );
}
