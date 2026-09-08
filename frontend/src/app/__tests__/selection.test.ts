import { describe, expect, it } from "vitest";
import { resolveSelection } from "../selection";

describe("resolveSelection (06 §6)", () => {
  it("agent selection requires projectAgentId", () => {
    expect(resolveSelection({ projectId: "p", type: "agent", projectAgentId: "a1" }))
      .toEqual({ kind: "agent", id: "a1" });
    expect(resolveSelection({ projectId: "p", type: "agent" })).toBeNull();
  });

  it("desk/monitor/inbox/outbox map to a desk sheet by roleCode", () => {
    for (const type of ["desk", "monitor", "inbox", "outbox"] as const) {
      expect(resolveSelection({ projectId: "p", type, roleCode: "BACKEND" }))
        .toEqual({ kind: "desk", id: "BACKEND" });
    }
    expect(resolveSelection({ projectId: "p", type: "desk" })).toBeNull();
  });
});
