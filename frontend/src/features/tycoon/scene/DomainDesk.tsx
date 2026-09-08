import { useState } from "react";
import { INBOX_COLOR, OUTBOX_COLOR, ROLE_LABEL, roleColor } from "../../../lib/roles";
import { dispatchSelection } from "../selectionEvent";
import { Monitor } from "./Monitor";

export function DomainDesk({
  roleCode,
  projectId,
  position,
  percent,
  inboxCount,
  outboxCount,
}: {
  roleCode: string;
  projectId: string;
  position: [number, number, number];
  percent: number;
  inboxCount: number;
  outboxCount: number;
}) {
  const color = roleColor(roleCode);
  const [pulse, setPulse] = useState(1);
  const bounce = () => {
    setPulse(1.12);
    setTimeout(() => setPulse(1), 180);
  };

  return (
    <group position={position} scale={pulse}>
      {/* floor mat */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2.6, 2.6]} />
        <meshStandardMaterial color={color} transparent opacity={0.18} />
      </mesh>
      {/* desk */}
      <mesh
        position={[0, 0.5, 0]}
        castShadow
        onClick={(e) => {
          e.stopPropagation();
          bounce();
          dispatchSelection({ projectId, type: "desk", roleCode });
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "auto")}
      >
        <boxGeometry args={[1.8, 1, 1]} />
        <meshStandardMaterial color="#ffffff" />
        <mesh position={[0, 0.51, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.8, 1]} />
          <meshStandardMaterial color={color} transparent opacity={0.5} />
        </mesh>
      </mesh>
      {/* monitor */}
      <Monitor label={ROLE_LABEL[roleCode] ?? roleCode} percent={percent} color={color} />
      {/* inbox / outbox trays */}
      <mesh
        position={[-1.2, 0.15, 0.9]}
        onClick={(e) => { e.stopPropagation(); dispatchSelection({ projectId, type: "inbox", roleCode }); }}
      >
        <boxGeometry args={[0.5, 0.15, 0.5]} />
        <meshStandardMaterial color={INBOX_COLOR} />
      </mesh>
      <mesh
        position={[1.2, 0.15, 0.9]}
        onClick={(e) => { e.stopPropagation(); dispatchSelection({ projectId, type: "outbox", roleCode }); }}
      >
        <boxGeometry args={[0.5, 0.15, 0.5]} />
        <meshStandardMaterial color={OUTBOX_COLOR} />
      </mesh>
    </group>
  );
}
