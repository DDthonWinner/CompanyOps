import { useEffect, useRef, useState } from "react";
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
const ASPECTS: { key: string; en: string; ko: string; desc: string; formula: string; naHint?: string }[] = [
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
type Tier = { label: string; face: string; weather: string; color: string; glow: string; msg: string };
function tierOf(score: number | null | undefined): Tier {
  if (score == null) return { label: "집계 불가", face: "🤔", weather: "❓", color: "#94a3b8", glow: "rgba(148,163,184,.45)", msg: "평가할 데이터가 아직 부족해요" };
  if (score >= 90) return { label: "PERFECT", face: "🤩", weather: "☀️", color: "#f59e0b", glow: "rgba(245,158,11,.65)", msg: "AI를 완벽하게 활용했어요!" };
  if (score >= 75) return { label: "GREAT", face: "😄", weather: "🌤️", color: "#22c55e", glow: "rgba(34,197,94,.55)", msg: "훌륭한 AI 활용이에요" };
  if (score >= 60) return { label: "GOOD", face: "🙂", weather: "⛅", color: "#3b82f6", glow: "rgba(59,130,246,.5)", msg: "무난하게 잘 활용했어요" };
  if (score >= 40) return { label: "FAIR", face: "😕", weather: "🌧️", color: "#f97316", glow: "rgba(249,115,22,.5)", msg: "개선할 여지가 보여요" };
  return { label: "TRY AGAIN", face: "😵", weather: "⛈️", color: "#ef4444", glow: "rgba(239,68,68,.5)", msg: "다음엔 AI를 더 활용해봐요" };
}

function useCountUp(target: number | null | undefined, run: boolean, duration = 1300, delay = 0): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run || target == null) {
      setV(target ?? 0);
      return;
    }
    let raf = 0;
    let start = 0;
    const step = (now: number) => {
      if (!start) start = now;
      const p = Math.min(1, (now - start - delay) / duration);
      const eased = p < 0 ? 0 : 1 - Math.pow(1 - p, 3);
      setV(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, run, duration, delay]);
  return v;
}

const KEYFRAMES = `
@keyframes uf-spin { to { transform: rotate(360deg); } }
@keyframes uf-pulse { 0%,100% { transform: translateY(0); opacity:.85 } 50% { transform: translateY(4px); opacity:1 } }
@keyframes uf-pop { 0% { transform: scale(.3); opacity:0 } 60% { transform: scale(1.15); opacity:1 } 100% { transform: scale(1) } }
@keyframes uf-rise { from { transform: translateY(14px); opacity:0 } to { transform: translateY(0); opacity:1 } }
@keyframes uf-shine { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }
@keyframes uf-burst { 0% { transform: translate(0,0) scale(.4); opacity:1 } 100% { transform: translate(var(--dx), var(--dy)) scale(1.1); opacity:0 } }
@keyframes uf-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
`;

function Sparkles({ color }: { color: string }) {
  const parts = Array.from({ length: 16 });
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      {parts.map((_, i) => {
        const ang = (i / parts.length) * Math.PI * 2;
        const dist = 60 + (i % 3) * 22;
        const dx = `${Math.cos(ang) * dist}px`;
        const dy = `${Math.sin(ang) * dist}px`;
        const emoji = ["✨", "🎉", "⭐", "💫"][i % 4];
        return (
          <span
            key={i}
            className="absolute left-1/2 top-8 text-lg"
            style={{
              // @ts-expect-error CSS custom props
              "--dx": dx,
              "--dy": dy,
              color,
              animation: `uf-burst 900ms ${i * 25}ms ease-out forwards`,
            }}
          >
            {emoji}
          </span>
        );
      })}
    </div>
  );
}

const SEV_COLOR: Record<string, string> = { HIGH: "#ef4444", MEDIUM: "#f59e0b", LOW: "#22c55e" };

