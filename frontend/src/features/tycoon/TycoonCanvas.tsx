import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import { DESK_ROLES, roleColor } from "../../lib/roles";
import type { Agent, Snapshot } from "../../api/types";
import { useStore } from "../../store/useStore";
import { CameraControls, type FocusPoint } from "./scene/CameraControls";
import { Decor } from "./scene/Decor";
import { DomainDesk } from "./scene/DomainDesk";
import { DevPawn } from "./scene/DevPawn";
import { FloorGrid } from "./scene/FloorGrid";
import { Lighting } from "./scene/Lighting";
import { PMSuite } from "./scene/PMSuite";

// Domain desks form a spaced row; the PM suite sits apart to the right.
const DOMAIN_LAYOUT: Record<string, [number, number]> = {
  FRONTEND: [-22, 16],
  DATABASE: [22, 16],
  BACKEND: [-22, -16],
  QA: [22, -16],
};
const PM_POS: [number, number] = [48, 0];
const DEFAULT_TARGET: [number, number, number] = [12, 2, 0];
const MAX_SEATS = 4;

// Up to 4 seats in a single row tucked at the desk (+z, facing the monitor).
function domainSeat([dx, dz]: [number, number], i: number): [number, number] {
  return [dx + (i - (MAX_SEATS - 1) / 2) * 4.2, dz + 3.9];
}
function pmSeat([px, pz]: [number, number], i: number): [number, number] {
  return [px + (i - 0.5) * 3.2, pz + 2.7];
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

  // Seated agents per desk (sliced to the visible seat count) — shared by render + focus.
  const seated = useMemo(() => {
    const forCode = (code: string): Agent[] =>
      snapshot.agents.filter((a) => codeOf(a.roleId) === code && a.status !== "REMOVED").slice(0, MAX_SEATS);
    const domain: Record<string, Agent[]> = {};
    for (const code of Object.keys(DOMAIN_LAYOUT)) domain[code] = forCode(code);
    return { domain, pm: forCode("PM") };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, rolesById]);

  // Focus targets: departments (wider) + each agent (zoomed in, centered).
  const focusPoints = useMemo(() => {
    const fp: Record<string, FocusPoint> = {};
    for (const [code, pos] of Object.entries(DOMAIN_LAYOUT)) {
      fp[code] = { pos: [pos[0], 3, pos[1]], zoomMult: 1.7 };
      seated.domain[code].forEach((a, i) => {
        const [sx, sz] = domainSeat(pos, i);
        fp[a.id] = { pos: [sx, 4, sz], zoomMult: 3.0 };
      });
    }
    fp.PM = { pos: [PM_POS[0], 3, PM_POS[1]], zoomMult: 1.7 };
    seated.pm.forEach((a, i) => {
      const [sx, sz] = pmSeat(PM_POS, i);
      fp[a.id] = { pos: [sx, 4, sz], zoomMult: 3.0 };
    });
    return fp;
  }, [seated]);

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
      <CameraControls focusPoints={focusPoints} defaultTarget={DEFAULT_TARGET} />
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
            {seated.domain[code].map((a, i) => (
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
      {seated.pm.map((a, i) => (
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
