# Application Design — Component Methods

> Stage: INCEPTION / Application Design · Date: 2026-09-08
> Method signatures and high-level purpose with input/output types. **Detailed business rules are defined in Functional Design (CONSTRUCTION).** Signatures use Python-ish types for backend and TS-ish for frontend; DTO fields follow the contract (`06`): DB snake_case, JSON camelCase, enums UPPER_SNAKE_CASE. All mutating methods take `request_id` and, where versioned, `expected_version`/`expected_revision`, and run inside a transaction that bumps the project revision.

---

## BC-1 · PMService

```python
# Projects
create_project(data: CreateProjectDTO) -> ProjectDTO            # derives budget_amount+max cap; status DRAFT/AGENT_MATCHING; creates GitRepository link
list_projects(filter: ProjectFilter) -> ProjectListDTO          # summary incl. assignedAgentCount, hasPrimaryPm
get_project(project_id: str) -> ProjectDetailDTO
update_project(project_id, patch: UpdateProjectDTO) -> ProjectDTO # cap not below current assigned; no auto re-recommend when ACTIVE (409)
archive_project(project_id: str) -> ProjectDTO

# Agent Profiles
create_agent_profile(data) -> AgentProfileDTO
list_agent_profiles(filter) -> list[AgentProfileDTO]
get_agent_profile(id) -> AgentProfileDTO
update_agent_profile(id, patch) -> AgentProfileDTO              # no auto-propagate to existing ProjectAgents
deactivate_agent_profile(id) -> AgentProfileDTO

# Matching / assignment (single transaction)
recommend_agents(project_id, req: RecommendRequest) -> RecommendationDTO   # rule-based; PM required; within cap; provisional
assign_agents(project_id, req: AssignRequest) -> AssignResultDTO            # validate PM exactly 1, cap, active profile/model, unique profile; create docs; status->READY
list_project_agents(project_id) -> list[ProjectAgentDTO]
replace_project_agent(project_id, agent_id, patch) -> ProjectAgentDTO       # PM swap = release+assign in one tx
remove_project_agent(project_id, agent_id) -> ProjectAgentDTO               # ->REMOVED; PM cannot be removed

# Milestones / tasks (progress is read-only derived)
create_milestone(project_id, data) -> MilestoneDTO
list_milestones(project_id) -> list[MilestoneDTO]                # incl. resultVersion/reviewStatus/next-exec eligibility
update_milestone(project_id, id, patch) -> MilestoneDTO          # status/progress read-only -> 400 if sent
link_agent_milestone(project_id, id, req) -> LinkDTO
create_task(project_id, data) -> TaskDTO
list_tasks(project_id, filter) -> list[TaskDTO]
update_task(project_id, id, patch) -> TaskDTO                    # exec-state transitions rejected here
move_task_milestone(project_id, id, req) -> TaskDTO             # recompute both milestones + project

# Metadata + aggregation (read-only)
list_roles() / list_llm_models() / list_role_document_templates(roleCode?) 
compute_project_progress(project_id) -> ProgressDTO             # round(100*completed/non-cancelled); 0/0 -> 0% "작업 없음"
compute_milestone_progress(milestone_id) -> ProgressDTO
```

## BC-2 · OrchestratorService

```python
# BC-2a PlanningService
create_plan(project_id, req: CommandRequest) -> PlanDTO                 # from POST /commands; version 1, REVIEW; no execution
apply_plan_feedback(plan_id, req: FeedbackRequest) -> PlanDTO           # expectedVersion; new version, REVIEW
review_complete(plan_id, req) -> PlanDTO                                # -> FINAL_APPROVAL_PENDING
approve_plan(plan_id, req) -> PlanDTO                                   # records PLAN_EXECUTION approval; APPROVED_WAITING|EXECUTING

# BC-2b DecisionService
resolve_decision(decision_id, req: ResolveRequest) -> DecisionResultDTO # answer; returns remaining waitReasons

# BC-2c ApprovalService
record_approval(kind, target_id, target_version, req) -> ApprovalDTO    # idempotent; 409 on stale version

# BC-2d SchedulerService
select_executable_tasks(project_id) -> list[TaskRef]                    # approvals+decisions+deps satisfied
acquire_write_lock(project_id) -> LockHandle | None

# BC-2e ExecutionWorker (async loop)
enqueue(job: WorkerJob) -> CommandReceipt                               # 202 accepted
_run_task(task_ref) -> None                                            # provider.execute -> git.apply -> attempt/artifact -> executionMode

# BC-2f QAGateService
record_qa_run(run: QARunInput) -> QARunDTO                             # target artifact version/hash, scope, results, evidence
get_qa_run(run_id) -> QARunDTO
compute_technical_gate(target) -> GateStatus                          # PASSED only if all required PASS + fully run + no exec error

# BC-2g MilestoneResultService
build_milestone_result(milestone_id) -> MilestoneResultDTO            # when all non-cancelled tasks COMPLETED
get_milestone_result(milestone_id) -> MilestoneResultDTO
review_milestone_result(milestone_id, req: ReviewRequest) -> ReviewResultDTO  # expectedResultVersion; APPROVED+additionalValidation=NONE, or REVISION/REQUESTED plan
_maybe_complete_project(project_id) -> ProjectDTO                      # all tasks COMPLETED in milestones + all latest results APPROVED

# BC-2h PublishCoordinator
publish_task(task_id, req: PublishRequest) -> TaskPublishDTO           # validate approvedPlanVersion==planVersion && gate PASSED && currentHash==qaValidatedHash; git push; COMPLETED on push success + executionMode!=null

# BC-2i CompletionService
on_project_completed(project_id) -> None                              # request UF report once
```

