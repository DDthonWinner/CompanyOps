# Application Design — Components

> Stage: INCEPTION / Application Design · Date: 2026-09-08
> High-level component identification, purpose, responsibilities, and interfaces. Method signatures are in `component-methods.md`; detailed business rules are deferred to Functional Design (CONSTRUCTION).

Components are grouped by tier. Backend follows the layered style (D1): each component is a **service** (business rules + transactions) backed by **repositories** (SQLAlchemy). Frontend is a snapshot-driven React app (D5).

---

## BACKEND

### BC-1 · PMService (module `pm/`)
- **Purpose**: Own Project, GitRepository link, Role/LlmModel master data, AgentProfile, ProjectAgent, SprintMilestone, ProjectTask, ProjectAgentDocument, and the rule-based team recommendation.
- **Responsibilities**:
  - Project CRUD + archive; budget-level→amount/cap derivation; status transitions it owns (DRAFT→AGENT_MATCHING→READY); PM-exactly-one and cap invariants.
  - Rule-based agent-count sizing and role recommendation (`01` §6.3–6.4); assignment confirmation as a single transaction.
  - Milestone CRUD; Task CRUD + milestone move; **read-only** progress aggregation (`progressCurrent/Total/Percent`) and derived milestone status.
  - Document mapping (planned md paths).
- **Owns tables**: projects, git_repositories, roles, llm_models, agent_profiles, project_agents, project_agent_documents, sprint_milestones, project_agent_milestones, project_tasks, role_document_templates.
- **Does NOT own**: execution-state transitions of Task/Agent (Orchestrator), publish (GIT), utilization (UF).
- **Interface (summary)**: project/profile/agent/milestone/task management + metadata reads + aggregation reads. See `component-methods.md`.

### BC-2 · OrchestratorService (module `orchestrator/`)
The connective backend responsibility (Master §6). Composed of sub-services with distinct concerns:

- **BC-2a · PlanningService** — plan-first lifecycle: create Plan v1 from a command, apply feedback (new version), review-complete, final approval; enforces "approved version only executes" and superseding on change.
- **BC-2b · DecisionService** — Decision open/resolve; computes remaining `waitReasons`.
- **BC-2c · ApprovalService** — records PLAN_EXECUTION and MILESTONE_RESULT approvals against target id/version with idempotency.
- **BC-2d · SchedulerService** — selects executable Tasks (approvals + decisions + dependencies satisfied), acquires the per-project write-lock, enqueues work.
- **BC-2e · ExecutionWorker** — the in-process async worker (D2): drains the persisted command/job queue; invokes the `ExecutionProvider`; calls GitInterface to apply changes; records TaskAttempt/ArtifactVersion; records `executionMode`.
- **BC-2f · QAGateService** — records QARun/TestResult; computes the technical Gate (PENDING/PASSED/FAILED/ERROR) from required checks; ties results to artifact content hash.
- **BC-2g · MilestoneResultService** — builds MilestoneResult versions (sorted snapshot/hash of task/artifact/qa/commit), opens result review, applies review decisions, unlocks next milestone, and transitions Project→COMPLETED when the completion condition holds.
- **BC-2h · PublishCoordinator** — validates publish preconditions (`approvedPlanVersion==task.planVersion && technicalGate==PASSED && currentHash==qaValidatedHash`), invokes GitInterface publish, flips Task→COMPLETED on push success + `executionMode!=null`.
- **BC-2i · CompletionService** — on Project→COMPLETED, requests UF report generation once.
- **Owns tables**: plan_versions, plan_feedback, decisions, approvals, qa_runs, test_results, milestone_results, task_attempts, artifact_versions, task_publishes (with GIT), plus drives task/agent execution-state fields.

### BC-3 · GitInterface (module `git_interface/`)
- **Purpose**: All file/diff/git-publish work against the fixed remote, per `03`.
- **Responsibilities**: initialize project repo (clone + `project/{projectId}` branch), sync on milestone start, read/apply file changes (path-safe), compute ChangeSet + diff (incl. untracked/deleted), commit+push idempotently with states NOT_STARTED/NO_CHANGES/COMMITTED_LOCAL/PUSHED/FAILED/SYNC_REQUIRED. No force-push/auto-merge; credentials from server env.
- **Concurrency**: fronted by a per-project write-lock (D7) held across change→QA→publish.
- **Interface**: `GitInterface` methods (`initialize_project_repository`, `sync_milestone_repository`, `read_repository_file`, `apply_file_changes`, `get_task_changes`, `publish_task_changes`).

### BC-4 · UFService (module `uf/`)
- **Purpose**: AI-utilization reports/metrics/feedback (`02`, `06` §3.3).
- **Responsibilities**: on Project COMPLETED, idempotently aggregate a single UtilizationReport (reads PM/orchestrator source snapshot read-only); compute metrics + Score (`UF_MVP_V1`); previous-report comparison; CRUD feedback comments (post-completion only; 409 if project not COMPLETED). Never mutates task/agent/progress/QA/git state.
- **Owns tables**: utilization_reports, utilization_metrics, feedbacks.
- **Interface**: `/api/utilization*` and `/api/feedbacks` (global paths, not project-prefixed).

