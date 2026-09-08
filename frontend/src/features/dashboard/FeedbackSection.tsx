import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { Feedback, UtilizationReport } from "../../api/uf-types";
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { pushToast } from "../../components/ui/toast";
import { useStore } from "../../store/useStore";
import { runWrite } from "./actions";

function normalizeReports(res: unknown): UtilizationReport[] {
  if (Array.isArray(res)) return res as UtilizationReport[];
  const items = (res as { items?: unknown[] })?.items;
  return Array.isArray(items) ? (items as UtilizationReport[]) : [];
}

export function FeedbackSection() {
  const pid = useStore((s) => s.activeProjectId);
  const status = useStore((s) => s.snapshot?.project.status);
  const [report, setReport] = useState<UtilizationReport | null>(null);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const completed = status === "COMPLETED";

  useEffect(() => {
    if (!pid || !completed) {
      setReport(null);
      return;
    }
    api
      .getUtilization(pid)
      .then((res) => {
        const reports = normalizeReports(res);
        const latest = reports[reports.length - 1] ?? null;
        setReport(latest);
        if (latest?.reportId) {
          api.getFeedbacks(latest.reportId).then((f) => setFeedbacks(f as Feedback[])).catch(() => setFeedbacks([]));
        }
      })
      .catch(() => setUnavailable(true));
  }, [pid, completed]);

  return (
    <GlassPanel level={2} className="p-4" data-testid="feedback-section">
      <h3 className="display mb-2 text-sm font-semibold">AI 활용 Feedback</h3>

      {!completed && (
        <p className="text-xs text-on-background/60">
          진행 중에는 지표를 수집·누적만 합니다. <b>프로젝트 완료 후 집계</b>되어 Score·Feedback을 확인할 수 있습니다.
        </p>
      )}

      {completed && unavailable && (
        <p className="text-xs text-on-background/50">AI 활용 리포트가 아직 연동되지 않았습니다 (UF 유닛).</p>
      )}

      {completed && report && (
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-xs text-on-background/50">AI 활용 Score</div>
              <div className="tabular text-2xl">
                {report.utilizationScore == null ? "N/A" : report.utilizationScore}
              </div>
            </div>
            <div className="text-xs text-on-background/50">{report.scoreVersion}</div>
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold text-on-background/60">Feedback ({feedbacks.length})</div>
            <ul className="space-y-1">
              {feedbacks.map((f) => (
                <li key={f.feedbackId} className="rounded border border-outline-variant bg-surface-lowest p-2 text-xs">
                  <b>{f.aspect}</b> · {f.severity}
                  <div>{f.observation}</div>
                  <div className="text-on-background/60">→ {f.suggestion}</div>
                </li>
              ))}
            </ul>
            {report.reportId && <AddComment reportId={report.reportId} onAdded={(f) => setFeedbacks((xs) => [...xs, f])} />}
          </div>
        </div>
      )}
    </GlassPanel>
  );
}

function AddComment({ reportId, onAdded }: { reportId: string; onAdded: (f: Feedback) => void }) {
  const [obs, setObs] = useState("");
  const submit = async () => {
    if (!obs.trim()) return;
    const res = (await runWrite(() =>
      api.createFeedback(reportId, {
        aspect: "AUTONOMY", severity: "LOW", observation: obs, impact: "", suggestion: "",
      }),
    )) as Feedback | null;
    if (res) {
      onAdded(res);
      setObs("");
      pushToast("Feedback을 기록했습니다.", "success");
    }
  };
  return (
    <div className="mt-2 flex gap-2">
      <input className="input flex-1" placeholder="관찰 기록 추가" value={obs} onChange={(e) => setObs(e.target.value)} />
      <Button onClick={submit}>추가</Button>
    </div>
  );
}
