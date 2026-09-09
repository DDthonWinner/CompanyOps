// Single source of truth (D5): server snapshot (read-only) + persisted UI slice.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ConnState } from "../api/sse";
import type { Snapshot } from "../api/types";

export type DashboardPanel = "overview" | "tasks" | "plan" | "quality" | "resources" | "activity" | "artifacts";

export interface OpenSheet {
  kind: "agent" | "desk";
  id: string; // projectAgentId (agent) or roleCode (desk)
}

interface StoreState {
  activeProjectId: string | null;
  snapshot: Snapshot | null;
  lastSyncAt: string | null;
  connection: ConnState;
  ui: { activeTab: "tycoon" | "dashboard" | "admin"; camera: { target?: string }; dashboardPanel?: DashboardPanel };
  // One-shot navigation intent; never persisted with the selected panel.
  dashboardScrollRequest: { panel: DashboardPanel } | null;
  openSheet: OpenSheet | null;
  rolesById: Record<string, { code: string; name: string }>;

  setRoles: (roles: Array<{ id: string; code: string; name: string }>) => void;
  setActiveProject: (id: string | null) => void;
  applySnapshot: (s: Snapshot) => void;
  setConnection: (c: ConnState) => void;
  setActiveTab: (t: "tycoon" | "dashboard" | "admin") => void;
  setCamera: (target?: string) => void;
  setDashboardPanel: (panel: DashboardPanel) => void;
  openAgentSheet: (projectAgentId: string) => void;
  openDeskSheet: (roleCode: string) => void;
  closeSheet: () => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      activeProjectId: null,
      snapshot: null,
      lastSyncAt: null,
      connection: "DISCONNECTED",
      ui: { activeTab: "tycoon", camera: {} },
      dashboardScrollRequest: null,
      openSheet: null,
      rolesById: {},

      setRoles: (roles) =>
        set({ rolesById: Object.fromEntries(roles.map((r) => [r.id, { code: r.code, name: r.name }])) }),
      setActiveProject: (id) => set({ activeProjectId: id, snapshot: null, dashboardScrollRequest: null }),
      applySnapshot: (s) => {
        const current = get().snapshot;
        // Ignore stale/duplicate revisions (FR-TY-2).
        if (current && s.revision <= current.revision) return;
        set({ snapshot: s, lastSyncAt: new Date().toISOString() });
      },
      setConnection: (c) => set({ connection: c }),
      setActiveTab: (t) => set((st) => ({ ui: { ...st.ui, activeTab: t }, dashboardScrollRequest: null })),
      setDashboardPanel: (dashboardPanel) => set((st) => ({ ui: { ...st.ui, activeTab: "dashboard", dashboardPanel }, dashboardScrollRequest: { panel: dashboardPanel } })),
      setCamera: (target) => set((st) => ({ ui: { ...st.ui, camera: { target } } })),
      openAgentSheet: (projectAgentId) => set({ openSheet: { kind: "agent", id: projectAgentId } }),
      openDeskSheet: (roleCode) => set({ openSheet: { kind: "desk", id: roleCode } }),
      closeSheet: () => set({ openSheet: null }),
    }),
    {
      name: "companyops-ui",
      // Only UI settings persist to Local Storage (06 §1); business state never does.
      partialize: (st) => ({ activeProjectId: st.activeProjectId, ui: st.ui }),
    },
  ),
);
