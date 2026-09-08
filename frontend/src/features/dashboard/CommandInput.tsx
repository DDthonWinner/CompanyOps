import { useState } from "react";
import { api } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { pushToast } from "../../components/ui/toast";
import { useStore } from "../../store/useStore";
import { runWrite } from "./actions";

export function CommandInput() {
  const pid = useStore((s) => s.activeProjectId);
  const connection = useStore((s) => s.connection);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const disabled = !pid || connection !== "CONNECTED";

  const send = async () => {
    if (!pid || !text.trim()) return;
    setBusy(true);
    const res = await runWrite(() =>
      api.postCommand(pid, { instruction: text, steps: [{ title: text, roleCode: "BACKEND" }] }),
    );
    setBusy(false);
    if (res) {
      pushToast("계획(v1)이 생성되었습니다. 검토 후 최종 승인하세요.", "info");
      setText("");
    }
  };

  return (
    <GlassPanel level={2} className="p-3">
      <div className="flex items-center gap-2">
        <input
          className="input flex-1"
          data-testid="command-input"
          placeholder={disabled ? "연결됨 상태에서 지시를 보낼 수 있습니다" : "AI에게 지시 입력 (계획 검토 후 실행)"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          disabled={disabled}
        />
        <Button onClick={send} disabled={disabled || busy} data-testid="command-send">보내기</Button>
      </div>
    </GlassPanel>
  );
}
