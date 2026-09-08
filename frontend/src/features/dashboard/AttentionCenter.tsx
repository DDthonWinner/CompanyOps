import { GlassPanel } from "../../components/ui/GlassPanel";
import { useStore } from "../../store/useStore";
import { deriveAttention } from "./attention";
import { DecisionCard } from "./cards/DecisionCard";
import { MilestoneResultApprovalCard } from "./cards/MilestoneResultApprovalCard";
import { PlanApprovalCard } from "./cards/PlanApprovalCard";
import { QAReviewCard } from "./cards/QAReviewCard";

export function AttentionCenter() {
  const snapshot = useStore((s) => s.snapshot);
  const items = deriveAttention(snapshot);

  const gateOkForMilestone = (milestoneId: string): boolean => {
    if (!snapshot) return false;
    const taskIds = snapshot.tasks.filter((t) => t.sprintMilestoneId === milestoneId).map((t) => t.id);
    const failed = snapshot.qaRuns.some((q) => taskIds.includes(q.taskId) && q.technicalGate === "FAILED");
    return !failed;
  };

  return (
    <GlassPanel level={3} className="p-4" data-testid="attention-center">
      <h3 className="display mb-3 text-sm font-semibold">Attention Center</h3>
      {items.length === 0 && <div className="text-xs text-on-background/50">처리할 항목이 없습니다.</div>}
      <div className="space-y-2">
        {items.map((it) => {
          if (it.kind === "DECISION") return <DecisionCard key={it.id} decisionId={it.id} reason={it.detail} />;
          if (it.kind === "PLAN_APPROVAL") {
            const plan = snapshot?.plans.find((p) => p.id === it.id);
            return <PlanApprovalCard key={it.id} planId={it.id} version={plan?.version ?? 1} request={it.detail} />;
          }
          if (it.kind === "MILESTONE_RESULT") {
            const m = snapshot?.milestones.find((x) => x.id === it.id);
            return (
              <MilestoneResultApprovalCard
                key={it.id}
                milestoneId={it.id}
                title={m?.title ?? it.title}
                gateOk={gateOkForMilestone(it.id)}
              />
            );
          }
          return <QAReviewCard key={it.id} title={it.title} detail={it.detail} />;
        })}
      </div>
      <p className="mt-2 text-[10px] text-on-background/40">
        알림을 읽거나 닫는 것은 처리 완료를 의미하지 않습니다.
      </p>
    </GlassPanel>
  );
}