## BC-3 · GitInterface

```python
initialize_project_repository(project_id) -> InitResult               # {checkoutPath, branch, baseCommitSha}
sync_milestone_repository(project_id, milestone_id) -> SyncResult      # ff-only pull; headCommitSha
read_repository_file(project_id, path) -> FileResult                   # path-safe; {content, exists}
apply_file_changes(project_id, task_id, changes: list[Change]) -> ApplyResult  # create/update/delete; checkout-only
get_task_changes(project_id, task_id) -> ChangeSet                     # incl. untracked+deleted; diff/diffStat; contentHash
publish_task_changes(project_id, milestone_id|None, task_id, task_title,
                     commit_type, artifact_version, qa_run_id,
                     approved_plan_version, request_id) -> PublishResult
                     # server-validates gate/plan/hash; states NO_CHANGES/COMMITTED_LOCAL/PUSHED/SYNC_REQUIRED/FAILED
```

## BC-4 · UFService

```python
create_report(project_id, request_id) -> UtilizationReportDTO         # 409 if project not COMPLETED; idempotent (returns existing)
list_reports(project_id) -> list[UtilizationReportDTO]
get_report(report_id) -> UtilizationReportDTO
get_metrics(report_id) -> list[UtilizationMetricDTO]
list_feedbacks(report_id) -> list[FeedbackDTO]
create_feedback(report_id, data) -> FeedbackDTO                       # completed project only
update_feedback(feedback_id, patch) -> FeedbackDTO
_compute_score(report) -> ScoreResult                                # UF_MVP_V1; invalid aspects -> N/A + renormalize
_select_previous_report(project) -> UtilizationReportDTO | None
```

## BC-5 · ExecutionProvider

```python
class ExecutionProvider(Protocol):
    def execute_task(self, ctx: TaskExecutionContext) -> ExecutionResult: ...
    # ExecutionResult: {changes[], artifactSummary, tokenMetrics{input,output,total|null}, executionMode}
# FixtureExecutionProvider(seed) — deterministic; marks demo. OpenAIExecutionProvider(config) — real GPT.
select_provider(env) -> ExecutionProvider                            # EXECUTION_MODE=demo|openai
```

## BC-6 · CommonPlatform

```python
# RevisionService
bump_revision(project_id, tx) -> int
current_revision(project_id) -> int
# ActivityService
append_event(project_id, type, entity_id, payload, tx) -> ActivityEvent
read_activity(project_id, cursor, limit) -> ActivityPage
# CommandReceiptStore
begin_command(request_id, operation, payload) -> ReceiptDecision      # NEW | REPLAY(existing result) | CONFLICT(409)
complete_command(request_id, result) -> None
# SnapshotService
build_snapshot(project_id) -> SnapshotDTO                            # revision + full read model + recent events
# SSEBroker
subscribe(project_id) -> EventStream                                 # heartbeat 15s; project.updated{revision,type,entityId}
publish_event(project_id, event) -> None
# Errors
error(code, message, details, request_id) -> ErrorEnvelope
```

---

## FRONTEND

### FC-2 · SnapshotStore (Zustand)
```ts
applySnapshot(snap: Snapshot): void            // apply only if snap.revision > current
selectProjectSummary(): ProjectSummary
selectAgents() / selectTasks() / selectMilestones()
selectAttentionItems(): AttentionItem[]        // decisions + pending approvals (dedup by requestId)
selectPlan(planId): PlanView
ui: { activeTab, camera }                       // persisted to Local Storage
setActiveTab(tab) / setCamera(state)
connection: ConnectionState                     // from SseClient
```

### FC-3 · ApiClient
```ts
getSnapshot(projectId): Promise<Snapshot>
postCommand(projectId, {requestId, instruction, targetAgentIds}): Promise<PlanRef>
planFeedback(planId, {requestId, expectedVersion, feedback}): Promise<PlanRef>
planReviewComplete(planId, {requestId, expectedVersion}): Promise<PlanRef>
planApprove(planId, {requestId, expectedVersion}): Promise<ApprovalRef>
resolveDecision(decisionId, {requestId, expectedRevision, answer}): Promise<DecisionRef>
reviewMilestoneResult(milestoneId, {requestId, expectedResultVersion, reviewStatus, additionalValidation, feedback}): Promise<ReviewRef>
publishTask(taskId, {requestId, artifactVersion, qaRunId}): Promise<TaskPublish>
getQaRun(runId) / getMilestoneResult(id) / getTaskArtifacts(id) / getActivity(cursor,limit)
// PM: projects/profiles/agents/milestones/tasks CRUD; UF: utilization/feedbacks
// all surface ErrorEnvelope {code,message,retryable}
```

### FC-4 · SseClient
```ts
connect(projectId): void          // set CONNECTING; on open CONNECTED + re-read snapshot
onEvent(evt): void                // higher revision -> trigger getSnapshot -> applySnapshot
onHeartbeat(): void               // reset 45s timer
onError()/onTimeout(): void       // RECONNECTING; backoff 1/2/5/10s
disconnect(): void
```

### FC-5 · TycoonView (selection contract)
```ts
dispatchSelection(sel: TycoonSelection): void   // window CustomEvent 'tycoon-item-selected'
// TycoonSelection { projectId, type:'agent'|'desk'|'monitor'|'inbox'|'outbox', projectAgentId?, roleCode? }
onSelection(e): void                            // agent -> openAgentSheet(projectAgentId); else openDeskSheet(roleCode)
seatFor(agent): SeatPlacement                   // deterministic by role + stable order
```
