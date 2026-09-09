import { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";

// Demo gating shared across the village enter buttons, the project switcher, and the
// create flow. Client-side only — a lightweight gate for the demo, not real access control.
export const DEMO_UNLOCKED_PROJECT = "Neobank Super App";
export const DEMO_PASSWORD = "demo";
export const isProjectLocked = (name: string | null | undefined) =>
  !!name && name !== DEMO_UNLOCKED_PROJECT;

// A password prompt that runs `onConfirm` only when the demo password is entered.
export function DemoPasswordDialog({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  const submit = () => {
    if (password !== DEMO_PASSWORD) {
      setError(true);
      return;
    }
    onConfirm();
  };

  // Rendered through a portal on <body> so the fixed overlay is anchored to the
  // viewport, not to any transformed ancestor (e.g. the scaled ScrollWorld office).
  return createPortal(
    <div
      className="pointer-events-auto fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="데모 인증"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="w-[min(360px,calc(100vw-32px))] rounded-xl border border-outline-variant bg-surface p-6 shadow-2xl">
        <h3 className="text-lg font-bold">패스워드를 입력하세요</h3>
        <p className="mt-1.5 text-xs text-on-background/60">{message}</p>
        <input
          autoFocus
          type="password"
          className="input mt-3 w-full"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(false); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onCancel();
          }}
          placeholder="패스워드"
        />
        {error && <span className="mt-2 block text-xs text-error">패스워드가 올바르지 않습니다.</span>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>취소</Button>
          <Button onClick={submit}>확인</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
