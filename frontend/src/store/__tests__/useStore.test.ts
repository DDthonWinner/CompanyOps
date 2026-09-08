import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "../useStore";
import type { Snapshot } from "../../api/types";

function snap(revision: number, progressPercent = 0): Snapshot {
  return {
    revision,
    project: {
      id: "p", name: "P", status: "ACTIVE", budgetLevel: "MEDIUM", budgetAmount: 180000,
      projectSize: "SMALL", maxAgentCount: 12, assignedAgentCount: 2, workingAgentCount: 0,
      hasPrimaryPm: true, progressPercent, progressCurrent: 0, progressTotal: 0,
      emptyLabel: null, activePlanId: null, completedAt: null,
    },
    agents: [], tasks: [], milestones: [], plans: [], pendingDecisions: [], qaRuns: [], git: [],
  };
}

describe("SnapshotStore", () => {
  beforeEach(() => {
    useStore.setState({ snapshot: null, activeProjectId: null, connection: "DISCONNECTED", openSheet: null });
  });

  it("applies a newer revision", () => {
    useStore.getState().applySnapshot(snap(5, 40));
    expect(useStore.getState().snapshot?.revision).toBe(5);
    expect(useStore.getState().lastSyncAt).not.toBeNull();
  });

  it("ignores stale/duplicate revisions (FR-TY-2)", () => {
    useStore.getState().applySnapshot(snap(5, 40));
    useStore.getState().applySnapshot(snap(4, 99)); // stale
    useStore.getState().applySnapshot(snap(5, 99)); // duplicate
    expect(useStore.getState().snapshot?.revision).toBe(5);
    expect(useStore.getState().snapshot?.project.progressPercent).toBe(40);
  });

  it("opens and closes sheets", () => {
    useStore.getState().openAgentSheet("a1");
    expect(useStore.getState().openSheet).toEqual({ kind: "agent", id: "a1" });
    useStore.getState().openDeskSheet("BACKEND");
    expect(useStore.getState().openSheet).toEqual({ kind: "desk", id: "BACKEND" });
    useStore.getState().closeSheet();
    expect(useStore.getState().openSheet).toBeNull();
  });
});
