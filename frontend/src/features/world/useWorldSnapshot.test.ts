import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import type { Snapshot } from "../../api/types";
import { useStore } from "../../store/useStore";
import { useWorldSnapshot } from "./useWorldSnapshot";

const snapshot = (id: string) => ({ project: { id }, revision: 1, agents: [] }) as unknown as Snapshot;
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe("opening-only backend reads", () => {
  it("loads real project data without changing the Tycoon snapshot store", async () => {
    const before = useStore.getState().snapshot;
    vi.spyOn(api, "getSnapshot").mockResolvedValue(snapshot("one"));
    const { result } = renderHook(() => useWorldSnapshot("one", true));
    await waitFor(() => expect(result.current.connection).toBe("CONNECTED"));
    expect(result.current.snapshot?.project.id).toBe("one");
    expect(useStore.getState().snapshot).toBe(before);
  });
  it("ignores a late response from the previously selected building", async () => {
    let finish: (value: Snapshot) => void = () => {};
    vi.spyOn(api, "getSnapshot").mockImplementation((id) => id === "one" ? new Promise((resolve) => { finish = resolve; }) : Promise.resolve(snapshot(id)));
    const { result, rerender } = renderHook(({ id }) => useWorldSnapshot(id, true), { initialProps: { id: "one" } });
    rerender({ id: "two" });
    await waitFor(() => expect(result.current.snapshot?.project.id).toBe("two"));
    await act(async () => { finish(snapshot("one")); });
    expect(result.current.snapshot?.project.id).toBe("two");
  });
  it("does not start opening requests after handing control to the existing app", () => {
    const get = vi.spyOn(api, "getSnapshot");
    renderHook(() => useWorldSnapshot("one", false));
    expect(get).not.toHaveBeenCalled();
  });
});
