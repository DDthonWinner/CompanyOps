// Token usage (04 §14, DASH-006): Project total + Input/Output split + per-role breakdown.
// Real measured values only; nothing collected yet → "미수집" (06 §3.2). Demo runs are labeled.
import { GlassPanel } from "../../components/ui/GlassPanel";
import { Icon } from "../../components/ui/Icon";
import { fmtTokens } from "../../lib/format";
import { ROLE_LABEL, roleColor } from "../../lib/roles";
import { useStore } from "../../store/useStore";

export function TokenUsage() {
  const tu = useStore((s) => s.snapshot?.tokenUsage);

  return (
    <GlassPanel level={2} className="p-4" data-testid="token-usage">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="display flex items-center gap-1.5 text-sm font-semibold">
          <Icon name="toll" size={18} className="text-primary" />
          Token Usage
        </h3>
        {tu?.demo && (
          <span className="rounded-full bg-surface-high px-2 py-0.5 text-[10px] text-on-background/55">
            데모 데이터
          </span>
        )}
      </div>

      {!tu?.collected ? (
        <div className="flex items-center gap-2 rounded-lg bg-surface-low/60 px-3 py-4 text-xs text-on-background/55">
          <Icon name="hourglass_empty" size={16} />
          아직 계측된 Token이 없습니다 · <span className="tabular">미수집</span>
        </div>
      ) : (
        <>
          <div className="flex items-end gap-4">
            <div>
              <div className="text-[11px] text-on-background/50">Total</div>
              <div className="tabular text-3xl font-semibold text-primary">{fmtTokens(tu.total)}</div>
            </div>
            <div className="mb-1 flex gap-4 text-[11px]">
              <div>
                <div className="text-on-background/45">Input</div>
                <div className="tabular text-sm">{fmtTokens(tu.totalInput)}</div>
              </div>
              <div>
                <div className="text-on-background/45">Output</div>
                <div className="tabular text-sm">{fmtTokens(tu.totalOutput)}</div>
              </div>
            </div>
          </div>

          {/* Input/Output composition bar */}
          <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-surface-high">
            <div
              className="h-full"
              style={{
                width: `${tu.total ? (100 * tu.totalInput) / tu.total : 0}%`,
                background: "linear-gradient(90deg,#4648d4cc,#4648d4)",
              }}
            />
            <div
              className="h-full"
              style={{
                width: `${tu.total ? (100 * tu.totalOutput) / tu.total : 0}%`,
                background: "linear-gradient(90deg,#059669cc,#059669)",
              }}
            />
          </div>

          {/* Per-role breakdown */}
          <div className="mt-3 space-y-1.5">
            {Object.entries(tu.byRole)
              .sort((a, b) => b[1] - a[1])
              .map(([code, val]) => {
                const max = Math.max(...Object.values(tu.byRole), 1);
                return (
                  <div key={code} className="flex items-center gap-2 text-[11px]">
                    <span className="w-16 shrink-0 text-on-background/60">{ROLE_LABEL[code] ?? code}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-high/70">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(100 * val) / max}%`,
                          background: `linear-gradient(90deg, ${roleColor(code)}cc, ${roleColor(code)})`,
                        }}
                      />
                    </div>
                    <span className="tabular w-12 shrink-0 text-right text-on-background/70">
                      {fmtTokens(val)}
                    </span>
                  </div>
                );
              })}
          </div>
        </>
      )}
    </GlassPanel>
  );
}
