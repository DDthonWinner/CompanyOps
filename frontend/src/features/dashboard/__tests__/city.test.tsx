import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Snapshot } from "../../../api/types";
import { useStore } from "../../../store/useStore";
import { CityWorkspace } from "../CityWorkspace";
import { cityModel } from "../cityModel";

vi.mock("../CityScene", () => ({ default: ({ onSelect, effects }: { onSelect: (role: string) => void; effects: boolean }) =>
  <button data-testid="scene" data-effects={effects} onClick={() => onSelect("BACKEND")}>Backend 건물</button> }));
const agent = (id: string, roleId = "be") => ({ id, roleId, displayName: id, displayColor: "", iconKey: "", status: "WORKING", isPrimaryPm: false, currentTaskId: null, nextTaskId: null, activitySummary: null, llmModelId: "m" });
function snapshot(): Snapshot {
  return {
    revision: 1, project: { id: "p" } as Snapshot["project"],
    agents: [agent("backend"), agent("frontend", "fe")],
    tasks: ["COMPLETED", "RUNNING", "CANCELLED"].map((status, i) => ({ id: `t${i}`, title: `Task ${i}`, roleId: "be", assignedProjectAgentId: "backend", sprintMilestoneId: null, status: status as Snapshot["tasks"][number]["status"], executionMode: null, priority: "P1", sortOrder: i, dependencyTaskIds: [], waitReasons: [] })),
    milestones: [], plans: [], pendingDecisions: [], qaRuns: [], git: [],
  };
}
const roles = { be: { code: "BACKEND", name: "Backend" }, fe: { code: "FRONTEND", name: "Frontend" } };
beforeEach(() => useStore.setState({ snapshot: snapshot(), rolesById: roles, connection: "CONNECTED", openSheet: null }));
describe("city snapshot integration", () => {
  it("excludes cancelled tasks, keeps empty roles and maps agents by IDs", () => {
    const nodes = cityModel(snapshot(), roles);
    expect(nodes.find((n) => n.role === "BACKEND")).toMatchObject({ percent: 50, total: 2, running: true });
    expect(nodes.find((n) => n.role === "PM")).toMatchObject({ percent: 0, total: 0, agents: [] });
    expect(nodes.find((n) => n.role === "FRONTEND")?.agents[0].agent.id).toBe("frontend");
  });
  it("does not animate waiting/review tasks even when agent reports WORKING", () => {
    const s = snapshot(); s.tasks[1].status = "REVIEW";
    s.agents.push({ ...agent("removed"), status: "REMOVED" });
    expect(cityModel(s, roles).find((n) => n.role === "BACKEND")).toMatchObject({ running: false, waiting: true, agents: [expect.objectContaining({ agent: expect.objectContaining({ id: "backend" }) })] });
  });
  it("uses the shared agent sheet for both building and accessible button selection", async () => {
    render(<CityWorkspace />);
    fireEvent.click(await screen.findByText("Backend 건물"));
    expect(useStore.getState().openSheet).toEqual({ kind: "agent", id: "backend" });
    fireEvent.click(screen.getByRole("button", { name: "frontend 상세 보기" }));
    expect(useStore.getState().openSheet).toEqual({ kind: "agent", id: "frontend" });
  });
  it("opens the department for multiple agents while keeping each selectable", async () => {
    const s = snapshot(); s.agents.push(agent("backend-2")); useStore.setState({ snapshot: s });
    render(<CityWorkspace />);
    fireEvent.click(await screen.findByText("Backend 건물"));
    expect(useStore.getState().openSheet).toEqual({ kind: "desk", id: "BACKEND" });
    expect(screen.getByRole("button", { name: "backend-2 상세 보기" })).toBeInTheDocument();
  });
  it("disables effects on disconnect and toggles to the original flow", async () => {
    useStore.setState({ connection: "DISCONNECTED" });
    render(<CityWorkspace />);
    expect(await screen.findByTestId("scene")).toHaveAttribute("data-effects", "false");
    expect(screen.getByText("DISCONNECTED · 마지막 수신 상태")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "흐름도" }));
    expect(screen.getByTestId("development-flow")).toBeInTheDocument();
    expect(screen.queryByTestId("scene")).not.toBeInTheDocument();
  });
});
