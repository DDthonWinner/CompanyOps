// Pure resolver for the tycoon-item-selected CustomEvent (06 §6). Testable in isolation.
import type { TycoonSelection } from "../api/types";
import type { OpenSheet } from "../store/useStore";

export function resolveSelection(detail: TycoonSelection): OpenSheet | null {
  if (detail.type === "agent") {
    return detail.projectAgentId ? { kind: "agent", id: detail.projectAgentId } : null;
  }
  // desk / monitor / inbox / outbox → desk sheet keyed by roleCode
  return detail.roleCode ? { kind: "desk", id: detail.roleCode } : null;
}
