import { describe, expect, it } from "vitest";
import { deriveAttention } from "../attention";
import type { Snapshot } from "../../../api/types";

function snap(partial: Partial<Snapshot>): Snapshot {
  return {
    revision: 1,
    project: {
      id: "p", name: "P", status: "ACTIVE", budgetLevel: "MEDIUM", budgetAmount: 180000,
      projectSize: "SMALL", maxAgentCount: 12, assignedAgentCount: 0, workingAgentCount: 0,
      hasPrimaryPm: true, progressPercent: 0, progressCurrent: 0, progressTotal: 0,
      emptyLabel: null, activePlanId: null, completedAt: null,
    },
    agents: [], tasks: [], milestones: [], plans: [], pendingDecisions: [], qaRuns: [], git: [],
    ...partial,
  };
}

describe("deriveAttention (04 §7)", () => {
  it("surfaces decisions, final-approval plans, pending milestone results, failed QA", () => {
    const items = deriveAttention(snap({
      pendingDecisions: [{ id: "d1", reason: "auth?" }],
      plans: [{ id: "pl1", version: 2, status: "FINAL_APPROVAL_PENDING", request: "x" }],
      milestones: [{ id: "m1", title: "M1", roleId: null, displayColor: null, sortOrder: 0,
        status: "IN_PROGRESS", progressCurrent: 3, progressTotal: 3, progressPercent: 100,
        emptyLabel: null, resultVersion: 1, reviewStatus: "PENDING", additionalValidation: "UNANSWERED" }],
      qaRuns: [{ id: "q1", taskId: "t1", runStatus: "COMPLETED", technicalGate: "FAILED" }],
    }));
    expect(items.map((i) => i.kind).sort()).toEqual(
      ["DECISION", "MILESTONE_RESULT", "PLAN_APPROVAL", "QA_REVIEW"].sort(),
    );
  });

  it("ignores non-actionable states and dedups", () => {
    const items = deriveAttention(snap({
      plans: [{ id: "pl1", version: 1, status: "REVIEW" }],
      milestones: [{ id: "m1", title: "M1", roleId: null, displayColor: null, sortOrder: 0,
        status: "DONE", progressCurrent: 1, progressTotal: 1, progressPercent: 100,
        emptyLabel: null, resultVersion: 1, reviewStatus: "APPROVED", additionalValidation: "NONE" }],
    }));
    expect(items).toHaveLength(0);
  });

  it("returns [] for no snapshot", () => {
    expect(deriveAttention(null)).toEqual([]);
  });
});
