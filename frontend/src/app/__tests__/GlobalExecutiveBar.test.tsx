import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "../../store/useStore";
import { GlobalExecutiveBar } from "../GlobalExecutiveBar";

describe("GlobalExecutiveBar", () => {
  beforeEach(() => {
    useStore.setState({ connection: "CONNECTED", lastSyncAt: new Date().toISOString(), snapshot: null });
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ items: [
        { id: "p1", name: "Demo", status: "READY", budgetLevel: "MEDIUM", budgetAmount: 180000,
          assignedAgentCount: 2, maxAgentCount: 12, hasPrimaryPm: true },
      ], total: 1 }), { status: 200, headers: { "Content-Type": "application/json" } }),
    ));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("renders tabs, connection status, and the project picker", async () => {
    render(<GlobalExecutiveBar />);
    expect(screen.getByTestId("gebar-tab-tycoon")).toBeInTheDocument();
    expect(screen.getByTestId("gebar-tab-dashboard")).toBeInTheDocument();
    expect(screen.getByTestId("gebar-connection")).toHaveTextContent("연결됨");
    await waitFor(() => expect(screen.getByText(/Demo · MEDIUM/)).toBeInTheDocument());
  });
});
