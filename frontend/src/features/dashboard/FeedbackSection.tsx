import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { Feedback, UtilizationReport } from "../../api/uf-types";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { useStore } from "../../store/useStore";

function normalizeReports(res: unknown): UtilizationReport[] {
  if (Array.isArray(res)) return res as UtilizationReport[];
  const items = (res as { items?: unknown[] })?.items;
  return Array.isArray(items) ? (items as UtilizationReport[]) : [];
}

// Each aspect's Korean label, what it evaluates, and its scoring formula (plain language).
const ASPECTS: {
  key: string;
  en: string;
  ko: string;
  desc: string;
  formula: string;
  naHint?: string;
}[] = [
  {
    key: "AUTONOMY",
    en: "Autonomy",
    ko: "AI 자율 수행도",
    desc: "AI가 사람 개입 없이 스스로 작업을 완료한 정도",
    formula: "AI가 완료한 Task ÷ 전체 대상 Task × 100",
  },
  {
    key: "RESOURCE_EFFICIENCY",
    en: "Resource Efficiency",
    ko: "토큰·비용 효율",
    desc: "같은 성과를 내는 데 자원(토큰·비용)을 얼마나 아꼈는지 (이전 프로젝트 대비)",
    formula: "이전 프로젝트의 Task당 토큰 ÷ 이번 Task당 토큰 × 100",
    naHint: "비교할 이전 프로젝트가 없거나 토큰이 미수집이면 N/A",
  },
  {
    key: "AREA_DISTRIBUTION",
    en: "Area Distribution",
    ko: "영역별 고른 활용",
    desc: "핵심 개발 영역(FE·BE 등)에 AI 활용이 고르게 퍼진 정도",
    formula: "AI를 활용한 핵심영역 ÷ 완료된 핵심영역 × 100",
  },
];

const ASPECT_KO: Record<string, string> = Object.fromEntries(
  ASPECTS.map((a) => [a.key, `${a.ko} (${a.en})`]),
);

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

  const aspectScores = report?.aspectScores ?? {};

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
        <div className="space-y-3 text-sm">
          {/* Final score */}
          <div className="flex items-baseline gap-3">
            <div>
              <div className="text-xs text-on-background/50">AI 활용 종합 Score</div>
              <div className="tabular text-2xl">
                {report.utilizationScore == null ? "N/A" : report.utilizationScore}
                <span className="ml-1 text-sm text-on-background/40">/ 100</span>
              </div>
            </div>
            <div className="text-[11px] text-on-background/50">
              유효한 관점 점수의 평균 <span className="text-on-background/40">(N/A 관점은 제외하고 재계산)</span>
            </div>
          </div>

          {/* Per-aspect breakdown with meaning + formula */}
          <div className="space-y-1.5" data-testid="aspect-scores">
            {ASPECTS.map((a) => {
              const s = aspectScores[a.key];
              const na = s == null;
              return (
                <div key={a.key} className="rounded border border-outline-variant bg-surface-lowest p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">
                        {a.ko} <span className="text-[11px] text-on-background/40">{a.en}</span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-on-background/60">{a.desc}</div>
                      <div className="mt-1 text-[11px] text-on-background/45">
                        산출식: {a.formula}
                        {na && a.naHint ? ` · ${a.naHint}` : ""}
                      </div>
                    </div>
                    <div className="tabular shrink-0 text-lg">{na ? "N/A" : s}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Auto-generated feedback */}
          <div>
            <div className="mb-1 text-xs font-semibold text-on-background/60">Feedback ({feedbacks.length})</div>
            <ul className="space-y-1">
              {feedbacks.map((f) => (
                <li key={f.feedbackId} className="rounded border border-outline-variant bg-surface-lowest p-2 text-xs">
                  <b>{ASPECT_KO[f.aspect] ?? f.aspect}</b> · {f.severity}
                  <div>{f.observation}</div>
                  <div className="text-on-background/60">→ {f.suggestion}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </GlassPanel>
  );
}
