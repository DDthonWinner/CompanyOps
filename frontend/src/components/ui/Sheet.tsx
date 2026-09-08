// Modal sheet with Escape/close/scrim + focus return (FR-TY-11).
import { useEffect, useRef, type ReactNode } from "react";

export function Sheet({
  open,
  onClose,
  title,
  accentColor,
  testId,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  accentColor?: string;
  testId?: string;
  children: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const prevFocus = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    prevFocus.current = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      (prevFocus.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} data-testid="sheet-scrim" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId}
        className="glass-4 relative z-10 w-[min(92vw,28rem)] max-h-[80vh] overflow-auto rounded-hud p-5 animate-in"
        style={accentColor ? { borderTop: `3px solid ${accentColor}` } : undefined}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="display text-lg font-semibold">{title}</h2>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="닫기"
            data-testid="sheet-close"
            className="rounded-full px-2 py-1 text-on-background/70 hover:bg-surface-high"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
