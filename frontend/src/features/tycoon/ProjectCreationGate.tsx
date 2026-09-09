import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { api } from "../../api/client";
import type { ProjectListItem } from "../../api/types";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { pushToast } from "../../components/ui/toast";
import { useStore } from "../../store/useStore";
import { runWrite } from "../dashboard/actions";
import "./projectCreationGate.css";

type GateStage = "select" | "name" | "size" | "description" | "creating";
type ProjectSize = "SMALL" | "MEDIUM" | "LARGE";
// Shared between the camera controls (writer) and house/lot click handlers (readers):
// true while a camera drag is in progress so the drag doesn't also fire a click.
type DragRef = MutableRefObject<{ moved: boolean }>;
type FocusRef = MutableRefObject<{ pos: [number, number] | null; nonce: number }>;

// Demo gating: during the demo only the flagship Neobank project can be entered.
const DEMO_UNLOCKED_PROJECT = "Neobank Super App";
const isProjectLocked = (p: ProjectListItem | null | undefined) => !!p && p.name !== DEMO_UNLOCKED_PROJECT;
const LOCKED_TOOLTIP = "해당 프로젝트는 잠겨있습니다.";
// Demo gating: creating a new project requires this password. Client-side only —
// a lightweight gate for the demo, not real access control.
const DEMO_CREATE_PASSWORD = "demo";

const SIZE_LABELS: Record<ProjectSize, string> = {
  SMALL: "S",
  MEDIUM: "M",
  LARGE: "L",
};

const SIZE_COPY: Record<ProjectSize, string> = {
  SMALL: "작고 빠른 실험",
  MEDIUM: "균형 잡힌 제품 개발",
  LARGE: "장기 운영 프로젝트",
};

// Cheerful Animal-Crossing-ish palette: pastel walls with a warm contrasting roof.
const WALL_COLORS: Record<ProjectSize, string> = {
  SMALL: "#8ccf83",
  MEDIUM: "#8fb7e8",
  LARGE: "#c79ad6",
};

const ROOF_COLORS: Record<ProjectSize, string> = {
  SMALL: "#d1715a",
  MEDIUM: "#e0913f",
  LARGE: "#5a7bbf",
};

const GRASS_LIGHT = "#93d06a";
const GRASS_DARK = "#83c65e";

const FOCUS: Record<GateStage, { target: THREE.Vector3; zoom: number }> = {
  select: { target: new THREE.Vector3(0, 3, -4), zoom: 18 },
  // Naming happens outside, framed on the freshly-planted nameplate post.
  name: { target: new THREE.Vector3(0, 2.4, 11), zoom: 30 },
  // Then the camera pulls back to the three houses so you can pick one.
  size: { target: new THREE.Vector3(0, 3.4, 2), zoom: 24 },
  description: { target: new THREE.Vector3(0, 3.6, 2), zoom: 30 },
  creating: { target: new THREE.Vector3(0, 3.6, 2), zoom: 34 },
};

