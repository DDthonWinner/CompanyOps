// Geometry reference: requirements/dashboard/character.png (local only).
// Rounded explorer mascot: cream cheeks, brown fur, khaki hat/uniform, red scarf.
import type { ThreeElements } from "@react-three/fiber";

type Position = [number, number, number];
function Ellipsoid({ at, scale, color, ...rest }: { at: Position; scale: Position; color: string } & Omit<ThreeElements["mesh"], "scale" | "position" | "color">) {
  return <mesh position={at} scale={scale} castShadow {...rest}>
    <sphereGeometry args={[1, 20, 14]} />
    <meshStandardMaterial color={color} roughness={0.88} />
  </mesh>;
}
const FUR = "#493a29", CREAM = "#f5efd7", KHAKI = "#cdb477", RED = "#ed4039";
export function CityMascot({ accent }: { accent: string }) {
  return <group rotation={[0, 0.45, 0]}>
    {/* Short legs and broad, rounded body. */}
    <Ellipsoid at={[0, 0.6, 0]} scale={[0.43, 0.5, 0.31]} color={FUR} />
    {[-1, 1].map((side) => <group key={side}>
      <Ellipsoid at={[side * 0.23, 0.16, 0.13]} scale={[0.19, 0.16, 0.28]} color={FUR} />
      <Ellipsoid at={[side * 0.52, 1.15, 0]} scale={[0.17, 0.36, 0.19]} color={KHAKI} rotation={[0, 0, side * 0.7]} />
      <Ellipsoid at={[side * 0.72, 0.93, 0.02]} scale={[0.15, 0.18, 0.16]} color={FUR} />
    </group>)}
    <Ellipsoid at={[0, 1.13, 0]} scale={[0.47, 0.54, 0.33]} color={KHAKI} />
    <mesh position={[0, 0.8, 0]} scale={[1, 1, 0.73]} castShadow><cylinderGeometry args={[0.46, 0.46, 0.13, 24]} /><meshStandardMaterial color="#292e2e" roughness={0.8} /></mesh>
    <mesh position={[0, 0.8, 0.35]}><boxGeometry args={[0.15, 0.11, 0.04]} /><meshStandardMaterial color="#c1c6c7" metalness={0.4} roughness={0.4} /></mesh>
    <Ellipsoid at={[0, 0.67, 0]} scale={[0.5, 0.12, 0.36]} color={KHAKI} />
    {[1.03, 1.19].map((y) => <Ellipsoid key={y} at={[0, y, 0.33]} scale={[0.04, 0.04, 0.02]} color="#775037" />)}
    {/* Uniform pockets and a role-colored shoulder badge keep the costume recognizable. */}
    {[-1, 1].map((side) => <mesh key={side} position={[side * 0.25, 1.29, 0.3]}>
      <boxGeometry args={[0.15, 0.17, 0.035]} /><meshStandardMaterial color="#b69b63" roughness={1} />
    </mesh>)}
    <Ellipsoid at={[0.53, 1.35, 0.14]} scale={[0.08, 0.1, 0.025]} color={accent} />
    {/* Large head, brown ears and eye patches. */}
    <Ellipsoid at={[0, 2.01, 0]} scale={[0.56, 0.57, 0.43]} color={FUR} />
    <Ellipsoid at={[0, 1.9, 0.18]} scale={[0.55, 0.43, 0.39]} color={CREAM} />
    {[-1, 1].map((side) => <group key={side}>
      <Ellipsoid at={[side * 0.4, 2.45, 0]} scale={[0.14, 0.18, 0.12]} color={FUR} />
      <Ellipsoid at={[side * 0.24, 2.16, 0.36]} scale={[0.17, 0.22, 0.085]} color={CREAM} rotation={[0, 0, side * -0.2]} />
      <Ellipsoid at={[side * 0.23, 2.16, 0.435]} scale={[0.085, 0.12, 0.04]} color="#191d1d" />
      <Ellipsoid at={[side * 0.23 - 0.02, 2.2, 0.47]} scale={[0.026, 0.03, 0.015]} color="white" />
      <Ellipsoid at={[side * 0.12, 1.98, 0.5]} scale={[0.2, 0.14, 0.12]} color="#fff9e9" />
      {[0, 1, 2].map((i) => <mesh key={i} position={[side * 0.37, 1.94 + i * 0.05, 0.49]} rotation={[0, 0, side * (i - 1) * 0.15]}>
        <boxGeometry args={[0.14, 0.009, 0.008]} /><meshStandardMaterial color="#948d79" />
      </mesh>)}
    </group>)}
    <Ellipsoid at={[0, 2.06, 0.59]} scale={[0.085, 0.065, 0.04]} color="#242523" />
    <Ellipsoid at={[0, 1.79, 0.52]} scale={[0.065, 0.08, 0.025]} color="#a32e2c" />
    {/* Khaki explorer helmet and red neckerchief. */}
    <Ellipsoid at={[0, 2.48, -0.015]} scale={[0.47, 0.3, 0.39]} color={KHAKI} />
    <mesh position={[0, 2.41, 0.04]} scale={[1, 1, 0.85]} castShadow><cylinderGeometry args={[0.61, 0.61, 0.09, 32]} /><meshStandardMaterial color="#ddc68b" roughness={0.9} /></mesh>
    <Ellipsoid at={[0, 2.77, -0.015]} scale={[0.07, 0.06, 0.07]} color="#303b35" />
    <Ellipsoid at={[0, 1.56, 0.36]} scale={[0.08, 0.1, 0.07]} color={RED} />
    <Ellipsoid at={[-0.13, 1.44, 0.36]} scale={[0.105, 0.22, 0.045]} color={RED} rotation={[0, 0, -0.65]} />
    <Ellipsoid at={[0.1, 1.39, 0.37]} scale={[0.085, 0.23, 0.045]} color={RED} rotation={[0, 0, 0.25]} />
  </group>;
}
