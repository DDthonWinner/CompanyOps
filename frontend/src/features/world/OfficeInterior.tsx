import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Agent, Snapshot } from "../../api/types";

type Vec = [number, number, number];
const SKIN = ["#b97e5c", "#e4b695", "#895f47", "#d6a081", "#c29173"];
const CLOTH = ["#c2bcb0", "#435b62", "#a2927c", "#657465", "#383d50"];

function Block({ at, size, color, metal = 0, radius = 0.025 }: { at: Vec; size: Vec; color: string; metal?: number; radius?: number }) {
  const geometry = useMemo(() => new RoundedBoxGeometry(...size, 2, Math.min(radius, ...size.map((n) => n / 4))), [size[0], size[1], size[2], radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh position={at} geometry={geometry} castShadow receiveShadow><meshStandardMaterial color={color} metalness={metal} roughness={metal ? 0.35 : 0.75} /></mesh>;
}

function Limb({ a, b, radius, color }: { a: Vec; b: Vec; radius: number; color: string }) {
  const { position, rotation, length } = useMemo(() => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const direction = end.clone().sub(start);
    return { position: start.add(end).multiplyScalar(0.5), rotation: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize()), length: direction.length() };
  }, [a.join(), b.join()]);
  return <mesh position={position} quaternion={rotation} castShadow><capsuleGeometry args={[radius, Math.max(0.01, length - radius * 2), 5, 10]} /><meshStandardMaterial color={color} roughness={0.83} /></mesh>;
}

export function OfficeWorker({ index, working, reducedMotion, onSelect }: { index: number; working: boolean; reducedMotion: boolean; onSelect?: () => void }) {
  const upper = useRef<THREE.Group>(null!);
  const leftHand = useRef<THREE.Group>(null!);
  const rightHand = useRef<THREE.Group>(null!);
  const skin = SKIN[index % SKIN.length], cloth = CLOTH[index % CLOTH.length];
  useFrame(({ clock }) => {
    const time = reducedMotion ? 0 : clock.elapsedTime;
    upper.current.rotation.x = working && !reducedMotion ? Math.sin(time * 1.3 + index) * 0.018 : 0;
    leftHand.current.position.y = working && !reducedMotion ? Math.sin(time * 12 + index) * 0.009 : 0;
    rightHand.current.position.y = working && !reducedMotion ? Math.cos(time * 10 + index) * 0.009 : 0;
  });
  return <group onClick={(event) => { if (onSelect) { event.stopPropagation(); onSelect(); } }}>
    {/* Seated anatomy: shoes, calves, thighs, pelvis, clothing, and articulated arms. */}
    {[-1, 1].map((side) => <group key={side}>
      <Block at={[side * 0.14, 0.065, -0.44]} size={[0.18, 0.13, 0.34]} color="#292b2a" radius={0.05} />
      <Limb a={[side * 0.14, 0.17, -0.35]} b={[side * 0.14, 0.56, -0.34]} radius={0.083} color="#303940" />
      <Limb a={[side * 0.14, 0.56, -0.34]} b={[side * 0.12, 0.59, 0.1]} radius={0.105} color="#303940" />
    </group>)}
    <group ref={upper}>
      <mesh position={[0, 0.94, 0.045]} scale={[0.39, 0.52, 0.24]} castShadow><sphereGeometry args={[0.6, 20, 18]} /><meshStandardMaterial color={cloth} roughness={0.92} /></mesh>
      <Limb a={[0, 1.14, 0.02]} b={[0, 1.3, -0.025]} radius={0.063} color={skin} />
      <group position={[0, 1.4, -0.06]} rotation={[-0.08, 0, 0]}>
        <mesh scale={[0.125, 0.172, 0.135]} castShadow><sphereGeometry args={[1, 24, 20]} /><meshStandardMaterial color={skin} roughness={0.68} /></mesh>
        <mesh position={[0, 0.06, 0.015]} scale={[0.133, 0.135, 0.138]} castShadow><sphereGeometry args={[1, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.62]} /><meshStandardMaterial color={index % 3 === 0 ? "#4d3829" : "#242321"} roughness={0.96} /></mesh>
        <mesh position={[0, -0.008, -0.135]} scale={[0.022, 0.03, 0.027]}><sphereGeometry args={[1, 10, 10]} /><meshStandardMaterial color={skin} /></mesh>
        {[-1, 1].map((side) => <group key={side}>
          <mesh position={[side * 0.047, 0.025, -0.122]}><sphereGeometry args={[0.01, 8, 8]} /><meshStandardMaterial color="#292925" /></mesh>
          <mesh position={[side * 0.124, 0, 0]} scale={[0.018, 0.036, 0.023]}><sphereGeometry args={[1, 10, 10]} /><meshStandardMaterial color={skin} /></mesh>
        </group>)}
      </group>
      {[-1, 1].map((side) => <group key={side}>
        <Limb a={[side * 0.2, 1.1, 0.03]} b={[side * 0.27, 0.86, -0.09]} radius={0.077} color={cloth} />
        <Limb a={[side * 0.27, 0.86, -0.09]} b={[side * 0.19, 0.9, -0.44]} radius={0.053} color={skin} />
        <group ref={side < 0 ? leftHand : rightHand}><Block at={[side * 0.19, 0.915, -0.47]} size={[0.095, 0.04, 0.14]} color={skin} radius={0.018} /></group>
      </group>)}
    </group>
  </group>;
}