export function ProjectCreationGate() {
  const setActiveProject = useStore((s) => s.setActiveProject);
  const gateMode = useStore((s) => s.gateMode);
  const gateNonce = useStore((s) => s.gateNonce);
  const [stage, setStage] = useState<GateStage>(() => (gateMode === "create" ? "name" : "select"));
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [listState, setListState] = useState<"loading" | "ready" | "error">("loading");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectSize, setProjectSize] = useState<ProjectSize | null>(null);
  const [hoveredProject, setHoveredProject] = useState<ProjectListItem | null>(null);
  // The project whose glass info card is pinned open (set by clicking a house).
  const [pinnedProject, setPinnedProject] = useState<ProjectListItem | null>(null);
  // Demo password gate shown before actually creating a project (Step 3).
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const pinnedCardRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef({ x: 0, y: 0, w: 0, h: 0 });
  // Shared with the 3D controls: set true while the camera is being dragged so a
  // drag doesn't also register as a house click on pointer-up.
  const dragRef = useRef({ moved: false });
  // Shared with the 3D controls: the world position of the just-pinned house, so the
  // camera can recenter on it and its glass card never renders clipped at a screen edge.
  const focusRef = useRef<{ pos: [number, number] | null; nonce: number }>({ pos: null, nonce: 0 });

  const trimmedName = name.trim();
  const canSubmit = trimmedName.length > 0 && description.trim().length > 0 && projectSize;
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;

  // React to home / new-project navigation: village opens the overview, create jumps
  // straight into the nameplate step with a fresh form.
  useEffect(() => {
    setPinnedProject(null);
    if (gateMode === "create") {
      setSelectedProjectId(null);
      setName("");
      setDescription("");
      setProjectSize(null);
      setStage("name");
    } else {
      setStage("select");
    }
  }, [gateNonce, gateMode]);

  // Place the hover info card next to the last known cursor position. Called both on
  // pointer move and right when the card first mounts (so it never flashes at 0,0).
  const positionCard = () => {
    const card = cardRef.current;
    if (!card) return;
    const { x, y, w, h } = pointerRef.current;
    const flipX = x > w - 280;
    card.style.left = `${flipX ? x - 260 : x + 20}px`;
    card.style.top = `${Math.min(y + 20, h - 180)}px`;
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    pointerRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      w: rect.width,
      h: rect.height,
    };
    positionCard();
  };

  // Position the card immediately when it appears, before the browser paints.
  useLayoutEffect(() => {
    if (hoveredProject) positionCard();
  }, [hoveredProject]);

  // The pinned card follows its house in 3D: an anchor inside the canvas projects the
  // house's world position to screen space each frame and calls this to move the card.
  const positionPinned = (x: number, y: number, visible: boolean) => {
    const el = pinnedCardRef.current;
    if (!el) return;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.opacity = visible ? "1" : "0";
    el.style.pointerEvents = visible ? "auto" : "none";
  };

  useEffect(() => {
    let cancelled = false;
    setListState("loading");
    api.listProjects()
      .then((result) => {
        if (cancelled) return;
        setProjects(Array.isArray(result) ? result : result.items);
        setListState("ready");
      })
      .catch(() => {
        if (!cancelled) setListState("error");
      });
    return () => { cancelled = true; };
  }, []);

  const startNewProject = () => {
    setSelectedProjectId(null);
    setPinnedProject(null);
    setStage("name");
  };

  const enterSelectedProject = () => {
    if (!selectedProject) {
      pushToast("입장할 프로젝트 집을 선택하세요.", "error");
      return;
    }
    if (isProjectLocked(selectedProject)) {
      pushToast(LOCKED_TOOLTIP, "error");
      return;
    }
    setActiveProject(selectedProject.id);
  };

  const continueFromName = () => {
    if (!trimmedName) {
      pushToast("프로젝트 이름을 입력하세요.", "error");
      return;
    }
    setStage("size");
  };

  // Step 3 "프로젝트 생성" opens the demo password prompt instead of creating directly.
  const requestCreate = () => {
    if (!canSubmit) {
      pushToast("프로젝트 정보를 완성하세요.", "error");
      return;
    }
    setPassword("");
    setPasswordError(false);
    setShowPasswordPrompt(true);
  };

  const confirmPassword = () => {
    if (password !== DEMO_CREATE_PASSWORD) {
      setPasswordError(true);
      return;
    }
    setShowPasswordPrompt(false);
    setPassword("");
    submit();
  };

  const submit = async () => {
    if (!canSubmit) {
      pushToast("프로젝트 정보를 완성하세요.", "error");
      return;
    }
    setStage("creating");
    // Keep the spinner up for a short beat so the "hiring" moment reads clearly.
    const [res] = await Promise.all([
      runWrite(() =>
        api.createProject({
          name: trimmedName,
          description: description.trim(),
          budgetLevel: "MEDIUM",
          projectSize,
          gitRepository: { repositoryUrl: "https://github.com/DDthonWinner/TestOutput" },
        }),
      ),
      new Promise((resolve) => setTimeout(resolve, 1200)),
    ]);
    const newId = (res as { id?: string } | undefined)?.id;
    if (newId) {
      // Auto-hire & assign the primary PM agent for the new project.
      try {
        const profiles = await api.listAgentProfiles();
        const pm = profiles.find((p) => p.role?.code === "PM" && p.isActive) ?? profiles.find((p) => p.role?.code === "PM");
        if (pm) {
          await api.assignAgents(newId, {
            agents: [
              {
                agentProfileId: pm.id,
                roleCode: "PM",
                llmModelId: pm.defaultLlmModel?.id,
                displayName: pm.name,
                displayColor: pm.defaultColor,
                iconKey: pm.defaultIconKey,
                isPrimaryPm: true,
              },
            ],
          });
        }
      } catch {
        /* project is created; PM assignment is best-effort */
      }
      setActiveProject(newId);
      window.dispatchEvent(new CustomEvent("companyops:projects-changed"));
      pushToast("PM 에이전트 1명이 고용되었습니다!", "success");
    } else {
      setStage("description");
    }
  };

  return (
    <div className="project-gate" data-testid="project-creation-gate" onPointerMove={handlePointerMove}>
      <Canvas
        shadows
        orthographic
        camera={{ position: [34, 32, 34], zoom: FOCUS.select.zoom, near: 0.1, far: 1000 }}
        className="project-gate-canvas"
      >
        <color attach="background" args={["#eef3f8"]} />
        <ambientLight intensity={0.82} />
        <directionalLight position={[12, 20, 10]} intensity={1.2} castShadow />
        {/* Village lets you fly the camera around freely; the creation flow keeps the
            scripted cinematic camera. */}
        {stage === "select" ? <VillageControls dragRef={dragRef} focusRef={focusRef} /> : <GateCamera stage={stage} />}
        <GateScene
          stage={stage}
          projects={projects}
          selectedProjectId={selectedProjectId}
          projectName={trimmedName}
          projectSize={projectSize}
          pinnedProjectId={pinnedProject?.id ?? null}
          dragRef={dragRef}
          focusRef={focusRef}
          onSelectProject={(id) => {
            setSelectedProjectId(id);
            setPinnedProject(projects.find((p) => p.id === id) ?? null);
          }}
          onHoverProject={setHoveredProject}
          onEmptyLot={startNewProject}
          onPinnedAnchor={positionPinned}
          onPickSize={(size) => {
            setProjectSize(size);
            setStage("description");
          }}
        />
      </Canvas>

      <div className="project-gate-ui">
        {stage === "select" && (
          <section className="project-gate-panel project-gate-panel--intro">
            <span className="project-gate-kicker">Project Village</span>
            <h1>프로젝트 시작하기</h1>
            <p>진행중인 프로젝트를 선택하거나, 새로운 프로젝트를 시작하세요.</p>
            <div className="project-gate-actions project-gate-actions--pair">
              <Button
                onClick={enterSelectedProject}
                disabled={!selectedProject}
                title={isProjectLocked(selectedProject) ? LOCKED_TOOLTIP : undefined}
                className={`flex-1 justify-center ${isProjectLocked(selectedProject) ? "project-gate-locked-btn" : ""}`}
              >
                프로젝트 들어가기
                {isProjectLocked(selectedProject) && <Icon name="lock" size={16} />}
              </Button>
              <Button variant="ghost" onClick={startNewProject} className="flex-1 justify-center">새 프로젝트 시작</Button>
            </div>
            <div className="project-gate-project-list" aria-live="polite">
              {listState === "loading" && <span>집 목록을 불러오는 중...</span>}
              {listState === "error" && <span>프로젝트 목록을 불러오지 못했습니다.</span>}
              {listState === "ready" && projects.length === 0 && <span>아직 지어진 프로젝트 집이 없습니다.</span>}
              {selectedProject && <span>선택됨: {selectedProject.name}</span>}
            </div>
          </section>
        )}

        {stage === "select" && hoveredProject && hoveredProject.id !== pinnedProject?.id && (() => {
          const meta = statusMeta(hoveredProject.status);
          return (
            <div ref={cardRef} className="project-gate-hovercard" role="status">
              <strong className="project-gate-hovercard-name">{hoveredProject.name}</strong>
              <span className="project-gate-hovercard-status">{meta.label}</span>
              <div className="project-gate-hovercard-bar"><span style={{ width: `${meta.percent}%` }} /></div>
              <dl className="project-gate-hovercard-meta">
                <div><dt>진행률</dt><dd>{meta.percent}%</dd></div>
                <div><dt>에이전트</dt><dd>{hoveredProject.assignedAgentCount} / {hoveredProject.maxAgentCount}명</dd></div>
                <div><dt>규모</dt><dd>{SIZE_LABELS[normalizeSize(hoveredProject.projectSize)]}</dd></div>
              </dl>
            </div>
          );
        })()}

        {/* Pinned info card: clicking a house opens this glass panel above the house and
            keeps it on screen (tracking the house as the camera moves) with an Enter CTA. */}
        {stage === "select" && pinnedProject && (() => {
          const meta = statusMeta(pinnedProject.status);
          return (
            <div ref={pinnedCardRef} className="project-gate-pincard" role="dialog" aria-label={`${pinnedProject.name} 정보`}>
              <button className="project-gate-pincard-close" onClick={() => setPinnedProject(null)} aria-label="닫기">×</button>
              <strong className="project-gate-hovercard-name">{pinnedProject.name}</strong>
              <span className="project-gate-hovercard-status">{meta.label}</span>
              <div className="project-gate-hovercard-bar"><span style={{ width: `${meta.percent}%` }} /></div>
              <dl className="project-gate-hovercard-meta">
                <div><dt>진행률</dt><dd>{meta.percent}%</dd></div>
                <div><dt>에이전트</dt><dd>{pinnedProject.assignedAgentCount} / {pinnedProject.maxAgentCount}명</dd></div>
                <div><dt>규모</dt><dd>{SIZE_LABELS[normalizeSize(pinnedProject.projectSize)]}</dd></div>
              </dl>
              {isProjectLocked(pinnedProject) ? (
                <Button
                  className="project-gate-pincard-enter project-gate-locked-btn w-full justify-center"
                  title={LOCKED_TOOLTIP}
                  onClick={() => pushToast(LOCKED_TOOLTIP, "error")}
                >
                  <Icon name="lock" size={16} />
                  이 프로젝트는 잠겨있습니다
                </Button>
              ) : (
                <Button className="project-gate-pincard-enter w-full justify-center" onClick={() => setActiveProject(pinnedProject.id)}>
                  이 프로젝트 들어가기 →
                </Button>
              )}
            </div>
          );
        })()}

        {stage === "name" && (
          <section className="project-gate-panel project-gate-panel--form">
            <span className="project-gate-kicker">Step 1 · 프로젝트 생성</span>
            <h2>문패에 새길 이름</h2>
            <label>
              <span>프로젝트 이름</span>
              <input
                autoFocus
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") continueFromName();
                }}
                placeholder="예: CompanyOps 자동 운영실"
              />
            </label>
            <div className="project-gate-actions">
              <Button variant="ghost" onClick={() => setStage("select")}>이전</Button>
              <Button onClick={continueFromName}>다음</Button>
            </div>
          </section>
        )}

        {stage === "size" && (
          <section className="project-gate-panel project-gate-panel--size">
            <span className="project-gate-kicker">Step 2 · 규모 설정</span>
            <h2>부지 위에 세울 집의 크기를 선택하세요.</h2>
            <p className="project-gate-summary">규모는 토큰 사용량 및 예산과 연동됩니다.</p>
            <div className="project-gate-size-grid">
              {(Object.keys(SIZE_LABELS) as ProjectSize[]).map((size) => (
                <button key={size} onClick={() => { setProjectSize(size); setStage("description"); }}>
                  <strong>{SIZE_LABELS[size]}</strong>
                  <span>{SIZE_COPY[size]}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {stage === "description" && (
          <section className="project-gate-panel project-gate-panel--form">
            <span className="project-gate-kicker">Step 3 · 프로젝트 설명</span>
            <h2>{trimmedName}</h2>
            <p className="project-gate-summary">{projectSize ? `${SIZE_LABELS[projectSize]} 규모 · ${SIZE_COPY[projectSize]}` : "규모 미선택"}</p>
            <label>
              <span>어떤 프로젝트인지 적어주세요</span>
              <textarea
                autoFocus
                className="input"
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="목표, 사용자, 만들고 싶은 핵심 기능을 자유롭게 적어주세요."
              />
            </label>
            <div className="project-gate-actions">
              <Button variant="ghost" onClick={() => setStage("size")}>이전</Button>
              <Button onClick={requestCreate} disabled={!canSubmit}>프로젝트 생성</Button>
            </div>
          </section>
        )}

        {stage === "creating" && (
          <section className="project-gate-panel project-gate-panel--intro" role="status">
            <span className="project-gate-kicker">Creating</span>
            <div className="project-gate-creating">
              <span className="project-gate-spinner" aria-hidden />
              <div>
                <h2>PM 에이전트를 고용하는 중</h2>
                <p>프로젝트를 만들고, 담당 PM 에이전트를 배치하고 있습니다.</p>
              </div>
            </div>
          </section>
        )}

        {showPasswordPrompt && (
          <div className="project-gate-modal-backdrop" role="dialog" aria-modal="true" aria-label="프로젝트 생성 인증">
            <div className="project-gate-modal">
              <h3>패스워드를 입력하세요</h3>
              <p>데모 단계에서는 인증된 사용자만 프로젝트를 생성할 수 있습니다.</p>
              <input
                autoFocus
                type="password"
                className="input"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setPasswordError(false); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmPassword();
                  if (e.key === "Escape") setShowPasswordPrompt(false);
                }}
                placeholder="패스워드"
              />
              {passwordError && <span className="project-gate-modal-error">패스워드가 올바르지 않습니다.</span>}
              <div className="project-gate-actions">
                <Button variant="ghost" onClick={() => setShowPasswordPrompt(false)}>취소</Button>
                <Button onClick={confirmPassword}>확인</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GateCamera({ stage }: { stage: GateStage }) {
  const { camera } = useThree();
  const lookAt = useMemo(() => new THREE.Vector3(), []);

  useFrame((_state, delta) => {
    const focus = FOCUS[stage];
    const desiredPosition = new THREE.Vector3(
      focus.target.x + 34,
      focus.target.y + 26,
      focus.target.z + 34,
    );
    camera.position.lerp(desiredPosition, 1 - Math.pow(0.001, delta));
    camera.zoom = THREE.MathUtils.lerp(camera.zoom, focus.zoom, 1 - Math.pow(0.002, delta));
    camera.updateProjectionMatrix();
    lookAt.lerp(focus.target, 1 - Math.pow(0.001, delta));
    camera.lookAt(lookAt);
  });

  return null;
}

// Lightweight orbit/pan/zoom for the orthographic village camera (no drei dependency):
// left-drag pans across the meadow, right-drag (or shift-drag) rotates the viewpoint,
// and the wheel zooms. State lives in a ref and is applied to the camera each frame.
function VillageControls({ dragRef, focusRef }: { dragRef: DragRef; focusRef: FocusRef }) {
  const { camera, gl } = useThree();
  const st = useRef({
    target: new THREE.Vector3(0, 3, -8),
    azimuth: Math.PI / 4,
    polar: 1.05,
    radius: 58,
    zoom: 15,
  });
  // When a house is pinned, ease the target here; cleared once reached or on drag.
  const ease = useRef<[number, number] | null>(null);
  const seenNonce = useRef(0);

  useEffect(() => {
    const el = gl.domElement;
    let active = false;
    let mode: "pan" | "rotate" = "pan";
    let lastX = 0;
    let lastY = 0;

    const onDown = (e: PointerEvent) => {
      active = true;
      ease.current = null; // a manual drag cancels any in-progress recenter
      dragRef.current.moved = false;
      mode = e.button === 2 || e.shiftKey ? "rotate" : "pan";
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onMove = (e: PointerEvent) => {
      if (!active) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      if (Math.abs(dx) + Math.abs(dy) > 3) dragRef.current.moved = true;
      const s = st.current;
      if (mode === "rotate") {
        s.azimuth -= dx * 0.005;
        s.polar = THREE.MathUtils.clamp(s.polar - dy * 0.005, 0.35, 1.45);
      } else {
        // Grab-and-drag the ground: move the target opposite the pointer, along the
        // camera's screen-right and (ground-projected) screen-forward directions, so
        // the spot under the cursor stays under the cursor as you drag (both axes).
        const wpp = 1 / s.zoom;
        const cos = Math.cos(s.azimuth);
        const sin = Math.sin(s.azimuth);
        s.target.x += (-dx * cos - dy * sin) * wpp;
        s.target.z += (dx * sin - dy * cos) * wpp;
        s.target.x = THREE.MathUtils.clamp(s.target.x, -90, 90);
        s.target.z = THREE.MathUtils.clamp(s.target.z, -120, 40);
      }
    };
    const onUp = () => { active = false; };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = st.current;
      s.zoom = THREE.MathUtils.clamp(s.zoom * (1 - e.deltaY * 0.0012), 6, 80);
    };
    const onContext = (e: Event) => e.preventDefault();

    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("contextmenu", onContext);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("contextmenu", onContext);
    };
  }, [gl, dragRef]);

  useFrame(() => {
    const s = st.current;
    // Pick up a newly pinned house and start easing the camera toward it.
    const f = focusRef.current;
    if (f.nonce !== seenNonce.current) {
      seenNonce.current = f.nonce;
      if (f.pos) ease.current = f.pos;
    }
    if (ease.current) {
      // Aim slightly "up-scene" of the house (along screen-up on the ground) so the
      // house settles in the lower-middle of the view, leaving headroom for its card.
      const [hx, hz] = ease.current;
      const D = 9;
      const tx = hx - Math.sin(s.azimuth) * D;
      const tz = hz - Math.cos(s.azimuth) * D;
      s.target.x += (tx - s.target.x) * 0.14;
      s.target.z += (tz - s.target.z) * 0.14;
      if (Math.hypot(tx - s.target.x, tz - s.target.z) < 0.15) ease.current = null;
    }
    const sinP = Math.sin(s.polar);
    camera.position.set(
      s.target.x + s.radius * sinP * Math.sin(s.azimuth),
      s.target.y + s.radius * Math.cos(s.polar),
      s.target.z + s.radius * sinP * Math.cos(s.azimuth),
    );
    if (camera instanceof THREE.OrthographicCamera && Math.abs(camera.zoom - s.zoom) > 0.0005) {
      camera.zoom = s.zoom;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(s.target);
  });

  return null;
}

// Projects a house's world position to screen pixels every frame so the pinned info
// card (a DOM element) can be positioned above it as the camera moves.
function HouseAnchor({
  position,
  onProject,
}: {
  position: [number, number];
  onProject: (x: number, y: number, visible: boolean) => void;
}) {
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    v.set(position[0], 9, position[1]); // just above the roof/chimney
    v.project(camera);
    const x = (v.x * 0.5 + 0.5) * size.width;
    const y = (1 - (v.y * 0.5 + 0.5)) * size.height;
    onProject(x, y, v.z < 1);
  });
  return null;
}

function normalizeSize(size: string | undefined): ProjectSize {
  if (size === "LARGE" || size === "MEDIUM" || size === "SMALL") return size;
  return "MEDIUM";
}

function useNameplateTexture(label: string) {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 160;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#f5d57c";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#9d793d";
      ctx.lineWidth = 12;
      ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
      ctx.fillStyle = "#253044";
      // Big, bold name that reads clearly from the camera distance.
      ctx.font = "800 84px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const text = label.trim() || "EMPTY LOT";
      const clipped = text.length > 16 ? `${text.slice(0, 15)}…` : text;
      ctx.fillText(clipped, canvas.width / 2, canvas.height / 2 + 4, canvas.width - 44);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }, [label]);
}

// A soft two-tone grass tile (Animal-Crossing-ish) mapped across the ground plane.
function useGrassTexture(repeatX: number, repeatY: number) {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = GRASS_LIGHT;
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = GRASS_DARK;
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillRect(64, 64, 64, 64);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }, [repeatX, repeatY]);
}

