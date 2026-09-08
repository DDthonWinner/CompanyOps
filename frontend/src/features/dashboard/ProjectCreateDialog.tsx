import { useState } from "react";
import { api } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Sheet } from "../../components/ui/Sheet";
import { pushToast } from "../../components/ui/toast";
import { useStore } from "../../store/useStore";
import { runWrite } from "./actions";

export function ProjectCreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const setActiveProject = useStore((s) => s.setActiveProject);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [budgetLevel, setBudgetLevel] = useState("MEDIUM");
  const [projectSize, setProjectSize] = useState("SMALL");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      pushToast("프로젝트명을 입력하세요.", "error");
      return;
    }
    setBusy(true);
    const res = await runWrite(() =>
      api.createProject({
        name, description, budgetLevel, projectSize,
        gitRepository: { repositoryUrl: "https://github.com/DDthonWinner/TestOutput" },
      }),
    );
    setBusy(false);
    if (res && (res as any).id) {
      setActiveProject((res as any).id);
      pushToast("프로젝트를 생성했습니다.", "success");
      onClose();
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="새 프로젝트" testId="project-create-dialog">
      <div className="space-y-3 text-sm">
        <Field label="프로젝트명">
          <input data-testid="pc-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="설명">
          <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Budget">
            <select className="input" value={budgetLevel} onChange={(e) => setBudgetLevel(e.target.value)}>
              <option value="HIGH">HIGH ($250,000 / 16)</option>
              <option value="MEDIUM">MEDIUM ($180,000 / 12)</option>
              <option value="LOW">LOW ($120,000 / 8)</option>
            </select>
          </Field>
          <Field label="규모">
            <select className="input" value={projectSize} onChange={(e) => setProjectSize(e.target.value)}>
              <option value="SMALL">SMALL</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LARGE">LARGE</option>
            </select>
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button onClick={submit} disabled={busy} data-testid="pc-submit">생성</Button>
        </div>
      </div>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-on-background/60">{label}</span>
      {children}
    </label>
  );
}
