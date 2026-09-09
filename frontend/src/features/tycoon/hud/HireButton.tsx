import { pushToast } from "../../../components/ui/toast";

// Prominent CTA above the right HUD panel.
export function HireButton() {
  return (
    <button
      data-testid="hire-agent"
      onClick={() => pushToast("Agent 고용 기능은 준비 중입니다.")}
      className="pointer-events-auto flex w-full shrink-0 items-center justify-center gap-2 rounded-hud bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary shadow-md transition hover:bg-primary-container active:scale-[0.98]"
    >
      <span className="text-base leading-none">＋</span>
      Agent 고용하기
    </button>
  );
}