// Shared hover behaviour: track hover state and switch the cursor to a pointer so
// every clickable object clearly reads as interactive. An optional callback lets a
// parent react (e.g. show an info card).
function useHover(onChange?: (hovered: boolean) => void) {
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    if (!hovered) return;
    document.body.style.cursor = "pointer";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hovered]);
  const bind = {
    onPointerOver: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      setHovered(true);
      onChange?.(true);
    },
    onPointerOut: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      setHovered(false);
      onChange?.(false);
    },
  };
  return { hovered, bind };
}

// Approximate a project's progress + a friendly Korean status label from its lifecycle
// status (the list endpoint doesn't carry a precise percentage).
function statusMeta(status: string): { label: string; percent: number } {
  switch (status) {
    case "DRAFT": return { label: "초안", percent: 8 };
    case "AGENT_MATCHING": return { label: "팀 매칭 중", percent: 20 };
    case "READY": return { label: "준비 완료", percent: 40 };
    case "ACTIVE":
    case "IN_PROGRESS": return { label: "진행 중", percent: 68 };
    case "COMPLETED": return { label: "완료", percent: 100 };
    case "CANCELLED": return { label: "취소됨", percent: 0 };
    case "ARCHIVED": return { label: "보관됨", percent: 100 };
    default: return { label: status, percent: 30 };
  }
}

