import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Snapshot } from "../../../api/types";
import { useStore } from "../../../store/useStore";
import { DashboardDetails } from "../DashboardDetails";
import { AgentOverview } from "../AgentOverview";
import { QASection } from "../QASection";

vi.mock("../../../api/client", () => ({ api: { getActivity: vi.fn().mockResolvedValue([]) } }));
function snapshot(): Snapshot {
  return { revision: 1, project: { id: "p" } as Snapshot["project"],
    agents: Array.from({ length: 9 }, (_, i) => ({ id: `a${i}`, roleId: "fe", displayName: `Agent ${i}`, displayColor: "", iconKey: "", status: "IDLE", isPrimaryPm: false, currentTaskId: null, nextTaskId: null, activitySummary: null, llmModelId: "m" })),
    tasks: ["RUNNING", "FAILED", "CANCELLED"].map((status, i) => ({ id: `t${i}`, title: `작업 ${i}`, roleId: "fe", assignedProjectAgentId: "a0", sprintMilestoneId: null, status: status as Snapshot["tasks"][number]["status"], executionMode: null, priority: "P1", sortOrder: i, dependencyTaskIds: [], waitReasons: ["DEPENDENCY"] })),
    milestones: [], plans: [{ id: "plan", version: 2, status: "EXECUTING", request: "현재 계획" }], pendingDecisions: [], qaRuns: [], git: [] };
}
beforeEach(() => useStore.setState({ activeProjectId: "p", snapshot: snapshot(), rolesById: { fe: { code: "FRONTEND", name: "Frontend" } }, ui: { activeTab: "dashboard", camera: {} } }));
describe("compact dashboard exploration", () => {
  it("keeps details out of the overview and supports keyboard tabs and task filters", async () => {
    await act(async () => { render(<DashboardDetails />); });
    expect(screen.queryByLabelText("작업 검색")).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("tab", { name: "요약" }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "작업 · 3" })).toHaveFocus();
    fireEvent.change(screen.getByLabelText("작업 상태"), { target: { value: "FAILED" } });
    expect(screen.getByText("작업 1")).toBeInTheDocument();
    expect(screen.queryByText("작업 2")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("작업 상태"), { target: { value: "CANCELLED" } });
    expect(screen.getByText("작업 2")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("작업 검색"), { target: { value: "없는 작업" } });
    expect(screen.getByRole("status")).toHaveTextContent("조건에 맞는 작업이 없습니다");
  });
  it("opens the plan panel via shared navigation without changing server data", async () => {
    await act(async () => { render(<DashboardDetails />); });
    const before = useStore.getState().snapshot;
    act(() => useStore.getState().setDashboardPanel("plan"));
    expect(screen.getByTestId("plan-review-panel")).toHaveTextContent("현재 계획");
    expect(useStore.getState().snapshot).toBe(before);
  });
  it("preserves plan feedback when switching detail tabs", async () => {
    const s = snapshot(); s.plans[0].status = "REVIEW";
    useStore.setState({ snapshot: s });
    await act(async () => { render(<DashboardDetails />); });
    act(() => useStore.getState().setDashboardPanel("plan"));
    fireEvent.change(screen.getByTestId("plan-feedback-input"), { target: { value: "예외 처리를 추가해 주세요" } });
    act(() => useStore.getState().setDashboardPanel("tasks"));
    act(() => useStore.getState().setDashboardPanel("plan"));
    expect(screen.getByTestId("plan-feedback-input")).toHaveValue("예외 처리를 추가해 주세요");
  });
  it("pages through all agents in a maximum four-card row", () => {
    render(<AgentOverview />);
    expect(screen.getByText("Agent 0")).toBeInTheDocument();
    expect(screen.queryByText("Agent 4")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다음 에이전트" }));
    expect(screen.getByText("Agent 4")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다음 에이전트" }));
    expect(screen.getByText("Agent 8")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음 에이전트" })).toBeDisabled();
  });
  it("does not treat running QA or skipped checks as a completed pass rate", () => {
    const s = snapshot(); s.qaRuns = [
      { id: "q1", taskId: "t1", runStatus: "COMPLETED", technicalGate: "FAILED", results: { passed: 3, failed: 1, skipped: 9 } },
      { id: "q2", taskId: "t2", runStatus: "RUNNING", technicalGate: "PENDING", results: { passed: 100, failed: 0 } },
    ]; useStore.setState({ snapshot: s });
    render(<QASection compact />);
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.queryByText("100%")).not.toBeInTheDocument();
  });
});
