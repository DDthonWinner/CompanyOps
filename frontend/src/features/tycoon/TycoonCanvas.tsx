import { Canvas } from "@react-three/fiber";
import { useCallback, useMemo, useRef, useState } from "react";
import { DESK_ROLES, roleColor } from "../../lib/roles";
import type { Agent, Snapshot } from "../../api/types";
import { api } from "../../api/client";
import { pushToast } from "../../components/ui/toast";
import { useStore } from "../../store/useStore";
import { useTycoonStore } from "./tycoonStore";
import { CameraControls, type FocusPoint } from "./scene/CameraControls";
import { Decor } from "./scene/Decor";
import { DomainDesk } from "./scene/DomainDesk";
import { DevPawn } from "./scene/DevPawn";
import { FireDoor } from "./scene/FireDoor";
import { FloorGrid } from "./scene/FloorGrid";
import { Lighting } from "./scene/Lighting";
import { OfficeDecor } from "./scene/OfficeDecor";
import { PMSuite } from "./scene/PMSuite";
import { SmokePuff } from "./scene/SmokePuff";

// Domain desks form a spaced row; the PM suite sits apart to the right.
const DOMAIN_LAYOUT: Record<string, [number, number]> = {
  FRONTEND: [-22, 16],
  DATABASE: [22, 16],
  BACKEND: [-22, -16],
  QA: [22, -16],
};
const PM_POS: [number, number] = [66, 0];
const DEFAULT_TARGET: [number, number, number] = [18, 3, 0];

// Seats spread across the desk; overflow wraps to a second row in front.
function domainSeat([dx, dz]: [number, number], i: number): [number, number] {
  const col = i % 4;
  const row = Math.floor(i / 4);
  return [dx + (col - 1.5) * 7.0, dz + 4.4 + row * 6.5];
}
function pmSeat([px, pz]: [number, number], i: number): [number, number] {
  const col = i % 2;
  const row = Math.floor(i / 2);
  return [px + (col - 0.5) * 5, pz + 3.2 + row * 6];
}