function isInProgress(status: string): boolean {
  return status !== "COMPLETED" && status !== "CANCELLED" && status !== "ARCHIVED";
}

// A single rising, fading smoke puff for an active project's chimney.
function SmokePuff({ delay }: { delay: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (!mesh.current || !mat.current) return;
    const t = ((clock.elapsedTime + delay) % 2.4) / 2.4; // 0..1 loop
    mesh.current.position.y = t * 3.2;
    mesh.current.position.x = Math.sin((t + delay) * 5) * 0.4;
    const s = 0.45 + t * 1.1;
    mesh.current.scale.setScalar(s);
    // Fade in briefly, then fade out as it rises so puffs read against the sky.
    mat.current.opacity = Math.min(t * 4, 1) * (1 - t) * 1.1;
  });
  return (
    <mesh ref={mesh}>
      <sphereGeometry args={[0.5, 8, 8]} />
      <meshStandardMaterial ref={mat} color="#9aa8b8" transparent opacity={0} depthWrite={false} roughness={1} />
    </mesh>
  );
}

function ChimneySmoke({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <SmokePuff delay={0} />
      <SmokePuff delay={0.8} />
      <SmokePuff delay={1.6} />
    </group>
  );
}

// A chunky low-poly tree for a bit of village greenery.
function Tree({ position, scale = 1 }: { position: [number, number]; scale?: number }) {
  return (
    <group position={[position[0], 0, position[1]]} scale={[scale, scale, scale]}>
      <mesh castShadow position={[0, 1, 0]}>
        <cylinderGeometry args={[0.32, 0.42, 2, 6]} />
        <meshStandardMaterial color="#a9764c" roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0, 2.9, 0]}>
        <icosahedronGeometry args={[1.7, 0]} />
        <meshStandardMaterial color="#5aa64b" roughness={0.8} flatShading />
      </mesh>
      <mesh castShadow position={[0.5, 3.9, 0.3]}>
        <icosahedronGeometry args={[1.1, 0]} />
        <meshStandardMaterial color="#67b955" roughness={0.8} flatShading />
      </mesh>
    </group>
  );
}

