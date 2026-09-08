# U1 backend-pm — Business Logic Model

> Stage: CONSTRUCTION / Functional Design · Unit: backend-pm · Date: 2026-09-08
> Algorithms and workflows (technology-agnostic). Grounded in `00` §5/§7, `01` §6, `06` §2–§5. Rules/validations live in `business-rules.md`.

## 1. Team recommendation & sizing (PM-3, `01` §6.3–6.4)
```
size_agents(project):
  if desired_agent_count given: n = desired_agent_count   # reject > max (400)
  else: n = LOOKUP(project_size, budget_level) in recommendation table
  n = clamp(1, max_agent_count); always include PM
recommend_roles(project, n):
  base_roles = table[project_size][budget_level]          # PM first, then FE/BE/DB/QA/DEVOPS/DESIGN by size/budget
  for role in base_roles[:n]:
     profile = best_active_profile(role, prefer skill/model grade by budget)   # LOW→JUNIOR/BASIC, MED→MID/STANDARD, HIGH→SENIOR/ADVANCED
     provisional_agent(role, profile, default name/color/icon/model, reason)
  if PM has no active profile: fail (409)
  return provisional list (user-editable; not persisted)
```

## 2. Assignment confirmation (PM-4, `01` §6.5) — single transaction
```
assign_agents(project, agents[]):
  validate: PM exactly 1; active profiles & models; unique profile per project; icon_key/color valid; count ≤ max
  create ProjectAgent rows (independent display name/color/icon/model)
  create ProjectAgentDocument rows from RoleDocumentTemplate (status PLANNED)
  project.status -> READY
  bump revision + activity(project.updated, agent.updated)
```
Replace PM = release old + set new primary in one tx. Remove non-PM → REMOVED. Re-assign a removed profile = reactivate existing row (avoids UNIQUE clash).

## 3. Progress & milestone status (read-only, `06` §3.2, `01` §4.2.9)
```
milestone_progress(m): current = COMPLETED tasks in m; total = non-CANCELLED tasks in m
                       percent = total>0 ? round(100*current/total) : 0
project_progress(p):   over ALL non-CANCELLED tasks (incl. milestone-less); same formula
milestone_status(m): none/all-TODO→PLANNED; all-COMPLETED→DONE; any BLOCKED/FAILED among incomplete→BLOCKED; else IN_PROGRESS
```
Recompute on task create/status-change/cancel/move (update both milestones on move). No weighting, no manual input, no averaging of milestone %. Empty ⇒ 0/0, 0%, "작업 없음".

## 4. Plan-first lifecycle (ORCH-1..3, `06` §4.2, `04` §19)
```
create_plan(project, command{requestId,instruction,targetAgentIds}):
  receipt = begin_command(requestId)   # NEW|REPLAY|CONFLICT(409)
  PlanVersion v1 {status REVIEW, steps/agents/scope/deps/validation/impact}; no execution
apply_feedback(plan, {expectedVersion, feedback}):
  assert plan.version==expectedVersion else 409; store PlanFeedback; new version REVIEW (supersede prior)
review_complete(plan, {expectedVersion}): -> FINAL_APPROVAL_PENDING
approve(plan, {expectedVersion}):
  record Approval(PLAN_EXECUTION); plan -> APPROVED_WAITING; compose (§5); then EXECUTING when a task starts
```
Only the approved version executes; a new revision returns to REVIEW; duplicate final approval executes once (receipt).

## 5. Approved plan → Task/Milestone composition (Q4, `00` §5.1.4)
```
compose(plan):
  for step in plan.steps:
    ensure role-based SprintMilestone (create if missing)
    create ProjectTask under milestone {approved_plan_id/version, role, priority, sort_order}
    wire dependency_task_ids from plan.dependencies  # reject self-ref/cycle (409)
  prepare repo: git_interface.initialize_project_repository(project)   # U2
  if prep ok: project -> ACTIVE else stay READY + reason
```
Steps under review are NOT counted in task denominator until composed.

