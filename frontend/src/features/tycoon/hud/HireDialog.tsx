import { useEffect, useMemo, useState } from "react";
import { api } from "../../../api/client";
import { GlassPanel } from "../../../components/ui/GlassPanel";
import { pushToast } from "../../../components/ui/toast";
import { DESK_ROLES, ROLE_LABEL } from "../../../lib/roles";
import { useStore } from "../../../store/useStore";
import { useAgentMeta, type ProfileMeta } from "../agentMeta";

const FIELD = "w-full rounded-lg border border-outline-variant bg-surface-lowest px-3 py-2 text-sm";

export function HireDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const projectId = useStore((s) => s.activeProjectId);
  const snapshot = useStore((s) => s.snapshot);
  const applySnapshot = useStore((s) => s.applySnapshot);
  const meta = useAgentMeta();

  const used = useMemo(
    () =>
      new Set(
        (snapshot?.agents ?? [])
          .filter((a) => a.status !== "REMOVED")
          .map((a) => a.agentProfileId)
          .filter(Boolean),
      ),
    [snapshot],
  );
  const available = useMemo(
    () => (meta?.profiles ?? []).filter((p) => p.isActive && !used.has(p.id)),
    [meta, used],
  );

  const [profileId, setProfileId] = useState("");
  const [roleCode, setRoleCode] = useState<string>("FRONTEND");
  const [modelId, setModelId] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const applyProfile = (p: ProfileMeta) => {
    setProfileId(p.id);
    const rc = p.role?.code && (DESK_ROLES as readonly string[]).includes(p.role.code) ? p.role.code : "FRONTEND";
    setRoleCode(rc);
    setModelId(p.defaultLlmModel?.id ?? meta?.models[0]?.id ?? "");
    setName(p.name);
  };

  // Initialize selection when opened / when profiles arrive.
  useEffect(() => {
    if (!open) return;
    if (available.length && !available.some((p) => p.id === profileId)) applyProfile(available[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, available]);

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async () => {
    if (!projectId || !profileId || busy) return;
    setBusy(true);
    try {
      const res = (await api.hireAgent(projectId, {
        agentProfileId: profileId,
        roleCode,
        llmModelId: modelId,
        displayName: name,
      })) as { agent?: { displayName?: string } };
      const snap = await api.getSnapshot(projectId);
      if (snap) applySnapshot(snap);
      pushToast(`고용 완료: ${res?.agent?.displayName ?? name}`, "success");
      onClose();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "고용에 실패했습니다.", "error");
    } finally {
      setBusy(false);
    }
  };

  const cap = snapshot ? `${snapshot.project.assignedAgentCount}/${snapshot.project.maxAgentCount}` : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} data-testid="hire-scrim" />
      <GlassPanel
        level={4}
        role="dialog"
        aria-modal="true"
        aria-label="Agent 고용하기"
        data-testid="hire-dialog"
        className="animate-in relative z-10 w-[min(92vw,26rem)] p-5"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="display text-lg font-semibold">Agent 고용하기</h2>
          <button onClick={onClose} aria-label="닫기" className="rounded-full px-2 py-1 text-on-background/70 hover:bg-surface-high">
            ✕
          </button>
        </div>

        {available.length === 0 ? (
          <div className="text-sm text-on-background/60">
            {meta ? "고용 가능한 Agent Profile이 없습니다 (모두 배정됨)." : "불러오는 중…"}
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <label className="block">
              <span className="mb-1 block text-xs text-on-background/60">Agent Profile</span>
              <select
                className={FIELD}
                value={profileId}
                onChange={(e) => {
                  const p = available.find((x) => x.id === e.target.value);
                  if (p) applyProfile(p);
                }}
              >
                {available.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.skillLevel}
                    {p.role ? ` · ${p.role.code}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs text-on-background/60">배치 데스크</span>
              <select className={FIELD} value={roleCode} onChange={(e) => setRoleCode(e.target.value)}>
                {DESK_ROLES.map((c) => (
                  <option key={c} value={c}>
                    {ROLE_LABEL[c] ?? c}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs text-on-background/60">LLM 모델</span>
              <select className={FIELD} value={modelId} onChange={(e) => setModelId(e.target.value)}>
                {(meta?.models ?? [])
                  .filter((m) => m.isActive)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName} · {m.grade}
                    </option>
                  ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs text-on-background/60">이름</span>
              <input className={FIELD} value={name} onChange={(e) => setName(e.target.value)} />
            </label>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-on-background/50">정원 {cap}</span>
              <button
                onClick={submit}
                disabled={busy || !profileId}
                data-testid="hire-submit"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow transition hover:bg-primary-container disabled:opacity-60"
              >
                {busy ? "고용 중…" : "고용"}
              </button>
            </div>
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
