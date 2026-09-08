import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../api/client";
import type { Snapshot } from "../../../api/types";
import { useStore } from "../../../store/useStore";
import { MilestoneResultApprovalCard } from "../cards/MilestoneResultApprovalCard";
import { FeedbackSection } from "../FeedbackSection";
import { ProjectCreateDialog } from "../ProjectCreateDialog";

function baseSnapshot(status: string): Snapshot {
  return {
    revision: 1,
    project: {
      id: "p", name: "P", status, budgetLevel: "MEDIUM", budgetAmount: 180000, projectSize: "SMALL",
      maxAgentCount: 12, assignedAgentCount: 0, workingAgentCount: 0, hasPrimaryPm: true,
      progressPercent: 0, progressCurrent: 0, progressTotal: 0, emptyLabel: null,
      activePlanId: null, completedAt: null,
    },
    agents: [], tasks: [], milestones: [], plans: [], pendingDecisions: [], qaRuns: [], git: [],
  };
}

describe("U5 gating rules", () => {
  beforeEach(() => useStore.setState({ activeProjectId: "p", snapshot: baseSnapshot("ACTIVE") }));
  afterEach(() => vi.restoreAllMocks());

  it("MilestoneResultApprovalCard disables Approve when the gate is failed (FR-DASH-6)", () => {
    vi.spyOn(api, "getMilestoneResult").mockResolvedValue({ id: "mr", version: 1, reviewStatus: "PENDING", additionalValidation: "UNANSWERED" } as never);
    render(<MilestoneResultApprovalCard milestoneId="m1" title="M1" gateOk={false} />);
    expect(screen.getByTestId("milestone-approve-m1")).toBeDisabled();
  });

  it("FeedbackSection shows the post-completion notice while ACTIVE (FR-DASH-13)", () => {
    render(<FeedbackSection />);
    expect(screen.getByTestId("feedback-section")).toHaveTextContent("완료 후 집계");
  });

  it("ProjectCreateDialog submits via createProject", async () => {
    const create = vi.spyOn(api, "createProject").mockResolvedValue({ id: "new" } as never);
    render(<ProjectCreateDialog open onClose={() => {}} />);
    await userEvent.type(screen.getByTestId("pc-name"), "Demo Project");
    await userEvent.click(screen.getByTestId("pc-submit"));
    expect(create).toHaveBeenCalled();
    expect((create.mock.calls[0][0] as any).name).toBe("Demo Project");
  });
});
