import { useEffect, useState } from "react";
import { api } from "../../../api/client";
import { Button } from "../../../components/ui/Button";
import { pushToast } from "../../../components/ui/toast";
import { useStore } from "../../../store/useStore";
import { runWrite } from "../actions";
import { Card } from "./DecisionCard";

export function MilestoneResultApprovalCard({
  milestoneId, title, gateOk,
}: { milestoneId: string; title: string; gateOk: boolean }) {
  const pid = useStore((s) => s.activeProjectId);
  const [version, setVersion] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pid) return;
    api.getMilestoneResult(pid, milestoneId).then((r) => setVersion(r.version)).catch(() => setVersion(null));
  }, [pid, milestoneId]);

  const review = async (reviewStatus: "APPROVED" | "REVISION_REQUESTED") => {
    if (!pid || version == null) return;
    setBusy(true);
    const res = await runWrite(() =>
      api.reviewMilestoneResult(pid, milestoneId, {
        expectedResultVersion: version,
        reviewStatus,
        additionalValidation: reviewStatus === "APPROVED" ? "NONE" : "UNANSWERED",
      }),
    );
    setBusy(false);
    if (res) pushToast(reviewStatus === "APPROVED" ? "Milestone 결과 승인" : "수정 요청됨", "success");
  };

  return (
    <Card kind="Milestone 결과 승인 대기" color="#e11d48">
      <p className="text-xs">{title}{version != null ? ` · v${version}` : ""}</p>
      {!gateOk && <p className="mt-1 text-[11px] text-error">기술 Gate 미통과 — 승인 불가</p>}
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => review("REVISION_REQUESTED")} disabled={busy}>
          수정 요청
        </Button>
        <Button
          onClick={() => review("APPROVED")}
          disabled={busy || !gateOk || version == null}
          data-testid={`milestone-approve-${milestoneId}`}
        >
          승인
        </Button>
      </div>
    </Card>
  );
}
