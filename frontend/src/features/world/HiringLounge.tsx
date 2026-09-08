import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { OfficeWorker } from "./OfficeInterior";
import type { HiringProfile } from "./useHiringProfiles";

function Nameplate({ profile }: { profile: HiringProfile }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = 170;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#122a30"; ctx.fillRect(0, 0, 640, 170);
    ctx.fillStyle = "#c0f5cd"; ctx.fillRect(0, 0, 640, 5);
    ctx.fillStyle = "#edf8f0"; ctx.font = "500 34px system-ui";
    let title = profile.name;
    while (ctx.measureText(title).width > 582 && title.length > 1) title = title.slice(0, -1);
    ctx.fillText(title + (title !== profile.name ? "…" : ""), 24, 65);
    ctx.fillStyle = "#a1bdb4"; ctx.font = "26px system-ui";
    ctx.fillText(`${profile.role.name} · ${profile.skillLevel}`, 24, 117, 590);
    const result = new THREE.CanvasTexture(canvas); result.colorSpace = THREE.SRGBColorSpace; return result;
  }, [profile]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <sprite position={[0, 2, 0]} scale={[2.2, 0.59, 1]}><spriteMaterial map={texture} depthTest={false} toneMapped={false} /></sprite>;
}

export default function HiringLounge({ profiles, reducedMotion }: { profiles: HiringProfile[]; reducedMotion: boolean }) {
  const visible = profiles.slice(0, 6);
  return <div className="world-lounge" role="img" aria-label={`함께할 AI 에이전트 라운지: ${visible.map((p) => p.name).join(", ")}`}>
    <p className="world-lounge-title">MEET YOUR NEXT TEAM <span>{visible.length} / {profiles.length} AGENTS</span></p>
    <Canvas shadows dpr={[1, 1.5]} camera={{ position: [5, 5, 11], fov: 37 }} onCreated={({ camera }) => camera.lookAt(0, 1, 0)} gl={{ alpha: true, antialias: true }}>
      <hemisphereLight args={["#e2f0f6", "#526a5c", 2.3]} />
      <directionalLight position={[2, 7, 5]} intensity={3} color="#ffe5bf" castShadow shadow-mapSize={[1024, 1024]} shadow-normalBias={0.025} />
      <directionalLight position={[-5, 3, -3]} intensity={1.7} color="#9fd5df" />
      <mesh position={[0, -0.13, 0]} receiveShadow><boxGeometry args={[8.2, 0.2, 6]} /><meshStandardMaterial color="#283f42" roughness={0.65} metalness={0.25} /></mesh>
      {visible.map((profile, index) => <group key={profile.id} position={[(index % 3 - 1) * 2.65, 0, Math.floor(index / 3) * 2.9 - 1.4]} rotation={[0, Math.PI, 0]}>
        <OfficeWorker index={index} working={false} reducedMotion={reducedMotion} />
        <mesh position={[0, 0.5, 0]} castShadow><boxGeometry args={[0.75, 0.12, 0.75]} /><meshStandardMaterial color={profile.defaultColor ?? "#567d70"} roughness={0.85} /></mesh>
        <mesh position={[0, 0.85, 0.32]} castShadow><boxGeometry args={[0.75, 0.7, 0.12]} /><meshStandardMaterial color="#496662" roughness={0.88} /></mesh>
        {[-0.27, 0.27].map((x) => <mesh key={x} position={[x, 0.25, 0]}><boxGeometry args={[0.06, 0.5, 0.6]} /><meshStandardMaterial color="#8e9a98" metalness={0.8} roughness={0.3} /></mesh>)}
        <Nameplate profile={profile} />
      </group>)}
    </Canvas>
  </div>;
}
