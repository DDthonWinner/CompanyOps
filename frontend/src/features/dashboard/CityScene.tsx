// Prototype geometry re-expressed in the existing R3F renderer. R3F owns mesh disposal.
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CityMascot } from "./CityMascot";
import { ROLE_LABEL, roleColor } from "../../lib/roles";
import { CITY_POSITION, type CityNode, type CityRole } from "./cityModel";

function Controls({ reset }: { reset: number }) {
  const { camera, gl, invalidate, size } = useThree();
  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    camera.position.set(11, 12, 14);
    controls.target.set(0, 1, 0);
    controls.enablePan = false;
    controls.minZoom = 0.7;
    controls.maxZoom = 1.8;
    // Orthographic zoom uses a responsive base; perspective distance is clamped instead.
    controls.minDistance = 15;
    controls.maxDistance = 33;
    controls.minPolarAngle = 0.35;
    controls.maxPolarAngle = 1.2;
    const changed = () => invalidate();
    controls.addEventListener("change", changed);
    controls.update();
    invalidate();
    return () => { controls.removeEventListener("change", changed); controls.dispose(); };
  }, [camera, gl, invalidate, reset]);
  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = size.width < 500 ? 53 : 40;
      camera.updateProjectionMatrix();
      invalidate();
    }
  }, [camera, size.width, invalidate]);
  return null;
}

function Label({ text, color, y }: { text: string; color: string; y: number }) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 180;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 512, 180);
    ctx.fillStyle = color; ctx.fillRect(0, 0, 8, 180);
    ctx.font = "600 58px sans-serif"; ctx.textAlign = "center";
    const [role, ...details] = text.split(" · ");
    ctx.fillText(role, 256, 76);
    ctx.fillStyle = "#344159"; ctx.font = "36px sans-serif";
    ctx.fillText(details.join(" · "), 256, 138);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    setTexture(map);
    return () => map.dispose();
  }, [text, color]);
  return texture ? <sprite position={[0, y, 0]} scale={[3.3, 1.16, 1]}>
    <spriteMaterial map={texture} depthTest={false} toneMapped={false} />
  </sprite> : null;
}

function Cylinder({ radius, height, y, color = "#ffffff" }: { radius: number; height: number; y: number; color?: string }) {
  return <mesh position={[0, y, 0]} castShadow receiveShadow>
    <cylinderGeometry args={[radius, radius, height, 32]} />
    <meshStandardMaterial color={color} roughness={0.35} metalness={0.15} />
  </mesh>;
}


function Building({ node, animate, onSelect }: { node: CityNode; animate: boolean; onSelect: (role: CityRole) => void }) {
  const rotor = useRef<THREE.Mesh>(null);
  const color = roleColor(node.role);
  const h = { PM: 2.6, FRONTEND: 3.4, BACKEND: 4, QA: 2.8 }[node.role];
  const status = node.blocked ? "차단/실패" : node.running ? "실행 중" : node.waiting ? "대기/검토" : "대기";
  const glow = node.blocked ? "#ba1a1a" : node.waiting ? "#d97706" : color;
  useFrame((_, delta) => {
    if (rotor.current && animate && node.running) rotor.current.rotation.y += Math.min(delta, 0.05) * 0.6;
  });
  return <group position={CITY_POSITION[node.role]} onClick={(e) => {
    e.stopPropagation();
    if (e.delta < 5) onSelect(node.role);
  }}>
    <Cylinder radius={1.65} height={0.22} y={0.12} />
    <Cylinder radius={1.5} height={0.12} y={0.3} color={color} />
    <mesh position={[0, h / 2 + 0.4, 0]} castShadow>
      {node.role === "FRONTEND" ? <boxGeometry args={[2, h, 2]} /> : <cylinderGeometry args={[1.1, 1.1, h, 32]} />}
      <meshPhysicalMaterial color={color} transparent opacity={node.agents.length ? 0.55 : 0.18} roughness={0.18} metalness={0.12} clearcoat={1} depthWrite={false} />
    </mesh>
    {Array.from({ length: 5 }, (_, i) => <Cylinder key={i} radius={1.15} height={0.08} y={0.5 + i * h / 5} />)}
    {[0, 1, 2, 3].map((i) => <mesh key={i} position={[Math.cos(i * Math.PI / 2 + Math.PI / 4) * 1.05, h / 2 + 0.4, Math.sin(i * Math.PI / 2 + Math.PI / 4) * 1.05]} castShadow>
      <boxGeometry args={[0.1, h, 0.1]} /><meshStandardMaterial color="white" />
    </mesh>)}
    <Cylinder radius={1.25} height={0.18} y={h + 0.45} />
    <mesh position={[0, h + 0.58, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.9, 0.045, 8, 48]} /><meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={node.running ? 0.7 : 0.15} />
    </mesh>
    <mesh ref={rotor} position={[0, h + 1.1, 0]}>
      <octahedronGeometry args={[0.45]} /><meshStandardMaterial color={color} metalness={0.35} roughness={0.2} />
    </mesh>
    <Label text={`${ROLE_LABEL[node.role]} · ${node.percent}% · ${status}`} color={color} y={h + 2} />
    {!!node.agents.length && <group position={[1.65, 0.2, 1]} scale={0.65}><CityMascot accent={color} /></group>}
  </group>;
}

