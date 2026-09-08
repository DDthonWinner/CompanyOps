import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SseClient, type ConnState } from "../sse";

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  close() {
    this.closed = true;
  }
}

describe("SseClient (06 §5)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeEventSource.instances = [];
  });
  afterEach(() => vi.useRealTimers());

  it("transitions CONNECTING → CONNECTED and resyncs on open", () => {
    const states: ConnState[] = [];
    let resyncs = 0;
    const client = new SseClient(
      "http://x/events",
      { onState: (s) => states.push(s), onResync: () => (resyncs += 1), onEvent: () => {} },
      FakeEventSource as unknown as new (u: string) => EventSource,
    );
    client.connect();
    expect(states[0]).toBe("CONNECTING");
    FakeEventSource.instances[0].onopen!();
    expect(states).toContain("CONNECTED");
    expect(resyncs).toBe(1);
    client.disconnect();
  });

  it("re-reads snapshot only on a higher revision", () => {
    const events: number[] = [];
    const client = new SseClient(
      "http://x/events",
      { onState: () => {}, onResync: () => {}, onEvent: (r) => events.push(r) },
      FakeEventSource as unknown as new (u: string) => EventSource,
    );
    client.connect();
    const es = FakeEventSource.instances[0];
    es.onmessage!({ data: JSON.stringify({ revision: 3 }) } as MessageEvent);
    es.onmessage!({ data: JSON.stringify({ revision: 4 }) } as MessageEvent);
    expect(events).toEqual([3, 4]);
    client.disconnect();
  });

  it("reconnects with backoff after an error", () => {
    const states: ConnState[] = [];
    const client = new SseClient(
      "http://x/events",
      { onState: (s) => states.push(s), onResync: () => {}, onEvent: () => {} },
      FakeEventSource as unknown as new (u: string) => EventSource,
    );
    client.connect();
    FakeEventSource.instances[0].onerror!();
    expect(states).toContain("RECONNECTING");
    vi.advanceTimersByTime(1000); // first backoff
    expect(FakeEventSource.instances.length).toBe(2); // reconnected
    client.disconnect();
    expect(states[states.length - 1]).toBe("DISCONNECTED");
  });
});
