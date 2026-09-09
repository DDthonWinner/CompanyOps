import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../api/client";
import type { Snapshot } from "../../../api/types";
import type { UtilizationPreview } from "../../../api/uf-types";
import { useStore } from "../../../store/useStore";
import { FeedbackSection } from "../FeedbackSection";

const report = { reportId: "r", projectId: "p", status: "COMPLETED", utilizationScore: 80, scoreVersion: "UF_MVP_V1", aspectScores: { AUTONOMY: 80, AREA_DISTRIBUTION: 80, RESOURCE_EFFICIENCY: null } };
const feedback = { feedbackId: "f", reportId: "r", aspect: "AUTONOMY", severity: "MEDIUM", observation: "AI 완료 작업 8/10건", impact: "자동화 여지가 있습니다.", suggestion: "계획을 구체화하세요.", source: "SYSTEM" };
const preview: UtilizationPreview = { testMode: true, sourceRevision: 1, report: { ...report, status: "PREVIEW" }, feedbacks: [feedback] };
function snapshot(status = "ACTIVE", id = "p"): Snapshot {
  return { project: { id, status, progressPercent: 100 } } as Snapshot;
}
beforeEach(() => {
  useStore.setState({ activeProjectId: "p", snapshot: snapshot() });
  vi.spyOn(api, "getUtilization").mockResolvedValue({ items: [] });
  vi.spyOn(api, "createUtilization").mockResolvedValue(report);
  vi.spyOn(api, "getFeedbacks").mockResolvedValue([feedback]);
  vi.spyOn(api, "previewUtilization").mockResolvedValue(preview);
});
afterEach(() => vi.restoreAllMocks());

describe("Feedback generation and temporary test mode", () => {
  it("expands a collapsed panel and generates once for a header request", async () => {
    useStore.setState({ snapshot: snapshot("COMPLETED") });
    const view = render(<FeedbackSection />);
    await waitFor(() => expect(screen.getByTestId("feedback-generate")).toBeEnabled());
    expect(screen.getByTestId("feedback-generate")).not.toBeVisible();
    view.rerender(<FeedbackSection requestId={1} />);
    await waitFor(() => expect(api.createUtilization).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: /접기/ })).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByText(feedback.observation, {}, { timeout: 4000 })).toBeVisible();
    view.rerender(<FeedbackSection requestId={2} />);
    expect(api.createUtilization).toHaveBeenCalledTimes(1);
  });
  it("keeps normal generation gated even at 100% and isolates preview results", async () => {
    render(<FeedbackSection />);
    fireEvent.click(screen.getByRole("button", { name: /펼치기/ }));
    expect(screen.getByTestId("feedback-generate")).toBeDisabled();
    fireEvent.click(screen.getByRole("switch", { name: "테스트 중" }));
    fireEvent.click(screen.getByTestId("feedback-generate"));
    expect(screen.getByTestId("feedback-progress")).toBeInTheDocument();
    expect(screen.queryByTestId("feedback-results")).not.toBeInTheDocument();
    expect(await screen.findByText(feedback.observation, {}, { timeout: 4000 })).toBeInTheDocument();
    expect(api.previewUtilization).toHaveBeenCalledWith("p");
    expect(api.createUtilization).not.toHaveBeenCalled();
    expect(screen.getByText("테스트 미리보기")).toBeInTheDocument();
    expect(useStore.getState().snapshot?.project.status).toBe("ACTIVE");
    fireEvent.click(screen.getByRole("switch", { name: "테스트 중" }));
    expect(screen.queryByTestId("feedback-results")).not.toBeInTheDocument();
    expect(screen.getByTestId("feedback-generate")).toBeDisabled();
  });
  it("enables generation on actual completion and calls the report API", async () => {
    render(<FeedbackSection />);
    fireEvent.click(screen.getByRole("button", { name: /펼치기/ }));
    act(() => useStore.setState({ snapshot: snapshot("COMPLETED") }));
    await waitFor(() => expect(screen.getByTestId("feedback-generate")).toBeEnabled());
    fireEvent.click(screen.getByTestId("feedback-generate"));
    expect(screen.getByTestId("feedback-progress")).toBeInTheDocument();
    expect(screen.queryByTestId("feedback-results")).not.toBeInTheDocument();
    expect(await screen.findByText(feedback.observation, {}, { timeout: 4000 })).toBeInTheDocument();
    expect(api.createUtilization).toHaveBeenCalledWith("p");
    expect(api.getFeedbacks).toHaveBeenCalledWith("r");
    expect(api.previewUtilization).not.toHaveBeenCalled();
    expect(screen.getByText("N/A")).toBeInTheDocument();
  });
  it("shows already generated completion feedback without a scoring animation", async () => {
    useStore.setState({ snapshot: snapshot("COMPLETED") });
    vi.mocked(api.getUtilization).mockResolvedValue({ items: [report] });
    render(<FeedbackSection />);
    fireEvent.click(screen.getByRole("button", { name: /펼치기/ }));
    expect(await screen.findByText(feedback.observation, {}, { timeout: 4000 })).toBeInTheDocument();
    expect(api.createUtilization).not.toHaveBeenCalled();
    expect(screen.queryByText("채점 중...")).not.toBeInTheDocument();
  });
  it("allows retry after generation failure", async () => {
    vi.mocked(api.previewUtilization).mockRejectedValueOnce(new Error("offline"));
    render(<FeedbackSection />);
    fireEvent.click(screen.getByRole("button", { name: /펼치기/ }));
    fireEvent.click(screen.getByRole("switch", { name: "테스트 중" }));
    fireEvent.click(screen.getByTestId("feedback-generate"));
    expect(await screen.findByRole("alert")).toHaveTextContent("생성에 실패");
    fireEvent.click(screen.getByTestId("feedback-generate"));
    expect(screen.getByTestId("feedback-progress")).toBeInTheDocument();
    expect(screen.queryByTestId("feedback-results")).not.toBeInTheDocument();
    expect(await screen.findByText(feedback.observation, {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("resets test mode on project changes and ignores a late preview response", async () => {
    let finish!: (value: UtilizationPreview) => void;
    vi.mocked(api.previewUtilization).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    render(<FeedbackSection />);
    fireEvent.click(screen.getByRole("button", { name: /펼치기/ }));
    fireEvent.click(screen.getByRole("switch", { name: "테스트 중" }));
    fireEvent.click(screen.getByTestId("feedback-generate"));
    act(() => useStore.setState({ activeProjectId: "p2", snapshot: snapshot("ACTIVE", "p2") }));
    await act(async () => { finish(preview); });
    expect(screen.getByRole("button", { name: /펼치기/ })).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByRole("button", { name: /펼치기/ }));
    expect(screen.getByRole("switch", { name: "테스트 중" })).not.toBeChecked();
    expect(screen.getByTestId("feedback-generate")).toBeDisabled();
    expect(screen.queryByText(feedback.observation)).not.toBeInTheDocument();
  });
});
