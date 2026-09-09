import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { api } from "../../api/client";
import type { ProjectListItem } from "../../api/types";
import { Button } from "../../components/ui/Button";
import { pushToast } from "../../components/ui/toast";
import { useStore } from "../../store/useStore";
import { runWrite } from "../dashboard/actions";
import "./projectCreationGate.css";

type GateStage = "select" | "name" | "size" | "description" | "creating";
type ProjectSize = "SMALL" | "MEDIUM" | "LARGE";

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
  const [stage, setStage] = useState<GateStage>("select");
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [listState, setListState] = useState<"loading" | "ready" | "error">("loading");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectSize, setProjectSize] = useState<ProjectSize | null>(null);

  const trimmedName = name.trim();
  const canSubmit = trimmedName.length > 0 && description.trim().length > 0 && projectSize;
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;

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
    setStage("name");
  };

  const enterSelectedProject = () => {
    if (!selectedProject) {
      pushToast("입장할 프로젝트 집을 선택하세요.", "error");
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

  const submit = async () => {
    if (!canSubmit) {
      pushToast("프로젝트 정보를 완성하세요.", "error");
      return;
    }
    setStage("creating");
    const res = await runWrite(() =>
      api.createProject({
        name: trimmedName,
        description: description.trim(),
        budgetLevel: "MEDIUM",
        projectSize,
        gitRepository: { repositoryUrl: "https://github.com/DDthonWinner/TestOutput" },
      }),
    );
    if (res && (res as any).id) {
      setActiveProject((res as any).id);
      window.dispatchEvent(new CustomEvent("companyops:projects-changed"));
      pushToast("프로젝트 문이 열렸습니다.", "success");
    } else {
      setStage("description");
    }
  };

  return (
    <div className="project-gate" data-testid="project-creation-gate">
      <Canvas
        shadows
        orthographic
        camera={{ position: [34, 32, 34], zoom: FOCUS.select.zoom, near: 0.1, far: 1000 }}
        className="project-gate-canvas"
      >
        <color attach="background" args={["#eef3f8"]} />
        <ambientLight intensity={0.82} />
        <directionalLight position={[12, 20, 10]} intensity={1.2} castShadow />
        <GateCamera stage={stage} />
        <GateScene
          stage={stage}
          projects={projects}
          selectedProjectId={selectedProjectId}
          projectName={trimmedName}
          projectSize={projectSize}
          onSelectProject={setSelectedProjectId}
          onEmptyLot={startNewProject}
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
            <h1>프로젝트 선택</h1>
            <p>프로젝트 마을에서 들어갈 집을 선택해서 들어가세요.</p>
            <div className="project-gate-actions project-gate-actions--split">
              <Button variant="ghost" onClick={startNewProject}>빈 부지 선택</Button>
              <Button onClick={enterSelectedProject} disabled={!selectedProject}>프로젝트 들어가기</Button>
            </div>
            <div className="project-gate-project-list" aria-live="polite">
              {listState === "loading" && <span>집 목록을 불러오는 중...</span>}
              {listState === "error" && <span>프로젝트 목록을 불러오지 못했습니다.</span>}
              {listState === "ready" && projects.length === 0 && <span>아직 지어진 프로젝트 집이 없습니다.</span>}
              {selectedProject && <span>선택됨: {selectedProject.name}</span>}
            </div>
          </section>
        )}

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
              <Button onClick={submit} disabled={!canSubmit}>프로젝트 생성</Button>
            </div>
          </section>
        )}

        {stage === "creating" && (
          <section className="project-gate-panel project-gate-panel--intro" role="status">
            <span className="project-gate-kicker">Creating</span>
            <h2>오피스를 준비하는 중</h2>
            <p>프로젝트 문을 열고, 기존 CompanyOps 워크스페이스에 연결하고 있습니다.</p>
          </section>
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

function normalizeSize(size: string | undefined): ProjectSize {
  if (size === "LARGE" || size === "MEDIUM" || size === "SMALL") return size;
  return "MEDIUM";
}

function useNameplateTexture(label: string) {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#f5d57c";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#9d793d";
      ctx.lineWidth = 10;
      ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
      ctx.fillStyle = "#253044";
      ctx.font = "700 34px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const text = label.trim() || "EMPTY LOT";
      const clipped = text.length > 18 ? `${text.slice(0, 17)}...` : text;
      ctx.fillText(clipped, canvas.width / 2, canvas.height / 2 + 2, canvas.width - 52);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }, [label]);
}

