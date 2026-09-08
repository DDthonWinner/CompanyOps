# CompanyOps — User Stories

> Stage: INCEPTION / User Stories · Date: 2026-09-08
> Approach: Feature-Based, grouped into one epic per module. Persona: **Operator** (see `personas.md`); AI Agent / Orchestrator are in-system actors.
> Each story is INVEST-shaped with acceptance criteria, a **Traces-to** line (requirements.md FR IDs + source AC IDs), and a **Priority** tag (P1 = connected-flow-first per Q4=C; P2 = fold in later).
> Acceptance criteria intentionally reuse the fixed contracts (multi-axis state, 409 concurrency, progress math, SSE recovery) rather than re-defining them.

**Count**: 24 stories across 7 epics. **P1**: 15 · **P2**: 9.

---

## EPIC PM — Project & Agent Management

### PM-1 — Create a project (P1)
**As an** Operator, **I want** to create a project with a name and a budget level, **so that** I have a container to staff and run work in.
**Acceptance Criteria**
- Given a name and a budget level (HIGH/MEDIUM/LOW), when I create a project, it is persisted and appears in the project list.
- Budget level fixes the display amount and agent cap: HIGH $250,000/16, MEDIUM $180,000/12, LOW $120,000/8 (display-only, not real spend).
- A new project with no tasks shows progress 0% / "작업 없음".
**Traces-to**: FR-PM-1, FR-ORCH-5 · Master-AC, PM AC · **P1**

### PM-2 — Browse and select projects (P1)
**As an** Operator, **I want** to list and select a project, **so that** both views and the executive bar operate on the chosen project.
**Acceptance Criteria**
- The project list shows name + scale/stage badge for each project.
- Selecting a project sets it as the active context in the shared GlobalExecutiveBar; the choice persists as a UI-only setting (Local Storage), never overwriting server work state.
**Traces-to**: FR-PM-1, Design §4.1 · **P1**

### PM-3 — Get a recommended team (P1)
**As an** Operator, **I want** a recommended team composition for the project, **so that** I can staff it quickly without hand-picking every role.
**Acceptance Criteria**
- Requesting a recommendation returns a proposed set of agent profiles per the recommendation rules in `01`, within the project's agent cap.
- The recommendation is a suggestion; I can accept, adjust, or ignore it before assigning.
**Traces-to**: FR-PM-3 · PM AC · **P1**

### PM-4 — Assign (hire) agents to the project (P1)
**As an** Operator, **I want** to assign existing agent profiles to the current project, **so that** the team can be shown and can perform work.
**Acceptance Criteria**
- "Hire AI Agent" assigns an existing `AgentProfile` to the project as a `ProjectAgent`; it does not create a new profile.
- Assignment is blocked when it would exceed the budget-level agent cap, with a clear message.
- Assigned counts are reflected as "assigned / cap" in the Tycoon HUD and Dashboard.
**Traces-to**: FR-PM-2, Design table (Hire AI Agent) · **P1**

### PM-5 — Create milestones and tasks (P1)
**As an** Operator, **I want** role-based milestones and their tasks to exist for a project, **so that** progress and execution can be tracked.
**Acceptance Criteria**
- I can create `SprintMilestone`s per role and `ProjectTask`s under them.
- Milestone completion is shown as `completed / total (non-cancelled)` tasks; no weighting.
- Task lists are retrievable via the PM endpoints.
**Traces-to**: FR-PM-4, FR-PM-6, FR-ORCH-5 · **P1**

### PM-6 — Edit / replace agent profiles (P2)
**As an** Operator, **I want** to edit an agent profile or replace an assigned agent, **so that** I can adjust the team over time.
**Acceptance Criteria**
- Editing a profile updates the reusable `AgentProfile`; replacing swaps the `ProjectAgent` on the project within the cap.
- Changes are reflected across both views on the next snapshot.
**Traces-to**: FR-PM-5 · **P2**

---

## EPIC ORCH — Orchestration & Plan-first Execution

