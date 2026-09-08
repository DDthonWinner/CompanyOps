import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { useStore } from "../../store/useStore";
import { ScrollWorld } from "./ScrollWorld";

vi.mock("./useWorldSnapshot", () => ({ useWorldSnapshot: () => ({ snapshot: null, connection: "DISCONNECTED" }) }));
vi.mock("../tycoon/WebGLFallback", () => ({ isWebGLAvailable: () => false }));
vi.mock("../../app/AppShell", () => ({ AppShell: () => {
  const id = useStore((state) => state.activeProjectId);
  const tab = useStore((state) => state.ui.activeTab);
  return <div data-testid="existing-office">{id ?? "empty"}:{tab}</div>;
} }));

const project = (id: string, name: string) => ({ id, name, status: "READY", assignedAgentCount: 3, budgetLevel: "MEDIUM", budgetAmount: 180000, maxAgentCount: 12, hasPrimaryPm: true });

function setupScroll() {
  const node = screen.getByTestId("world-scroll");
  Object.defineProperties(node, { scrollHeight: { value: 1100 }, clientHeight: { value: 100 } });
  node.scrollTo = vi.fn((options?: ScrollToOptions | number) => {
    node.scrollTop = typeof options === "object" ? options.top ?? 0 : 0;
    fireEvent.scroll(node);
  });
  return node;
}

async function moveTo(node: HTMLElement, progress: number) {
  await act(async () => {
    node.scrollTop = progress * 1000;
    fireEvent.scroll(node);
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

describe("scroll world project-to-office journey", () => {
  beforeEach(() => {
    vi.spyOn(api, "listAgentProfiles").mockResolvedValue([]);
    useStore.setState({ activeProjectId: null, snapshot: null, ui: { activeTab: "dashboard", camera: {} } });
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => window.setTimeout(() => cb(0), 0));
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ items: [project("p1", "AI Commerce"), project("p2", "Seoul Studio")] }))));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("selects the actual project and reveals the existing Tycoon app on the final scroll", async () => {
    render(<ScrollWorld />);
    const node = setupScroll();
    await moveTo(node, 0.32);
    const second = await screen.findByRole("button", { name: /Seoul Studio/ });
    fireEvent.click(second);
    expect(second).toHaveAttribute("aria-pressed", "true");
    expect(useStore.getState().activeProjectId).toBe("p2");
    expect(useStore.getState().snapshot).toBeNull();
    await moveTo(node, 1);
    expect(await screen.findByTestId("existing-office")).toHaveTextContent("p2:tycoon");
    expect(screen.getByRole("region", { name: "프로젝트 오피스" })).not.toHaveAttribute("inert");
    expect(node).toHaveClass("is-in-office");
  });

  it("keeps the office inert during the transition and can return to project selection", async () => {
    render(<ScrollWorld />);
    const node = setupScroll();
    await moveTo(node, 0.88);
    await screen.findByTestId("existing-office");
    expect(screen.getByLabelText("프로젝트 오피스")).toHaveAttribute("inert");
    await moveTo(node, 1);
    fireEvent.click(screen.getByRole("button", { name: /도시 · 프로젝트 선택/ }));
    await waitFor(() => expect(screen.getByRole("heading", { name: /어떤 가능성을/ })).toBeInTheDocument());
    expect(screen.queryByTestId("existing-office")).not.toBeInTheDocument();
  });

  it("handles an empty project list without inventing projects or blocking the office", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ items: [] })));
    render(<ScrollWorld />);
    const node = setupScroll();
    await moveTo(node, 0.32);
    expect(await screen.findByText("아직 입주한 프로젝트가 없습니다.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /첫 프로젝트 만들러/ }));
    expect(await screen.findByTestId("existing-office")).toHaveTextContent("empty:dashboard");
  });

  it("offers retry after a failed project request and displays recovered projects", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    render(<ScrollWorld />);
    const node = setupScroll();
    await moveTo(node, 0.32);
    expect(await screen.findByText("프로젝트 서버에 연결할 수 없습니다.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /다시 불러오기/ }));
    expect(await screen.findByRole("button", { name: /AI Commerce/ })).toBeInTheDocument();
  });

  it("clears a deleted persisted project only after a successful list response", async () => {
    useStore.setState({ activeProjectId: "deleted-project" });
    render(<ScrollWorld />);
    await waitFor(() => expect(useStore.getState().activeProjectId).toBeNull());
  });
});
