// Pure derivation of Attention Center items from the snapshot (04 §7). Dedup by id.
import type { Snapshot } from "../../api/types";

export type AttentionKind = "DECISION" | "PLAN_APPROVAL" | "MILESTONE_RESULT" | "QA_REVIEW";
export interface AttentionItem {
  kind: AttentionKind;
  id: string;
  title: string;
  detail?: string;
}

export function deriveAttention(snapshot: Snapshot | null): AttentionItem[] {
  if (!snapshot) return [];
  const items: AttentionItem[] = [];

  for (const d of snapshot.pendingDecisions ?? []) {
    items.push({ kind: "DECISION", id: d.id, title: "결정 필요", detail: d.reason });
  }
  for (const p of snapshot.plans ?? []) {
    if (p.status === "FINAL_APPROVAL_PENDING") {
      items.push({ kind: "PLAN_APPROVAL", id: p.id, title: `계획 최종 실행 승인 (v${p.version})`, detail: p.request });
    }
  }
  for (const m of snapshot.milestones ?? []) {
    if (m.reviewStatus === "PENDING") {
      items.push({ kind: "MILESTONE_RESULT", id: m.id, title: `Milestone 결과 승인 대기: ${m.title}` });
    }
  }
  for (const q of snapshot.qaRuns ?? []) {
    if (q.technicalGate === "FAILED") {
      items.push({ kind: "QA_REVIEW", id: q.id, title: "QA 실패 검토 필요", detail: `Task ${q.taskId}` });
    }
  }

  // dedup by kind+id
  const seen = new Set<string>();
  return items.filter((i) => {
    const key = `${i.kind}:${i.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
