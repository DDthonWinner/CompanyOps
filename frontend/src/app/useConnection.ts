// Wire SseClient → store for the active project (RT-1/2).
import { useEffect } from "react";
import { api } from "../api/client";
import { SseClient } from "../api/sse";
import { useStore } from "../store/useStore";

export function useConnection(): void {
  const projectId = useStore((s) => s.activeProjectId);
  const setConnection = useStore((s) => s.setConnection);
  const applySnapshot = useStore((s) => s.applySnapshot);

  useEffect(() => {
    if (!projectId) {
      setConnection("DISCONNECTED");
      return;
    }
    let latest = 0;
    let cancelled = false;

    const resync = async () => {
      try {
        const snap = await api.getSnapshot(projectId);
        if (cancelled) return;
        applySnapshot(snap);
        latest = snap.revision;
      } catch {
        /* transient; SSE state reflects connectivity */
      }
    };

    const client = new SseClient(api.eventsUrl(projectId), {
      onState: setConnection,
      onResync: resync,
      onEvent: (rev) => {
        if (rev > latest) resync();
      },
    });
    client.connect();
    void resync();

    return () => {
      cancelled = true;
      client.disconnect();
    };
  }, [projectId, setConnection, applySnapshot]);
}
