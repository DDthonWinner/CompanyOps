// Agent roster with Current & Next step (04 §5) — the bottom row of rich agent cards.
// "지금 무엇을 / 다음에 무엇을 / 왜" 를 작업 수준으로만 보여준다 (내부 CoT 미표시).
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { Icon } from "../../components/ui/Icon";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { StatusPill } from "../../components/ui/StatusPill";
import { fmtTokens } from "../../lib/format";
import { ROLE_LABEL, roleColor, roleIcon } from "../../lib/roles";
import { useStore } from "../../store/useStore";
import { agentMetrics } from "./agentMetrics";

export function AgentOverview() {
  const [page, setPage] = useState(0);
  const snapshot = useStore((s) => s.snapshot);
  const rolesById = useStore((s) => s.rolesById);
  const openAgentSheet = useStore((s) => s.openAgentSheet);
  if (!snapshot) return null;
  const agents = snapshot.agents.filter((a) => a.status !== "REMOVED");
  const pages = Math.max(1, Math.ceil(agents.length / 4));
  const currentPage = Math.min(page, pages - 1);

  return (
    <GlassPanel level={2} className="p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="display flex items-center gap-1.5 text-sm font-semibold">
        <Icon name="groups" size={18} className="text-primary" />
        AI Agents · 현재 &amp; 다음 작업
      </h3>
      {pages > 1 && <div className="flex items-center gap-2 text-xs"><Button variant="ghost" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} aria-label="이전 에이전트">←</Button><span aria-live="polite">{currentPage + 1} / {pages} · {agents.length}명</span><Button variant="ghost" disabled={currentPage === pages - 1} onClick={() => setPage(currentPage + 1)} aria-label="다음 에이전트">→</Button></div>}
      </div>
      {agents.length === 0 && <div className="text-xs text-on-background/50">배정된 Agent가 없습니다.</div>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {agents.slice(currentPage * 4, currentPage * 4 + 4).map((a) => {
          const code = rolesById[a.roleId]?.code;
          const color = a.displayColor || roleColor(code);
          const m = agentMetrics(snapshot, a);
          return (
            <button
              key={a.id}
              onClick={() => openAgentSheet(a.id)}
              className="card-lift flex min-w-0 flex-col gap-1.5 rounded-hud border border-outline-variant bg-surface-lowest p-2.5 text-left"
              style={{ borderTop: `3px solid ${color}` }}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="grid h-8 w-8 place-items-center rounded-lg"
                    style={{ background: `${color}1a`, color }}
                  >
                    <Icon name={roleIcon(code)} size={18} fill />
                  </span>
                  <div>
                    <div className="text-sm font-semibold" style={{ color }}>
                      {a.displayName}
                    </div>
                    <div className="text-[10px] uppercase tracking-wide text-on-background/45">
                      {ROLE_LABEL[code ?? ""] ?? code ?? "—"}
                    </div>
                  </div>
                </div>
                <StatusPill status={a.status} />
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex items-start gap-1">
                  <span className="mt-0.5 text-[10px] font-semibold text-on-background/40">현재</span>
                  <span className="min-w-0 flex-1 truncate">
                    {m.current?.title ?? a.activitySummary ?? "대기 중"}
                  </span>
                </div>
                <div className="flex items-start gap-1 text-on-background/60">
                  <span className="mt-0.5 text-[10px] font-semibold text-on-background/40">다음</span>
                  <span className="min-w-0 flex-1 truncate">
                    {m.next ? (
                      <>
                        <Icon name="arrow_forward" size={12} className="align-middle" /> {m.next.title}
                      </>
                    ) : (
                      "—"
                    )}
                  </span>
                </div>
              </div>

              <ProgressBar value={m.percent} color={color} height={6} />
              <div className="flex items-center justify-between text-[11px] text-on-background/55">
                <span className="tabular">
                  {m.completed}/{m.total} 완료
                </span>
                <span className="tabular flex items-center gap-1">
                  <Icon name="toll" size={13} /> {fmtTokens(m.tokenTotal)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </GlassPanel>
  );
}
