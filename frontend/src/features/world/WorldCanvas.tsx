import { OfficeInterior } from "./OfficeInterior";
import type { Snapshot } from "../../api/types";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { buildingPosition, segment, smooth } from "./journey";

type Vec = [number, number, number];
type Piece = { p: Vec; s: Vec; color?: string };
type Props = { progress: MutableRefObject<number>; selectedIndex: number; projectNames: string[]; onSelect: (index: number) => void; snapshot: Snapshot | null; reducedMotion: boolean };
const random = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

function Instances({ pieces, metalness = 0.3, roughness = 0.6, emissive = false }: { pieces: Piece[]; metalness?: number; roughness?: number; emissive?: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  useEffect(() => {
    const dummy = new THREE.Object3D();
    pieces.forEach((piece, index) => {
      dummy.position.set(...piece.p);
      dummy.scale.set(...piece.s);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(index, dummy.matrix);
      mesh.current.setColorAt(index, new THREE.Color(piece.color ?? "#506371"));
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [pieces]);
  return <instancedMesh ref={mesh} args={[undefined, undefined, pieces.length]} castShadow={!emissive} receiveShadow>
    <boxGeometry />
    {emissive ? <meshPhysicalMaterial metalness={0.35} roughness={0.28} clearcoat={0.8} envMapIntensity={0.8} emissive="#88aaa6" emissiveIntensity={0.12} /> : <meshStandardMaterial metalness={metalness} roughness={roughness} />}
  </instancedMesh>;
}

function useArchitecture() {
  return useMemo(() => {
    const shells: Piece[] = [], frames: Piece[] = [], windows: Piece[] = [], rooftops: Piece[] = [];
    // Meter-scale city blocks. Geometry is instanced in four batches, including thousands of facade bays.
    for (let row = 0; row < 10; row++) for (let col = 0; col < 17; col++) {
      const seed = row * 31 + col;
      const x = (col - 8) * 10.5 + (random(seed + 2) - 0.5) * 2;
      const z = -25 - row * 12;
      const w = 4 + random(seed + 7) * 3.1, d = 4 + random(seed + 9) * 3.6;
      const h = 5 + random(seed + 3) ** 2 * 37;
      const tint = ["#172c38", "#263843", "#293a43", "#173e49", "#3c4144"][seed % 5];
      shells.push({ p: [x, h / 2, z], s: [w, h, d], color: tint });
      shells.push({ p: [x, 0.45, z], s: [w + 1.3, 0.9, d + 1.3], color: "#40484a" });
      rooftops.push({ p: [x + w * 0.15, h + 0.45, z], s: [w * 0.45, 0.9, d * 0.5], color: "#3f4a50" });
      rooftops.push({ p: [x - w * 0.25, h + 0.3, z + d * 0.22], s: [0.8, 0.6, 1.5], color: "#657074" });
      if (seed % 6 === 0) rooftops.push({ p: [x, h + 2, z], s: [0.08, 4, 0.08], color: "#87928f" });
      for (let floor = 1; floor < h - 0.5; floor += 0.95) {
        frames.push({ p: [x, floor, z], s: [w + 0.05, 0.07, d + 0.05], color: "#516069" });
        for (let bay = 0; bay < Math.floor(w / 0.8); bay++) {
          const lit = random(seed * 997 + floor * 37 + bay);
          windows.push({ p: [x - w / 2 + 0.45 + bay * 0.8, floor + 0.41, z + d / 2 + 0.015], s: [0.56, 0.62, 0.035], color: lit > 0.67 ? (lit > 0.9 ? "#f5cf92" : "#688e94") : "#132c38" });
        }
        for (let bay = 0; bay < Math.floor(d / 1); bay++) windows.push({ p: [x + w / 2 + 0.02, floor + 0.41, z - d / 2 + 0.5 + bay], s: [0.035, 0.62, 0.72], color: random(seed + floor * 61 + bay) > 0.72 ? "#baab84" : "#1c3b46" });
      }
    }
    return { shells, frames, windows, rooftops };
  }, []);
}

const CityBlocks = memo(function CityBlocks() {
  const { shells, frames, windows, rooftops } = useArchitecture();
  return <group><Instances pieces={shells} metalness={0.65} roughness={0.3} /><Instances pieces={frames} metalness={0.8} roughness={0.28} /><Instances pieces={windows} emissive /><Instances pieces={rooftops} /></group>;
});

const MetropolitanBackdrop = memo(function MetropolitanBackdrop() {
  const { mass, crowns, lights } = useMemo(() => {
    const mass: Piece[] = [], crowns: Piece[] = [], lights: Piece[] = [];
    for (let row = 0; row < 19; row++) for (let col = 0; col < 34; col++) {
      const x = (col - 16.5) * 13.5, z = -24 - row * 17;
      if (Math.abs(x) < 93 && z > -145) continue;
      const seed = row * 47 + col;
      const h = 7 + random(seed + 701) ** 2 * 44;
      const width = 5 + random(seed + 43) * 5;
      mass.push({ p: [x, h / 2, z], s: [width, h, 7 + seed % 4], color: ['#2c404b', '#30464f', '#45545a', '#263c49'][seed % 4] });
      crowns.push({ p: [x, h + 1, z], s: [width * 0.6, 2, 5], color: '#394e57' });
      for (let floor = 2; floor < h; floor += 2.1) for (let bay = 0; bay < 4; bay++) {
        if (random(seed * 71 + floor * 3 + bay) > 0.52) lights.push({ p: [x - width * .35 + bay * width * .23, floor, z + (7 + seed % 4) / 2 + .025], s: [.55, .65, .04], color: random(seed + bay) > .6 ? '#c3b797' : '#607f87' });
      }
    }
    return { mass, crowns, lights };
  }, []);
  return <group>
    <Instances pieces={mass} metalness={0.5} roughness={0.38} />
    <Instances pieces={crowns} metalness={0.7} roughness={0.4} />
    <Instances pieces={lights} emissive />
    <SignatureTower position={[55, 0, -85]} height={64} />
    <SignatureTower position={[-120, 0, -166]} height={78} />

  </group>;
});

function SignatureTower({ position, height }: { position: Vec; height: number }) {
  const facade = useMemo(() => {
    const rings: Piece[] = [];
    for (let level = 0; level < height; level += 1.5) {
      const width = 9 * (1 - level / height * .58);
      rings.push({ p: [0, level, 0], s: [width, .12, width * .72], color: '#91a4a5' });
    }
    return rings;
  }, [height]);
  return <group position={position} rotation={[0, .3, 0]}>
    <mesh position={[0, height / 2, 0]} rotation={[0, Math.PI / 4, 0]} castShadow><cylinderGeometry args={[2.5, 6.3, height, 4, 1]} /><meshPhysicalMaterial color="#62818c" metalness={.8} roughness={.19} clearcoat={1} /></mesh>
    <Instances pieces={facade} metalness={.75} roughness={.3} />
    <mesh position={[0, height + 1.4, 0]}><cylinderGeometry args={[.04, .16, 4, 12]} /><meshStandardMaterial color="#d2d1b5" metalness={.8} /></mesh>
  </group>;
}

function Box({ p, s, color, metalness = 0.4, roughness = 0.5 }: { p: Vec; s: Vec; color: string; metalness?: number; roughness?: number }) {
  return <mesh position={p} castShadow receiveShadow><boxGeometry args={s} /><meshStandardMaterial color={color} metalness={metalness} roughness={roughness} /></mesh>;
}

function BuildingSign({ name, index, height, selected }: { name: string; index: number; height: number; selected: boolean }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = 768; canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = selected ? "#c0f5cd" : "#142c33"; ctx.fillRect(0, 0, 768, 128);
    ctx.fillStyle = selected ? "#17362b" : "#e3f2e9"; ctx.font = "500 40px system-ui, sans-serif";
    const prefix = `${String(index + 1).padStart(2, "0")}  /  `;
    let label = name;
    while (ctx.measureText(prefix + label).width > 700 && label.length > 1) label = label.slice(0, -1);
    ctx.fillText(prefix + label + (label !== name ? "…" : ""), 28, 78);
    const result = new THREE.CanvasTexture(canvas); result.colorSpace = THREE.SRGBColorSpace; return result;
  }, [name, index, selected]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <sprite position={[0, height + 4, 0]} scale={[12, 2, 1]}><spriteMaterial map={texture} depthTest={false} toneMapped={false} /></sprite>;
}

function ArrivalOffice({ height, selected, snapshot, reducedMotion, cutaway }: { cutaway: boolean; height: number; selected: boolean; snapshot?: Snapshot | null; reducedMotion: boolean }) {
  const level = height * 0.64;
  return <group position={[0, level - 0.97, 0]}>
    <group scale={0.29}><OfficeInterior snapshot={selected ? snapshot : null} preview={!snapshot} reducedMotion={reducedMotion} compact /></group>
    {!cutaway && <mesh position={[0, 1.89, 0]} receiveShadow><boxGeometry args={[7.9, 0.08, 7]} /><meshStandardMaterial color="#a6aaa0" /></mesh>}
    <pointLight position={[0, 1.4, 1]} color="#ffe5bd" intensity={18} distance={10} decay={2} />
  </group>;
}

function FeaturedBuilding({ index, selected, onSelect, selectable, name, snapshot, reducedMotion, interiorEnabled, cutaway }: { cutaway: boolean; interiorEnabled: boolean; snapshot?: Snapshot | null; reducedMotion: boolean; index: number; selected: boolean; onSelect: () => void; selectable: boolean; name?: string }) {
  const [x, height, z] = buildingPosition(index);
  const width = 8, depth = 7;
  const { trim, glazing } = useMemo(() => {
  const trim: Piece[] = [], glazing: Piece[] = [];
  for (let y = 0.6; y < height; y += 0.9) {
    if (Math.abs(y - height * 0.64) > 1.1) trim.push({ p: [0, y, 0], s: [width + 0.2, 0.1, depth + 0.2], color: "#67757b" });
    for (let bay = 0; bay < 8; bay++) {
      if (Math.abs(y + 0.42 - height * 0.64) > 1.35) glazing.push({ p: [-3.5 + bay, y + 0.42, depth / 2 + 0.025], s: [0.78, 0.67, 0.03], color: random(index * 51 + bay + y * 31) > 0.5 ? "#bdc1a4" : "#234751" });
      glazing.push({ p: [width / 2 + 0.025, y + 0.42, -3 + bay * 0.85], s: [0.03, 0.67, 0.62], color: random(index * 27 + bay + y * 21) > 0.7 ? "#c8af82" : "#264653" });
    }
  }
  for (let bay = 0; bay <= 8; bay++) trim.push({ p: [-4 + bay, height / 2, 3.55], s: [0.09, height, 0.2], color: "#849193" });
  for (let bay = 0; bay <= 7; bay++) trim.push({ p: [4.05, height / 2, -3.5 + bay], s: [0.2, height, 0.09], color: "#849193" });
  return { trim, glazing };
  }, [height, index]);
  const shells = useMemo(() => [new RoundedBoxGeometry(width, height * 0.64 - 1, depth, 2, 0.15), new RoundedBoxGeometry(width, height * 0.36 - 1, depth, 2, 0.15)], [height]);
  useEffect(() => () => shells.forEach((shell) => shell.dispose()), [shells]);
  const accent = selected ? "#c4f7cf" : "#557f87";
  return <group position={[x, 0, z]} onClick={(event) => { if (selectable) { event.stopPropagation(); onSelect(); } }} onPointerOver={(e) => { if (selectable) { e.stopPropagation(); document.body.style.cursor = "pointer"; } }} onPointerOut={() => { document.body.style.cursor = ""; }}>
    {selectable && name && <BuildingSign name={name} index={index} height={height} selected={selected} />}
    <mesh position={[0, (height * 0.64 - 1) / 2, 0]} geometry={shells[0]}><meshPhysicalMaterial color="#365762" metalness={0.78} roughness={0.2} clearcoat={1} clearcoatRoughness={0.15} /></mesh>
    <mesh visible={!cutaway} position={[0, (height * 1.64 + 1) / 2, 0]} geometry={shells[1]}><meshPhysicalMaterial color="#365762" metalness={0.78} roughness={0.2} clearcoat={1} clearcoatRoughness={0.15} /></mesh>
    <group visible={!cutaway}><Instances pieces={trim} metalness={0.8} roughness={0.26} /><Instances pieces={glazing} emissive /></group>
    <Box p={[0, 0.35, 0]} s={[10, 0.7, 9]} color="#686b68" />
    <Box p={[0, height + 0.15, 0]} s={[8.5, 0.3, 7.5]} color="#8c9796" />
    <Box p={[0, height + 1, -0.6]} s={[4.5, 1.7, 3.8]} color="#34474e" />
    {[0, 1, 2].map((n) => <group key={n} position={[-2 + n * 2, height + 0.5, 2]}><Box p={[0, 0, 0]} s={[1.1, 0.65, 1.2]} color="#818789" /><mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.34, 0]}><circleGeometry args={[0.38, 16]} /><meshStandardMaterial color="#182c32" /></mesh></group>)}
    {interiorEnabled && (selected || (index === 0 && !snapshot)) && <ArrivalOffice height={height} selected={selected} snapshot={snapshot} reducedMotion={reducedMotion} cutaway={cutaway} />}
    <mesh position={[0, height * 0.64 - 1.04, 3.65]}><planeGeometry args={[7.8, 0.08]} /><meshBasicMaterial color={accent} toneMapped={false} /></mesh>
    <Box p={[0, 1.2, 4.6]} s={[4.5, 0.15, 2]} color="#aab1ac" />
    {[-1.9, 1.9].map((dx) => <Box key={dx} p={[dx, 0.6, 5.2]} s={[0.1, 1.2, 0.1]} color="#b0b6b3" />)}
    {selected && <mesh position={[0, 0.72, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[6.5, 6.55, 96]} /><meshBasicMaterial color="#b9f0c7" transparent opacity={0.8} /></mesh>}
  </group>;
}

function River({ reducedMotion }: { reducedMotion: boolean }) {
  const river = useMemo(() => {
    const shader = {
      uniforms: { color: { value: new THREE.Color() }, tDiffuse: { value: null }, textureMatrix: { value: new THREE.Matrix4() } },
      vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; void main(){vUv = textureMatrix * vec4(position,1.);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform vec3 color; uniform sampler2D tDiffuse; varying vec4 vUv; void main(){vec4 base = texture2DProj( tDiffuse, vUv );gl_FragColor=vec4(base.rgb*color*1.6,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
    };
    const waterShader = {
      ...shader,
      uniforms: { ...shader.uniforms, uTime: { value: 0 } },
      vertexShader: 'varying vec2 vWaterUv;\n' + shader.vertexShader.replace('vUv = textureMatrix', 'vWaterUv = uv;\nvUv = textureMatrix'),
      fragmentShader: 'uniform float uTime; varying vec2 vWaterUv;\n' + shader.fragmentShader.replace('vec4 base = texture2DProj( tDiffuse, vUv );', `
        vec4 rippleUv = vUv;
        float ripple = sin(vWaterUv.x * 520. + sin(vWaterUv.y * 80. + uTime * .25) * 2.) * sin(vWaterUv.y * 310. - uTime * .5);
        rippleUv.x += ripple * .0013 * vUv.w;
        rippleUv.y += sin(vWaterUv.y * 230. + uTime * .35) * .0015 * vUv.w;
        vec4 base = texture2DProj(tDiffuse, rippleUv);
        base.rgb = mix(vec3(.025, .075, .088), base.rgb, .67);
      `),
    };
    const result = new Reflector(new THREE.PlaneGeometry(520, 26), { color: '#748c93', textureWidth: 768, textureHeight: 768, clipBias: 0.005, multisample: 0, shader: waterShader });
    result.rotation.x = -Math.PI / 2; result.position.set(0, 0.12, 22);
    return result;
  }, []);
  useFrame((_, delta) => { if (!reducedMotion) (river.material as THREE.ShaderMaterial).uniforms.uTime.value += delta; });
  useEffect(() => () => { river.geometry.dispose(); river.dispose(); }, [river]);
  return <primitive object={river} />;
}

function Bridge({ x }: { x: number }) {
  const cables = useMemo(() => {
    const points: number[] = [];
    for (const side of [-1, 1]) for (const z of [16, 29]) for (let n = -6; n <= 6; n++) {
      points.push(x + side * 1.65, 10, z, x + side * 1.65, 1.5, z + n * 1.1);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(points, 3)); return geo;
  }, [x]);
  useEffect(() => () => cables.dispose(), [cables]);
  return <group>
    <Box p={[x, 1.3, 22]} s={[4, 0.45, 37]} color="#454f51" />
    {[16, 29].map((z) => <group key={z}>{[-1.65, 1.65].map((dx) => <Box key={dx} p={[x + dx, 4.7, z]} s={[0.35, 10.3, 0.5]} color="#86928c" />)}<Box p={[x, 8.6, z]} s={[3.5, 0.4, 0.4]} color="#86928c" /></group>)}
    <lineSegments geometry={cables}><lineBasicMaterial color="#8b9b94" transparent opacity={0.6} /></lineSegments>
    {[-1.9, 1.9].map((dx) => <mesh key={dx} position={[x + dx, 1.65, 22]}><boxGeometry args={[0.07, 0.07, 37]} /><meshBasicMaterial color="#ded4ac" /></mesh>)}
  </group>;
}

function Traffic({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    const time = reducedMotion ? 0 : clock.elapsedTime;
    for (let n = 0; n < 90; n++) {
      const direction = n % 2 === 0 ? 1 : -1;
      dummy.position.set(((n * 7.7 + time * direction * 2.1 + 200) % 180) - 90, 0.5, 6 + direction * 0.7);
      dummy.scale.set(0.5, 0.08, 0.12); dummy.updateMatrix(); ref.current.setMatrixAt(n, dummy.matrix);
      ref.current.setColorAt(n, new THREE.Color(direction > 0 ? "#fff1cb" : "#fa7666"));
    }
    ref.current.instanceMatrix.needsUpdate = true; if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[undefined, undefined, 90]} frustumCulled={false}><boxGeometry /><meshBasicMaterial toneMapped={false} /></instancedMesh>;
}

function Landmark() {
  return <group position={[-43, 0, -93]}>
    <mesh position={[0, 4, 0]}><coneGeometry args={[25, 15, 40]} /><meshStandardMaterial color="#162c2c" roughness={1} /></mesh>
    <mesh position={[0, 18, 0]}><cylinderGeometry args={[0.55, 1.2, 18, 20]} /><meshStandardMaterial color="#869a96" /></mesh>
    <mesh position={[0, 26, 0]}><cylinderGeometry args={[2.3, 2.1, 2.2, 32]} /><meshStandardMaterial color="#b4c4bb" metalness={0.6} /></mesh>
    <mesh position={[0, 26, 0]}><cylinderGeometry args={[2.32, 2.32, 0.7, 32]} /><meshBasicMaterial color="#82bbbd" /></mesh>
    <mesh position={[0, 32, 0]}><cylinderGeometry args={[0.07, 0.18, 11, 12]} /><meshStandardMaterial color="#a9b6ad" /></mesh>
  </group>;
}

function CameraRig({ progress, selectedIndex, reducedMotion }: Pick<Props, "progress" | "selectedIndex" | "reducedMotion">) {
  const { camera, size } = useThree();
  const current = useRef(0);
  const look = useRef(new THREE.Vector3(0, 10, -28));
  const target = useMemo(() => new THREE.Vector3(), []);
  const position = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, delta) => {
    current.current = THREE.MathUtils.damp(current.current, progress.current, 7, Math.min(delta, 0.05));
    const p = reducedMotion ? [0, 0.32, 0.55, 0.78, 1][progress.current < 0.21 ? 0 : progress.current < 0.45 ? 1 : progress.current < 0.67 ? 2 : progress.current < 0.9 ? 3 : 4] : current.current;
    const [x, height, z] = buildingPosition(selectedIndex);
    const stops: { at: number; pos: Vec; look: Vec }[] = [
      { at: 0, pos: [76, 61, size.width < 700 ? 192 : 139], look: [0, 10, -28] },
      { at: 0.2, pos: [29, 28, 40], look: [0, 11, -12] },
      { at: 0.39, pos: [24, 25, 33], look: [0, 13, -10] },
      { at: 0.58, pos: [x + 10, height * 0.64 + 5, z + 17], look: [x, height * 0.64, z + 2] },
      { at: 0.7, pos: [x + 4.5, height * 0.64 + 2.3, z + 7.8], look: [x - 1.1, height * 0.64 - 0.6, z - 0.6] },
      { at: 0.85, pos: [x + 3.2, height * 0.64 + 1.7, z + 5.7], look: [x - 1.3, height * 0.64 - 0.6, z - 0.5] },
      { at: 1, pos: [x + 3.2, height * 0.64 + 1.7, z + 5.7], look: [x - 1.3, height * 0.64 - 0.6, z - 0.5] },
    ];
    const end = Math.max(1, stops.findIndex((s) => s.at >= p));
    const a = stops[end - 1], b = stops[end];
    const t = smooth(segment(p, a.at, b.at));
    position.set(...a.pos).lerp(new THREE.Vector3(...b.pos), t);
    target.set(...a.look).lerp(new THREE.Vector3(...b.look), t);
    const speed = reducedMotion ? 1 : 1 - Math.exp(-6 * Math.min(delta, 0.05));
    camera.position.lerp(position, speed); look.current.lerp(target, speed); camera.lookAt(look.current);
  });
  return null;
}

// An infinite environment background cannot intersect the camera's far clipping plane.
function Atmosphere() {
  const { scene } = useThree();
  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 256;
    const context = canvas.getContext("2d")!;
    const gradient = context.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, "#071c30");
    gradient.addColorStop(0.32, "#263f50");
    gradient.addColorStop(0.5, "#687c83");
    gradient.addColorStop(0.64, "#253d45");
    gradient.addColorStop(1, "#101e27");
    context.fillStyle = gradient; context.fillRect(0, 0, 512, 256);
    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    const previous = scene.background;
    scene.background = texture;
    return () => { scene.background = previous; texture.dispose(); };
  }, [scene]);
  return null;
}