## 6. Scheduler + worker (ORCH-4/5/7, `00` §5.2)
```
scheduler_tick(project):
  candidates = tasks TODO with no unmet wait_reasons (deps COMPLETED, decisions RESOLVED, plan approved, milestone approval satisfied)
  if project write-lock free and a candidate exists: pick highest priority/sort_order; acquire lock; enqueue WorkerJob
worker.run(task):
  task -> RUNNING; provider = select_provider(EXECUTION_MODE)
  result = provider.execute_task(ctx)          # Fixture(default)/OpenAI
  git_interface.apply_file_changes(project, task, result.changes)     # U2 (checkout only)
  record TaskAttempt + ArtifactVersion(GENERATED, content_hash); set execution_mode
  record token source metrics (input/output/total|null)
  task -> REVIEW; run QA (§7)
```
Sequential per-project writes; reads/plans not blocked. On process restart, RUNNING → BLOCKED (no auto re-run).

### 6a. Fixture provider (Q2)
Deterministic by taskId: emits a small code stub + `.ai-dlc/tasks/{taskId}.md`; simulated token metrics; `executionMode=AI_AGENT`; flagged demo ("AI 서버 미연결 / 데모 데이터"). OpenAI provider calls GPT with timeouts; on failure, graceful degrade to fixture (NFR-7) and record the mode actually used.

## 7. Technical QA gate (ORCH-4, Q3, `06` §7)
```
run_qa(artifact):
  if repo has a detected test command: execute it in checkout; parse Total/Passed/Failed/Skipped + evidence
  else: seeded deterministic PASS, evidence labeled "demo QA" (never reported as real)
  QARun {run_status COMPLETED, results tied to artifact.content_hash}
  technical_gate = PASSED iff fully run AND all required PASS AND no exec error
pass_rate = round(100*Passed/(Passed+Failed)); 0 run ⇒ N/A; SKIPPED excluded from denominator
```
If code changed after QA, results are invalid for the new hash (re-QA required).

## 8. Publish coordination (ORCH-4, GIT-1/2 via U2)
```
publish(task, {requestId, artifactVersion, qaRunId}):
  assert approved_plan_version == task.approved_plan_version
  assert technical_gate == PASSED
  assert current_hash == qa_validated_hash
  res = git_interface.publish_task_changes(...)   # real push; SYNC_REQUIRED aborts
  if res.status==PUSHED and execution_mode != null: task -> COMPLETED; release write-lock
```
No task-level human approval. REVIEW until push succeeds. Push failure ≠ QA failure (keep local SHA; idempotent retry).

## 9. Milestone result & project completion (ORCH-6, `00` §5.2.6–9, `06` §2.2)
```
on all non-cancelled tasks in milestone COMPLETED:
  build MilestoneResult version = hash(sorted task ids + artifact hashes + qa run ids + commit SHAs); review PENDING (progress 100%)
review(milestone, {expectedResultVersion, reviewStatus, additionalValidation, feedback}):
  assert version==expectedResultVersion else 409; gate must be PASSED to allow APPROVED
  APPROVED + additionalValidation==NONE -> record; release next milestone's MILESTONE_APPROVAL wait
  REVISION_REQUESTED / REQUESTED -> create a plan (§4), later new result version (no inherited approval)
maybe_complete_project(project):
  if every non-cancelled task ∈ a milestone AND COMPLETED AND every milestone latest result APPROVED (no empty milestone, no unassigned task):
     project -> COMPLETED + completed_at; trigger UF once (POST /api/utilization)   # U3
```

## 10. Decisions & wait reasons (ORCH-8, `04` §8)
```
resolve_decision(decision, {expectedRevision, answer}):
  record selected_answer; status RESOLVED
  recompute wait_reasons of scope tasks; resume only tasks whose ALL wait_reasons cleared
```

## 11. Snapshot / revision / SSE (RT-1/2, `06` §3.2/§5)
```
mutate(...): within ONE tx -> write state + revision.bump(project) + activity.append; after commit -> sse.publish(project.updated{revision,type,entityId})
build_snapshot(project): revision + Project/Agents/Tasks/Milestones + plans/pending-approvals/QA/UF/git summaries + recent events (single read tx)
sse stream: heartbeat 15s; client re-reads snapshot on higher revision / (re)connect
```

## 12. Idempotency & concurrency (`06` §4.3)
- Every mutating op: `begin_command(requestId)` → NEW / REPLAY(existing result) / CONFLICT(409 same-id-different-payload).
- Versioned ops validate `expectedVersion`/`expectedRevision` → 409 `{code,message,details,requestId}`.
- plan/approval/receipt + state committed atomically; external git/LLM effects recorded as receipt processing stages for partial-failure recovery.
