import { GlassPanel } from "../../../components/ui/GlassPanel";
import { useStore } from "../../../store/useStore";

export function SideHUD() {
  const snapshot = useStore((s) => s.snapshot);
  if (!snapshot) return null;
  const p = snapshot.project;
  return (
    <GlassPanel
      level={2}
      className="pointer-events-auto absolute left-6 top-24 w-64 p-4"
      data-testid="side-hud"
    >
      <div className="display text-sm font-semibold">{p.name}</div>
      <div className="mt-0.5 text-xs text-on-background/60">{p.status}</div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-on-background/50">Agents</div>
          <div className="tabular text-base">
            {p.assignedAgentCount}/{p.maxAgentCount}
          </div>
        </div>
        <div>
          <div className="text-on-background/50">Budget</div>
          <div className="tabular text-base">${p.budgetAmount.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-on-background/50">진행률</div>
          <div className="tabular text-base">
            {p.progressTotal === 0 ? "작업 없음" : `${p.progressPercent}%`}
          </div>
        </div>
        <div>
          <div className="text-on-background/50">Working</div>
          <div className="tabular text-base">{p.workingAgentCount}</div>
        </div>
      </div>
    </GlassPanel>
  );
}