function Environment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04);
    scene.environment = env.texture;
    scene.environmentIntensity = 0.65;
    let disposed = false;
    let outdoor: THREE.WebGLRenderTarget | undefined;
    new RGBELoader().load("/world/moonless_golf_1k.hdr", (texture) => {
      if (disposed) { texture.dispose(); return; }
      outdoor = pmrem.fromEquirectangular(texture);
      scene.environment = outdoor.texture;
      scene.environmentIntensity = 1.5;
      texture.dispose();
    }, undefined, () => { /* Retain the local reflection environment if an asset fails to load. */ });
    return () => { disposed = true; scene.environment = null; outdoor?.dispose(); env.dispose(); room.dispose(); pmrem.dispose(); };
  }, [gl, scene]);
  return null;
}

function CinematicFinish() {
  const { gl, scene, camera, size } = useThree();
  const composer = useMemo(() => {
    const result = new EffectComposer(gl);
    result.addPass(new RenderPass(scene, camera));
    result.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.22, 0.5, 0.88));
    result.addPass(new OutputPass());
    return result;
  }, [gl, scene, camera]);
  useEffect(() => { composer.setSize(size.width, size.height); }, [composer, size]);
  useEffect(() => () => { composer.passes.forEach((pass) => pass.dispose()); composer.dispose(); }, [composer]);
  useFrame((_, delta) => { composer.render(delta); }, 1);
  return null;
}

