import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeedbackProgress } from "../FeedbackProgress";

beforeEach(() => {
  vi.useFakeTimers();
  // Keep RAF timestamps on the same virtual clock as timer advancement.
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 16));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("Feedback presentation progress", () => {
  it("fills from zero but never completes until the API result is ready", () => {
    const complete = vi.fn();
    const view = render(<FeedbackProgress ready={false} onComplete={complete} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "0");
    act(() => vi.advanceTimersByTime(800));
    expect(Number(bar.getAttribute("aria-valuenow"))).toBeGreaterThan(0);
    expect(Number(bar.getAttribute("aria-valuenow"))).toBeLessThan(90);
    act(() => vi.advanceTimersByTime(5000));
    expect(bar).toHaveAttribute("aria-valuenow", "90");
    expect(complete).not.toHaveBeenCalled();
    view.rerender(<FeedbackProgress ready onComplete={complete} />);
    act(() => vi.advanceTimersByTime(450));
    expect(bar).toHaveAttribute("aria-valuenow", "100");
    expect(complete).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(300));
    expect(complete).toHaveBeenCalledTimes(1);
  });
  it("cancels the progress callback when the user leaves the project", () => {
    const complete = vi.fn();
    const view = render(<FeedbackProgress ready onComplete={complete} />);
    view.unmount();
    act(() => vi.advanceTimersByTime(5000));
    expect(complete).not.toHaveBeenCalled();
  });
});