function AspectCard({ a, score, feedbacks, run, index }: {
  a: (typeof ASPECTS)[number];
  score: number | null | undefined;
  feedbacks: Feedback[];
  run: boolean;
  index: number;
}) {
  const t = tierOf(score);
  const val = useCountUp(score, run, 1000, 500 + index * 180);
  const na = score == null;
  return (
    <div
      className="rounded-lg border border-outline-variant bg-surface-lowest p-3"
      style={{ animation: run ? `uf-rise 500ms ${300 + index * 160}ms both` : undefined, borderLeft: `3px solid ${t.color}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 font-medium">
            <span className="text-base leading-none">{t.weather}</span>
            {a.ko} <span className="text-[11px] text-on-background/40">{a.en}</span>
          </div>
          <div className="mt-0.5 text-[11px] text-on-background/60">{a.desc}</div>
          <div className="mt-1 text-[11px] text-on-background/45">
            산출식: {a.formula}
            {na && a.naHint ? ` · ${a.naHint}` : ""}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="tabular text-xl font-bold" style={{ color: na ? undefined : t.color }}>
            {na ? "N/A" : val}
          </div>
          <div className="text-[10px] text-on-background/50">{t.label}</div>
        </div>
      </div>

      {/* Feedback for this aspect (merged in) */}
      {feedbacks.map((f) => (
        <div key={f.feedbackId} className="mt-2 border-t border-outline-variant/60 pt-2 text-[11px]">
          <span
            className="mr-1 rounded px-1.5 py-0.5 text-[10px] font-semibold"
            style={{ color: SEV_COLOR[f.severity] ?? "#94a3b8", background: `${SEV_COLOR[f.severity] ?? "#94a3b8"}1f` }}
          >
            {f.severity}
          </span>
          <span className="text-on-background/80">{f.observation}</span>
          {f.suggestion && <div className="mt-0.5 text-on-background/60">→ {f.suggestion}</div>}
        </div>
      ))}
    </div>
  );
}

export function FeedbackSection() {
  const pid = useStore((s) => s.activeProjectId);
  const status = useStore((s) => s.snapshot?.project.status);
  const [report, setReport] = useState<UtilizationReport | null>(null);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const [phase, setPhase] = useState<"idle" | "scoring" | "done">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completed = status === "COMPLETED";

  useEffect(() => {
    setPhase("idle");
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

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const startReveal = () => {
    setPhase("scoring");
    timer.current = setTimeout(() => setPhase("done"), 2100);
  };

  const overall = report?.utilizationScore ?? null;
  const tier = tierOf(overall);
  const aspectScores = report?.aspectScores ?? {};
  const scoreVal = useCountUp(overall, phase === "done", 1500);

  // Group each aspect's auto-generated feedback so it shows inside its score card.
  const fbByAspect: Record<string, Feedback[]> = {};
  for (const f of feedbacks) {
    if (f.source === "USER") continue; // drop legacy manual comments
    (fbByAspect[f.aspect] ??= []).push(f);
  }

  return (
    <GlassPanel level={2} className="relative overflow-hidden p-4" data-testid="feedback-section">
      <style>{KEYFRAMES}</style>
      <h3 className="display mb-2 text-sm font-semibold">AI 활용 Feedback</h3>

      {!completed && (
        <p className="text-xs text-on-background/60">
          진행 중에는 지표를 수집·누적만 합니다. <b>프로젝트 완료 후 집계</b>되어 Score·Feedback을 확인할 수 있습니다.
        </p>
      )}

      {completed && unavailable && (
        <p className="text-xs text-on-background/50">AI 활용 리포트가 아직 연동되지 않았습니다 (UF 유닛).</p>
      )}

      {/* Collapsed teaser */}
      {completed && report && phase === "idle" && (
        <button
          onClick={startReveal}
          className="group flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-outline-variant bg-surface-lowest py-7 transition hover:border-primary/50 hover:bg-primary/5"
        >
          <div className="text-2xl" style={{ animation: "uf-bob 2.2s ease-in-out infinite" }}>🎬</div>
          <div className="text-sm font-semibold">AI 활용 평가 결과가 준비됐어요</div>
          <div className="text-[11px] text-on-background/55">아래 화살표를 눌러 채점 결과를 확인하세요</div>
          <div className="mt-1 text-xl text-primary" style={{ animation: "uf-pulse 1.4s ease-in-out infinite" }}>⌄</div>
        </button>
      )}

      {/* Scoring animation */}
      {completed && report && phase === "scoring" && (
        <div className="flex flex-col items-center gap-3 py-8">
          <div
            className="h-10 w-10 rounded-full border-[3px] border-primary/25 border-t-primary"
            style={{ animation: "uf-spin 700ms linear infinite" }}
          />
          <div className="text-lg font-bold tracking-wide">채점 중...</div>
          <ScoringNumber />
          <div className="h-1.5 w-48 overflow-hidden rounded-full bg-surface-lowest">
            <div
              className="h-full rounded-full"
              style={{ width: "100%", background: "linear-gradient(90deg, transparent, var(--tw-prose-links, #6366f1), transparent)", backgroundSize: "200% 100%", animation: "uf-shine 1.1s linear infinite" }}
            />
          </div>
          <div className="text-[11px] text-on-background/50">AI 활용 지표를 종합하고 있어요</div>
        </div>
      )}

      {/* Result reveal */}
      {completed && report && phase === "done" && (
        <div className="space-y-3 text-sm">
          {/* Hero score */}
          <div
            className="relative overflow-hidden rounded-2xl p-5 text-center"
            style={{
              background: `radial-gradient(120% 120% at 50% 0%, ${tier.glow}, transparent 70%)`,
              boxShadow: `inset 0 0 0 1px ${tier.color}33`,
            }}
          >
            {overall != null && overall >= 75 && <Sparkles color={tier.color} />}
            <div className="relative">
              <div className="text-4xl" style={{ animation: "uf-pop 600ms ease-out both" }}>
                {tier.weather}
                <span className="ml-1">{tier.face}</span>
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-widest text-on-background/50">AI 활용 종합 Score</div>
              <div className="tabular text-6xl font-black leading-none" style={{ color: tier.color, textShadow: `0 0 24px ${tier.glow}` }}>
                {overall == null ? "N/A" : scoreVal}
                {overall != null && <span className="align-top text-2xl text-on-background/40">/100</span>}
              </div>
              <div
                className="mt-1 inline-block rounded-full px-3 py-0.5 text-sm font-extrabold tracking-wider"
                style={{ color: tier.color, background: `${tier.color}1f`, animation: "uf-pop 600ms 200ms both" }}
              >
                {tier.label}
              </div>
              <div className="mt-1.5 text-xs text-on-background/70">{tier.msg}</div>
              <div className="mt-1 text-[10px] text-on-background/40">
                {report.scoreVersion} · 유효한 관점 점수의 평균 (N/A 제외)
              </div>
            </div>
          </div>

          {/* Per-aspect breakdown — score + its feedback merged into one card */}
          <div className="space-y-2" data-testid="aspect-scores">
            {ASPECTS.map((a, i) => (
              <AspectCard key={a.key} a={a} score={aspectScores[a.key]} feedbacks={fbByAspect[a.key] ?? []} run index={i} />
            ))}
          </div>

          <button onClick={startReveal} className="text-[11px] text-on-background/50 underline-offset-2 hover:underline">
            ↻ 다시 보기
          </button>
        </div>
      )}
    </GlassPanel>
  );
}

function ScoringNumber() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN(Math.floor(Math.random() * 100)), 70);
    return () => clearInterval(id);
  }, []);
  return <div className="tabular text-3xl font-black text-on-background/30">{n}</div>;
}
