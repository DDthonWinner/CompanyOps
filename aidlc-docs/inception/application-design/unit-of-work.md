# Units of Work — CompanyOps

> Stage: INCEPTION / Units Generation · Date: 2026-09-08 · Project type: Greenfield
> Decomposition per approved plan (`unit-of-work-plan.md`): **modular monolith**, **5 units** (Q2), with the shared frontend foundation folded into `frontend-tycoon` (Q7=B). A unit = a logical module grouping stories for the CONSTRUCTION phase; it is not independently deployable.

## Unit Set (5)

### U1 · `backend-pm` (core backend service)
Per Q2, all backend services except Git and UF fold into PM. This is the core backend service.
- **Responsibilities**:
  - **PM**: Project/GitRepository-link/Role/LlmModel/AgentProfile/ProjectAgent/SprintMilestone/ProjectTask/documents; rule-based recommendation; PM-exactly-one + cap invariants; read-only progress aggregation.
  - **Orchestration**: plan-first lifecycle (create/feedback/review-complete/approve); Decision open/resolve; PLAN_EXECUTION & MILESTONE_RESULT approvals; scheduler + per-project write-lock; in-process async ExecutionWorker; technical QA gate; PublishCoordinator (calls U2); MilestoneResult versioning + review; project completion + UF trigger (calls U3).
  - **Platform/Common**: per-project revision, activity log, command receipts (idempotency), snapshot assembly, SSE broker, error envelope, DB/session/unit-of-work.
  - **Execution Provider**: `ExecutionProvider` interface + `FixtureExecutionProvider` (default) / `OpenAIExecutionProvider`, selected by `EXECUTION_MODE`.
- **Owns entities/tables**: projects, git_repositories, roles, llm_models, agent_profiles, project_agents, project_agent_documents, sprint_milestones, project_agent_milestones, project_tasks, role_document_templates, plan_versions, plan_feedback, decisions, approvals, task_attempts, artifact_versions, qa_runs, test_results, milestone_results, activity_events, command_receipts, (task_publishes shared with U2 as writer of publish records).
- **Exposes**: PM management APIs (`/api/projects*`, `/api/agent-profiles*`, `/api/roles`, `/api/llm-models`, `/api/role-document-templates`) + orchestration APIs (`/snapshot`, `/events`, `/commands`, `/plans/*`, `/decisions/*`, `/qa-runs/*`, `/sprint-milestones/*/result*`, `/tasks/*/publish`, `/tasks/*/artifacts`, `/activity`). Health endpoint.
- **Stories**: PM-1..6, ORCH-1..8, RT-1..2 (backend/SSE side), ORCH-5 (integration).

### U2 · `backend-git`
- **Responsibilities**: `GitInterface` — clone + `project/{projectId}` branch; milestone sync (ff-only pull); path-safe read/write; ChangeSet + diff (incl. untracked/deleted); idempotent commit + real push with states NOT_STARTED/NO_CHANGES/COMMITTED_LOCAL/PUSHED/FAILED/SYNC_REQUIRED. No force-push/auto-merge; credentials from server env. Per-project write-lock cooperation with U1's PublishCoordinator.
- **Owns**: server checkout directories; writes task_publishes records (validated by U1).
- **Exposes**: `GitInterface` methods (in-process, called by U1); the `/tasks/{id}/publish` route handler delegates here after U1 validation.
- **Stories**: GIT-1, GIT-2 (+ contributes to ORCH-4/ORCH-5).

### U3 · `backend-uf`
- **Responsibilities**: AI-utilization aggregation — on Project COMPLETED, idempotently build a single UtilizationReport from the completed-revision source snapshot (read-only); metrics; Score `UF_MVP_V1` (invalid aspects → N/A + renormalize); previous-report comparison; feedback CRUD (post-completion only; 409 when ACTIVE). Never mutates work state.
- **Owns**: utilization_reports, utilization_metrics, feedbacks.
- **Exposes**: `/api/utilization*`, `/api/feedbacks/*` (global paths).
- **Stories**: UF-1..4 (+ ORCH-8 decision counts feed metrics).