function WorkScreen({ name, status, task, accent }: { name: string; status: string; task: string; accent: string }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = 360;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#101d25"; ctx.fillRect(0, 0, 640, 360);
    ctx.fillStyle = accent; ctx.fillRect(0, 0, 640, 5);
    ctx.fillStyle = "#d7e8e4"; ctx.font = "500 29px system-ui"; ctx.fillText(name.slice(0, 26), 30, 56);
    ctx.fillStyle = "#84b8a2"; ctx.font = "20px system-ui"; ctx.fillText(status, 30, 90);
    ctx.fillStyle = "#b7c9cc"; ctx.font = "20px system-ui";
    const words = task.match(/.{1,32}/g) ?? [];
    words.slice(0, 3).forEach((line, index) => ctx.fillText(line, 30, 150 + index * 32));
    ctx.fillStyle = "#28414a"; ctx.fillRect(30, 287, 580, 1);
    ctx.fillStyle = "#91a6aa"; ctx.font = "17px monospace"; ctx.fillText("AI-DLC  /  CompanyOps", 30, 326);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; return map;
  }, [name, status, task, accent]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh position={[0, 1.3, -0.24]}><planeGeometry args={[0.99, 0.55]} /><meshStandardMaterial map={texture} emissiveMap={texture} emissive="#ffffff" emissiveIntensity={0.45} roughness={0.3} /></mesh>;
}

function Plant({ at }: { at: Vec }) {
  return <group position={at}>
    <mesh position={[0, 0.28, 0]} castShadow><cylinderGeometry args={[0.3, 0.23, 0.56, 24]} /><meshStandardMaterial color="#a4a295" roughness={0.9} /></mesh>
    {Array.from({ length: 9 }, (_, n) => <group key={n} rotation={[0, n * 2.4, 0]}>
      <Limb a={[0, 0.45, 0]} b={[0.28, 1 + n * 0.09, 0]} radius={0.015} color="#4f6348" />
      <mesh position={[0.27, 1.02 + n * 0.09, 0]} rotation={[0.2, 0, -0.6]} scale={[0.13, 0.34, 0.045]} castShadow><sphereGeometry args={[1, 12, 10]} /><meshStandardMaterial color={n % 2 ? "#3c674c" : "#587550"} roughness={0.8} /></mesh>
    </group>)}
  </group>;
}

