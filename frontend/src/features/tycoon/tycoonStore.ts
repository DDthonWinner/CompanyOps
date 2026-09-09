// Local (client-only) tycoon interactions that aren't part of the server snapshot.
// Reassignments move an agent to a different desk in the office view (visual only —
// not persisted to the backend). recallVersion bumps to send wandering agents back.
import { create } from "zustand";

interface TycoonState {
  // agentId -> overridden role code (desk)
  reassignments: Record<string, string>;
  reassign: (agentId: string, roleCode: string) => void;
  // bumped to recall all wandering agents to their desks
  recallVersion: number;
  recallAll: () => void;
}

export const useTycoonStore = create<TycoonState>((set) => ({
  reassignments: {},
  reassign: (agentId, roleCode) =>
    set((s) => ({ reassignments: { ...s.reassignments, [agentId]: roleCode } })),
  recallVersion: 0,
  recallAll: () => set((s) => ({ recallVersion: s.recallVersion + 1 })),
}));
