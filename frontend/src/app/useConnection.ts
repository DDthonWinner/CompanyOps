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
    let inFlight = false;
    let requestedRevision = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      if (cancelled || timer || inFlight) return;
      timer = setTimeout(() => { timer = undefined; void resync(); }, 80);
    };

    const resync = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      let succeeded = false;
      try {
        const snap = await api.getSnapshot(projectId);
        if (cancelled) return;
        applySnapshot(snap);
        latest = Math.max(latest, snap.revision);
        succeeded = true;
      } catch {
        /* transient; SSE state reflects connectivity */
      } finally {
        inFlight = false;
        if (succeeded && requestedRevision > latest) schedule();
      }
    };

    const client = new SseClient(api.eventsUrl(projectId), {
      onState: setConnection,
      onResync: resync,
      onEvent: (rev) => {
        requestedRevision = Math.max(requestedRevision, rev);
        if (rev > latest) schedule();
      },
    });
    client.connect();
    void resync();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      client.disconnect();
    };
  }, [projectId, setConnection, applySnapshot]);
}
