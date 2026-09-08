import { useState } from "react";
import { api } from "../../../api/client";
import { Button } from "../../../components/ui/Button";
import { useStore } from "../../../store/useStore";
import { runWrite } from "../actions";

export function DecisionCard({ decisionId, reason }: { decisionId: string; reason?: string }) {
  const pid = useStore((s) => s.activeProjectId);
  const revision = useStore((s) => s.snapshot?.revision ?? 0);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);

  const resolve = async () => {
    if (!pid || !answer.trim()) return;
    setBusy(true);
    await runWrite(() => api.resolveDecision(pid, decisionId, revision, answer));
    setBusy(false);
  };

  return (
    <Card kind="결정 필요" color="#d97706">
      {reason && <p className="text-xs text-on-background/70">{reason}</p>}
      <input
        className="input mt-2"
        placeholder="결정 내용"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        data-testid={`decision-input-${decisionId}`}
      />
      <div className="mt-2 flex justify-end">
        <Button onClick={resolve} disabled={busy} data-testid={`decision-resolve-${decisionId}`}>
          결정 전달
        </Button>
      </div>
    </Card>
  );
}

export function Card({ kind, color, children }: { kind: string; color: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-outline-variant bg-surface-lowest p-3" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="mb-1 text-xs font-semibold" style={{ color }}>{kind}</div>
      {children}
    </div>
  );
}
