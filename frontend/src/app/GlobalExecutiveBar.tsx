// Single shared top bar (Design §4.1, MASTER-008). Product · project picker · tabs · connection.
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { ProjectListItem } from "../api/types";
import { Button } from "../components/ui/Button";
import { useStore } from "../store/useStore";

const CONN_META: Record<string, { label: string; color: string }> = {
  CONNECTING: { label: "연결 중", color: "#d97706" },
  CONNECTED: { label: "연결됨", color: "#059669" },
  RECONNECTING: { label: "재연결 중", color: "#d97706" },
  DISCONNECTED: { label: "연결 끊김", color: "#767586" },
  ERROR: { label: "오류", color: "#ba1a1a" },
};

export function GlobalExecutiveBar() {
  const activeProjectId = useStore((s) => s.activeProjectId);
  const setActiveProject = useStore((s) => s.setActiveProject);
  const activeTab = useStore((s) => s.ui.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const connection = useStore((s) => s.connection);
  const lastSyncAt = useStore((s) => s.lastSyncAt);
  const snapshot = useStore((s) => s.snapshot);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);

  useEffect(() => {
    api
      .listProjects()
      .then((res) => setProjects(Array.isArray(res) ? res : res.items))
      .catch(() => setProjects([]));
  }, []);

  const conn = CONN_META[connection] ?? CONN_META.DISCONNECTED;
  const projectName = snapshot?.project?.name;

  return (
    <header className="glass-3 fixed left-1/2 top-4 z-40 grid w-[min(1100px,94vw)] -translate-x-1/2 items-center justify-between gap-2 rounded-2xl px-3 py-2 sm:grid-cols-2 lg:flex lg:gap-4 lg:rounded-full lg:px-5">
      {/* left: brand + project */}
      <div className="flex min-w-0 items-center justify-between gap-3 sm:col-span-2 lg:justify-start">
        <span className="display text-base font-bold text-primary">CompanyOps</span>
        <select
          data-testid="gebar-project-select"
          aria-label="프로젝트 선택"
          className="min-w-0 max-w-[180px] rounded-full border border-outline-variant bg-surface-lowest px-3 py-1 text-sm"
          value={activeProjectId ?? ""}
          onChange={(e) => setActiveProject(e.target.value || null)}
        >
          <option value="">프로젝트 선택…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.budgetLevel}
            </option>
          ))}
        </select>
        {projectName && <span className="hidden truncate text-sm text-on-background/60 lg:block lg:max-w-[160px]">{projectName}</span>}
      </div>

      {/* center: tabs */}
      <nav className="flex w-fit shrink-0 items-center gap-1 rounded-full bg-surface p-1">
        <TabButton id="tycoon" active={activeTab === "tycoon"} onClick={() => setActiveTab("tycoon")}>
          Tycoon Office
        </TabButton>
        <TabButton id="dashboard" active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")}>
          Dashboard
        </TabButton>
      </nav>

      {/* right: connection + plan review */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
        <span data-testid="gebar-connection" className="flex flex-wrap items-center gap-1.5 text-xs">
          <span aria-hidden style={{ color: conn.color }}>●</span>
          <span>{conn.label}</span>
          {lastSyncAt && (
            <span className="tabular text-on-background/50">
              {new Date(lastSyncAt).toLocaleTimeString()}
            </span>
          )}
        </span>
        <Button variant="ghost" onClick={() => setActiveTab("dashboard")} data-testid="gebar-plan-review">
          계획 검토
        </Button>
      </div>
    </header>
  );
}

function TabButton({
  id, active, onClick, children,
}: { id: string; active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      data-testid={`gebar-tab-${id}`}
      onClick={onClick}
      aria-pressed={active}
      className={`whitespace-nowrap rounded-full px-4 py-1 text-sm font-medium transition ${
        active ? "bg-surface-lowest text-primary shadow" : "text-on-background/70 hover:text-on-background"
      }`}
    >
      {children}
    </button>
  );
}