// A small round bush to tuck beside a house door.
function Bush({ position }: { position: [number, number, number] }) {
  return (
    <mesh castShadow position={position}>
      <icosahedronGeometry args={[0.7, 0]} />
      <meshStandardMaterial color="#5fae4d" roughness={0.85} flatShading />
    </mesh>
  );
}

function GateScene({
  stage,
  projects,
  selectedProjectId,
  projectName,
  projectSize,
  pinnedProjectId,
  dragRef,
  focusRef,
  onSelectProject,
  onHoverProject,
  onEmptyLot,
  onPinnedAnchor,
  onPickSize,
}: {
  stage: GateStage;
  projects: ProjectListItem[];
  selectedProjectId: string | null;
  projectName: string;
  projectSize: ProjectSize | null;
  pinnedProjectId: string | null;
  dragRef: DragRef;
  focusRef: FocusRef;
  onSelectProject: (projectId: string) => void;
  onHoverProject: (project: ProjectListItem | null) => void;
  onEmptyLot: () => void;
  onPinnedAnchor: (x: number, y: number, visible: boolean) => void;
  onPickSize: (size: ProjectSize) => void;
}) {
  if (stage === "select") {
    return (
      <ProjectVillage
        projects={projects}
        selectedProjectId={selectedProjectId}
        pinnedProjectId={pinnedProjectId}
        dragRef={dragRef}
        focusRef={focusRef}
        onSelectProject={onSelectProject}
        onHoverProject={onHoverProject}
        onEmptyLot={onEmptyLot}
        onPinnedAnchor={onPinnedAnchor}
      />
    );
  }

  // Creating a project happens outside on the new plot: plant the nameplate,
  // then step out and choose one of the three houses.
  return (
    <NewHouseLot
      stage={stage}
      projectName={projectName}
      projectSize={projectSize}
      onPickSize={onPickSize}
    />
  );
}

