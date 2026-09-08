import { useEffect } from "react";
import { api } from "../api/client";
import type { TycoonSelection } from "../api/types";
import { GlassPanel } from "../components/ui/GlassPanel";
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
      <GlobalExecutiveBar />
      <main className="h-full w-full pt-20">
        {activeTab === "tycoon" ? <TycoonView /> : <DashboardPlaceholder />}
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
    </div>
  );
}

function DashboardPlaceholder() {
  const snapshot = useStore((s) => s.snapshot);
  return (
    <div className="flex h-full items-center justify-center p-6">
      <GlassPanel level={2} className="max-w-md p-6 text-center">
        <h2 className="display mb-2 text-lg font-semibold">Dashboard</h2>
        <p className="text-sm text-on-background/70">
          Human–AI Control Center는 <b>frontend-dashboard (U5)</b>에서 구현됩니다.
        </p>
        {snapshot && (
          <p className="tabular mt-3 text-sm">
            현재 진행률: {snapshot.project.progressTotal === 0 ? "작업 없음" : `${snapshot.project.progressPercent}%`}
          </p>
        )}
      </GlassPanel>
    </div>
  );
}
