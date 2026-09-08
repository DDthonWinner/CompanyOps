import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../api/client";
import type { Snapshot } from "../../../api/types";
import { useStore } from "../../../store/useStore";
import { PlanReviewPanel } from "../PlanReviewPanel";

function withPlan(status: string, version: number): Snapshot {
  return {
    revision: 1,
    project: {
      id: "p", name: "P", status: "ACTIVE", budgetLevel: "MEDIUM", budgetAmount: 180000,
      projectSize: "SMALL", maxAgentCount: 12, assignedAgentCount: 0, workingAgentCount: 0,
      hasPrimaryPm: true, progressPercent: 0, progressCurrent: 0, progressTotal: 0,
      emptyLabel: null, activePlanId: "pl1", completedAt: null,
    },
    agents: [], tasks: [],
    milestones: [],
    plans: [{ id: "pl1", version, status, request: "Build" }],
    pendingDecisions: [], qaRuns: [], git: [],
  };
}

describe("PlanReviewPanel (04 §19)", () => {
  beforeEach(() => useStore.setState({ activeProjectId: "p" }));
  afterEach(() => vi.restoreAllMocks());

  it("REVIEW shows feedback + review-complete; approve calls with the expected version", async () => {
    useStore.setState({ snapshot: withPlan("REVIEW", 2) });
    const rc = vi.spyOn(api, "planReviewComplete").mockResolvedValue({} as never);
    render(<PlanReviewPanel />);
    // feedback button disabled until text entered
    expect(screen.getByTestId("plan-feedback-btn")).toBeDisabled();
    await userEvent.click(screen.getByTestId("plan-review-complete-btn"));
    expect(rc).toHaveBeenCalledWith("p", "pl1", 2);
  });

  it("FINAL_APPROVAL_PENDING shows final approval with version guard", async () => {
    useStore.setState({ snapshot: withPlan("FINAL_APPROVAL_PENDING", 3) });
    const ap = vi.spyOn(api, "planApprove").mockResolvedValue({} as never);
    render(<PlanReviewPanel />);
    await userEvent.click(screen.getByTestId("plan-approve-btn"));
    expect(ap).toHaveBeenCalledWith("p", "pl1", 3);
  });
});