function NewHouseLot({
  stage,
  projectName,
  projectSize,
  onPickSize,
}: {
  stage: GateStage;
  projectName: string;
  projectSize: ProjectSize | null;
  onPickSize: (size: ProjectSize) => void;
}) {
  const nameplate = useNameplateTexture(projectName || "NEW PROJECT");
  const grass = useGrassTexture(7, 6);
  // The three houses only become pickable once the nameplate is done (past the name step).
  const canPick = stage !== "name";
  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 4]}>
        <planeGeometry args={[52, 42]} />
        <meshStandardMaterial map={grass} roughness={0.95} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 4]}>
        <boxGeometry args={[38, 19, 0.16]} />
        <meshStandardMaterial color="#cdbfa0" roughness={0.9} />
      </mesh>
      {/* Nameplate: post rises to the board, which is mounted just in front of it so
          the post never pokes through the sign. */}
      <mesh castShadow position={[0, 1.7, 14]}>
        <boxGeometry args={[0.34, 3.4, 0.34]} />
        <meshStandardMaterial color="#8f6844" roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0, 3.35, 14.16]}>
        <boxGeometry args={[8.8, 1.8, 0.24]} />
        <meshStandardMaterial map={nameplate} color="#f5d57c" metalness={0.1} roughness={0.35} />
      </mesh>
      {/* The three houses only appear once the name is set (past STEP 1). */}
      {canPick && (
        <>
          <ScaleHouse size="SMALL" x={-13} selected={projectSize === "SMALL"} dimmed={!canPick} onPick={onPickSize} />
          <ScaleHouse size="MEDIUM" x={0} selected={projectSize === "MEDIUM"} dimmed={!canPick} onPick={onPickSize} />
          <ScaleHouse size="LARGE" x={13} selected={projectSize === "LARGE"} dimmed={!canPick} onPick={onPickSize} />
        </>
      )}
    </group>
  );
}

function ProjectVillage({
  projects,
  selectedProjectId,
  pinnedProjectId,
  dragRef,
  focusRef,
  onSelectProject,
  onHoverProject,
  onEmptyLot,
  onPinnedAnchor,
}: {
  projects: ProjectListItem[];
  selectedProjectId: string | null;
  pinnedProjectId: string | null;
  dragRef: DragRef;
  focusRef: FocusRef;
  onSelectProject: (projectId: string) => void;
  onHoverProject: (project: ProjectListItem | null) => void;
  onEmptyLot: () => void;
  onPinnedAnchor: (x: number, y: number, visible: boolean) => void;
}) {
  // Lay every project out on a centered grid (plus one trailing "for sale" plot) so the
  // village grows to fit any number of houses instead of capping at six.
  const layout = useMemo(() => {
    const SPACING_X = 17;
    const SPACING_Z = 16;
    const CENTER_Z = -8;
    const cellCount = projects.length + 1; // + the empty lot
    const cols = Math.max(3, Math.ceil(Math.sqrt(cellCount)));
    const rows = Math.ceil(cellCount / cols);
    const cell = (index: number): [number, number] => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = (col - (cols - 1) / 2) * SPACING_X;
      const z = CENTER_Z - (row - (rows - 1) / 2) * SPACING_Z;
      return [x, z];
    };
    // Reserve the second row's third cell for the empty "for sale" plot; projects fill the rest.
    const reserved = Math.min(cols + 2, cellCount - 1);
    const projIndices: number[] = [];
    for (let i = 0; i < cellCount; i += 1) if (i !== reserved) projIndices.push(i);
    const lots = projects.map((project, k) => ({ project, position: cell(projIndices[k]) }));
    const emptyLot = cell(reserved);
    return { lots, emptyLot, width: cols * SPACING_X, depth: rows * SPACING_Z, centerZ: CENTER_Z };
  }, [projects]);

  const { lots, emptyLot, width, depth, centerZ } = layout;
  const groundW = width + 30;
  const groundD = depth + 34;
  const grass = useGrassTexture(Math.max(6, Math.round(groundW / 8)), Math.max(6, Math.round(groundD / 8)));
  const edgeX = groundW / 2 - 3;
  const frontZ = centerZ + depth / 2 + 4;
  const backZ = centerZ - depth / 2 - 4;
  const pinnedPos = pinnedProjectId ? lots.find((l) => l.project.id === pinnedProjectId)?.position ?? null : null;

  // Tell the camera controls to recenter on a freshly pinned house so its glass card
  // always lands in the visible area (never clipped at a screen edge).
  useEffect(() => {
    if (pinnedPos) focusRef.current = { pos: pinnedPos, nonce: focusRef.current.nonce + 1 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinnedProjectId]);

  return (
    <group>
      {/* Bright grassy meadow that grows with the village. */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, centerZ]}>
        <planeGeometry args={[groundW, groundD]} />
        <meshStandardMaterial map={grass} roughness={0.95} />
      </mesh>
      {/* A few trees hugging the meadow edges for that cozy village feel. */}
      <Tree position={[-edgeX + 1, frontZ]} scale={1.1} />
      <Tree position={[edgeX - 2, frontZ - 2]} scale={0.95} />
      <Tree position={[-edgeX + 2, backZ]} scale={1.15} />
      <Tree position={[edgeX - 1, backZ - 1]} scale={1.05} />
      {lots.map(({ project, position }) => (
        <ProjectHouse
          key={project.id}
          project={project}
          position={position}
          selected={project.id === selectedProjectId}
          dragRef={dragRef}
          onSelect={onSelectProject}
          onHover={onHoverProject}
        />
      ))}
      <EmptyLot position={emptyLot} dragRef={dragRef} onClick={onEmptyLot} />
      {pinnedPos && <HouseAnchor position={pinnedPos} onProject={onPinnedAnchor} />}
    </group>
  );
}

