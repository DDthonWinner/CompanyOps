import { useState } from "react";
import { api } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { StatusPill } from "../../components/ui/StatusPill";
import { useStore } from "../../store/useStore";
import { runWrite } from "./actions";

export function PlanReviewPanel() {
  const pid = useStore((s) => s.activeProjectId);
  const plans = useStore((s) => s.snapshot?.plans ?? []);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);

  // Current plan = highest-version non-superseded plan (FR-DASH-2).
  const plan = [...plans].filter((p) => p.status !== "SUPERSEDED").sort((a, b) => b.version - a.version)[0];
  if (!plan) {
    return (
      <GlassPanel level={2} className="p-4" data-testid="plan-review-panel">
        <h3 className="display mb-1 text-sm font-semibold">Plan Review</h3>
        <p className="text-xs text-on-background/50">아직 등록된 계획이 없습니다. 계획이 생성되면 이곳에서 검토할 수 있습니다.</p>
      </GlassPanel>
    );
  }

  const act = async (fn: () => Promise<unknown>) => {
    if (!pid) return;
    setBusy(true);
    await runWrite(fn);
    setBusy(false);
    setFeedback("");
  };

  const isReview = plan.status === "REVIEW";
  const isFinal = plan.status === "FINAL_APPROVAL_PENDING";

  return (
    <GlassPanel level={2} className="p-4" data-testid="plan-review-panel">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="display text-sm font-semibold">Plan Review</h3>
        <span className="flex items-center gap-2 text-xs">
          <span className="tabular">v{plan.version}</span>
          <StatusPill status={plan.status === "REVIEW" ? "REVIEW" : plan.status === "EXECUTING" ? "RUNNING" : "WAITING"} />
          <span className="text-on-background/50">{plan.status}</span>
        </span>
      </div>
      {plan.request && <p className="mb-2 text-xs text-on-background/70">{plan.request}</p>}

      {isReview && (
        <div className="space-y-2">
          <textarea
            className="input"
            placeholder="계획 피드백 (Request Changes)"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            data-testid="plan-feedback-input"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              disabled={busy || !feedback.trim()}
              data-testid="plan-feedback-btn"
              onClick={() => act(() => api.planFeedback(pid!, plan.id, plan.version, feedback))}
            >
              변경 요청
            </Button>
            <Button
              disabled={busy}
              data-testid="plan-review-complete-btn"
              onClick={() => act(() => api.planReviewComplete(pid!, plan.id, plan.version))}
            >
              검토 완료
            </Button>
          </div>
        </div>
      )}

      {isFinal && (
        <div className="flex justify-end">
          <Button
            disabled={busy}
            data-testid="plan-approve-btn"
            onClick={() => act(() => api.planApprove(pid!, plan.id, plan.version))}
          >
            최종 실행 승인
          </Button>
        </div>
      )}

      {!isReview && !isFinal && (
        <p className="text-xs text-on-background/50">이 계획 버전은 실행 흐름에 있습니다.</p>
      )}
    </GlassPanel>
  );
}