export function TycoonCanvas({ snapshot }: { snapshot: Snapshot }) {
  const rolesById = useStore((s) => s.rolesById);
  const reassignments = useTycoonStore((s) => s.reassignments);
  const codeOf = (roleId: string | null | undefined) => (roleId ? rolesById[roleId]?.code : undefined);
  const projectId = snapshot.project.id;
  const tier = snapshot.project.budgetLevel; // HIGH | MEDIUM | LOW

  const perRole = useMemo(() => {
    const out: Record<string, { percent: number; total: number; inbox: number; outbox: number }> = {};
    for (const code of DESK_ROLES) {
      const tasks = snapshot.tasks.filter((t) => codeOf(t.roleId) === code && t.status !== "CANCELLED");
      const completed = tasks.filter((t) => t.status === "COMPLETED").length;
      out[code] = {
        percent: tasks.length ? Math.round((100 * completed) / tasks.length) : 0,
        total: tasks.length,
        inbox: tasks.filter((t) => t.status === "TODO" || t.status === "WAITING").length,
        outbox: completed,
      };
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, rolesById]);

  // Group agents by their EFFECTIVE desk (server role + local reassignments), and
  // compute a stable seat per agent. Rendered as a flat list so a reassigned agent
  // keeps its component instance and can walk to the new seat.
  const layout = useMemo(() => {
    const buckets: Record<string, Agent[]> = {};
    for (const code of DESK_ROLES) buckets[code] = [];
    const all = snapshot.agents.filter((a) => a.status !== "REMOVED");
    for (const a of all) {
      const eff = reassignments[a.id] ?? codeOf(a.roleId);
      if (eff && buckets[eff]) buckets[eff].push(a);
    }
    for (const code of DESK_ROLES) buckets[code].sort((x, y) => (x.id < y.id ? -1 : 1));
    const info: Record<string, { eff: string; seat: [number, number] }> = {};
    for (const code of DESK_ROLES) {
      buckets[code].forEach((a, i) => {
        const seat = code === "PM" ? pmSeat(PM_POS, i) : domainSeat(DOMAIN_LAYOUT[code], i);
        info[a.id] = { eff: code, seat };
      });
    }
    return { all: all.filter((a) => info[a.id]), info };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, rolesById, reassignments]);

  // Focus targets: departments (wider) + each agent (zoomed in, centered).
  const focusPoints = useMemo(() => {
    const fp: Record<string, FocusPoint> = {};
    for (const [code, pos] of Object.entries(DOMAIN_LAYOUT)) fp[code] = { pos: [pos[0], 3, pos[1]], zoomMult: 1.7 };
    fp.PM = { pos: [PM_POS[0], 3, PM_POS[1]], zoomMult: 1.7 };
    for (const a of layout.all) {
      const { seat } = layout.info[a.id];
      fp[a.id] = { pos: [seat[0], 6, seat[1]], zoomMult: 2.6 };
    }
    return fp;
  }, [layout]);

  const resolveDeskAt = useCallback((x: number, z: number): string | null => {
    for (const [code, [dx, dz]] of Object.entries(DOMAIN_LAYOUT)) {
      if (Math.abs(x - dx) <= 17 && z >= dz - 9 && z <= dz + 13) return code;
    }
    if (Math.abs(x - PM_POS[0]) <= 11 && Math.abs(z - PM_POS[1]) <= 12) return "PM";
    return null;
  }, []);

  // Smoke puffs on reassignment.
  const [puffs, setPuffs] = useState<Array<{ id: number; pos: [number, number, number] }>>([]);
  const nextPuff = useRef(0);
  const onPuff = useCallback((pos: [number, number, number]) => {
    const id = nextPuff.current++;
    setPuffs((p) => [...p, { id, pos }]);
  }, []);
  const removePuff = useCallback((id: number) => setPuffs((p) => p.filter((x) => x.id !== id)), []);

  return (
    <Canvas
      shadows
      orthographic
      data-testid="tycoon-canvas"
      camera={{ position: [100, 94, 92], zoom: 10, near: 0.1, far: 1000 }}
      style={{ width: "100%", height: "100%" }}
    >
      <color attach="background" args={["#e9ebf2"]} />
      <Lighting />
      <CameraControls focusPoints={focusPoints} defaultTarget={DEFAULT_TARGET} />
      <FloorGrid />
      {tier !== "LOW" && <Decor />}
      <OfficeDecor tier={tier} />

      {/* Domain desks */}
      {(Object.keys(DOMAIN_LAYOUT) as Array<keyof typeof DOMAIN_LAYOUT>).map((code) => {
        const r = perRole[code];
        return (
          <DomainDesk
            key={code}
            roleCode={code}
            projectId={projectId}
            position={DOMAIN_LAYOUT[code]}
            color={roleColor(code)}
            percent={r.percent}
            done={r.outbox}
            total={r.total}
            inboxCount={r.inbox}
            outboxCount={r.outbox}
          />
        );
      })}

      {/* Separate PM suite */}
      <PMSuite
        projectId={projectId}
        position={PM_POS}
        percent={perRole.PM.percent}
        done={perRole.PM.outbox}
        total={perRole.PM.total}
        inboxCount={perRole.PM.inbox}
        outboxCount={perRole.PM.outbox}
      />

      {/* All agents (flat list — stable instances survive reassignment) */}
      {layout.all.map((a) => {
        const { eff, seat } = layout.info[a.id];
        const reassigned = reassignments[a.id] != null;
        const color = reassigned ? roleColor(eff) : a.displayColor || roleColor(eff);
        return (
          <DevPawn
            key={a.id}
            projectId={projectId}
            projectAgentId={a.id}
            color={color}
            status={a.status}
            name={a.displayName}
            position={seat}
            roleCode={eff}
            tier={tier}
            resolveDeskAt={resolveDeskAt}
            onPuff={onPuff}
          />
        );
      })}

      {puffs.map((p) => (
        <SmokePuff key={p.id} position={p.pos} onDone={() => removePuff(p.id)} />
      ))}
    </Canvas>
  );
}