export default function WorldCanvas(props: Props) {
  const pageStart = Math.floor(Math.max(0, props.selectedIndex) / 12) * 12;
  const count = Math.max(3, Math.min(12, props.projectNames.length - pageStart));
  const indices = Array.from({ length: count }, (_, i) => pageStart + i);
  return <Canvas shadows dpr={[1, 1.75]} camera={{ position: [76, 61, 139], fov: 48, near: 0.1, far: 650 }} gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.25 }}>
    <Atmosphere />
    <fog attach="fog" args={["#142b35", 90, 440]} />
    <Environment />
    <ambientLight intensity={0.35} color="#8ca9b8" />
    <hemisphereLight args={["#accbda", "#162326", 1.5]} />
    <directionalLight position={[-35, 65, 20]} color="#ffe2b7" intensity={2.7} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-65} shadow-camera-right={65} shadow-camera-top={60} shadow-camera-bottom={-65} shadow-camera-far={180} shadow-normalBias={0.06} />
    <directionalLight position={[45, 20, -40]} color="#7db8cf" intensity={1.5} />
    <CameraRig {...props} selectedIndex={Math.max(0, props.selectedIndex)} />
    <Box p={[0, -0.5, -180]} s={[520, 0.9, 380]} color="#243033" roughness={0.95} />
    <Box p={[0, -0.5, 120]} s={[520, 0.9, 170]} color="#17292a" roughness={0.95} />
    <Box p={[0, 0.04, 6]} s={[520, 0.12, 3.7]} color="#192429" roughness={0.96} />
    <Box p={[0, 0.03, 9]} s={[520, 0.18, 1.5]} color="#7a8176" />
    <River reducedMotion={props.reducedMotion} />
    <CityBlocks />
    <MetropolitanBackdrop />
    <Landmark />
    <Bridge x={-26} /><Bridge x={36} />
    <Traffic reducedMotion={props.reducedMotion} />
    {indices.map((i) => <FeaturedBuilding key={i} index={i} name={props.projectNames[i]} cutaway={props.progress.current >= 0.66 && i === Math.max(0, props.selectedIndex)} interiorEnabled={props.progress.current > 0.59} snapshot={props.snapshot} reducedMotion={props.reducedMotion} selected={i === props.selectedIndex} selectable={i < props.projectNames.length && props.progress.current >= 0.21 && props.progress.current < 0.45} onSelect={() => props.onSelect(i)} />)}
    
    <CinematicFinish />
  </Canvas>;
}
