import { useEffect, useId, useRef, useState } from "react";

/** Presentation progress, not the utilization score or server-measured percent.
 * Wait at 90% until the API succeeds; show 100% briefly before revealing results.
 */
export function FeedbackProgress({ ready, onComplete }: { ready: boolean; onComplete: () => void }) {
  const id = useId().replace(/:/g, "");
  const [progress, setProgress] = useState(0);
  const readyRef = useRef(ready);
  const completeRef = useRef(onComplete);
  useEffect(() => { readyRef.current = ready; }, [ready]);
  useEffect(() => { completeRef.current = onComplete; }, [onComplete]);
  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let started: number | null = null;
    let finishStart: number | null = null;
    let completeAt: number | null = null;
    let frame = 0;
    const tick = (now: number) => {
      started ??= now;
      const elapsed = Math.max(0, now - started);
      let value = reduced ? 0 : Math.min(90, Math.floor(90 * elapsed / 1600));
      if (readyRef.current && (reduced || elapsed >= 1600)) {
        finishStart ??= now;
        value = reduced ? 100 : Math.min(100, 90 + Math.floor(10 * (now - finishStart) / 400));
      }
      setProgress(value);
      if (value === 100) {
        completeAt ??= now;
        if (now - completeAt >= (reduced ? 0 : 250)) { completeRef.current(); return; }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-outline-variant bg-surface-lowest py-6" data-testid="feedback-progress">
    <div className="relative h-36 w-36" role="progressbar" aria-label="Feedback 결과 표시 준비" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-valuetext={`${progress}% · 결과 표시 준비`}>
      <svg viewBox="0 0 160 160" className="h-full w-full text-primary" aria-hidden="true">
        <defs>
          <clipPath id={`${id}-clip`}><circle cx="80" cy="80" r="72" /></clipPath>
          <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7779ef" /><stop offset="100%" stopColor="#4648d4" /></linearGradient>
        </defs>
        <circle cx="80" cy="80" r="76" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2" />
        <circle cx="80" cy="80" r="72" fill="currentColor" fillOpacity="0.05" />
        <g clipPath={`url(#${id}-clip)`}><rect x="8" y={152 - 144 * progress / 100} width="144" height={144 * progress / 100} fill={`url(#${id}-fill)`} /></g>
      </svg>
      <div className={`absolute inset-0 grid place-content-center text-center ${progress >= 60 ? "text-white" : "text-primary"}`}>
        <span className="tabular text-3xl font-bold">{progress}<span className="ml-0.5 text-sm">%</span></span>
        <span className="mt-1 text-[10px] font-medium">{progress === 100 ? "준비 완료" : "계산 중"}</span>
      </div>
    </div>
    <div className="text-center"><p className="text-sm font-semibold">{progress === 100 ? "Feedback을 표시합니다" : "AI 활용 Feedback 준비 중"}</p><p className="mt-1 text-[11px] text-on-background/50">결과 표시 준비 진행률 · AI 활용 점수와 별도</p></div>
  </div>;
}
