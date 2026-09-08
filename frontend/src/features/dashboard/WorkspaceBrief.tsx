import { useStore } from "../../store/useStore";
import { fmtTokens } from "../../lib/format";
import { deriveAttention } from "./attention";

const PLAN_LABEL: Record<string, string> = {
  REVIEW: "피드백 검토 중", FINAL_APPROVAL_PENDING: "최종 실행 승인 대기",
  APPROVED_WAITING: "실행 조건 대기", EXECUTING: "실행 중", COMPLETED: "완료",
};

/** Desktop companion to Attention: useful context in the remaining city-column space. */
export function WorkspaceBrief() {
  const snapshot = useStore((s) => s.snapshot);
  const select = useStore((s) => s.setDashboardPanel);
  if (!snapshot) return null;
  const plan = [...snapshot.plans].filter((p) => p.status !== "SUPERSEDED").sort((a, b) => b.version - a.version)[0];
  const usage = snapshot.tokenUsage;
  const needsAttention = deriveAttention(snapshot).length > 0 || snapshot.plans.some((p) => p.status === "REVIEW");
  const buttonStyle = "glass-2 min-w-0 rounded-hud border border-outline-variant/60 p-4 text-left transition hover:border-primary/50 hover:bg-white focus-visible:outline-primary";

  if (needsAttention) return <div className="hidden gap-2 lg:grid lg:grid-cols-2" aria-label="워크스페이스 바로가기">
    <button type="button" onClick={() => select("resources")} className={buttonStyle}><span className="text-xs">토큰 상세 ↗</span></button>
    <button type="button" onClick={() => select("plan")} className={buttonStyle}><span className="text-xs">현재 계획 ↗</span></button>
  </div>;

  return <div className="hidden min-h-0 flex-1 gap-3 lg:grid lg:grid-rows-2" aria-label="워크스페이스 요약">
    <button type="button" onClick={() => select("resources")} className={buttonStyle}>
      <span className="flex items-center justify-between text-xs font-semibold"><span>Token usage</span><span className="font-normal text-primary">상세 ↗</span></span>
      <span className="mt-3 flex items-baseline gap-2"><strong className="tabular text-2xl text-primary">{fmtTokens(usage?.collected ? usage.total : null)}</strong>{usage?.demo && <span className="text-[10px] text-on-background/50">데모 데이터</span>}</span>
      <span className="mt-2 block text-[11px] text-on-background/55">{usage?.collected ? `Input ${fmtTokens(usage.totalInput)} · Output ${fmtTokens(usage.totalOutput)}` : "실행 시 수집되는 토큰 사용량을 확인하세요"}</span>
    </button>
    <button type="button" onClick={() => select("plan")} className={buttonStyle}>
      <span className="flex items-center justify-between text-xs font-semibold"><span>현재 계획</span><span className="font-normal text-primary">열기 ↗</span></span>
      <span className="mt-3 block text-sm font-semibold">{plan ? `v${plan.version} · ${PLAN_LABEL[plan.status] ?? plan.status}` : "아직 등록된 계획이 없어요"}</span>
      <span className="mt-2 block truncate text-[11px] text-on-background/55" title={plan?.request}>{plan?.request || (plan ? "계획과 실행 상태를 확인하세요" : "하단 입력창에서 다음 작업을 지시해 보세요")}</span>
    </button>
  </div>;
}
