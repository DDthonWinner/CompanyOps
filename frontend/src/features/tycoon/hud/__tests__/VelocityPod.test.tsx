import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { Snapshot } from "../../../../api/types";
import { useStore } from "../../../../store/useStore";
import { VelocityPod } from "../VelocityPod";

function baseSnapshot(): Snapshot {
  return {
    revision: 1,
    project: {
      id: "p", name: "P", status: "ACTIVE", budgetLevel: "MEDIUM", budgetAmount: 180000,
      projectSize: "SMALL", maxAgentCount: 12, assignedAgentCount: 0, workingAgentCount: 0,
      hasPrimaryPm: true, progressPercent: 0, progressCurrent: 0, progressTotal: 0,
      emptyLabel: null, activePlanId: null, completedAt: null,
    },
    agents: [], tasks: [],
    milestones: [
      { id: "m1", title: "Canvas Virtualizer", roleId: null, displayColor: null, sortOrder: 0,
        status: "IN_PROGRESS", progressCurrent: 2, progressTotal: 3, progressPercent: 67,
        emptyLabel: null, resultVersion: null, reviewStatus: null, additionalValidation: null },
    ],
    plans: [], pendingDecisions: [], qaRuns: [], git: [],
  };
}

describe("VelocityPod", () => {
  beforeEach(() => useStore.setState({ snapshot: baseSnapshot() }));

  it("renders milestone progress from the snapshot (no client recompute)", () => {
    render(<VelocityPod />);
    expect(screen.getByText("Canvas Virtualizer")).toBeInTheDocument();
    expect(screen.getByText(/2\/3 · 67%/)).toBeInTheDocument();
  });

  it("shows a review-status pill when present", () => {
    const s = baseSnapshot();
    s.milestones[0].reviewStatus = "PENDING";
    useStore.setState({ snapshot: s });
    render(<VelocityPod />);
    expect(screen.getByTestId("mr-status-m1")).toHaveTextContent("승인 대기");
  });
});
