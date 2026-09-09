import { useState } from "react";
import { HireDialog } from "./HireDialog";

// Prominent CTA above the right HUD panel — opens the hire form.
export function HireButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        data-testid="hire-agent"
        onClick={() => setOpen(true)}
        className="pointer-events-auto flex w-full shrink-0 items-center justify-center gap-2 rounded-hud bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-primary-container active:scale-[0.98]"
      >
        <span className="text-base leading-none">＋</span>
        Agent 고용하기
      </button>
      <HireDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
