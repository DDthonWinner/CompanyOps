import { create } from "zustand";

export interface ToastItem {
  id: number;
  message: string;
  kind: "info" | "error" | "success";
}

interface ToastState {
  toasts: ToastItem[];
  push: (message: string, kind?: ToastItem["kind"]) => void;
  dismiss: (id: number) => void;
}

let seq = 1;

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (message, kind = "info") => {
    const id = seq++;
    set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function pushToast(message: string, kind: ToastItem["kind"] = "info") {
  useToasts.getState().push(message, kind);
}

const COLOR = { info: "#4648d4", error: "#ba1a1a", success: "#059669" } as const;

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          data-testid="toast"
          className="glass-4 pointer-events-auto max-w-sm rounded-hud px-4 py-2 text-sm"
          style={{ borderLeft: `4px solid ${COLOR[t.kind]}` }}
          onClick={() => dismiss(t.id)}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