function ProjectHouse({
  project,
  position,
  selected,
  dragRef,
  onSelect,
  onHover,
}: {
  project: ProjectListItem;
  position: [number, number];
  selected: boolean;
  dragRef: DragRef;
  onSelect: (projectId: string) => void;
  onHover: (project: ProjectListItem | null) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const size = normalizeSize(project.projectSize);
  const scale = size === "LARGE" ? 1.26 : size === "MEDIUM" ? 1.04 : 0.86;
  const texture = useNameplateTexture(project.name);
  const active = isInProgress(project.status);
  const wallColor = WALL_COLORS[size];
  const roofColor = ROOF_COLORS[size];
  const { hovered, bind } = useHover((h) => onHover(h ? project : null));

  useFrame(({ clock }) => {
    if (!group.current) return;
    const bob = Math.sin(clock.elapsedTime * 1.4 + position[0]) * 0.08;
    // Lift and gently grow on hover so the house clearly reads as clickable.
    group.current.position.y = bob + (selected ? 0.35 : 0) + (hovered ? 0.5 : 0);
    const target = scale * (hovered ? 1.08 : 1);
    group.current.scale.lerp(new THREE.Vector3(target, target, target), 0.2);
  });

  const click = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    // Ignore the click that ends a camera drag so panning never selects a house.
    if (dragRef.current.moved) return;
    onSelect(project.id);
  };

  return (
    <group ref={group} position={[position[0], 0, position[1]]} scale={[scale, scale, scale]} onClick={click} {...bind}>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <boxGeometry args={[10, 9, 0.18]} />
        <meshStandardMaterial color={selected ? "#d9ddff" : "#cdbfa0"} roughness={0.95} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 2.6, 0]}>
        <boxGeometry args={[7.6, 5.2, 6.8]} />
        <meshStandardMaterial color={wallColor} roughness={0.7} />
      </mesh>
      <GableRoof width={7.6} depth={6.8} y={5.2} rise={2.5} color={roofColor} />
      {/* chimney */}
      <mesh castShadow position={[2.1, 7, -1.4]}>
        <boxGeometry args={[0.9, 2.2, 0.9]} />
        <meshStandardMaterial color="#b9705a" roughness={0.8} />
      </mesh>
      {/* in-progress projects puff smoke from the chimney */}
      {active && <ChimneySmoke position={[2.1, 8.2, -1.4]} />}
      <mesh castShadow position={[0, 1.7, 3.48]}>
        <boxGeometry args={[2, 3.2, 0.2]} />
        <meshStandardMaterial color="#8a5a3c" roughness={0.6} />
      </mesh>
      <mesh castShadow position={[0, 3.7, 3.62]}>
        <boxGeometry args={[6.6, 1.45, 0.2]} />
        <meshStandardMaterial map={texture} color="#f5d57c" metalness={0.1} roughness={0.35} />
      </mesh>
      <LiveWindow active={active} position={[2.25, 2.35, 3.58]} phase={position[0] * 0.17} />
      <LiveWindow active={active} position={[-2.25, 2.35, 3.58]} phase={position[1] * 0.21 + 1.4} />
      <Bush position={[-3, 0.55, 3.4]} />
      {selected && (
        <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[5.8, 6.25, 36]} />
          <meshStandardMaterial color="#4648d4" transparent opacity={0.55} />
        </mesh>
      )}
    </group>
  );
}

function GableRoof({
  width,
  depth,
  y,
  color,
  rise,
  overhang = 0.5,
}: {
  width: number;
  depth: number;
  y: number;
  color: string;
  rise?: number;
  overhang?: number;
}) {
  const roofWidth = width + overhang * 2;
  const roofDepth = depth + overhang * 2;
  const peak = rise ?? width * 0.34;

  // A clean gable roof: a triangular prism whose cross-section sits on top of the
  // walls, with two sloped faces meeting at a ridge and solid triangular gable ends.
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-roofWidth / 2, 0);
    shape.lineTo(roofWidth / 2, 0);
    shape.lineTo(0, peak);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: roofDepth, bevelEnabled: false });
    geo.translate(0, 0, -roofDepth / 2);
    geo.computeVertexNormals();
    return geo;
  }, [roofWidth, roofDepth, peak]);

  return (
    <group position={[0, y, 0]}>
      <mesh castShadow receiveShadow geometry={geometry}>
        <meshStandardMaterial color={color} roughness={0.68} flatShading />
      </mesh>
      {/* ridge cap running along the peak */}
      <mesh castShadow position={[0, peak, 0]}>
        <boxGeometry args={[0.24, 0.22, roofDepth + 0.12]} />
        <meshStandardMaterial color="#2f333c" roughness={0.5} />
      </mesh>
    </group>
  );
}