function GateScene({
  stage,
  projects,
  selectedProjectId,
  projectName,
  projectSize,
  onSelectProject,
  onEmptyLot,
  onPickSize,
}: {
  stage: GateStage;
  projects: ProjectListItem[];
  selectedProjectId: string | null;
  projectName: string;
  projectSize: ProjectSize | null;
  onSelectProject: (projectId: string) => void;
  onEmptyLot: () => void;
  onPickSize: (size: ProjectSize) => void;
}) {
  if (stage === "select") {
    return (
      <ProjectVillage
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={onSelectProject}
        onEmptyLot={onEmptyLot}
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
  // The three houses only become pickable once the nameplate is done (past the name step).
  const canPick = stage !== "name";
  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 4]}>
        <planeGeometry args={[52, 42]} />
        <meshStandardMaterial color="#dbe5dc" />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 4]}>
        <boxGeometry args={[38, 19, 0.16]} />
        <meshStandardMaterial color="#e9e1c8" roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0, 1.25, 14]}>
        <boxGeometry args={[8.6, 1.5, 0.28]} />
        <meshStandardMaterial map={nameplate} color="#f5d57c" />
      </mesh>
      <mesh castShadow position={[0, 0.6, 14]}>
        <boxGeometry args={[0.28, 1.35, 0.28]} />
        <meshStandardMaterial color="#8f6844" />
      </mesh>
      <ScaleHouse size="SMALL" x={-13} selected={projectSize === "SMALL"} dimmed={!canPick} onPick={onPickSize} />
      <ScaleHouse size="MEDIUM" x={0} selected={projectSize === "MEDIUM"} dimmed={!canPick} onPick={onPickSize} />
      <ScaleHouse size="LARGE" x={13} selected={projectSize === "LARGE"} dimmed={!canPick} onPick={onPickSize} />
    </group>
  );
}

function ProjectVillage({
  projects,
  selectedProjectId,
  onSelectProject,
  onEmptyLot,
}: {
  projects: ProjectListItem[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onEmptyLot: () => void;
}) {
  const lots = useMemo(() => {
    const positions: Array<[number, number]> = [[-17, -8], [0, -9], [17, -8], [-12, -23], [12, -23], [-25, -22]];
    return projects.slice(0, 6).map((project, index) => ({ project, position: positions[index] ?? [0, 0] as [number, number] }));
  }, [projects]);

  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, -8]}>
        <planeGeometry args={[64, 56]} />
        <meshStandardMaterial color="#dbe5dc" />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, -8]}>
        <ringGeometry args={[10, 12, 4]} />
        <meshStandardMaterial color="#bec9c1" />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, -8]}>
        <planeGeometry args={[9, 48]} />
        <meshStandardMaterial color="#c6d0ca" />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[0, -0.02, -8]}>
        <planeGeometry args={[8, 60]} />
        <meshStandardMaterial color="#c6d0ca" />
      </mesh>
      {lots.map(({ project, position }) => (
        <ProjectHouse
          key={project.id}
          project={project}
          position={position}
          selected={project.id === selectedProjectId}
          onSelect={onSelectProject}
        />
      ))}
      <EmptyLot position={[0, 13]} onClick={onEmptyLot} />
    </group>
  );
}

