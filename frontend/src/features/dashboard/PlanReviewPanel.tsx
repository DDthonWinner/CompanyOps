import { useState } from "react";
import { api } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { StatusPill } from "../../components/ui/StatusPill";
import { useStore } from "../../store/useStore";
import { runWrite } from "./actions";
import { ROLE_LABEL } from "../../lib/roles";

export function PlanReviewPanel() {
  const pid = useStore((s) => s.activeProjectId);
  const plans = useStore((s) => s.snapshot?.plans ?? []);
  const snapshot = useStore((s) => s.snapshot);
  const roles = useStore((s) => s.rolesById);
  const connection = useStore((s) => s.connection);
  const [instruction, setInstruction] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);

  // Current plan = highest-version non-superseded plan (FR-DASH-2).
  const plan = [...plans].filter((p) => p.status !== "SUPERSEDED").sort((a, b) => b.version - a.version)[0];
  if (!plan) {
    const assignedRoles = [...new Set((snapshot?.agents ?? []).filter((agent) => agent.status !== "REMOVED")
      .map((agent) => roles[agent.roleId]?.code).filter((role): role is string => Boolean(role)))];
    const role = assignedRoles.includes(selectedRole) ? selectedRole : assignedRoles.includes("BACKEND") ? "BACKEND" : assignedRoles.find((code) => code !== "PM") ?? assignedRoles[0];
    const ready = snapshot?.project.status === "READY";
    const create = async () => {
      if (!pid || !ready || !role || !instruction.trim() || busy || connection !== "CONNECTED") return;
      setBusy(true);
      await runWrite(() => api.postCommand(pid, {
        instruction: instruction.trim(),
        steps: [{ title: instruction.trim().slice(0, 120), description: instruction.trim(), roleCode: role,
          milestoneTitle: "첫 번째 마일스톤" }],
      }));
      setBusy(false);
    };
    return (
      <GlassPanel level={2} className="p-4" data-testid="plan-review-panel">
        <h3 className="display mb-1 text-sm font-semibold">첫 계획 만들기</h3>
        {ready ? <div className="space-y-3">
          <p className="text-xs text-on-background/60">팀 배정이 완료되었습니다. 먼저 수행할 작업과 담당 역할을 정하세요. 계획을 검토하고 최종 승인한 뒤 실행됩니다.</p>
          <label className="block text-xs">첫 작업의 목표와 완료 조건
            <textarea className="input mt-1" value={instruction} onChange={(e) => setInstruction(e.target.value)}
              placeholder="예: 입력한 금액의 합계를 계산하는 함수를 만들고 결과 예제를 작성하세요." data-testid="initial-plan-instruction" />
          </label>
          <label className="block text-xs">담당 역할
            <select className="input mt-1" value={role ?? ""} onChange={(e) => setSelectedRole(e.target.value)}>
              {assignedRoles.map((code) => <option key={code} value={code}>{ROLE_LABEL[code] ?? code}</option>)}
            </select>
          </label>
          <div className="flex justify-end"><Button onClick={create} disabled={busy || !instruction.trim() || !role || connection !== "CONNECTED"} data-testid="initial-plan-create">{busy ? "계획 등록 중…" : "계획 만들기"}</Button></div>
        </div> : <p className="text-xs text-on-background/50">팀 배정 후 첫 계획을 만들 수 있습니다.</p>}
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
        <h3 className="display text-sm font-semibold">계획 검토</h3>
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