function Path({ from, to, active }: { from: CityRole; to: CityRole; active: boolean }) {
  const dot = useRef<THREE.Mesh>(null);
  const phase = useRef(0);
  const curve = useMemo(() => {
    const a = new THREE.Vector3(...CITY_POSITION[from]); a.y = 0.18;
    const b = new THREE.Vector3(...CITY_POSITION[to]); b.y = 0.18;
    return new THREE.CatmullRomCurve3([a, new THREE.Vector3((a.x + b.x) / 2, 0.18, (a.z + b.z) / 2 + 0.5), b]);
  }, [from, to]);
  useFrame((_, delta) => {
    if (active && dot.current) {
      phase.current = (phase.current + Math.min(delta, 0.05) * 0.22) % 1;
      dot.current.position.copy(curve.getPoint(phase.current));
    }
  });
  return <group>
    <mesh><tubeGeometry args={[curve, 32, 0.12, 8, false]} /><meshStandardMaterial color="white" /></mesh>
    <mesh><tubeGeometry args={[curve, 32, 0.04, 8, false]} /><meshBasicMaterial color={roleColor(to)} /></mesh>
    <mesh ref={dot} visible={active} position={CITY_POSITION[from]}><sphereGeometry args={[0.11, 12, 8]} /><meshBasicMaterial color="#ffffff" /></mesh>
  </group>;
}

function ContextGuard({ onLost }: { onLost: () => void }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const lost = (event: Event) => { event.preventDefault(); onLost(); };
    gl.domElement.addEventListener("webglcontextlost", lost);
    return () => gl.domElement.removeEventListener("webglcontextlost", lost);
  }, [gl, onLost]);
  return null;
}

export default function CityScene({ nodes, effects, reset, onSelect }: {
  nodes: CityNode[]; effects: boolean; reset: number; onSelect: (role: CityRole) => void;
}) {
  const [lost, setLost] = useState(false);
  const [reduced, setReduced] = useState(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  const [visible, setVisible] = useState(true);
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    if (host.current) observer.observe(host.current);
    return () => { media.removeEventListener("change", update); observer.disconnect(); };
  }, []);
  const animate = effects && !reduced && visible;
  const paths: [CityRole, CityRole][] = [["PM", "FRONTEND"], ["PM", "BACKEND"], ["FRONTEND", "QA"], ["BACKEND", "QA"]];
  return <div ref={host} className="h-full w-full">
    {lost ? <div role="status" className="p-6 text-sm">3D 그래픽 연결이 중단되었습니다. 아래 목록을 이용하거나 흐름도로 전환하세요.</div> :
      <Canvas shadows dpr={[1, 1.5]} frameloop={animate && nodes.some((n) => n.running) ? "always" : "demand"}
        camera={{ position: [11, 12, 14], fov: 40, near: 0.1, far: 100 }}
        fallback={<div role="status" className="p-6 text-sm">WebGL을 사용할 수 없습니다. 아래 에이전트 목록을 이용하세요.</div>}>
        <ContextGuard onLost={() => setLost(true)} />
        <color attach="background" args={["#f0effa"]} />
        <ambientLight intensity={1.5} />
        <directionalLight position={[-6, 14, 8]} intensity={3} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} shadow-bias={-0.001} />
        <directionalLight position={[8, 6, -8]} intensity={1.5} color="#c6d9ff" />
        <Cylinder radius={8.7} height={0.25} y={-0.2} color="#e3e1f2" />
        <gridHelper args={[13, 26, "#d1cce5", "#ddd9ed"]} position={[0, -0.06, 0]} />
        {paths.map(([from, to]) => <Path key={`${from}-${to}`} from={from} to={to} active={animate && !!nodes.find((n) => n.role === from)?.running} />)}
        {nodes.map((node) => <Building key={node.role} node={node} animate={animate} onSelect={onSelect} />)}
        <Controls reset={reset} />
      </Canvas>}
  </div>;
}