function ProjectHouse({
  project,
  position,
  selected,
  onSelect,
}: {
  project: ProjectListItem;
  position: [number, number];
  selected: boolean;
  onSelect: (projectId: string) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const size = normalizeSize(project.projectSize);
  const scale = size === "LARGE" ? 1.26 : size === "MEDIUM" ? 1.04 : 0.86;
  const texture = useNameplateTexture(project.name);
  const active = project.status !== "COMPLETED" && project.status !== "CANCELLED";
  const wallColor = size === "LARGE" ? "#9b789f" : size === "MEDIUM" ? "#7089ac" : "#6f9b87";

  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.position.y = Math.sin(clock.elapsedTime * 1.4 + position[0]) * 0.08 + (selected ? 0.35 : 0);
  });

  const click = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(project.id);
  };

  return (
    <group ref={group} position={[position[0], 0, position[1]]} scale={[scale, scale, scale]} onClick={click}>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <boxGeometry args={[10, 9, 0.18]} />
        <meshStandardMaterial color={selected ? "#d9ddff" : "#cad6cf"} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 2.6, 0]}>
        <boxGeometry args={[7.6, 5.2, 6.8]} />
        <meshStandardMaterial color={wallColor} roughness={0.7} />
      </mesh>
      <GableRoof width={7.6} depth={6.8} y={5.2} rise={2.5} color="#4a4d59" />
      <mesh castShadow position={[0, 1.7, 3.48]}>
        <boxGeometry args={[2, 3.2, 0.2]} />
        <meshStandardMaterial color="#35586f" roughness={0.6} />
      </mesh>
      <mesh castShadow position={[0, 3.6, 3.6]}>
        <boxGeometry args={[5.9, 1.15, 0.18]} />
        <meshStandardMaterial map={texture} color="#f5d57c" metalness={0.1} roughness={0.35} />
      </mesh>
      <LiveWindow active={active} position={[2.25, 2.35, 3.58]} phase={position[0] * 0.17} />
      <LiveWindow active={active} position={[-2.25, 2.35, 3.58]} phase={position[1] * 0.21 + 1.4} />
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

function EmptyLot({ position, onClick }: { position: [number, number]; onClick: () => void }) {
  const sign = useRef<THREE.Group>(null);
  const texture = useNameplateTexture("FOR SALE");
  useFrame(({ clock }) => {
    if (!sign.current) return;
    // A gentle sway, as if the stake is planted loosely in the empty plot.
    sign.current.rotation.z = Math.sin(clock.elapsedTime * 1.6) * 0.03;
  });
  return (
    <group position={[position[0], 0, position[1]]} onClick={(event) => { event.stopPropagation(); onClick(); }}>
      {/* Bare dirt plot */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <boxGeometry args={[10, 9, 0.18]} />
        <meshStandardMaterial color="#e9e1c8" roughness={0.95} />
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
        {/* FOR SALE board mounted near the top */}
        <mesh castShadow position={[0, 2.7, 0.06]}>
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
  const color = size === "SMALL" ? "#5f8f7c" : size === "MEDIUM" ? "#5c75a8" : "#8d6b9c";
  const scale = size === "SMALL" ? 0.78 : size === "MEDIUM" ? 1 : 1.24;
  const texture = useNameplateTexture(SIZE_LABELS[size]);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const bob = dimmed ? 0.03 : 0.08;
    ref.current.position.y = 3.2 + Math.sin(clock.elapsedTime * 1.5 + x) * bob;
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
    >
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.15, 0]}>
        <boxGeometry args={[8.6, 7.6, 0.18]} />
        <meshStandardMaterial color={selected ? "#d9ddff" : "#e9e1c8"} roughness={0.9} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[5.8, 4.2, 5.2]} />
        <meshStandardMaterial color={selected ? "#4648d4" : color} roughness={0.62} />
      </mesh>
      <GableRoof width={5.8} depth={5.2} y={2.1} rise={1.9} color="#4a4d59" />
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
