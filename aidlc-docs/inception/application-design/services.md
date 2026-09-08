# Application Design — Services & Orchestration

> Stage: INCEPTION / Application Design · Date: 2026-09-08
> Service definitions, responsibilities, and orchestration patterns. Grounds the plan-first execution and the multi-axis state model from `06`/`00`. Detailed rules per unit come in Functional Design.

## Service Inventory

| Service | Layer | Responsibility | Owns / drives |
|---|---|---|---|
| PMService | backend | Project/profile/agent/milestone/task management, recommendation, progress aggregation | PM tables |
| PlanningService | backend | Plan-first lifecycle | plan_versions, plan_feedback |
| DecisionService | backend | Decision open/resolve, waitReasons | decisions |
| ApprovalService | backend | PLAN_EXECUTION / MILESTONE_RESULT approvals | approvals |
| SchedulerService | backend | Choose executable tasks, write-lock, enqueue | (reads deps/approvals) |
| ExecutionWorker | backend | Async work loop; provider + git.apply; attempts/artifacts | task_attempts, artifact_versions |
| QAGateService | backend | QARun/TestResult, technical gate | qa_runs, test_results |
| PublishCoordinator | backend | Validate + publish + Task→COMPLETED | task_publishes (with GIT) |
| MilestoneResultService | backend | Result versions, review, project completion | milestone_results |
| CompletionService | backend | Trigger UF once | — |
| GitInterface | backend | clone/sync/read/write/diff/publish | checkout dirs |
| UFService | backend | reports/metrics/feedback/comparison | UF tables |
| ExecutionProvider | backend | AI artifact production (Fixture/OpenAI) | token source metrics |
| RevisionService / ActivityService / CommandReceiptStore / SnapshotService / SSEBroker | backend | cross-cutting consistency, idempotency, read model, realtime | revision, activity_events, command_receipts |
| ApiClient / SseClient / SnapshotStore | frontend | commands, realtime, single source of truth | Local Storage (UI only) |

## Orchestration Patterns

### OP-1 · Project preparation → ACTIVE (Master §5.1)
```
create_project (PM) → recommend_agents → assign_agents (PM=1, cap ok) → READY
→ user command → PlanningService.create_plan(v1, REVIEW)
→ [feedback ↔ revised versions] → review_complete → approve_plan
→ compose approved plan into Tasks/Milestones (PM)
→ GitInterface.initialize_project_repository → project ACTIVE (else stay READY + reason)
```

### OP-2 · Plan-first command lifecycle (Dashboard §19, contract §4.2)
```
POST /commands (requestId)            → Plan v1 REVIEW            [no execution]
POST /plans/{id}/feedback (expVer)    → Plan v(n+1) REVIEW        [no execution]
POST /plans/{id}/review-complete      → FINAL_APPROVAL_PENDING
POST /plans/{id}/approve (expVer)     → APPROVED_WAITING | EXECUTING
```
Guards: only the approved version executes; a new revision supersedes and returns to REVIEW; stale `expectedVersion` → 409; duplicate final approval executes once (CommandReceiptStore).

### OP-3 · Task execution + technical QA + publish (Master §5.2, contract §2.2/§7)
```
SchedulerService.select_executable_tasks → acquire per-project write-lock
→ ExecutionWorker: provider.execute_task → GitInterface.apply_file_changes
   → record TaskAttempt + ArtifactVersion (contentHash), set executionMode
→ QAGateService.record_qa_run(target=artifactVersion/hash) → compute_technical_gate
→ PublishCoordinator.publish_task:
     assert approvedPlanVersion==task.planVersion AND gate==PASSED AND currentHash==qaValidatedHash
     → GitInterface.publish_task_changes (real push; SYNC_REQUIRED aborts)
     → on push success + executionMode!=null: Task → COMPLETED, release lock
```
Task-level human approval does **not** exist. Task is REVIEW until publish succeeds.

### OP-4 · Milestone result review → next milestone / project completion (§9, §5.2.6–9)
```
all non-cancelled tasks in milestone COMPLETED
→ MilestoneResultService.build_milestone_result (sorted snapshot/hash)
→ result review PENDING (progress already 100%)
→ POST /sprint-milestones/{id}/result/reviews (expectedResultVersion):
     APPROVED + additionalValidation=NONE  → record; unlock next milestone (MILESTONE_APPROVAL)
     REVISION_REQUESTED / REQUESTED        → create plan (OP-2), new result version later
→ _maybe_complete_project: all tasks COMPLETED in milestones + all latest results APPROVED
     → Project COMPLETED + completedAt → CompletionService.on_project_completed
```
Gate: cannot approve if the technical Gate is FAILED. Stale resultVersion → 409.

### OP-5 · Project completion → UF aggregation (§5.2.9, contract §3.3)
```
CompletionService → POST /api/utilization (requestId)
→ UFService.create_report: read COMPLETED-revision source snapshot (read-only)
   → metrics (aiCompletedTaskRatio, area distribution, tokens, intervention counts)
   → Score UF_MVP_V1 (invalid aspects N/A + renormalize)
   → previous-report comparison
Idempotent: repeat returns existing report; ACTIVE project → 409.
```
UF never mutates task/agent/progress/QA/git state.

### OP-6 · Snapshot & realtime sync (contract §5)
```
State mutation (any service): within one tx → write state + RevisionService.bump + ActivityService.append
→ SSEBroker.publish_event(project.updated{revision})
Client: SseClient connects → getSnapshot → applySnapshot(if newer)
        on higher-revision event or reconnect → getSnapshot again
        heartbeat 15s; 45s silence → RECONNECTING; backoff 1/2/5/10s
```

### OP-7 · Command idempotency & concurrency (contract §4.3, §6)
- Every mutating command carries `requestId`; `CommandReceiptStore.begin_command` returns NEW / REPLAY / CONFLICT(409 same-id-different-payload).
- Versioned ops validate `expectedVersion`/`expectedRevision`; mismatch → 409 with `{code,message,details,requestId}`; client re-reads snapshot.
- plan/approval/receipt + state change committed in one transaction; external git/LLM effects recorded as receipt processing stages to recover partial failures.

### OP-8 · 3D selection (contract §6, Design §9)
Scene → `tycoon-item-selected` CustomEvent → DOM reads shared store by id → opens Agent/Desk sheet. CustomEvent is a **selection** path only; it never replaces SSE/snapshot or writes server state.
