// Single shared top bar (Design §4.1, MASTER-008). Home · project switcher · tabs · connection.
import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { ProjectListItem } from "../api/types";
import { Button } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import { openProjectCreationGate } from "../features/tycoon/projectCreationNavigation";
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
  const setDashboardPanel = useStore((s) => s.setDashboardPanel);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const connection = useStore((s) => s.connection);
  const lastSyncAt = useStore((s) => s.lastSyncAt);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);

  useEffect(() => {
    const load = () => {
      api
        .listProjects()
        .then((res) => setProjects(Array.isArray(res) ? res : res.items))
        .catch(() => setProjects([]));
    };
    load();
    window.addEventListener("companyops:projects-changed", load);
    return () => window.removeEventListener("companyops:projects-changed", load);
  }, []);

  const conn = CONN_META[connection] ?? CONN_META.DISCONNECTED;

  return (
    <header className="glass-3 fixed left-1/2 top-5 z-40 grid w-[min(1000px,calc(100vw-360px))] -translate-x-1/2 items-center justify-between gap-2 rounded-2xl px-3 py-2 sm:grid-cols-2 lg:flex lg:gap-4 lg:rounded-full lg:px-5">
      {/* left: current-project switcher (brand logo moved to the fixed top-left corner) */}
      <div className="flex min-w-0 items-center gap-3 sm:col-span-2 lg:col-span-1 lg:justify-start">
        <ProjectSwitcher
          projects={projects}
          activeProjectId={activeProjectId}
          onSelect={(id) => {
            setActiveProject(id);
            setActiveTab("tycoon");
          }}
        />
      </div>

      {/* center: tabs */}
      <nav className="flex w-fit shrink-0 items-center gap-1 rounded-full bg-surface p-1">
        <TabButton id="tycoon" active={activeTab === "tycoon"} onClick={() => setActiveTab("tycoon")}>
          Tycoon Office
        </TabButton>
        <TabButton id="dashboard" active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")}>
          Dashboard
        </TabButton>
        <TabButton id="admin" active={activeTab === "admin"} onClick={() => setActiveTab("admin")}>
          Dev Admin
        </TabButton>
      </nav>

      {/* right: connection + plan review */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
        <Button variant="ghost" onClick={openProjectCreationGate} data-testid="gebar-project-create">
          <Icon name="add" size={16} /> 새 프로젝트
        </Button>
        <span data-testid="gebar-connection" className="flex flex-wrap items-center gap-1.5 text-xs">
          <span aria-hidden style={{ color: conn.color }}>●</span>
          <span>{conn.label}</span>
          {lastSyncAt && (
            <span className="tabular text-on-background/50">
              {new Date(lastSyncAt).toLocaleTimeString()}
            </span>
          )}
        </span>
        {activeProjectId && (
          <Button variant="ghost" onClick={() => setDashboardPanel("plan")} data-testid="gebar-plan-review">
            계획 검토
          </Button>
        )}
      </div>
    </header>
  );
}

// Current project name at the very left; click to open a dropdown and switch projects.
function ProjectSwitcher({
  projects,
  activeProjectId,
  onSelect,
}: {
  projects: ProjectListItem[];
  activeProjectId: string | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const current = projects.find((p) => p.id === activeProjectId) ?? null;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative min-w-0">
      <button
        type="button"
        data-testid="gebar-project-switcher"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex min-w-0 max-w-[240px] items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-on-background transition hover:bg-surface-high ${
          current ? "bg-transparent" : "bg-surface"
        }`}
      >
        <span className={`truncate font-semibold ${current ? "text-on-background" : "text-on-background/55"}`}>
          {current ? current.name : "프로젝트 선택"}
        </span>
        <Icon name="expand_more" size={18} className={`shrink-0 text-on-background/60 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          role="listbox"
          className="glass-3 absolute left-0 top-[calc(100%+8px)] z-50 max-h-[320px] w-[260px] overflow-auto rounded-2xl border border-outline-variant p-1.5 shadow-xl"
        >
          {projects.length === 0 && (
            <p className="px-3 py-2 text-sm text-on-background/60">아직 프로젝트가 없습니다.</p>
          )}
          {projects.map((p) => (
            <button
              key={p.id}
              role="option"
              aria-selected={p.id === activeProjectId}
              onClick={() => { onSelect(p.id); setOpen(false); }}
              className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-surface-high ${
                p.id === activeProjectId ? "bg-surface-high text-primary" : "text-on-background/85"
              }`}
            >
              <span className="min-w-0 truncate font-medium">{p.name}</span>
              <span className="shrink-0 text-xs text-on-background/50">{p.projectSize ?? p.budgetLevel}</span>
            </button>
          ))}
        </div>
      )}
    </div>
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
