import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { useStore } from "../../store/useStore";

export function QASection({ compact = false, onExpand }: { compact?: boolean; onExpand?: () => void }) {
  const snapshot = useStore((s) => s.snapshot);
  const qaRuns = snapshot?.qaRuns ?? [];
  const counts = qaRuns.reduce((out, q) => {
    const r = q.results as { passed?: number; failed?: number } | null;
    if (q.runStatus === "COMPLETED" && typeof r?.passed === "number" && typeof r.failed === "number") {
      out.passed += r.passed; out.failed += r.failed;
    }
    return out;
  }, { passed: 0, failed: 0 });
  const total = counts.passed + counts.failed;
  return <GlassPanel level={2} className="h-full p-4">
    <div className="mb-2 flex items-center justify-between gap-2"><h3 className="display text-sm font-semibold">Quality gate</h3>{onExpand && <Button variant="ghost" onClick={onExpand} aria-label="QA 상세 보기">상세 ↗</Button>}</div>
    <div className="mb-3 flex items-center gap-3"><strong className="tabular text-3xl text-primary">{total ? `${Math.round(100 * counts.passed / total)}%` : "N/A"}</strong><p className="text-[11px] text-on-background/60">완료된 QA 실행 통과율<br />{counts.passed} passed · {counts.failed} failed{qaRuns.some((q) => q.demo) && <span className="block">데모 QA 포함</span>}</p></div>
    {!qaRuns.length && <p className="text-xs text-on-background/50">QA 실행 결과가 없습니다.</p>}
    {compact ? <p className="text-xs text-on-background/60">{qaRuns.length}회 실행 · Gate 실패 {qaRuns.filter((q) => q.technicalGate === "FAILED" || q.technicalGate === "ERROR").length}건</p> :
      <div className="space-y-2">{qaRuns.map((q) => {
        const r = q.results as { passed?: number; failed?: number; skipped?: number } | null;
        return <details key={q.id} className="rounded-lg border border-outline-variant/60 p-3 text-xs">
          <summary className="cursor-pointer">{snapshot?.tasks.find((t) => t.id === q.taskId)?.title ?? `Task ${q.taskId}`} · Gate {q.technicalGate}</summary>
          <div className="mt-2 space-y-1 text-on-background/60"><p>실행 상태: {q.runStatus}{q.demo ? " · 데모 QA" : ""}</p><p>{r?.passed ?? "미수집"} passed / {r?.failed ?? "미수집"} failed / {r?.skipped ?? "미수집"} skipped</p><p className="break-all">실행 ID: {q.id}</p></div>
        </details>;
      })}</div>}
  </GlassPanel>;
}
