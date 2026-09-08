# U3 backend-uf — Domain Entities

> Stage: CONSTRUCTION / Functional Design · Unit: backend-uf · Date: 2026-09-08
> Owns UF tables (06 §3.1); references PM/orchestrator data read-only. Conventions per 06 §1.

## Owned entities
| Entity | Key fields |
|---|---|
| **UtilizationReport** | id, project_id, status, score(nullable), score_version(UF_MVP_V1), previous_report_id(nullable), source_revision, created_at; **one per project** |
| **UtilizationMetric** | id, report_id, aspect(AUTONOMY/RESOURCE_EFFICIENCY/AREA_DISTRIBUTION), metric_key, value, unit(nullable), role_code(nullable), collection_status(COLLECTED/UNCOLLECTED), measured_at |
| **Feedback** | id, report_id, aspect, severity(HIGH/MEDIUM/LOW), observation, impact, suggestion, created_at, updated_at |

No targetAgent / rework / resolve fields on Feedback (02 §6.1).

## Read-only references (not owned)
- **Project** (PM): status must be COMPLETED; `project_type`, `completed_at` for comparison selection.
- **ProjectTask** (PM): status, execution_mode, role_id→code — for AI-completed ratio + area distribution.
- **Decision / PlanFeedback / MilestoneResult** (orchestrator): RESOLVED decisions, feedback count, REVISION_REQUESTED count — user-intervention source metrics.
- **ActivityEvent** (common): `artifact.updated` payloads carry `{tokens:{input,output,total}, demo}` — token source (no dedicated token table needed).

## Relationships
```
Project (PM, read-only) 1 --- 1 UtilizationReport (UF)   # created at COMPLETED
UtilizationReport 1 --- N UtilizationMetric
UtilizationReport 1 --- N Feedback
UtilizationReport 0..1 --- previous_report_id --> UtilizationReport
```

## Notes
- `estimated_cost` metric stored as `미수집` (UNCOLLECTED) — no provider price table in MVP.
- Score is nullable (N/A when no valid aspect). `score_version` fixes the formula; a new formula ⇒ new version.
- All references validated for same-project membership; UF owns only `/api/utilization*` + `/api/feedbacks` (never `/api/projects/*`).
