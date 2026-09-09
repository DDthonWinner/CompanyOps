import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { Snapshot } from "../../../api/types";
import { useStore } from "../../../store/useStore";
import { agentMetrics } from "../agentMetrics";
import { AgentOverview } from "../AgentOverview";
import { DevelopmentFlow } from "../DevelopmentFlow";
import { HeaderStrip } from "../HeaderStrip";
import { TokenUsage } from "../TokenUsage";

function snap(): Snapshot {
  return {
    revision: 1,
    project: {
      id: "p", name: "Frontend + Backend", status: "ACTIVE", budgetLevel: "MEDIUM", budgetAmount: 180000,
      projectSize: "SMALL", maxAgentCount: 12, assignedAgentCount: 2, workingAgentCount: 1,
      hasPrimaryPm: true, progressPercent: 67, progressCurrent: 8, progressTotal: 12,
      emptyLabel: null, activePlanId: null, completedAt: null,
    },
    agents: [
      { id: "a1", roleId: "r-fe", displayName: "Fira", displayColor: "#4f46e5", iconKey: "code",
        status: "WORKING", isPrimaryPm: false, currentTaskId: null, nextTaskId: null,
        activitySummary: null, llmModelId: "m", tokenTotal: 380000 },
      { id: "a2", roleId: "r-be", displayName: "Boa", displayColor: "#059669", iconKey: "dns",
        status: "WAITING", isPrimaryPm: false, currentTaskId: null, nextTaskId: null,
        activitySummary: null, llmModelId: "m", tokenTotal: 420000 },
    ],
    tasks: [
      { id: "t1", sprintMilestoneId: "m1", assignedProjectAgentId: "a1", roleId: "r-fe",
        title: "로그인 인터페이스 구현", status: "RUNNING", executionMode: "AI_AGENT", priority: "P1",
        sortOrder: 1, dependencyTaskIds: [], waitReasons: [] },
      { id: "t2", sprintMilestoneId: "m1", assignedProjectAgentId: "a1", roleId: "r-fe",
        title: "반응형 검증", status: "TODO", executionMode: null, priority: "P2",
        sortOrder: 2, dependencyTaskIds: [], waitReasons: [] },
      { id: "t3", sprintMilestoneId: "m1", assignedProjectAgentId: "a1", roleId: "r-fe",
        title: "done", status: "COMPLETED", executionMode: "AI_AGENT", priority: "P2",
        sortOrder: 0, dependencyTaskIds: [], waitReasons: [] },
    ],
    milestones: [], plans: [], pendingDecisions: [], qaRuns: [], git: [],
    tokenUsage: {
      collected: true, demo: true, totalInput: 500000, totalOutput: 300000, total: 800000,
      byRole: { FRONTEND: 380000, BACKEND: 420000 }, byAgent: { a1: 380000, a2: 420000 },
    },
  };
}

describe("dashboard flow components (04 §5,§6,§14)", () => {
  beforeEach(() =>
    useStore.setState({
      activeProjectId: "p",
      snapshot: snap(),
      rolesById: { "r-fe": { code: "FRONTEND", name: "Frontend" }, "r-be": { code: "BACKEND", name: "Backend" } },
    }),
  );

  it("agentMetrics derives current/next and weight-free progress", () => {
    const s = snap();
    const m = agentMetrics(s, s.agents[0]);
    expect(m.current?.title).toBe("로그인 인터페이스 구현"); // RUNNING wins
    expect(m.next?.title).toBe("반응형 검증"); // next TODO
    expect(m.total).toBe(3);
    expect(m.completed).toBe(1);
    expect(m.percent).toBe(33); // round(100*1/3)
  });

  it("DevelopmentFlow renders the four role nodes", () => {
    render(<DevelopmentFlow />);
    expect(screen.getByTestId("development-flow")).toBeInTheDocument();
    expect(screen.getAllByText("Frontend").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Backend").length).toBeGreaterThan(0);
  });

  it("AgentOverview shows current & next step", () => {
    render(<AgentOverview />);
    expect(screen.getAllByText("로그인 인터페이스 구현").length).toBeGreaterThan(0);
    expect(screen.getByText("반응형 검증")).toBeInTheDocument();
  });

  it("HeaderStrip shows weight-free progress and attention count", () => {
    render(<HeaderStrip />);
    const el = screen.getByTestId("dash-progress");
    expect(el).toHaveTextContent("67%");
    expect(el).toHaveTextContent("12개 작업 중 8개 완료");
  });

  it("TokenUsage shows total + per-role breakdown when collected", () => {
    render(<TokenUsage />);
    const el = screen.getByTestId("token-usage");
    expect(el).toHaveTextContent("800K");
    expect(el).toHaveTextContent("데모 데이터");
  });

  it("TokenUsage shows 미수집 when not collected", () => {
    useStore.setState({ snapshot: { ...snap(), tokenUsage: undefined } });
    render(<TokenUsage />);
    expect(screen.getByTestId("token-usage")).toHaveTextContent("미수집");
  });
});
