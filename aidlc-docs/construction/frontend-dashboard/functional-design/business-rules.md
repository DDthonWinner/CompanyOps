# U5 frontend-dashboard — Client Rules

> Stage: CONSTRUCTION / Functional Design · Unit: frontend-dashboard · Date: 2026-09-08
> Rules (04, 01, 02, 06). IDs prefixed FR-DASH-.

## Plan-first & approvals (04 §19, 26)
- FR-DASH-1: Sending an instruction, giving feedback, and completing review do NOT execute; only **Final Execution Approval** executes.
- FR-DASH-2: A new plan version returns the panel to REVIEW; a stale/old version cannot approve/execute the new one (server 409).
- FR-DASH-3: Every write carries `requestId`; versioned writes carry `expectedVersion`/`expectedResultVersion`/`expectedRevision`; on 409 show "최신 상태로 갱신되었습니다" and rely on the re-read snapshot (never optimistic success).
- FR-DASH-4: Duplicate final-approval clicks execute once (idempotent server); the button disables after submit until snapshot updates.

## Milestone result & QA (04 §9/§12/§13)
- FR-DASH-5: Task completion (progress) and milestone human approval are shown as separate axes (e.g., "Task 6/6 · 승인 대기").
- FR-DASH-6: Approve is disabled while the technical gate is FAILED; viewing a QA report never changes failure counts.
- FR-DASH-7: Additional-validation choice is explicit (NONE vs REQUESTED); no response is not treated as approval.

## Attention Center (04 §7)
- FR-DASH-8: Surfaces Decision / Plan final-approval / Milestone-result / QA-review items; dedup by request/id; reading/closing a card is not resolving it.
- FR-DASH-9: Narrow screens show AttentionCenter before the work area.

## PM management (01 §7, §10)
- FR-DASH-10: Create/assign surfaces the server envelope on validation errors (PM count, cap, duplicate profile, inactive model/profile, color/icon).
- FR-DASH-11: Assignment requires exactly one PM; UI blocks assign otherwise with a clear message.
- FR-DASH-12: ACTIVE projects do not auto re-recommend; the UI routes changes through the plan-first flow.

## UF (02, 04 §30)
- FR-DASH-13: Report/Score/Comment are read-only display + comment authoring, and only for COMPLETED projects; ACTIVE shows a "완료 후 집계" notice.
- FR-DASH-14: Comment authoring never triggers task/agent/rework; comment count is total (not unresolved). Uncollected metrics show "미수집", not 0.
- FR-DASH-15: AI-utilization Score is visually separated from task progress / QA gate / product quality.

## Shell / a11y / connection
- FR-DASH-16: Uses the single shared GlobalExecutiveBar (U4); no third top-level tab; no local project/connection header.
- FR-DASH-17: Status via text/icon + color; modals Escape/close/focus-return; connection status always visible (via GEBar).
- FR-DASH-18: While disconnected, write actions are disabled/warned; unconfirmed commands are not shown as completed.
- FR-DASH-19: dnd scheduling / Recharts token trends / history search are deferred (P1/P2) — not in this unit's build.
