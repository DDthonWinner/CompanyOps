import { useState } from "react";
import { api } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { pushToast } from "../../components/ui/toast";
import { useStore } from "../../store/useStore";
import { runWrite } from "./actions";

interface RecRow {
  roleCode: string;
  agentProfileId: string;
  llmModelId?: string;
  displayName: string;
  displayColor?: string;
  iconKey?: string;
  isPrimaryPm?: boolean;
  include: boolean;
}

export function AgentMatchingPanel() {
  const projectId = useStore((s) => s.activeProjectId);
  const [rows, setRows] = useState<RecRow[]>([]);
  const [busy, setBusy] = useState(false);

  const recommend = async () => {
    if (!projectId) return;
    setBusy(true);
    const res = (await runWrite(() => api.recommendAgents(projectId, {}))) as any;
    setBusy(false);
    if (res?.recommendations) {
      setRows(
        res.recommendations.map((r: any) => ({
          roleCode: r.roleCode, agentProfileId: r.agentProfileId, llmModelId: r.llmModelId,
          displayName: r.displayName, displayColor: r.displayColor, iconKey: r.iconKey,
          isPrimaryPm: r.roleCode === "PM", include: true,
        })),
      );
    }
  };

  const assign = async () => {
    if (!projectId) return;
    const agents = rows.filter((r) => r.include).map((r) => ({
      agentProfileId: r.agentProfileId, roleCode: r.roleCode, llmModelId: r.llmModelId,
      displayName: r.displayName, displayColor: r.displayColor, iconKey: r.iconKey,
      isPrimaryPm: r.isPrimaryPm,
    }));
    setBusy(true);
    const res = await runWrite(() => api.assignAgents(projectId, { agents }));
    setBusy(false);
    if (res) pushToast("팀을 배정했습니다 (READY).", "success");
  };

  return (
    <GlassPanel level={2} className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="display text-sm font-semibold">팀 매칭</h3>
        <Button variant="ghost" onClick={recommend} disabled={busy} data-testid="agent-recommend">
          추천 받기
        </Button>
      </div>
      {rows.length === 0 ? (
        <div className="text-xs text-on-background/50">추천을 받아 팀을 구성하세요 (PM 필수).</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={r.include}
                onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))}
                aria-label={`include-${r.roleCode}`}
              />
              <span className="w-20 text-xs" style={{ color: r.displayColor }}>{r.roleCode}</span>
              <input
                className="input flex-1"
                value={r.displayName}
                onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, displayName: e.target.value } : x)))}
              />
            </div>
          ))}
          <div className="flex justify-end pt-1">
            <Button onClick={assign} disabled={busy} data-testid="agent-matching-assign">배정 확정</Button>
          </div>
        </div>
      )}
    </GlassPanel>
  );
}
