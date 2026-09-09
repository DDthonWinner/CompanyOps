import { useEffect, useRef, useState } from "react";
import { api } from "../../api/client";
import type { Feedback, UtilizationReport } from "../../api/uf-types";
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { Icon } from "../../components/ui/Icon";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { FeedbackProgress } from "./FeedbackProgress";
import { useStore } from "../../store/useStore";

function items<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  const list = (res as { items?: unknown[] })?.items;
  return Array.isArray(list) ? list as T[] : [];
}

const ASPECTS = [
  { key: "AUTONOMY", label: "AI 자율 수행도", icon: "smart_toy", desc: "대상 작업 중 AI가 자동으로 완료한 비율", formula: "AI 완료 Task ÷ 전체 대상 Task × 100" },
  { key: "RESOURCE_EFFICIENCY", label: "토큰·비용 효율", icon: "toll", desc: "이전 프로젝트 대비 Task당 토큰 사용 효율", formula: "이전 AI 등가 Task당 토큰 ÷ 현재 AI 등가 Task당 토큰 × 100 (최대 100)", na: "비교 대상이나 토큰 데이터가 없으면 N/A" },
  { key: "AREA_DISTRIBUTION", label: "영역별 AI 활용", icon: "account_tree", desc: "완료된 핵심 영역에 AI를 활용한 범위", formula: "AI 활용 핵심 영역 ÷ 완료된 핵심 영역 × 100" },
];
const SEVERITY: Record<string, { label: string; className: string }> = {
  HIGH: { label: "중점 검토", className: "bg-error/10 text-error" },
  MEDIUM: { label: "개선 검토", className: "bg-primary/10 text-primary" },
  LOW: { label: "참고", className: "bg-surface-high text-on-background/65" },
};

export function FeedbackSection({ requestId }: { requestId?: number } = {}) {
  const pid = useStore((s) => s.activeProjectId);
  const status = useStore((s) => s.snapshot?.project.status);
  return pid ? <FeedbackPanel key={pid} pid={pid} completed={status === "COMPLETED"} requestId={requestId} /> : null;
}