export function OfficeInterior({ snapshot, reducedMotion = false, preview = false, compact = false }: { snapshot?: Snapshot | null; reducedMotion?: boolean; preview?: boolean; compact?: boolean }) {
  const realAgents = snapshot?.agents.filter((agent) => agent.status !== "REMOVED") ?? [];
  const seats: (Agent | null)[] = realAgents.length ? realAgents : Array.from({ length: preview ? 8 : 5 }, () => null);
  const rows = Math.max(2, Math.ceil(seats.length / 5));
  const officeDepth = Math.max(16, rows * 4.4 + 5);
  const floor = useMemo(() => {
    const geo = new THREE.PlaneGeometry(26, officeDepth);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 26, uv.getY(i) * officeDepth);
    return geo;
  }, [officeDepth]);
  useEffect(() => () => floor.dispose(), [floor]);
  return <group>
    <mesh geometry={floor} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><meshStandardMaterial color="#555c58" roughness={0.94} onBeforeCompile={(shader) => {
      shader.vertexShader = 'varying vec2 vFloorUV;\n' + shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvFloorUV = uv;');
      shader.fragmentShader = 'varying vec2 vFloorUV;\n' + shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nfloat seam = step(0.025, fract(vFloorUV.x * 0.5)) * step(0.025, fract(vFloorUV.y * 0.5));\nfloat grain = fract(sin(dot(vFloorUV, vec2(12.9898,78.233))) * 43758.5453);\ndiffuseColor.rgb *= (0.83 + grain * 0.13) * (0.82 + seam * 0.18);');
    }} /></mesh>
    <Block at={[0, -0.17, 0]} size={[26.2, 0.3, officeDepth + 0.2]} color="#6b716c" />
    <Block at={[0, 3.1, -officeDepth / 2]} size={[26, 6.2, 0.22]} color="#a1a89e" />
    <Block at={[-13, 3.1, 0]} size={[0.22, 6.2, officeDepth]} color="#637976" />
    {!compact && <>
      <mesh position={[13, 3, 0]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[officeDepth, 6]} /><meshPhysicalMaterial color="#9dced4" transparent opacity={0.12} roughness={0.08} metalness={0.4} side={THREE.DoubleSide} depthWrite={false} /></mesh>
      {Array.from({ length: 9 }, (_, i) => <Block key={i} at={[13, 3, -officeDepth / 2 + i * officeDepth / 8]} size={[0.12, 6, 0.12]} color="#425859" metal={0.75} />)}
    </>}
    {[-9, -3, 3, 9].map((x) => <group key={x}>
      <Block at={[x, 5.4, -1]} size={[0.09, 0.14, 12]} color="#3a4949" metal={0.6} />
      <mesh position={[x, 5.32, -1]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[0.055, 11.8]} /><meshBasicMaterial color="#fff1d2" toneMapped={false} /></mesh>
    </group>)}
    {seats.map((agent, index) => {
      const x = (index % 5 - 2) * 4.4, z = -3 + Math.floor(index / 5) * 4.4;
      const task = snapshot?.tasks.find((item) => item.id === agent?.currentTaskId);
      const status = agent?.status ?? "공간 미리보기";
      const select = undefined; // Opening scene only; interaction belongs to the untouched Tycoon app.
      return <group key={agent?.id ?? index} position={[x, 0, z]}>
        <Block at={[0, 0.86, 0]} size={[3.2, 0.09, 1.6]} color="#b3a087" radius={0.06} />
        {[-1.38, 1.38].map((dx) => <Block key={dx} at={[dx, 0.42, 0]} size={[0.065, 0.84, 1.3]} color="#344346" metal={0.7} />)}
        <group>
          <Block at={[0, 1.3, -0.29]} size={[1.08, 0.64, 0.08]} color="#1c272b" metal={0.65} />
          <Block at={[0, 0.98, -0.32]} size={[0.065, 0.24, 0.08]} color="#4b575a" metal={0.8} />
          <Block at={[0, 0.918, -0.31]} size={[0.38, 0.03, 0.23]} color="#687173" metal={0.8} />
          <WorkScreen name={agent?.displayName ?? "CompanyOps"} status={status} task={task?.title ?? agent?.activitySummary ?? (agent ? "다음 작업을 기다리고 있습니다." : "AI 팀이 함께 일할 공간입니다.")} accent={agent?.displayColor ?? "#89b9a5"} />
        </group>
        <Block at={[0, 0.929, 0.47]} size={[0.68, 0.025, 0.25]} color="#475354" radius={0.01} />
        <Block at={[0.55, 0.935, 0.48]} size={[0.13, 0.04, 0.2]} color="#c2c5be" radius={0.035} />
        <mesh position={[1.02, 1.02, -0.06]} castShadow><cylinderGeometry args={[0.07, 0.06, 0.2, 20]} /><meshStandardMaterial color="#b9c5b5" roughness={0.6} /></mesh>
        <Block at={[-1.1, 0.93, 0.2]} size={[0.4, 0.035, 0.52]} color="#5a786d" />
        <group position={[0, 0, 1.05]}>
          <Block at={[0, 0.52, 0]} size={[0.6, 0.11, 0.57]} color="#344448" radius={0.065} />
          <Block at={[0, 0.85, 0.26]} size={[0.57, 0.63, 0.09]} color="#384c4f" radius={0.08} />
          <Limb a={[0, 0.1, 0]} b={[0, 0.5, 0]} radius={0.045} color="#6a7374" />
          {Array.from({ length: 5 }, (_, n) => <group key={n} rotation={[0, n * Math.PI * 0.4, 0]}><Block at={[0.19, 0.1, 0]} size={[0.4, 0.05, 0.04]} color="#59666a" metal={0.8} /><mesh position={[0.37, 0.06, 0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.055, 0.055, 0.05, 12]} /><meshStandardMaterial color="#282f30" /></mesh></group>)}
          {(agent || preview) && <OfficeWorker index={index} working={agent ? agent.status === "WORKING" : true} reducedMotion={reducedMotion} onSelect={select} />}
        </group>
      </group>;
    })}
    {[-11.8, 11.8].map((x) => <Plant key={x} at={[x, 0, -officeDepth / 2 + 1.1]} />)}
    <Block at={[-9, 0.48, officeDepth / 2 - 1]} size={[5.4, 0.9, 1.4]} color="#7d8980" radius={0.18} />
    <Block at={[-9, 1.03, officeDepth / 2 - 1.55]} size={[5.4, 0.65, 0.3]} color="#758176" radius={0.1} />
  </group>;
}
