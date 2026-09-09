import { useEffect } from "react";
import { api } from "../api/client";
import type { TycoonSelection } from "../api/types";
import { BrandLogo } from "../components/ui/BrandLogo";
import { Toaster } from "../components/ui/toast";
import { openProjectVillage } from "../features/tycoon/projectCreationNavigation";
import { AdminView } from "../features/admin/AdminView";
import { DashboardView } from "../features/dashboard/DashboardView";
import { AgentSheet } from "../features/tycoon/hud/AgentSheet";
import { DeskSheet } from "../features/tycoon/hud/DeskSheet";
import { TycoonView } from "../features/tycoon/TycoonView";
import { SELECTION_EVENT } from "../features/tycoon/selectionEvent";
import { useStore } from "../store/useStore";
import { GlobalExecutiveBar } from "./GlobalExecutiveBar";
import { resolveSelection } from "./selection";
import { useConnection } from "./useConnection";

export function AppShell() {
  useConnection();
  const setRoles = useStore((s) => s.setRoles);
  const activeTab = useStore((s) => s.ui.activeTab);
  const openSheet = useStore((s) => s.openSheet);
  const openAgentSheet = useStore((s) => s.openAgentSheet);
  const openDeskSheet = useStore((s) => s.openDeskSheet);
  const closeSheet = useStore((s) => s.closeSheet);

  useEffect(() => {
    api.listRoles().then(setRoles).catch(() => {});
  }, [setRoles]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as TycoonSelection;
      const sel = resolveSelection(detail);
      if (!sel) return;
      if (sel.kind === "agent") openAgentSheet(sel.id);
      else openDeskSheet(sel.id);
    };
    window.addEventListener(SELECTION_EVENT, handler as EventListener);
    return () => window.removeEventListener(SELECTION_EVENT, handler as EventListener);
  }, [openAgentSheet, openDeskSheet]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* White plate is a bit larger than the logo so the mark sits comfortably inside. */}
      <button
        onClick={openProjectVillage}
        title="마을 뷰로 이동"
        aria-label="마을 뷰로 이동"
        data-testid="app-brand"
        className="fixed left-4 top-4 z-50 flex items-center justify-center !bg-white px-4.5 py-3 text-on-background shadow-sm transition hover:text-primary"
      >
        <BrandLogo className="pointer-events-none scale-[0.85]" />
      </button>
      <GlobalExecutiveBar />
      {/* Tycoon is full-bleed (3D fills behind the floating GNB); other tabs clear the bar. */}
      <main className={`h-full w-full ${activeTab === "tycoon" ? "" : "pt-44 sm:pt-32 lg:pt-20"}`}>
        {activeTab === "tycoon" ? <TycoonView /> : activeTab === "admin" ? <AdminView /> : <DashboardView />}
      </main>
      <AgentSheet
        open={openSheet?.kind === "agent"}
        projectAgentId={openSheet?.kind === "agent" ? openSheet.id : undefined}
        onClose={closeSheet}
      />
      <DeskSheet
        open={openSheet?.kind === "desk"}
        roleCode={openSheet?.kind === "desk" ? openSheet.id : undefined}
        onClose={closeSheet}
      />
      <Toaster />
    </div>
  );
}