### ORCH-1 — Submit a request and receive Plan v1 (P1)
**As an** Operator, **I want** my execution request to produce a Plan (v1) instead of running immediately, **so that** nothing happens without my review.
**Acceptance Criteria**
- Submitting a request with a `requestId` creates Plan v1 in state PLAN/REVIEW; no task execution starts.
- Re-submitting the same `requestId` is idempotent (no duplicate plan).
**Traces-to**: FR-ORCH-1, FR-ORCH-2 · Master §5 · **P1**

### ORCH-2 — Iterate on a plan with feedback (P1)
**As an** Operator, **I want** to request changes and receive a revised plan, **so that** the plan reflects my intent before execution.
**Acceptance Criteria**
- Submitting feedback produces a new plan revision; the plan state moves through REVIEW as revisions are made.
- Concurrency is guarded by `expectedRevision`; a stale revision returns **409**.
**Traces-to**: FR-ORCH-1, FR-ORCH-2, FR-ORCH-4 · **P1**

### ORCH-3 — Give final execution approval (P1)
**As an** Operator, **I want** an explicit final execution approval step, **so that** execution only begins on my command.
**Acceptance Criteria**
- After review-complete, the plan enters FINAL_APPROVAL_PENDING; approval moves it to APPROVED_WAITING then EXECUTING.
- Approval requires the expected plan version; a mismatch returns **409** and does not execute.
**Traces-to**: FR-ORCH-1, FR-ORCH-2 · Dashboard §19 · **P1**

### ORCH-4 — Execute a task to completion (P1)
**As an** Operator, **I want** an approved task to run through QA and publishing before it counts as done, **so that** "COMPLETED" is trustworthy.
**Acceptance Criteria**
- A task reaches COMPLETED only when ALL hold: approved plan version + technical QA passed + Git publish success + `executionMode` recorded.
- Execution and artifact-generation states are tracked on separate axes (never merged into one status).
- Human approval applies to the milestone-result version, not to individual tasks.
**Traces-to**: FR-ORCH-3, FR-ORCH-4, FR-GIT-4 · **P1**

### ORCH-5 — Complete the connected flow end-to-end (P1)
**As an** Operator, **I want** to run one project from staffing to a reviewed milestone result, **so that** I can see the whole loop work.
**Acceptance Criteria**
- End-to-end: recommend/assign team → create a small milestone → plan → approve → task executes → QA passes → real commit/push to `project/{projectId}` → milestone-result review.
- Progress updates to `round(100 × COMPLETED / non-cancelled tasks)` as tasks complete.
- The final demo shows a real GitHub commit on the project branch.
**Traces-to**: FR-ORCH-1..6, FR-GIT-1..4, MASTER-AC (final demo) · **P1**

### ORCH-6 — Review and act on milestone results (P1)
**As an** Operator, **I want** to review a milestone's result and approve/request-revision/reject it, **so that** completed work is validated by me.
**Acceptance Criteria**
- Milestone-result review states are PENDING/APPROVED/REVISION_REQUESTED/REJECTED, kept separate from execution/plan/QA axes.
- My decision is recorded against a result version with optimistic concurrency (409 on stale version).
**Traces-to**: FR-ORCH-3, FR-ORCH-4 · Dashboard §19 · **P1**

### ORCH-7 — Choose demo vs real AI execution (P1)
**As an** Operator, **I want** the system to default to a reliable demo/fixture mode with a switch to real OpenAI execution, **so that** demos are dependable but real runs are possible.
**Acceptance Criteria**
- Default mode is demo/fixture: deterministic seeded data; screens clearly show "AI 서버 미연결 / 데모 데이터"; no external model calls.
- Setting the env var/flag switches to a real OpenAI-GPT adapter for execution.
- `executionMode` is recorded per task regardless of mode.
**Traces-to**: FR-ORCH-7, requirements §1.1 (Q1/Q2) · **P1**

### ORCH-8 — Surface and record user decisions (P2)
**As an** Operator, **I want** my key decisions (approvals, revisions, rejections) captured as a Decisions record, **so that** there is an auditable trail.
**Acceptance Criteria**
- Decisions are exposed via the `/decisions` surface and counted for utilization metrics.
- Decision counts feed UF without triggering any rework loop.
**Traces-to**: FR-ORCH-6, FR-UF-1 · **P2**

