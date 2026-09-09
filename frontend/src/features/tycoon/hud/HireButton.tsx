import { useState } from "react";
import { api } from "../../../api/client";
import { pushToast } from "../../../components/ui/toast";
import { useStore } from "../../../store/useStore";

// Prominent CTA above the right HUD panel — hires one more agent onto the
// least-staffed desk via the backend, then refreshes the snapshot.
export function HireButton() {
  const projectId = useStore((s) => s.activeProjectId);
  const applySnapshot = useStore((s) => s.applySnapshot);
  const [busy, setBusy] = useState(false);

  const hire = async () => {
    if (!projectId || busy) return;
    setBusy(true);
    try {
      const res = (await api.hireAgent(projectId)) as { agent?: { displayName?: string } };
      // Pull the fresh snapshot so the new agent appears at its desk immediately.
      const snap = await api.getSnapshot(projectId);
      if (snap) applySnapshot(snap);
      pushToast(`고용 완료: ${res?.agent?.displayName ?? "새 Agent"}`, "success");
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "고용에 실패했습니다.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      data-testid="hire-agent"
      onClick={hire}
      disabled={busy}
      className="pointer-events-auto flex w-full shrink-0 items-center justify-center gap-2 rounded-hud bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary shadow-md transition hover:bg-primary-container active:scale-[0.98] disabled:opacity-60"
    >
      <span className="text-base leading-none">＋</span>
      {busy ? "고용 중…" : "Agent 고용하기"}
    </button>
  );
}
