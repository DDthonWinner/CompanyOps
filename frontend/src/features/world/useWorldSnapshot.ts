import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { Snapshot } from "../../api/types";

// Opening-only read model. The existing app retains ownership of its SSE and store.
export function useWorldSnapshot(projectId: string | null, enabled: boolean) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [connection, setConnection] = useState("DISCONNECTED");
  useEffect(() => {
    if (!projectId) { setSnapshot(null); setConnection("DISCONNECTED"); return; }
    if (!enabled) return;
    setSnapshot((current) => current?.project.id === projectId ? current : null);
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    setConnection("CONNECTING");
    const refresh = async () => {
      try {
        const next = await api.getSnapshot(projectId);
        if (next?.project?.id !== projectId || !Array.isArray(next.agents)) throw new Error("Invalid project response");
        if (!cancelled) { setSnapshot(next); setConnection("CONNECTED"); }
      } catch { if (!cancelled) setConnection("ERROR"); }
      if (!cancelled) timer = setTimeout(refresh, 10000);
    };
    void refresh();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [projectId, enabled]);
  return { snapshot: snapshot?.project.id === projectId ? snapshot : null, connection };
}
