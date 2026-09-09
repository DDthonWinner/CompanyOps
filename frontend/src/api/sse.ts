// SSE client (06 §5): connection states, 45s watchdog, backoff 1/2/5/10s, snapshot re-read hooks.
export type ConnState = "CONNECTING" | "CONNECTED" | "RECONNECTING" | "DISCONNECTED" | "ERROR";

const BACKOFF_MS = [1000, 2000, 5000, 10000];
const WATCHDOG_MS = 45000;

type EventSourceCtor = new (url: string) => EventSource;

export interface SseHandlers {
  onState: (s: ConnState) => void;
  onResync: () => void; // full snapshot re-read (on (re)connect)
  onEvent: (revision: number) => void; // conditional re-read on higher revision
}

export class SseClient {
  private es: EventSource | null = null;
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  private closed = false;

  constructor(
    private url: string,
    private handlers: SseHandlers,
    private ESImpl: EventSourceCtor = (globalThis as any).EventSource,
  ) {}

  connect(): void {
    this.closed = false;
    this.handlers.onState(this.attempt === 0 ? "CONNECTING" : "RECONNECTING");
    this.es = new this.ESImpl(this.url);
    this.es.onopen = () => {
      this.attempt = 0;
      this.handlers.onState("CONNECTED");
      this.handlers.onResync();
      this.resetWatchdog();
    };
    const receive = (ev: MessageEvent) => {
      this.resetWatchdog();
      try {
        const data = JSON.parse(ev.data);
        if (typeof data.revision === "number") this.handlers.onEvent(data.revision);
      } catch {
        /* ignore malformed */
      }
    };
    this.es.onmessage = receive;
    this.es.addEventListener("project.updated", receive);
    this.es.onerror = () => {
      if (this.closed) return;
      this.handlers.onState("RECONNECTING");
      this.scheduleReconnect();
    };
  }

  private resetWatchdog(): void {
    if (this.watchdog) clearTimeout(this.watchdog);
    this.watchdog = setTimeout(() => {
      this.handlers.onState("RECONNECTING");
      this.reconnect();
    }, WATCHDOG_MS);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const delay = BACKOFF_MS[Math.min(this.attempt, BACKOFF_MS.length - 1)];
    this.attempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnect();
    }, delay);
  }

  private reconnect(): void {
    this.teardownSource();
    if (!this.closed) this.connect();
  }

  private teardownSource(): void {
    if (this.watchdog) { clearTimeout(this.watchdog); this.watchdog = null; }
    if (this.es) { this.es.close(); this.es = null; }
  }

  disconnect(): void {
    this.closed = true;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.teardownSource();
    this.handlers.onState("DISCONNECTED");
  }
}
