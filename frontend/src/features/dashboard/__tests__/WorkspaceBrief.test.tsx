import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { Snapshot } from "../../../api/types";
import { useStore } from "../../../store/useStore";
import { WorkspaceBrief } from "../WorkspaceBrief";

beforeEach(() => useStore.setState({ ui: { activeTab: "dashboard", camera: {} }, snapshot: {
  plans: [{id:"plan",version:2,status:"EXECUTING",request:"서비스 구현"}],
  tasks: [{id:"task",title:"진행 중인 작업",status:"RUNNING"}],
  qaRuns: [{id:"qa",runStatus:"COMPLETED",technicalGate:"FAILED"}],
  milestones: [], git: [],
} as unknown as Snapshot }));
describe("expanded project summary", () => {
  it("shows compact token and plan summaries and navigates explicitly", () => {
    render(<WorkspaceBrief />);
    fireEvent.click(screen.getByRole("button", { name: /Token Usage/ }));
    expect(useStore.getState().ui.dashboardPanel).toBe("resources");
    fireEvent.click(screen.getByRole("button", { name: /현재 계획/ }));
    expect(useStore.getState().ui.dashboardPanel).toBe("plan");
  });
  it("shows every summary together without tabs and preserves snapshot data", () => {
    const before = useStore.getState().snapshot;
    render(<WorkspaceBrief />);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByText("진행 중인 작업")).toBeInTheDocument();
    expect(screen.getByText("Gate 실패·오류")).toBeInTheDocument();
    expect(screen.getByText("아직 게시된 결과물이 없습니다.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /QA 상세 보기/ }));
    expect(useStore.getState().ui.dashboardPanel).toBe("quality");
    expect(useStore.getState().snapshot).toBe(before);
  });
});
