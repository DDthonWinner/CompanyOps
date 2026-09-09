import { describe, expect, it } from "vitest";
import type { Snapshot } from "../../../api/types";
import { DESK_ROLES } from "../../../lib/roles";
import { flowModel } from "../flowModel";

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
describe("flow role aggregation", () => {
  it("excludes cancelled tasks, keeps empty roles and maps agents by IDs", () => {
    const nodes = flowModel(snapshot(), roles);
    expect(nodes.find((n) => n.role === "BACKEND")).toMatchObject({ percent: 50, total: 2, running: true });
    expect(nodes.find((n) => n.role === "PM")).toMatchObject({ percent: 0, total: 0, agents: [] });
    expect(nodes.find((n) => n.role === "FRONTEND")?.agents[0].agent.id).toBe("frontend");
  });
  it("includes the same roles as tycoon, including Database", () => {
    const s = snapshot();
    s.agents.push(agent("database", "db"));
    s.tasks.push({ ...s.tasks[1], id: "db-task", roleId: "db", assignedProjectAgentId: "database" });
    const nodes = flowModel(s, { ...roles, db: { code: "DATABASE" } });
    expect(nodes.map((node) => node.role).sort()).toEqual([...DESK_ROLES].sort());
    expect(nodes.find((node) => node.role === "DATABASE")).toMatchObject({ total: 1, running: true, agents: [expect.objectContaining({ agent: expect.objectContaining({ id: "database" }) })] });
  });
  it("keeps waiting/review tasks distinct from running agents", () => {
    const s = snapshot(); s.tasks[1].status = "REVIEW";
    s.agents.push({ ...agent("removed"), status: "REMOVED" });
    expect(flowModel(s, roles).find((n) => n.role === "BACKEND")).toMatchObject({ running: false, waiting: true, agents: [expect.objectContaining({ agent: expect.objectContaining({ id: "backend" }) })] });
  });
});
