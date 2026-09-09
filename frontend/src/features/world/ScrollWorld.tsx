import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [listState, setListState] = useState<"loading" | "ready" | "error">("loading");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(false);
  const webgl = useMemo(isWebGLAvailable, []);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const requestGate = useStore((s) => s.requestGate);
  const enteredRef = useRef(false);
  const chapter = chapterAt(progress);
  const arrived = progress >= 0.98;
  const officeReveal = segment(progress, 0.90, 0.98);

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
    }).catch(() => { if (!cancelled) setListState("error"); });
    return () => { cancelled = true; };
  }, []);

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

  const go = (at: number) => {
    const node = scroller.current;
    if (!node) return;
    node.scrollTo({ top: at * (node.scrollHeight - node.clientHeight), behavior: reducedMotion ? "instant" : "smooth" });
  };

  useEffect(() => {
    if (progress >= 0.9) {
      setActiveTab("tycoon");
      // Land on the project village (selection/creation), not straight into an office.
      if (!enteredRef.current) {
        enteredRef.current = true;
        requestGate("village");
      }
    } else if (progress < 0.85) {
      enteredRef.current = false; // re-arm if the user scrolls back up
    }
  }, [progress, setActiveTab, requestGate]);

  return (
    <div className={`world-scroll ${arrived ? "is-in-office" : ""}`} ref={scroller} data-testid="world-scroll" tabIndex={0} aria-label="CompanyOps 아이디어에서 프로젝트로 이어지는 스크롤 여정">
      <div className="world-track">
        <div className="world-stage">
          {!arrived && <div className="world-canvas" aria-hidden="true">
            {webgl && !sceneFailed && <SceneBoundary onError={() => setSceneFailed(true)}>
              <Suspense fallback={<div className="world-loading">시작 화면을 불러오는 중<span>●</span></div>}>
                <CityCanvas hiringProfiles={hiringProfiles} progress={progressRef} projectNames={projects.map((p) => p.name)} reducedMotion={reducedMotion} />
              </Suspense>
            </SceneBoundary>}
          </div>}
          {!arrived && <div className="world-vignette" style={{ opacity: 1 - officeReveal }} />}

          {!arrived && <header className="world-header">
            <div className="world-brand"><span className="world-brand-mark">C<span>↗</span></span> CompanyOps<span className="world-brand-note">A WORLD OF POSSIBILITIES</span></div>
            <button className="world-skip" onClick={() => go(1)}>오피스로 바로 가기 <span>↗</span></button>
          </header>}

          {!arrived && <div className="world-coordinate"><span className="world-live-dot" /> AI-DLC &amp; COMPANYOPS <span>IDEAS BECOME REALITY</span></div>}

          {chapter === 0 && <section className="world-copy world-intro" aria-labelledby="world-title">
            <p className="world-eyebrow">01 / POSSIBILITY — 아이디어에서 시작</p>
            <h1 id="world-title">수많은 가능성,<br /><em>시작은 당신의 아이디어부터.</em></h1>
            <p className="world-description">아이디어가 실제 프로젝트가 되는 곳.<br />AI-DLC &amp; CompanyOps와 함께라면 가능합니다.</p>
            {listState === "ready" && <div className="world-opening-data"><span><strong>{projects.length}</strong> PROJECTS</span><span><strong>{projects.reduce((sum, project) => sum + project.assignedAgentCount, 0)}</strong> AI AGENTS</span></div>}
          </section>}

          {chapter === 1 && <section className="world-project-panel" aria-labelledby="project-title">
            <p className="world-eyebrow">02 / PROJECT — 가능성을 프로젝트로</p>
            <h2 id="project-title">어떤 가능성을<br /><em>열어볼까요?</em></h2>
            <p className="world-description">당신의 아이디어를 프로젝트로 만들고,<br />함께할 AI 에이전트를 고용하세요.</p>
            {hiringProfiles.length > 0 && <aside className="world-hiring"><p>새로운 프로젝트에서 함께할 준비가 되어 있어요.</p><span className="world-caption">이름과 역할을 확인하고, 프로젝트에서 팀을 고용하세요.</span></aside>}
            <div className="world-project-list" aria-label="프로젝트 선택">
              {listState === "loading" && <p role="status">프로젝트를 불러오는 중…</p>}
              {listState === "error" && <div className="world-empty" role="status"><p>프로젝트 목록을 불러오지 못했습니다.</p></div>}
              {listState === "ready" && projects.length === 0 && <div className="world-empty"><p>새로운 프로젝트가 준비되고 있습니다.</p></div>}
              {projects.map((project, index) => <div key={project.id} className="world-project">
                <span className="world-project-number">{String(index + 1).padStart(2, "0")}</span>
                <span className="world-project-detail"><strong>{project.name}</strong></span>
              </div>)}
            </div>
          </section>}


          {chapter === 2 && <section className="world-copy world-company-copy" aria-labelledby="company-title">
            <p className="world-eyebrow">03 / COMPANYOPS — 프로젝트가 움직이는 곳</p>
            <h2 id="company-title">당신의 Project,<br /><em>지금 이곳에서 만들어지고 있습니다.</em></h2>
            <p className="world-description">프로젝트의 규모와 상황에 맞게<br />버짓과 사용량을 설정하고 운영하세요.</p>
          </section>}

          {chapter === 3 && <section className="world-copy world-office-copy" style={{ opacity: 1 - officeReveal }} aria-labelledby="office-title">
            <p className="world-eyebrow">04 / AI TEAM — 실제로 일하는 에이전트들</p>
            <h2 id="office-title">당신의 팀은 지금도<br /><em>프로젝트를 완성해가고 있습니다.</em></h2>
            <p className="world-description">AI 에이전트가 어떻게 일하고 있는지,<br />무엇을 완료했고 무엇을 진행하고 있는지 확인하세요.<br />프로젝트가 끝나면 AI가 전체 과정을 분석하고 피드백합니다.</p>
          </section>}

          {(sceneFailed || !webgl) && !arrived && <p className="world-fallback" role="status">이 환경에서는 3D 장면 대신 단계별 이야기와 프로젝트 목록을 표시합니다.</p>}

          {progress >= 0.90 && <section ref={(node) => { if (node) { if (arrived) node.removeAttribute("inert"); else node.setAttribute("inert", ""); } }} className={`world-app ${arrived ? "is-arrived" : ""}`} aria-label="프로젝트 오피스" aria-hidden={!arrived} style={{ opacity: officeReveal, transform: `scale(${0.83 + 0.17 * officeReveal}) translateY(${(1 - officeReveal) * 9}%)`, borderRadius: `${(1 - officeReveal) * 30}px` }}>
            <Suspense fallback={<div className="flex h-full items-center justify-center">오피스를 준비하는 중…</div>}><AppShell /></Suspense>
          </section>}

          {chapter === 0 && <div className="world-center-scroll"><span>스크롤하며 가능성을 만나보세요</span><span aria-hidden="true">↓</span></div>}
          {!arrived && <footer className="world-footer">
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