function LiveWindow({ active, position, phase }: { active: boolean; position: [number, number, number]; phase: number }) {
  const material = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    if (!material.current) return;
    if (!active) {
      material.current.emissiveIntensity = 0.1;
      return;
    }
    // Layered sines create a lively, flickering "someone's working in there" glow.
    const t = clock.elapsedTime;
    const flicker =
      0.7 + Math.sin(t * 6 + phase) * 0.45 + Math.sin(t * 13.7 + phase * 2.3) * 0.3;
    material.current.emissiveIntensity = Math.max(0.2, flicker);
  });

  return (
    <mesh castShadow position={position}>
      <boxGeometry args={[1.2, 1.2, 0.18]} />
      <meshStandardMaterial
        ref={material}
        color={active ? "#fff4b8" : "#eef3f8"}
        emissive={active ? "#ffd85a" : "#d7efff"}
        emissiveIntensity={active ? 0.45 : 0.12}
      />
    </mesh>
  );
}

function EmptyLot({ position, dragRef, onClick }: { position: [number, number]; dragRef: DragRef; onClick: () => void }) {
  const root = useRef<THREE.Group>(null);
  const sign = useRef<THREE.Group>(null);
  const texture = useNameplateTexture("FOR SALE");
  const { hovered, bind } = useHover();
  useFrame(({ clock }) => {
    if (sign.current) {
      // A gentle sway, as if the stake is planted loosely in the empty plot.
      sign.current.rotation.z = Math.sin(clock.elapsedTime * 1.6) * 0.03;
    }
    if (root.current) {
      root.current.position.y = hovered ? 0.5 : 0;
      const target = hovered ? 1.06 : 1;
      root.current.scale.lerp(new THREE.Vector3(target, target, target), 0.2);
    }
  });
  return (
    <group
      ref={root}
      position={[position[0], 0, position[1]]}
      onClick={(event) => { event.stopPropagation(); if (dragRef.current.moved) return; onClick(); }}
      {...bind}
    >
      {/* Bare dirt plot */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <boxGeometry args={[10, 9, 0.18]} />
        <meshStandardMaterial color="#e9e1c8" roughness={0.95} />
      </mesh>
      {/* A '+' etched into the dirt — "add a new project here". */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.16, 0]}>
        <planeGeometry args={[5.4, 1.5]} />
        <meshStandardMaterial color="#b89a63" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.161, 0]}>
        <planeGeometry args={[1.5, 5.4]} />
        <meshStandardMaterial color="#b89a63" roughness={1} />
      </mesh>
      {/* FOR SALE stake driven into the front edge of the plot */}
      <group ref={sign} position={[0, 0, 3.4]}>
        {/* pointed stake tip */}
        <mesh castShadow position={[0, 0.18, 0]}>
          <coneGeometry args={[0.22, 0.5, 4]} />
          <meshStandardMaterial color="#6f5133" roughness={0.85} />
        </mesh>
        {/* the stake / 말뚝 */}
        <mesh castShadow position={[0, 1.55, 0]}>
          <boxGeometry args={[0.3, 3.1, 0.3]} />
          <meshStandardMaterial color="#8f6844" roughness={0.8} />
        </mesh>
        {/* FOR SALE board mounted near the top, in front of the stake so the pole
            never pokes over the nameplate. */}
        <mesh castShadow position={[0, 2.7, 0.3]}>
          <boxGeometry args={[5.4, 1.7, 0.16]} />
          <meshStandardMaterial map={texture} color="#f3e4c4" roughness={0.6} />
        </mesh>
      </group>
      <mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[4.8, 5.2, 4]} />
        <meshStandardMaterial color="#d7b171" transparent opacity={0.75} />
      </mesh>
    </group>
  );
}

function ScaleHouse({
  size,
  x,
  selected,
  dimmed = false,
  onPick,
}: {
  size: ProjectSize;
  x: number;
  selected: boolean;
  dimmed?: boolean;
  onPick: (size: ProjectSize) => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const wallColor = WALL_COLORS[size];
  const roofColor = ROOF_COLORS[size];
  const scale = size === "SMALL" ? 0.78 : size === "MEDIUM" ? 1 : 1.24;
  const texture = useNameplateTexture(SIZE_LABELS[size]);
  const { hovered, bind } = useHover();
  const interactive = hovered && !dimmed;
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const bob = dimmed ? 0.03 : 0.08;
    ref.current.position.y = 3.2 + Math.sin(clock.elapsedTime * 1.5 + x) * bob + (interactive ? 0.5 : 0);
    const target = scale * (interactive ? 1.08 : 1);
    ref.current.scale.lerp(new THREE.Vector3(target, target, target), 0.2);
  });
  return (
    <group
      ref={ref}
      position={[x, 3.2, 0]}
      scale={[scale, scale, scale]}
      onClick={(event) => {
        if (dimmed) return;
        event.stopPropagation();
        onPick(size);
      }}
      {...(dimmed ? {} : bind)}
    >
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.15, 0]}>
        <boxGeometry args={[8.6, 7.6, 0.18]} />
        <meshStandardMaterial color={selected ? "#d9ddff" : "#cdbfa0"} roughness={0.9} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[5.8, 4.2, 5.2]} />
        <meshStandardMaterial color={selected ? "#4648d4" : wallColor} roughness={0.62} />
      </mesh>
      <GableRoof width={5.8} depth={5.2} y={2.1} rise={1.9} color={roofColor} />
      <mesh castShadow position={[0, -0.85, 2.7]}>
        <boxGeometry args={[1.45, 2.35, 0.2]} />
        <meshStandardMaterial color="#35586f" roughness={0.6} />
      </mesh>
      <mesh castShadow position={[0, 0.9, 2.84]}>
        <boxGeometry args={[3.5, 0.9, 0.18]} />
        <meshStandardMaterial map={texture} color="#f4d47a" metalness={0.2} roughness={0.38} />
      </mesh>
      {selected && (
        <mesh position={[0, -3.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[4.7, 5.12, 36]} />
          <meshStandardMaterial color="#4648d4" transparent opacity={0.55} />
        </mesh>
      )}
      <mesh position={[0, -3.04, -3.7]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.2, 2.45, 4]} />
        <meshStandardMaterial color="#c6d0ca" />
      </mesh>
    </group>
  );
}
