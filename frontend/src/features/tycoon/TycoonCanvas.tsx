import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import { DESK_ROLES, roleColor } from "../../lib/roles";
import type { Snapshot } from "../../api/types";
import { useStore } from "../../store/useStore";
import { CameraControls } from "./scene/CameraControls";
import { Decor } from "./scene/Decor";
import { DomainDesk } from "./scene/DomainDesk";
import { DevPawn } from "./scene/DevPawn";
import { FloorGrid } from "./scene/FloorGrid";
import { Lighting } from "./scene/Lighting";
import { PMSuite } from "./scene/PMSuite";

// Domain desks form a clustered row; the PM suite sits apart to the right.
const DOMAIN_LAYOUT: Record<string, [number, number]> = {
  FRONTEND: [-15, 13],
  DATABASE: [15, 13],
  BACKEND: [-15, -13],
  QA: [15, -13],
};
const PM_POS: [number, number] = [42, 0];
const DEFAULT_TARGET: [number, number, number] = [8, 2, 0];

// Camera focus points for the CommandDock quick-jump buttons.
const FOCUS: Record<string, [number, number, number]> = {
  ...Object.fromEntries(
    Object.entries(DOMAIN_LAYOUT).map(([code, [x, z]]) => [code, [x, 2, z] as [number, number, number]]),
  ),
  PM: [PM_POS[0], 2, PM_POS[1]],
};

// Seat positions in front of a desk (+z), wrapping to a second row past 5 seats.
function domainSeat([dx, dz]: [number, number], i: number): [number, number] {
  const col = i % 5;
  const row = Math.floor(i / 5);
  return [dx - 8 + col * 4, dz + 5 + row * 4.2];
}
function pmSeat([px, pz]: [number, number], i: number): [number, number] {
  const col = i % 3;
  const row = Math.floor(i / 3);
  return [px - 3 + col * 3, pz + 3.4 + row * 4];
}

export function TycoonCanvas({ snapshot }: { snapshot: Snapshot }) {
  const rolesById = useStore((s) => s.rolesById);
  const codeOf = (roleId: string | null | undefined) => (roleId ? rolesById[roleId]?.code : undefined);
  const projectId = snapshot.project.id;

  const perRole = useMemo(() => {
    const out: Record<string, { percent: number; steps: string; inbox: number; outbox: number }> = {};
    for (const code of DESK_ROLES) {
      const tasks = snapshot.tasks.filter((t) => codeOf(t.roleId) === code && t.status !== "CANCELLED");
      const completed = tasks.filter((t) => t.status === "COMPLETED").length;
      out[code] = {
        percent: tasks.length ? Math.round((100 * completed) / tasks.length) : 0,
        steps: `${completed}/${tasks.length}`,
        inbox: tasks.filter((t) => t.status === "TODO" || t.status === "WAITING").length,
        outbox: completed,
      };
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, rolesById]);

  const agentsFor = (code: string) =>
    snapshot.agents.filter((a) => codeOf(a.roleId) === code && a.status !== "REMOVED");

  return (
    <Canvas
      shadows
      orthographic
      data-testid="tycoon-canvas"
      camera={{ position: [100, 94, 92], zoom: 10, near: 0.1, far: 1000 }}
      style={{ width: "100%", height: "100%" }}
    >
      <color attach="background" args={["#f8f9ff"]} />
      <Lighting />
      <CameraControls focusPoints={FOCUS} defaultTarget={DEFAULT_TARGET} />
      <FloorGrid />
      <Decor />

      {/* Domain desks + seated agents */}
      {(Object.keys(DOMAIN_LAYOUT) as Array<keyof typeof DOMAIN_LAYOUT>).map((code) => {
        const pos = DOMAIN_LAYOUT[code];
        const r = perRole[code];
        return (
          <group key={code}>
            <DomainDesk
              roleCode={code}
              projectId={projectId}
              position={pos}
              color={roleColor(code)}
              percent={r.percent}
              steps={r.steps}
              inboxCount={r.inbox}
              outboxCount={r.outbox}
            />
            {agentsFor(code).map((a, i) => (
              <DevPawn
                key={a.id}
                projectId={projectId}
                projectAgentId={a.id}
                color={a.displayColor || roleColor(code)}
                status={a.status}
                name={a.displayName}
                position={domainSeat(pos, i)}
              />
            ))}
          </group>
        );
      })}

      {/* Separate PM suite + PM agents */}
      <PMSuite
        projectId={projectId}
        position={PM_POS}
        percent={perRole.PM.percent}
        steps={perRole.PM.steps}
        inboxCount={perRole.PM.inbox}
        outboxCount={perRole.PM.outbox}
      />
      {agentsFor("PM").map((a, i) => (
        <DevPawn
          key={a.id}
          projectId={projectId}
          projectAgentId={a.id}
          color={a.displayColor || roleColor("PM")}
          status={a.status}
          name={a.displayName}
          position={pmSeat(PM_POS, i)}
        />
      ))}
    </Canvas>
  );
}
