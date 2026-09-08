import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import { DESK_ROLES, roleColor } from "../../lib/roles";
import type { Snapshot } from "../../api/types";
import { useStore } from "../../store/useStore";
import { DomainDesk } from "./scene/DomainDesk";
import { DevPawn } from "./scene/DevPawn";
import { FloorGrid } from "./scene/FloorGrid";
import { Lighting } from "./scene/Lighting";

const DESK_X: Record<string, number> = {
  FRONTEND: -8, BACKEND: -4, DATABASE: 0, PM: 4, QA: 8,
};

export function TycoonCanvas({ snapshot }: { snapshot: Snapshot }) {
  const rolesById = useStore((s) => s.rolesById);
  const codeOf = (roleId: string | null | undefined) => (roleId ? rolesById[roleId]?.code : undefined);
  const projectId = snapshot.project.id;

  const perRole = useMemo(() => {
    const out: Record<string, { percent: number; inbox: number; outbox: number }> = {};
    for (const code of DESK_ROLES) {
      const tasks = snapshot.tasks.filter((t) => codeOf(t.roleId) === code && t.status !== "CANCELLED");
      const completed = tasks.filter((t) => t.status === "COMPLETED").length;
      out[code] = {
        percent: tasks.length ? Math.round((100 * completed) / tasks.length) : 0,
        inbox: tasks.filter((t) => t.status === "TODO" || t.status === "WAITING").length,
        outbox: completed,
      };
    }
    return out;
  }, [snapshot, rolesById]);

  return (
    <Canvas
      shadows
      orthographic
      data-testid="tycoon-canvas"
      camera={{ position: [12, 12, 12], zoom: 55, near: 0.1, far: 200 }}
      onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
      style={{ width: "100%", height: "100%" }}
    >
      <color attach="background" args={["#f8f9ff"]} />
      <Lighting />
      <FloorGrid />
      {DESK_ROLES.map((code) => {
        const x = DESK_X[code];
        const agents = snapshot.agents.filter((a) => codeOf(a.roleId) === code && a.status !== "REMOVED");
        return (
          <group key={code}>
            <DomainDesk
              roleCode={code}
              projectId={projectId}
              position={[x, 0, 0]}
              percent={perRole[code].percent}
              inboxCount={perRole[code].inbox}
              outboxCount={perRole[code].outbox}
            />
            {agents.map((a, i) => (
              <DevPawn
                key={a.id}
                projectId={projectId}
                projectAgentId={a.id}
                color={a.displayColor || roleColor(code)}
                status={a.status}
                position={[x - 0.6 + (i % 3) * 0.6, 0, 2.4 + Math.floor(i / 3) * 0.8]}
              />
            ))}
          </group>
        );
      })}
    </Canvas>
  );
}
