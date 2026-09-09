import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { SseHandlers } from "../../api/sse";
import type { Snapshot } from "../../api/types";
import { useStore } from "../../store/useStore";
import { useConnection } from "../useConnection";

const mock = vi.hoisted(() => ({ handlers: null as SseHandlers | null, getSnapshot: vi.fn() }));
vi.mock("../../api/client", () => ({ api: { getSnapshot: mock.getSnapshot, eventsUrl: () => "/events" } }));
vi.mock("../../api/sse", () => ({ SseClient: class {
  constructor(_url: string, handlers: SseHandlers) { mock.handlers = handlers; }
  connect() { mock.handlers!.onResync(); }
  disconnect() {}
} }));
afterEach(() => vi.useRealTimers());

it("coalesces event bursts and fetches again if an update arrives during a snapshot request", async () => {
  vi.useFakeTimers();
  let resolve: (value: Snapshot) => void = () => {};
  mock.getSnapshot.mockImplementation(() => new Promise<Snapshot>((done) => { resolve = done; }));
  useStore.setState({ activeProjectId: "p", snapshot: null });
  const hook = renderHook(() => useConnection());
  expect(mock.getSnapshot).toHaveBeenCalledTimes(1);
  await act(async () => resolve({ revision: 1 } as Snapshot));
  act(() => { for (let revision = 2; revision <= 60; revision++) mock.handlers!.onEvent(revision); });
  await act(async () => vi.advanceTimersByTime(80));
  expect(mock.getSnapshot).toHaveBeenCalledTimes(2);
  act(() => mock.handlers!.onEvent(61));
  await act(async () => resolve({ revision: 60 } as Snapshot));
  await act(async () => vi.advanceTimersByTime(80));
  expect(mock.getSnapshot).toHaveBeenCalledTimes(3);
  await act(async () => resolve({ revision: 61 } as Snapshot));
  expect(useStore.getState().snapshot?.revision).toBe(61);
  hook.unmount();
});