### U4 · `frontend-tycoon` (owns the shared frontend foundation — Q7=B)
- **Responsibilities**:
  - **Shared foundation** (owned here, consumed by U5): AppShell + single `GlobalExecutiveBar`; `SnapshotStore` (Zustand, snapshot-driven + UI slice in Local Storage); `ApiClient` (requestId, expectedVersion/Revision, error envelope); `SseClient` (connection states, 15s heartbeat, 45s disconnect, backoff 1/2/5/10s, snapshot re-read); design tokens; shared shadcn/ui; connection status + last-sync.
  - **Tycoon view**: R3F/Three.js isometric scene (desks FE/BE/DB/PM + QA aux, pawns, inbox/outbox, CanvasTexture monitors), SideHUD/VelocityPod/CommandDock, Agent/Desk sheets, `tycoon-item-selected` selection, deterministic seat placement, WebGL-failure → Dashboard route.
- **Consumes**: U1 HTTP+SSE contract.
- **Stories**: TY-1..3, RT-1..2 (frontend foundation), + shell-hosted PM-2 project select.

### U5 · `frontend-dashboard` (depends on U4 foundation)
- **Responsibilities**: Dashboard control center (`04` §24 tree): ProjectProgress, DependencyWaitNotice, DevelopmentFlow/AgentWorkArea, AttentionCenter (Decision/MilestoneResultApproval/PlanApproval/QAReview), AgentOverview, CurrentAndNextStep, ActiveTaskList/DependencyDetailPanel, PlanReviewPanel (versions/feedback/impact/final-approval), QARunReport/QAReview/AdditionalValidation, QualityGate, TokenUsage, ActivityTimeline, RecentArtifacts/ArtifactPreview, CommandInput; **FeedbackSection** (UF). Also hosts PM management surfaces (project create, agent matching, profile management).
- **Consumes**: U4 shared foundation (shell/store/clients/UI); U1 + U3 contracts.
- **Stories**: DASH-1..4, UF-1..4 (UI), PM-1/3/4/5/6 (management UI surfaces), ORCH-1..3/6/8 (plan/decision/approval UI).

## Code Organization Strategy (greenfield)
Monorepo with functional module directories (D8); units map to directory sets (a module dir need not equal a unit, but each dir has one owning unit):

```
backend/app/
  ├── main.py, config.py, db.py, models/, schemas/          # U1
  ├── common/       # U1 — revision, receipts, snapshot, sse, activity, errors
  ├── pm/           # U1 — projects, profiles, agents, milestones, tasks, recommendation
  ├── orchestrator/ # U1 — planning, decisions, approvals, scheduler, worker, qa, publish-coord, milestone-result, completion
  │     └── execution/   # U1 — ExecutionProvider (fixture/openai)
  ├── git_interface/# U2 — interface, workspace, file_access, git_command, models, exceptions
  └── uf/           # U3 — reports, metrics, feedback, scoring
backend/tests/{common,pm,orchestrator,git_interface,uf}
frontend/src/
  ├── app/          # U4 — AppShell, GlobalExecutiveBar, routing
  ├── store/        # U4 — zustand snapshot + ui slices
  ├── api/          # U4 — http client, sse client
  ├── components/ui/# U4 — shadcn + tokens
  ├── features/tycoon/     # U4
  ├── features/dashboard/  # U5
  └── features/feedback/   # U5
```
Application code lives at workspace root; per-unit doc summaries go under `aidlc-docs/construction/{unit-name}/`.

## Validation
- Boundaries: PM/orchestration/platform coherently form the core service (U1); Git (U2) and UF (U3) are isolated backend concerns with clear read-only/validated interfaces; frontend split by the two required views with shared foundation owned by U4 (Q7=B).
- All 29 stories are assigned (see `unit-of-work-story-map.md`).
- Dependencies acyclic (see `unit-of-work-dependency.md`).
