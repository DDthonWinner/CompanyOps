# U3 backend-uf — Business Logic Model

> Stage: CONSTRUCTION / Functional Design · Unit: backend-uf · Date: 2026-09-08
> Aggregation + UF_MVP_V1 scoring + comparison + wiring. Read-only vs work state (06 §3.3).

## create_report(project_id) — idempotent (06 §4.2/§8)
```
project = read Project
if project.status != 'COMPLETED': raise 409 PROJECT_NOT_COMPLETED
existing = report for project_id
if existing: return existing            # idempotent, one report per project
metrics = aggregate(project_id)
report = UtilizationReport(project_id, source_revision=project.revision, score_version='UF_MVP_V1')
persist metrics rows
report.previous_report_id = select_previous(project)
report.score = compute_score(metrics, previous)
persist report; return report
```

## aggregate(project_id) — source metrics (06 §3.3)
```
tasks = ProjectTask where project_id (read-only)
eligible = [t for t in tasks if t.status != 'CANCELLED']
aiCompleted = [t for t in eligible if t.status=='COMPLETED' and t.execution_mode=='AI_AGENT']
mixed       = [t for t in eligible if t.status=='COMPLETED' and t.execution_mode=='MIXED']
aiCompletedTaskRatio = len(aiCompleted)/len(eligible)  (if eligible else 0)

# area distribution over core areas PM/FRONTEND/BACKEND/QA (others → OTHER, kept in detail)
for area in CORE: completedInArea, aiOrMixedInArea

# user intervention (kept as separate counts, not merged — 06 §3.3)
resolvedDecisions = count Decision RESOLVED
planFeedbacks     = count PlanFeedback
revisionRequests  = count MilestoneResult REVISION_REQUESTED (latest per milestone)

# tokens from activity_events 'artifact.updated' payloads (read-only)
totalInput/Output/Total = sum over events; estimatedCost = 미수집

emit UtilizationMetric rows (aspect-tagged) with collection_status
```

## compute_score(metrics, previous) — UF_MVP_V1 (06 §3.3)
```
Autonomy = 100 * aiCompletedCount / eligibleCount          # eligible 0 ⇒ N/A
AreaDistribution = 100 * (#core areas with AI_AGENT|MIXED) / (#core areas with completed tasks)   # denom 0 ⇒ N/A
ResourceEfficiency:
   aiEquivTasks = AI_AGENT*1 + MIXED*0.5
   curPerTask = totalTokens / aiEquivTasks                  # 0/none ⇒ N/A
   if previous has comparable curPerTask: min(100, 100 * prevPerTask / curPerTask) else N/A
valid = [a for a in (Autonomy, Area, Resource) if a is not N/A]
overall = round(mean(valid)) if valid else N/A              # equal weight, renormalized over valid
```
Product quality / QA pass-rate are NOT inputs. Rounding for display only.

## select_previous(project) (06 §3.3)
```
prefer latest COMPLETED report of same project_type with completed_at earlier than this project
else latest report of any type (flag type/scale difference on the client)
else none (no comparison)
```

## Feedback CRUD (02 §6, 04 §30)
```
create/update Feedback allowed only if the report's project is COMPLETED (else 409)
Feedback = {aspect, severity, observation, impact, suggestion}; count = total comments (not unresolved)
never triggers task/agent/rework; never changes work state
```

## Wiring (Q5)
```
class UtilizationAdapter(UtilizationPort):
    def request_report(project_id): with unit_of_work() as s: UFService(s).create_report(project_id)
app.main startup → deps.set_utilization_port(UtilizationAdapter())
# U1 CompletionService already calls utilization_port().request_report on Project→COMPLETED
```

## API (02 §9.2, global paths)
`POST /api/utilization`, `GET /api/utilization?projectId=`, `GET /api/utilization/{reportId}`,
`GET /api/utilization/{reportId}/metrics`, `GET/POST /api/utilization/{reportId}/feedbacks`,
`PUT /api/feedbacks/{feedbackId}`.
