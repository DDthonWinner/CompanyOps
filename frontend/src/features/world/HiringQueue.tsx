import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { buildingPosition } from "./journey";
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
  return <sprite position={[0, 2.35, 0]} scale={[2.5, 0.66, 1]}><spriteMaterial map={texture} depthTest={true} toneMapped={false} /></sprite>;
}

// Human-sized developers share the city camera, lighting and depth buffer.
function Developer({ profile, index, reducedMotion }: { profile: HiringProfile; index: number; reducedMotion: boolean }) {
  const body = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  useFrame(({ clock }) => {
    if (body.current) body.current.rotation.z = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.8 + index) * 0.012;
  });
  const skin = ["#d5a47f", "#bb8666", "#ebc4a0", "#95664b"][index % 4];
  return <group onPointerOver={(event) => { event.stopPropagation(); setHovered(true); }} onPointerOut={() => setHovered(false)} onClick={(event) => { event.stopPropagation(); setHovered(!hovered); }}>
    <group ref={body} rotation={[0, -0.45, 0]}>
      {[-0.13, 0.13].map((x) => <group key={x}>
        <mesh position={[x, 0.48, 0]} castShadow><capsuleGeometry args={[0.095, 0.61, 5, 10]} /><meshStandardMaterial color="#26333e" roughness={0.95} /></mesh>
        <mesh position={[x, 0.09, 0.06]} castShadow><boxGeometry args={[0.21, 0.15, 0.34]} /><meshStandardMaterial color="#c3c9c5" roughness={0.8} /></mesh>
      </group>)}
      <mesh position={[0, 1.12, 0]} castShadow><capsuleGeometry args={[0.24, 0.36, 6, 12]} /><meshStandardMaterial color={profile.defaultColor ?? "#526c68"} roughness={0.95} /></mesh>
      <mesh position={[0, 1.65, 0]} castShadow><sphereGeometry args={[0.18, 16, 12]} /><meshStandardMaterial color={skin} roughness={0.8} /></mesh>
      <mesh position={[0, 1.72, -0.018]} castShadow><sphereGeometry args={[0.184, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58]} /><meshStandardMaterial color={index % 2 ? "#30251e" : "#172025"} roughness={0.95} /></mesh>
      {[-1, 1].map((side) => <group key={side} position={[side * 0.29, 1.14, 0.02]} rotation={[0.15, 0, side * 0.12]}>
        <mesh castShadow><capsuleGeometry args={[0.085, 0.29, 5, 10]} /><meshStandardMaterial color={profile.defaultColor ?? "#526c68"} roughness={0.95} /></mesh>
        <mesh position={[0, -0.22, 0.035]}><sphereGeometry args={[0.075, 10, 8]} /><meshStandardMaterial color={skin} roughness={0.8} /></mesh>
      </group>)}
      <mesh position={[0, 1.16, -0.26]} castShadow><boxGeometry args={[0.38, 0.44, 0.17]} /><meshStandardMaterial color="#25353b" roughness={0.95} /></mesh>
      <mesh position={[0.32, 0.89, 0.08]} rotation={[0, 0, -0.12]} castShadow><boxGeometry args={[0.055, 0.34, 0.45]} /><meshStandardMaterial color="#a8b4bb" metalness={0.65} roughness={0.32} /></mesh>
      <mesh position={[0, 1.21, 0.236]}><boxGeometry args={[0.08, 0.12, 0.018]} /><meshStandardMaterial color="#e3e8de" /></mesh>
    </group>
    {hovered && <Nameplate profile={profile} />}
  </group>;
}

export default function HiringQueue({ profiles, buildingIndex, reducedMotion }: { profiles: HiringProfile[]; buildingIndex: number; reducedMotion: boolean }) {
  const [x, , z] = buildingPosition(buildingIndex);
  return <group position={[x, 0.71, z + 4.05]}>
    {profiles.slice(0, 6).map((profile, index) => <group key={profile.id} position={[-3.5 + index * 1.35, 0, index % 2 * 0.08]}>
      <Developer profile={profile} index={index} reducedMotion={reducedMotion} />
    </group>)}
  </group>;
}
