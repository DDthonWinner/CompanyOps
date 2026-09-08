# Functional Design Plan — U5 `frontend-dashboard`

> Stage: CONSTRUCTION / Functional Design (Planning) · Unit: frontend-dashboard · Date: 2026-09-08
> Scope: Dashboard control center + PM management/creation UIs + UF Feedback section. Depends on U4 shared foundation (AppShell/GlobalExecutiveBar/SnapshotStore/ApiClient/SseClient/UI).
> Stories: DASH-1..4, UF-1..4, PM-1/3/4/5/6 (UI), ORCH-1..3/6/8 (plan/approval UI). Inputs: `04`, `01`, `02`, `06`.

## Methodology & Approach
`04` §24 fixes the component tree; `06` §4 fixes the write endpoints; `01`/`02` fix PM/UF flows. This stage defines the Dashboard components, the write-action flows (commands/approvals/creation), and UI rules. It **replaces U4's DashboardPlaceholder** with the real `DashboardView`. Recommended defaults pre-filled.

## Functional Design Decisions
### Q1 — Dashboard component set (P0 first)
**Recommended P0**: `ProjectProgress`, `AttentionCenter` (DecisionCard / MilestoneResultApprovalCard / PlanApprovalCard / QAReviewCard), `AgentOverview`, `ActiveTaskList`, `PlanReviewPanel` (PlanVersion / FeedbackHistory / ImpactPreview / FinalExecutionApproval), `QARunReport` + `QualityGate`, `ActivityTimeline`, `RecentArtifacts`, `CommandInput`. **Deferred P1/P2**: Token trend charts (Recharts), dnd scheduling, decision/approval history search, checkpoints.
[Answer]: P0 set as above; charts/dnd deferred (recommended)

### Q2 — PM management / creation UIs
**Recommended**: `ProjectCreateDialog` (PM-1: create project), `AgentMatchingPanel` (PM-3/4: recommend + edit + assign), lightweight `ProfileManager` (PM-6, P2). These make the whole flow demoable from the UI (U4 was read-only).
[Answer]: ProjectCreate + AgentMatching (P0); ProfileManager P2 (recommended)

### Q3 — Plan-first & approval flows (04 §19, 06 §4.2)
**Recommended**: `CommandInput` → `POST /commands` → plan shows in `PlanReviewPanel`; buttons **Request Changes** (feedback, expectedVersion), **Review Complete**, **Final Execution Approval** (expectedVersion) — distinct actions, never auto-execute; `MilestoneResultApprovalCard` → review (APPROVED+NONE / REVISION_REQUESTED, expectedResultVersion); `DecisionCard` → resolve. All carry `requestId`; 409 surfaces "최신 상태로 갱신됨" and re-reads snapshot.
[Answer]: Plan/approval/decision actions as above with version guards (recommended)

### Q4 — UF Feedback section (02, 04 §30)
**Recommended**: `FeedbackSection` inside Dashboard (no third tab). ACTIVE → show source metrics + "프로젝트 완료 후 집계" notice; COMPLETED → Autonomy/Resource/Area scores, overall Score or N/A + scoreVersion, AI-task ratio, token/cost (미수집 aware), previous comparison; comment list + create/edit (post-completion only). Read/write via `/api/utilization*` + `/api/feedbacks` (uses U3 when available; before U3, shows empty/"미연동").
[Answer]: FeedbackSection per 04 §30 (recommended)

### Q5 — API client extension
**Recommended**: Extend the shared `api/client.ts` with write + PM/UF methods: `createProject`, `recommendAgents`, `assignAgents`, `createMilestone`, `createTask`, `postCommand`, `planFeedback`, `planReviewComplete`, `planApprove`, `resolveDecision`, `reviewMilestoneResult`, `publishTask`, `getMilestoneResult`, `getQaRun`, `getActivity`, `listAgentProfiles`, `listLlmModels`, `getUtilization`/`getFeedbacks` — all attach `requestId`/versions and surface the error envelope.
[Answer]: Extend shared ApiClient with write/PM/UF methods (recommended)

### Q6 — Integration with shell
**Recommended**: Replace U4's `DashboardPlaceholder` in `AppShell` with `DashboardView`; both tabs keep sharing the single `GlobalExecutiveBar`; `GlobalExecutiveBar` "계획 검토" button deep-links to the PlanReviewPanel. Narrow screens show AttentionCenter first (Design §12).
[Answer]: Wire DashboardView into AppShell; shared GEBar (recommended)

## Mandatory Functional Design Artifacts (generation checklist)
- [x] `construction/frontend-dashboard/functional-design/frontend-components.md` — component tree, props/state, interactions, API integration
- [x] `construction/frontend-dashboard/functional-design/business-logic-model.md` — command/approval/creation flows, snapshot-driven rendering
- [x] `construction/frontend-dashboard/functional-design/business-rules.md` — plan-first UI rules, 409 handling, UF post-completion gating, a11y
- [x] `construction/frontend-dashboard/functional-design/domain-entities.md` — client view-model types (reuses U4 snapshot types; adds plan/decision/UF shapes)
- [x] Validate against 04 + 01 + 02 + 06

## Approval
Approve this plan (defaults) to generate U5 functional-design artifacts, or edit any `[Answer]:`.