function FeedbackPanel({ pid, completed, requestId }: { pid: string; completed: boolean; requestId?: number }) {
  const root = useRef<HTMLDivElement>(null);
  const handledRequest = useRef<number>();
  const [loaded, setLoaded] = useState(false);
  // TEMP UF_TEST_PREVIEW: local only; defaults off and resets when the project changes.
  const [testMode, setTestMode] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [report, setReport] = useState<UtilizationReport | null>(null);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pending, setPending] = useState<{ report: UtilizationReport; feedbacks: Feedback[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  useEffect(() => {
    const version = ++requestVersion.current;
    setLoaded(false);
    setReport(null);
    setFeedbacks([]);
    setGenerating(false);
    setPending(null);
    setError(null);
    setBusy(false);
    if (completed && !testMode) {
      setBusy(true);
      void (async () => {
        try {
          const reports = items<UtilizationReport>(await api.getUtilization(pid));
          const latest = reports[reports.length - 1] ?? null;
          const comments = latest ? items<Feedback>(await api.getFeedbacks(latest.reportId)) : [];
          if (version !== requestVersion.current) return;
          setReport(latest);
          setFeedbacks(comments);
        } catch {
          if (version === requestVersion.current) setError("Feedback을 불러오지 못했습니다. 생성 버튼으로 다시 시도하세요.");
        } finally {
          if (version === requestVersion.current) { setBusy(false); setLoaded(true); }
        }
      })();
    }
    return () => { requestVersion.current++; };
  }, [pid, completed, testMode]);

  const generate = async () => {
    if (busy || (!completed && !testMode)) return;
    const version = ++requestVersion.current;
    setBusy(true);
    setGenerating(true);
    setPending(null);
    setError(null);
    try {
      if (testMode) {
        const preview = await api.previewUtilization(pid);
        if (version !== requestVersion.current) return;
        setPending({ report: preview.report, feedbacks: preview.feedbacks });
      } else {
        const result = await api.createUtilization(pid);
        const comments = items<Feedback>(await api.getFeedbacks(result.reportId));
        if (version !== requestVersion.current) return;
        setPending({ report: result, feedbacks: comments });
      }
    } catch {
      if (version === requestVersion.current) {
        setError("Feedback 생성에 실패했습니다. 연결 상태를 확인하고 다시 시도하세요.");
        setGenerating(false);
        setBusy(false);
      }
    }
  };
  const reveal = () => {
    if (!pending) return;
    setReport(pending.report);
    setFeedbacks(pending.feedbacks);
    setPending(null);
    setGenerating(false);
    setBusy(false);
  };

  useEffect(() => {
    if (!requestId || !completed) return;
    setExpanded(true);
    const frame = requestAnimationFrame(() => root.current?.scrollIntoView?.({ block: "start", behavior: "smooth" }));
    return () => cancelAnimationFrame(frame);
  }, [requestId, completed]);
  useEffect(() => {
    if (!requestId || handledRequest.current === requestId || !completed) return;
    setExpanded(true);
    if (testMode) { setLoaded(false); setTestMode(false); return; }
    if (!loaded || busy) return;
    handledRequest.current = requestId;
    if (!report) void generate();
  }, [requestId, completed, testMode, loaded, busy, report]);

  return (
    <div ref={root} className="scroll-mt-4"><GlassPanel level={2} className="p-4" data-testid="feedback-section">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="display flex items-center gap-1.5 text-sm font-semibold"><Icon name="insights" size={18} className="text-primary" />AI 활용 Feedback</h3>
          <p className="mt-1 text-xs text-on-background/55">AI 수행 비율·자원 사용·영역별 활용을 바탕으로 개선점을 확인합니다.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" aria-expanded={expanded} aria-controls="feedback-content" onClick={() => setExpanded((value) => !value)} className="shrink-0 rounded-lg border border-outline-variant bg-white px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 focus-visible:outline-primary">{expanded ? "접기 ∧" : "펼치기 ∨"}</button>
        </div>
      </div>
      <div id="feedback-content" hidden={!expanded}>
        <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
          <button type="button" role="switch" aria-checked={testMode} disabled={busy} onClick={() => setTestMode(!testMode)} className="flex items-center gap-2 rounded-full text-xs text-on-background/65 focus-visible:outline-primary disabled:opacity-50">
            <span aria-hidden="true" className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${testMode ? "bg-primary" : "bg-outline-variant"}`}><span className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${testMode ? "translate-x-4" : ""}`} /></span>
            테스트 중
          </button>
          <Button onClick={generate} disabled={busy || (!completed && !testMode)} data-testid="feedback-generate">
            <Icon name={busy ? "hourglass_top" : testMode ? "science" : report ? "refresh" : "auto_awesome"} size={16} />
            {busy ? "처리 중…" : testMode ? "테스트 Feedback 생성" : report ? "Feedback 불러오기" : "Feedback 생성"}
          </Button>
        </div>

      {testMode ? (
        <p role="status" className="mt-3 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs leading-relaxed text-primary">
          <Icon name="science" size={16} className="shrink-0" />테스트 중 · 현재 수집된 지표로 임시 Feedback을 생성합니다. 진행 중인 프로젝트의 점수는 잠정값이며, 정식 리포트로 저장되지 않습니다.
        </p>
      ) : !completed ? (
        <p className="mt-3 rounded-lg border border-outline-variant bg-surface-lowest px-3 py-2 text-xs text-on-background/60">프로젝트 완료 후 집계·생성이 가능합니다. 모든 Task 완료와 Milestone 결과 승인 후 활성화됩니다.</p>
      ) : !report && !busy && !error ? (
        <p className="mt-3 text-xs text-on-background/60">프로젝트가 완료되었습니다. Feedback 생성 버튼으로 활용 리포트와 개선 제안을 생성하세요.</p>
      ) : null}
      {error && <p role="alert" className="mt-3 flex items-center gap-1.5 text-xs text-error"><Icon name="error" size={16} />{error}</p>}

      {generating && <FeedbackProgress ready={pending !== null} onComplete={reveal} />}
      {report && !generating && <div className="mt-4 space-y-3" data-testid="feedback-results">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/15 bg-primary/5 p-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-on-background/50">{testMode ? "테스트 미리보기" : "AI 활용 종합 Score"}</div>
            <div className="mt-1 flex items-baseline gap-2"><span className="tabular text-4xl font-bold text-primary">{report.utilizationScore ?? "N/A"}</span>{report.utilizationScore != null && <span className="tabular text-sm text-on-background/40">/ 100</span>}</div>
          </div>
          <div className="text-xs leading-relaxed text-on-background/60">
            <p>{report.utilizationScore == null ? "집계할 데이터가 부족합니다." : "유효한 관점 점수의 평균입니다. N/A는 제외합니다."}</p>
            <p className="mt-1 text-[11px] text-on-background/45">{report.scoreVersion} · 작업 진행률 및 제품 품질 점수와 별도</p>
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-3" data-testid="aspect-scores">
          {ASPECTS.map((aspect) => {
            const score = report.aspectScores?.[aspect.key];
            const comments = feedbacks.filter((feedback) => feedback.aspect === aspect.key);
            return <div key={aspect.key} className="min-w-0 rounded-xl border border-outline-variant bg-surface-lowest p-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="flex items-center gap-1.5 text-xs font-semibold"><Icon name={aspect.icon} size={16} className="text-primary" />{aspect.label}</h4>
                <span className="tabular text-lg font-bold text-primary">{score ?? "N/A"}</span>
              </div>
              <p className="mt-1 text-[11px] text-on-background/55">{aspect.desc}</p>
              {score != null && <ProgressBar value={score} height={5} className="mt-2" />}
              <details className="mt-2 text-[11px] text-on-background/55"><summary className="cursor-pointer">산출 기준</summary><p className="mt-1 leading-relaxed">{aspect.formula}{score == null && aspect.na ? ` · ${aspect.na}` : ""}</p></details>
              {comments.map((feedback) => {
                const severity = SEVERITY[feedback.severity] ?? SEVERITY.LOW;
                return <div key={feedback.feedbackId} className="mt-3 space-y-1.5 border-t border-outline-variant/60 pt-3 text-xs leading-relaxed">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${severity.className}`}>{severity.label}</span>
                  <p className="text-on-background/80">{feedback.observation}</p>
                  {feedback.impact && <p className="text-on-background/60">{feedback.impact}</p>}
                  {feedback.suggestion && <p className="flex items-start gap-1 text-on-background/65"><Icon name="arrow_forward" size={14} className="mt-0.5 shrink-0 text-primary" />{feedback.suggestion}</p>}
                </div>;
              })}
            </div>;
          })}
        </div>
      </div>}
      </div>
    </GlassPanel></div>
  );
}
