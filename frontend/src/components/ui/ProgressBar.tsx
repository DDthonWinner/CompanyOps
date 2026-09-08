// Gradient progress bar with a soft glow in the accent color. Value 0–100.
export function ProgressBar({
  value,
  color = "#4648d4",
  height = 8,
  showValue = false,
  className = "",
}: {
  value: number;
  color?: string;
  height?: number;
  showValue?: boolean;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className="relative flex-1 overflow-hidden rounded-full bg-surface-high/70"
        style={{ height }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}cc, ${color})`,
            boxShadow: `0 0 10px ${color}66`,
          }}
        />
      </div>
      {showValue && <span className="tabular text-xs text-on-background/70">{pct}%</span>}
    </div>
  );
}
