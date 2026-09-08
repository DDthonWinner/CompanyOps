# U5 frontend-dashboard — Client Logic / Flows

> Stage: CONSTRUCTION / Functional Design · Unit: frontend-dashboard · Date: 2026-09-08
> Write-action flows on top of U4's snapshot-driven rendering (04 §19/§9, 06 §4).

## Project setup → team (PM-1/3/4)
```
ProjectCreateDialog.submit(CreateProjectReq) → api.createProject → setActiveProject(id) → snapshot
AgentMatchingPanel:
  api.recommendAgents(pid, {desiredAgentCount?}) → editable provisional rows (name/color/icon/model)
  assign → api.assignAgents(pid, {agents}) → project READY (snapshot via SSE)
```
Validation errors (PM count, cap, duplicate, inactive) surface the server envelope message inline.

## Plan-first lifecycle (ORCH-1..3, 04 §19)
```
CommandInput.send(text) → api.postCommand(pid, {requestId, instruction, steps?}) → plan v1 REVIEW
PlanReviewPanel:
  Request Changes → api.planFeedback(pid, planId, {requestId, expectedVersion, feedback}) → new version REVIEW
  Review Complete → api.planReviewComplete(...) → FINAL_APPROVAL_PENDING
  Final Execution Approval → api.planApprove(pid, planId, {requestId, expectedVersion}) → EXECUTING
```
Distinct actions; none executes on send/feedback/review-complete. Buttons disabled unless the plan is in the matching state; each shows the current version.

## Milestone result review (ORCH-6, 04 §9)
```
MilestoneResultApprovalCard: api.getMilestoneResult(pid, milestoneId) → show version + gate + included tasks/commits
  Approve → api.reviewMilestoneResult(..., {reviewStatus:'APPROVED', additionalValidation:'NONE', expectedResultVersion})
  Request Revision → reviewStatus:'REVISION_REQUESTED'
  Approve disabled when technical gate FAILED (04 §12)
```

## Decisions (ORCH-8, 04 §8)
```
DecisionCard: options + AI recommendation → api.resolveDecision(pid, decisionId, {requestId, expectedRevision, answer})
```

## Rendering (snapshot-driven; reuses U4 store)
```
DashboardView reads store.snapshot:
  progress/counts (server-computed), agents/tasks (status columns), plans, pendingDecisions, qaRuns, git
AttentionCenter derives items from pendingDecisions + plans(FINAL_APPROVAL_PENDING) + milestones(reviewStatus PENDING) + qaRuns; dedup by requestId/id
ActivityTimeline: api.getActivity(pid, cursor) (paged)
```

## UF (UF-1..4, 04 §30)
```
if project.status !== 'COMPLETED': show source metrics + "프로젝트 완료 후 집계" notice (no create)
else: api.getUtilization(pid) → score/metrics/comparison; api.getFeedbacks(reportId) → comments
  create/edit comment → api.createFeedback/updateFeedback (completed only)
Before U3 is wired, endpoints may 404/empty → show "AI 활용 리포트 미연동" gracefully.
```

## Error / concurrency handling (06 §4.3)
```
any write → attach requestId (+ expectedVersion/expectedRevision)
on 409 → toast "최신 상태로 갱신되었습니다"; do not retry blindly; SSE already re-read the snapshot
while connection !== 'CONNECTED' → disable write actions or warn (no optimistic success)
```