---

## EPIC GIT — GitHub Interface

### GIT-1 — Publish task artifacts with a real push (P1)
**As an** Operator, **I want** completed task work committed and pushed to the project branch, **so that** output is real and verifiable.
**Acceptance Criteria**
- Publish uses `GitInterface` (subprocess git with path-safety) against the fixed remote `DDthonWinner/TestOutput`, branch `project/{projectId}`.
- Real remote push is performed (Q3=A); publish states are COMMITTED_LOCAL / PUSHED / SYNC_REQUIRED.
- No force-push, no auto-merge.
**Traces-to**: FR-GIT-1, FR-GIT-2, FR-GIT-3 · GIT-003..005 · **P1**

### GIT-2 — Republish idempotently and see sync status (P1)
**As an** Operator, **I want** publishing to be idempotent and its sync status visible, **so that** retries are safe and I know the remote state.
**Acceptance Criteria**
- Re-publishing the same work does not create duplicate commits and reports the correct state.
- A divergent remote surfaces SYNC_REQUIRED rather than force-pushing.
- A per-project write-lock prevents concurrent publishes for the same project.
**Traces-to**: FR-GIT-2, FR-GIT-3 · **P1**

---

## EPIC UF — AI-Utilization Feedback

### UF-1 — View a utilization report on completion (P1)
**As an** Operator, **I want** a utilization report generated when a project completes, **so that** I can see how AI was used.
**Acceptance Criteria**
- On project completion (QA + all stages done), a `UtilizationReport` is aggregated and viewable.
- Report includes AI-completed task ratio, area distribution (PM/FE/BE/QA), and token/cost (cost shows "미수집" when uncollected).
**Traces-to**: FR-UF-1, FR-UF-2 · UF AC-001..003 · **P1**

### UF-2 — See the AI-utilization score (P1)
**As an** Operator, **I want** a single AI-utilization score, **so that** I can gauge utilization at a glance.
**Acceptance Criteria**
- Score (`UF_MVP_V1`) combines Autonomy / Resource Efficiency / Area Distribution; an uncollected aspect is excluded and the rest re-normalized; N/A if none.
- Display is integer-rounded and clearly separated from product-quality and task-progress numbers.
**Traces-to**: FR-UF-2 · UF AC-004 · **P1**

### UF-3 — Read and record utilization feedback (P2)
**As an** Operator, **I want** to view and record feedback comments on AI utilization, **so that** I can capture improvement ideas.
**Acceptance Criteria**
- Feedback has aspect/severity/observation/impact/suggestion and can only be recorded after project completion.
- Feedback never assigns a task, targets an agent, or triggers rework.
**Traces-to**: FR-UF-3 · UF AC-005, AC-006 · **P2**

### UF-4 — Compare with previous projects (P2)
**As an** Operator, **I want** to compare the current report with previous ones, **so that** I can see whether utilization improved.
**Acceptance Criteria**
- Current vs previous reports are compared on score and key metrics.
- Comparison limits are flagged when project scope/nature differs.
**Traces-to**: FR-UF-4 · UF AC-007 · **P2**

---

## EPIC DASH — Dashboard (Human–AI Control Center)

### DASH-1 — Attention Center (P1)
**As an** Operator, **I want** a single place that surfaces what needs my action, **so that** I never miss an approval or review.
**Acceptance Criteria**
- The Attention Center lists items needing human action (plan review, final approval, milestone-result review) with direct entry points.
- On narrow screens, the Attention Center is shown first.
**Traces-to**: FR-DASH-1, Design §12 · Dashboard AC · **P1**

### DASH-2 — Plan review and approval UI (P1)
**As an** Operator, **I want** to review plan versions and give final approval from the Dashboard, **so that** the plan-first loop has a home.
**Acceptance Criteria**
- I can view plan versions, request changes, and give final execution approval (§19 flow).
- Execution/approval cannot be bypassed via drag-and-drop.
**Traces-to**: FR-DASH-2, FR-ORCH-1..3 · Dashboard §19 · **P1**

