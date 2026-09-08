# Code Generation Plan — U5 `frontend-dashboard`

> Stage: CONSTRUCTION / Code Generation (Planning) · Unit: frontend-dashboard · Date: 2026-09-08
> Single source of truth for U5 code. Code location: `frontend/src/features/dashboard/` + extends `frontend/src/api/client.ts` and `frontend/src/app/AppShell.tsx`. Doc summary: `aidlc-docs/construction/frontend-dashboard/code/`.

## Unit Context
- **Stories**: DASH-1..4, UF-1..4, PM-1/3/4/5/6 (UI), ORCH-1..3/6/8 (plan/approval/decision UI).
- **Design**: `construction/frontend-dashboard/functional-design/*`, `04`, `01`, `02`, `06`.
- **Dependency**: U4 shared foundation (store/api/sse/GlobalExecutiveBar/UI). Extends shared ApiClient.
- **Tech**: React + TS + Tailwind + Zustand (existing frontend project).

## Generation Steps (numbered)
- [x] **Step 1 — Extend ApiClient** — add to `src/api/client.ts`: `createProject`, `recommendAgents`, `assignAgents`, `createMilestone`, `createTask`, `listAgentProfiles`, `listLlmModels`, `planFeedback`, `planReviewComplete`, `planApprove`, `resolveDecision`, `reviewMilestoneResult`, `publishTask`, `getMilestoneResult`, `getQaRun`, `getActivity`, `getTaskArtifacts`, `getUtilization`, `getFeedbacks`, `createFeedback`, `updateFeedback` (all requestId/version aware, envelope-parsing). Add `src/api/uf-types.ts` (UtilizationReport/Feedback).
- [x] **Step 2 — Toast + 409 handling** — `src/components/ui/Toast.tsx` (+ a tiny toast store) for envelope messages / "최신 상태로 갱신되었습니다".
- [x] **Step 3 — DashboardView + layout** — `src/features/dashboard/DashboardView.tsx` (header strip, center/right layout, narrow-first AttentionCenter), `HeaderStrip.tsx`, `AgentOverview.tsx`, `ActiveTaskList.tsx`.
- [x] **Step 4 — PM setup** — `ProjectCreateDialog.tsx` (PM-1), `AgentMatchingPanel.tsx` (PM-3/4: recommend→edit→assign).
- [x] **Step 5 — Attention Center** — `AttentionCenter.tsx` + `attention.ts` (pure derivation from snapshot, dedup) + `DecisionCard.tsx`, `PlanApprovalCard.tsx`, `MilestoneResultApprovalCard.tsx`, `QAReviewCard.tsx`.
- [x] **Step 6 — Plan review + command** — `PlanReviewPanel.tsx` (versions + feedback/review-complete/final-approval), `CommandInput.tsx`.
- [x] **Step 7 — QA / activity / artifacts** — `QARunReport.tsx` + `QualityGate.tsx`, `ActivityTimeline.tsx`, `RecentArtifacts.tsx`.
- [x] **Step 8 — UF FeedbackSection** — `FeedbackSection.tsx` (ACTIVE notice vs COMPLETED score/metrics/comments; graceful "미연동" before U3).
- [x] **Step 9 — Wire into shell** — replace `DashboardPlaceholder` in `AppShell.tsx` with `<DashboardView/>`; mount `<Toaster/>`.
- [x] **Step 10 — Tests (Vitest + RTL)** — `attention.ts` derivation/dedup; PlanReviewPanel button states + version-guarded calls (mocked api); ProjectCreateDialog submit → createProject; MilestoneResultApprovalCard approve disabled when gate FAILED; FeedbackSection ACTIVE-vs-COMPLETED gating.
- [x] **Step 11 — Build + docs** — `npm run build` + `npm run test` green; `code-summary.md`.

## Story traceability
| Step | Stories |
|---|---|
| 1 | all writes |
| 3 | DASH-3 (board/agents), DASH-1 (progress) |
| 4 | PM-1/3/4 |
| 5–6 | DASH-1/2, ORCH-1..3/6/8 |
| 7 | DASH-3 (QA/activity/artifacts) |
| 8 | UF-1..4 |
| 10 | DASH/ORCH/PM/UF (logic-level) |

## Notes
- Reuses U4 store/sse/GlobalExecutiveBar; no new top-level tab.
- Deferred (P1/P2): Recharts token trends, dnd scheduling, history search.
- Tests mock fetch; `npm run build` is the build gate. Executed in U5 Build & Test.

## Approval
Approve to generate U5 code (Steps 1–11).
