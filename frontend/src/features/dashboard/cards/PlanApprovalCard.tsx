import { useState } from "react";
import { api } from "../../../api/client";
import { Button } from "../../../components/ui/Button";
import { useStore } from "../../../store/useStore";
import { runWrite } from "../actions";
import { Card } from "./DecisionCard";

export function PlanApprovalCard({ planId, version, request }: { planId: string; version: number; request?: string }) {
  const pid = useStore((s) => s.activeProjectId);
  const [busy, setBusy] = useState(false);

  const approve = async () => {
    if (!pid) return;
    setBusy(true);
    await runWrite(() => api.planApprove(pid, planId, version));
    setBusy(false);
  };

  return (
    <Card kind={`계획 최종 실행 승인 (v${version})`} color="#4648d4">
      {request && <p className="text-xs text-on-background/70">{request}</p>}
      <p className="mt-1 text-[11px] text-on-background/50">검토 완료 상태입니다. 승인해야 실행이 시작됩니다.</p>
      <div className="mt-2 flex justify-end">
        <Button onClick={approve} disabled={busy} data-testid={`plan-approve-${planId}`}>
          최종 실행 승인
        </Button>
      </div>
    </Card>
  );
}
