import { useState } from "react";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { StatusPill } from "../../components/ui/StatusPill";
import { useStore } from "../../store/useStore";
import type { ExecStatus } from "../../api/types";

const STATUSES: ExecStatus[] = ["TODO", "RUNNING", "WAITING", "REVIEW", "COMPLETED", "BLOCKED", "FAILED", "CANCELLED"];
export function ActiveTaskList() {
  const snapshot = useStore((s) => s.snapshot);
  const openAgent = useStore((s) => s.openAgentSheet);
  const [status, setStatus] = useState("ALL");
  const [query, setQuery] = useState("");
  if (!snapshot) return null;
  const tasks = snapshot.tasks.filter((t) => (status === "ALL" || t.status === status) && t.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <GlassPanel level={2} className="p-4">
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <h3 className="display mr-auto text-sm font-semibold">Tasks · {tasks.length}/{snapshot.tasks.length}</h3>
      <input aria-label="작업 검색" placeholder="작업 검색…" value={query} onChange={(e) => setQuery(e.target.value)} className="min-w-0 rounded-lg border border-outline-variant bg-white px-3 py-1.5 text-xs" />
      <select aria-label="작업 상태" value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-outline-variant bg-white px-2 py-1.5 text-xs">
        <option value="ALL">전체 상태</option>{STATUSES.map((s) => <option key={s} value={s}>{s} ({snapshot.tasks.filter((t) => t.status === s).length})</option>)}
      </select>
    </div>
    {!tasks.length && <p role="status" className="py-6 text-center text-xs text-on-background/55">조건에 맞는 작업이 없습니다.</p>}
    <div className="space-y-2">
      {tasks.map((task) => <details key={task.id} className="rounded-xl border border-outline-variant/60 bg-white p-3">
        <summary className="cursor-pointer text-xs focus-visible:outline-primary"><span className="ml-1 font-medium">{task.title}</span> <StatusPill status={task.status} /></summary>
        <div className="mt-3 space-y-2 border-t border-outline-variant/40 pt-2 text-xs text-on-background/70">
          <p>{task.description || "상세 설명이 없습니다."}</p>
          <p>우선순위: {task.priority} · 실행 주체: {task.executionMode ?? "미지정"}</p>
          <p>대기 사유: {task.waitReasons.length ? task.waitReasons.join(", ") : "없음"}</p>
          <p>선행 작업: {task.dependencyTaskIds.map((id) => snapshot.tasks.find((t) => t.id === id)?.title ?? id).join(", ") || "없음"}</p>
          {task.assignedProjectAgentId && <button className="rounded text-primary underline" onClick={() => openAgent(task.assignedProjectAgentId!)}>담당 에이전트 상세 ↗</button>}
        </div>
      </details>)}
    </div>
  </GlassPanel>;
}