### DASH-3 — Task board, QA, and activity (P1)
**As an** Operator, **I want** task status columns, QA results, and an activity summary, **so that** I can monitor progress.
**Acceptance Criteria**
- Task columns reflect the execution-state axis; QA results and an activity summary are shown per the component tree in `04` §24.
- Status is conveyed with text/icon in addition to color.
**Traces-to**: FR-DASH-3, Design §12 · **P1**

### DASH-4 — Charts and drag-based scheduling (P2)
**As an** Operator, **I want** trend charts and drag-based schedule/status changes, **so that** I can plan visually.
**Acceptance Criteria**
- Recharts trend charts and dnd-kit scheduling are available.
- Dragging changes schedule/status but never bypasses execution/approval gates.
**Traces-to**: FR-DASH-4, Design §3.2 · **P2**

---

## EPIC TY — Tycoon View

### TY-1 — View the isometric office reflecting live state (P1)
**As an** Operator, **I want** a 2.5D isometric office that mirrors real project state, **so that** monitoring feels tangible.
**Acceptance Criteria**
- R3F/Three.js Orthographic isometric scene (azimuth 45°, elevation 35.264°) renders domain desks (FE/BE/DB/QA/PM), pawns, inbox/outbox, and monitors.
- WORKING animation is shown only for real task execution; WAITING/REVIEW are not animated as "working".
- On WebGL failure, a route to the Dashboard is offered without losing state/selection.
**Traces-to**: FR-TY-1, FR-TY-4, Design §8, §12 · **P1**

### TY-2 — Select an object to open its detail sheet (P1)
**As an** Operator, **I want** to click an agent or desk in 3D and open its detail, **so that** I can inspect work in context.
**Acceptance Criteria**
- Raycaster selection dispatches `tycoon-item-selected`; an `agent` opens the Agent sheet, and `desk/monitor/inbox/outbox` opens the Desk queue sheet.
- Modals support Escape/close and focus return.
**Traces-to**: FR-TY-3, Design §8.4, §9 · **P1**

### TY-3 — Read HUD summary and milestone progress (P1)
**As an** Operator, **I want** the HUD to show project summary, team counts, budget figure, and role milestones, **so that** key numbers are always visible.
**Acceptance Criteria**
- Side HUD shows project summary, department/agent navigation, assigned/cap, and the budget-level figure.
- Velocity pod shows role milestones with task-count-based auto progress.
- Numeric values use tabular figures; unavailable values show "미수집".
**Traces-to**: FR-TY-2, FR-PM-4, Design §4, §6 · **P1**

---

## EPIC RT — Real-time & Product Shell (cross-cutting)

### RT-1 — Stay in sync across views via SSE (P1)
**As an** Operator, **I want** both views to stay consistent in real time, **so that** I never act on stale data.
**Acceptance Criteria**
- SSE snapshot-invalidation: heartbeat 15s, disconnect after 45s, reconnect backoff 1/2/5/10s; on a revision event the client re-reads the snapshot.
- State flows SSE/snapshot → Zustand → React/Three.js; the two views never show conflicting product name / project / connection state.
**Traces-to**: FR-RT-1, Design §4.1, §9 · Contract §5 · **P1**

### RT-2 — Recover gracefully from disconnects (P2)
**As an** Operator, **I want** clear connection status and automatic recovery after a drop, **so that** transient network issues don't confuse me.
**Acceptance Criteria**
- Connection status is always visible in the executive bar with last-sync time.
- After reconnect, the client re-reads the snapshot and reconciles without losing the operator's selection/UI settings.
**Traces-to**: FR-RT-1, FR-DASH-4 (reconnect UX) · **P2**

---

## Priority Summary

- **P1 (connected flow first)**: PM-1..5, ORCH-1..7, GIT-1..2, UF-1..2, DASH-1..3, TY-1..3, RT-1.
- **P2 (fold in as time allows)**: PM-6, ORCH-8, UF-3..4, DASH-4, RT-2.