### BC-5 · ExecutionProvider (module `orchestrator/execution/`)
- **Purpose**: Abstraction over the AI work that produces artifacts (D3).
- **Implementations**: `FixtureExecutionProvider` (default; deterministic seeded artifacts; marks demo), `OpenAIExecutionProvider` (real GPT). Selected by `EXECUTION_MODE`. Records token usage source metrics per call. LangChain is an optional wrapper.
- **Interface**: `execute_task(context) -> ExecutionResult` (+ token metrics).

### BC-6 · CommonPlatform (module `common/`)
- **Purpose**: Cross-cutting infrastructure.
- **Responsibilities**:
  - **RevisionService** — per-project monotonic revision, bumped in the same transaction as state changes (D4).
  - **ActivityService** — append `activity_events`; `/activity` cursor read.
  - **CommandReceiptStore** — idempotency by `requestId`(+payload hash); 409 on same-id/different-payload (D6).
  - **SnapshotService** — assemble the full read model at current revision (Project/Agent/Task/Milestone + plans/pending approvals/QA/UF/git summaries + recent events).
  - **SSEBroker** — `/events` stream; heartbeat 15s; emits `project.updated` with revision (snapshot-invalidation model).
  - **ErrorEnvelope** — `{code,message,details,requestId}`; status mapping (400/404/409/422/502/503).
  - **Db/session/unit-of-work** — SQLAlchemy engine, transaction boundary.

### BC-7 · HTTP API layer (routers)
- **Purpose**: FastAPI routers exposing the `06` §4 contract; no business logic. Management PATCH cannot bypass approval gates to set RUNNING/COMPLETED.
- **Route groups**: PM management (`/api/projects*`, `/api/agent-profiles*`, `/api/roles`, `/api/llm-models`, `/api/role-document-templates`); orchestration (project-scoped `/snapshot`, `/events`, `/commands`, `/plans/*`, `/decisions/*`, `/qa-runs/*`, `/sprint-milestones/*/result*`, `/tasks/*/publish`, `/tasks/*/artifacts`, `/activity`); UF global (`/api/utilization*`, `/api/feedbacks/*`).

---

## FRONTEND

### FC-1 · AppShell + GlobalExecutiveBar
- **Purpose**: Mount the single shared executive bar once at top (Design §4.1, MASTER-008); host the two tabs (Tycoon Office / Dashboard); route between views without a third tab.
- **Responsibilities**: product/project context, tab nav, always-visible connection status + last-sync, plan-review entry (Deploy-Sprint slot), view-specific actions only when that view is active.

### FC-2 · SnapshotStore (Zustand)
- **Purpose**: Single source of truth for business state (D5). Holds the latest server snapshot for the active project (read-only business state) + a UI slice (selected tab, camera) persisted to Local Storage.
- **Responsibilities**: apply snapshot only if newer revision; expose selectors for both views; ignore stale/duplicate revisions.

### FC-3 · ApiClient
- **Purpose**: Typed HTTP client for the `06` contract. Attaches `requestId`; carries `expectedVersion`/`expectedRevision`; surfaces the error envelope + retryability. Never optimistically marks commands successful while disconnected.

### FC-4 · SseClient
- **Purpose**: Connect `/events`; manage connection state (CONNECTING/CONNECTED/RECONNECTING/DISCONNECTED/ERROR); 45s disconnect detection; backoff 1/2/5/10s; trigger full snapshot re-read on (re)connect and on higher-revision events.

### FC-5 · TycoonView
- **Purpose**: R3F/Three.js isometric office (`05`, Design §8). Sub-parts: `TycoonCanvas` (FloorStage/grid, DomainDesks FE/BE/DB/PM(+QA aux), DevPawns, Inbox/Outbox, CanvasTexture monitors), `HUDOverlay` (SideHUD, VelocityPod, CommandDock, Modals). Raycaster dispatches `tycoon-item-selected`; deterministic seat placement by role + stable agent order.

### FC-6 · DashboardView
- **Purpose**: Human–AI Control Center (`04` §24 tree): ProjectProgress, DependencyWaitNotice, DevelopmentFlow/AgentWorkArea, **AttentionCenter** (Decision/MilestoneResultApproval/PlanApproval/QAReview cards), AgentOverview, CurrentAndNextStep, ActiveTaskList/DependencyDetailPanel, **PlanReviewPanel** (PlanVersion/FeedbackHistory/ImpactPreview/FinalExecutionApproval), QARunReport/QAReview/AdditionalValidationRequest, QualityGate, TokenUsage, ActivityTimeline, RecentArtifacts/ArtifactPreview, CommandInput.

### FC-7 · FeedbackSection
- **Purpose**: UF utilization/score/feedback + previous-project comparison rendered **inside** the Dashboard (no third tab); read source metrics while ACTIVE, full score/comments after COMPLETED (`04` §30).

### FC-8 · Shared UI + tokens
- **Purpose**: shadcn/ui themed to the design tokens, glassmorphism levels, fonts, discipline accent colors, status shown with text/icon + color; WebGL-failure route to Dashboard.
