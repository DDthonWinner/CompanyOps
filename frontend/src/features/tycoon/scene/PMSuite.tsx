import { dispatchSelection } from "../selectionEvent";
import { Monitor } from "./Monitor";

const STICKY = ["#f43f5e", "#fbbf24", "#10b981", "#3b82f6"];
const LEGS: Array<[number, number, number]> = [
  [-4.5, 1.5, -3.5],
  [4.5, 1.5, -3.5],
  [-4.5, 1.5, -0.1],
  [4.5, 1.5, -0.1],
];

// Separate executive "corner suite" for the PM: rug, roadmap whiteboard,
// exec desk, big monitor, coffee bar. Sits apart from the domain-desk row.
function PaperStack({ count, y }: { count: number; y: number }) {
  return (
    <>
      {Array.from({ length: Math.min(8, Math.max(0, count)) }).map((_, i) => (
        <mesh key={i} position={[0, y + i * 0.085, 0]} rotation={[0, ((i % 3) - 1) * 0.08, 0]} castShadow>
          <boxGeometry args={[1.9, 0.07, 2.1]} />
          <meshStandardMaterial color="#ffffff" roughness={0.85} />
        </mesh>
      ))}
    </>
  );
}

export function PMSuite({
  projectId,
  position,
  percent,
  steps,
  inboxCount,
  outboxCount,
}: {
  projectId: string;
  position: [number, number]; // [x, z]
  percent: number;
  steps: string;
  inboxCount: number;
  outboxCount: number;
}) {
  const select = (type: "desk" | "inbox" | "outbox") =>
    dispatchSelection({ projectId, type, roleCode: "PM" });
  const hover = {
    onPointerOver: () => (document.body.style.cursor = "pointer"),
    onPointerOut: () => (document.body.style.cursor = "auto"),
  };

  return (
    <group position={[position[0], 0, position[1]]}>
      {/* Rose zone rug */}
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[18, 16]} />
        <meshStandardMaterial color="#fecdd3" transparent opacity={0.9} />
      </mesh>

      {/* Roadmap whiteboard */}
      <mesh position={[0, 4.4, -6.5]}>
        <boxGeometry args={[10, 5.5, 0.3]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[0, 4.4, -6.34]}>
        <planeGeometry args={[9.6, 5.1]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      {Array.from({ length: 2 }).flatMap((_, r) =>
        Array.from({ length: 5 }).map((__, c) => (
          <mesh key={`${r}-${c}`} position={[-3.4 + c * 1.7, 5.2 - r * 1.7, -6.32]}>
            <planeGeometry args={[1.3, 1.3]} />
            <meshBasicMaterial color={STICKY[(r * 5 + c) % STICKY.length]} toneMapped={false} />
          </mesh>
        )),
      )}

      {/* Executive desk + trim */}
      <mesh
        position={[0, 3.2, -1.8]}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          select("desk");
        }}
        {...hover}
      >
        <boxGeometry args={[10, 0.52, 4.5]} />
        <meshStandardMaterial color="#ffe4e6" />
      </mesh>
      <mesh position={[0, 3.0, -1.8]}>
        <boxGeometry args={[10.15, 0.28, 4.65]} />
        <meshStandardMaterial color="#e11d48" />
      </mesh>
      {LEGS.map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <cylinderGeometry args={[0.3, 0.3, 3.0, 12]} />
          <meshStandardMaterial color="#64748b" />
        </mesh>
      ))}

      {/* Inbox / outbox trays */}
      <mesh
        position={[-3.6, 3.55, -1.5]}
        castShadow
        onClick={(e) => {
          e.stopPropagation();
          select("inbox");
        }}
        {...hover}
      >
        <boxGeometry args={[2.4, 0.6, 2.6]} />
        <meshStandardMaterial color="#2563eb" />
      </mesh>
      <group position={[-3.6, 3.85, -1.5]}>
        <PaperStack count={inboxCount} y={0} />
      </group>
      <mesh
        position={[-3.6, 3.55, -3.2]}
        castShadow
        onClick={(e) => {
          e.stopPropagation();
          select("outbox");
        }}
        {...hover}
      >
        <boxGeometry args={[2.4, 0.6, 2.6]} />
        <meshStandardMaterial color="#059669" />
      </mesh>
      <group position={[-3.6, 3.85, -3.2]}>
        <PaperStack count={outboxCount} y={0} />
      </group>

      {/* Big monitor (on the exec desktop) */}
      <group position={[0.8, 3.46, -2.8]}>
        <Monitor
          title="PM Strategy Hub"
          steps={steps}
          percent={percent}
          color="#e11d48"
          width={10}
          height={5.6}
          onSelect={() => select("desk")}
        />
      </group>

      {/* Coffee bar */}
      <mesh position={[4.0, 4.45, -1.8]} castShadow>
        <boxGeometry args={[1.5, 2.0, 1.3]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[3.0, 3.65, -1.2]} castShadow>
        <cylinderGeometry args={[0.25, 0.25, 0.45, 12]} />
        <meshStandardMaterial color="#f43f5e" />
      </mesh>
    </group>
  );
}
