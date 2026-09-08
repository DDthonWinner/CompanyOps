# U5 frontend-dashboard — Code Generation Summary

> Stage: CONSTRUCTION / Code Generation · Unit: frontend-dashboard · Date: 2026-09-08
> Application code under `frontend/src/features/dashboard/` (+ shared `api/client.ts`, `app/AppShell.tsx`). Doc summary only.

## Created / modified
- **Modified** `src/api/client.ts` — added write + PM/UF methods (createProject, recommendAgents, assignAgents, createMilestone, createTask, listAgentProfiles, listLlmModels, planFeedback, planReviewComplete, planApprove, resolveDecision, getMilestoneResult, reviewMilestoneResult, publishTask, getQaRun, getTaskArtifacts, getActivity, getUtilization, getReportMetrics, getFeedbacks, createFeedback, updateFeedback).
- **Created** `src/api/uf-types.ts`, `src/components/ui/toast.tsx` (+ store), `src/index.css` `.input` utility.
- **Created** `src/features/dashboard/`: `DashboardView`, `HeaderStrip`, `AgentOverview`, `ActiveTaskList`, `ProjectCreateDialog`, `AgentMatchingPanel`, `AttentionCenter` + `attention.ts` (pure) + `cards/{DecisionCard,PlanApprovalCard,MilestoneResultApprovalCard,QAReviewCard}`, `PlanReviewPanel`, `CommandInput`, `QASection`, `ActivityTimeline`, `RecentArtifacts`, `FeedbackSection`, `actions.ts` (runWrite/409).
- **Modified** `src/app/AppShell.tsx` — replaced DashboardPlaceholder with `<DashboardView/>`; mounted `<Toaster/>`.
- **Created** tests: `attention.test.ts`, `PlanReviewPanel.test.tsx`, `gating.test.tsx`.

## Tests & build
- `npm run test` → **19/19 pass** (8 files: 11 from U4 + 8 new). One benign `act()` warning (async fetch resolves after a synchronous disabled-state assertion).
- `npm run build` → **success**; bundle ~1.01 MB (Three.js; code-split later).

## Story coverage
DASH-1..3 (P0; DASH-4 charts/dnd deferred), UF-1..4, PM-1/3/4 (create + matching; PM-6 P2), ORCH-1..3/6/8 (command/plan/approval/decision UI). Write actions carry requestId + version guards; 409 → toast + snapshot re-read.

## Notes
- Reuses U4 shared foundation; no third top-level tab.
- Before U3 (UF) is wired, FeedbackSection shows a graceful "미연동/미생성" state after completion.
