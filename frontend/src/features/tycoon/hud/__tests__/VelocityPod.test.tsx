import { act, render, screen } from "@testing-library/react";
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
    expect(screen.getByText("2/3")).toBeInTheDocument();
    expect(screen.getByText("67%")).toBeInTheDocument();
  });

  it("shows a review-status pill when present", () => {
    const s = baseSnapshot();
    s.milestones[0].reviewStatus = "PENDING";
    useStore.setState({ snapshot: s });
    render(<VelocityPod />);
    expect(screen.getByTestId("mr-status-m1")).toHaveTextContent("승인 대기");
  });

  it("updates live tasks and milestone progress when the server snapshot changes", () => {
    const s = baseSnapshot();
    s.tasks = [{ id: "t", title: "Wallet UI", sprintMilestoneId: "m1", roleId: null,
      assignedProjectAgentId: "a", status: "RUNNING", executionMode: "AI_AGENT",
      priority: "MEDIUM", sortOrder: 0, dependencyTaskIds: [], waitReasons: [] }];
    s.agents = [{ id: "a", displayName: "Iris", roleId: "fe", status: "WORKING",
      displayColor: "#123456", iconKey: "monitor", isPrimaryPm: false,
      currentTaskId: "t", nextTaskId: null, activitySummary: null, llmModelId: "model" }];
    useStore.setState({ snapshot: s, connection: "CONNECTED" });
    render(<VelocityPod />);
    expect(screen.getByText("개발 중")).toBeInTheDocument();
    expect(screen.getByText("Iris")).toBeInTheDocument();
    expect(screen.getByText("실시간 연결")).toBeInTheDocument();
    act(() => useStore.getState().applySnapshot({ ...s, revision: 2,
      tasks: [{ ...s.tasks[0], status: "COMPLETED" }],
      milestones: [{ ...s.milestones[0], progressCurrent: 3, progressPercent: 100, reviewStatus: "PENDING" }],
      agents: [{ ...s.agents[0], status: "IDLE", currentTaskId: null }],
    }));
    expect(screen.queryByText("개발 중")).not.toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("작업 중 0명")).toBeInTheDocument();
    expect(screen.getByTestId("mr-status-m1")).toHaveTextContent("승인 대기");
  });
});
