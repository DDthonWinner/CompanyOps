# Functional Design Plan — U3 `backend-uf`

> Stage: CONSTRUCTION / Functional Design (Planning) · Unit: backend-uf · Date: 2026-09-08
> Scope: AI-utilization report/metrics/feedback aggregation + scoring, wired via U1's `UtilizationPort`. Stories UF-1..4 (+ ORCH-8 decision counts).
> Inputs: `02`, `06` §3.3, U1 functional design. Read-only against PM/orchestrator source data; never mutates work state.

## Methodology & Approach
`02` and `06` §3.3 fix the entities, the source-metric contract, and the exact `UF_MVP_V1` score formulas. This stage adopts them verbatim and resolves only the integration gaps (token source, wiring). Recommended defaults pre-filled.

## Functional Design Decisions
### Q1 — Entities & rules source of truth
**Recommended**: Own `utilization_reports`, `utilization_metrics`, `feedbacks` (06 §3.1). Adopt `02` §5/§6 + `06` §3.3 formulas verbatim as business rules.
[Answer]: Adopt 02 + 06 §3.3 verbatim (recommended)

### Q2 — Token / source-data aggregation
**Recommended**: Aggregate read-only from existing data at COMPLETED time: tasks (status/executionMode/roleCode via PM), decisions (RESOLVED count), plan feedback count, milestone REVISION_REQUESTED count, and **tokens from `activity_events` payloads** (U1 emits `artifact.updated` with `{tokens}`). `estimatedCost` = `미수집` (no price table). MIXED counted separately.
[Answer]: Aggregate from tasks + activity_events token payloads; cost 미수집 (recommended)

### Q3 — Report creation gating & idempotency (06 §4.2, §8)
**Recommended**: `POST /api/utilization {projectId}` → 409 if project not COMPLETED; one report per project (repeat returns the existing report). Feedback create/update allowed only for a completed project's report.
[Answer]: 409 when not COMPLETED; idempotent single report (recommended)

### Q4 — Score (UF_MVP_V1, 06 §3.3)
**Recommended**: Autonomy = `100 × AI_AGENT-completed / eligible(non-cancelled)`; Area Distribution = `100 × (core areas with AI_AGENT|MIXED work) / (core areas with completed tasks)` (core = PM/FRONTEND/BACKEND/QA; denom 0 ⇒ N/A); Resource Efficiency = `min(100, 100 × prevTokensPerAiTask / curTokensPerAiTask)` (N/A if no comparable prev report or 0 tokens/tasks). Overall = equal-weight mean of valid aspects, integer-rounded; N/A if none. Invalid aspects excluded + renormalized.
[Answer]: UF_MVP_V1 exactly per 06 §3.3 (recommended)

### Q5 — Wiring
**Recommended**: `UtilizationAdapter` implements U1's `UtilizationPort.request_report(project_id)` → calls `UFService.create_report` (idempotent). `app.main` calls `deps.set_utilization_port(UtilizationAdapter())` at startup (in-process, same app). Replaces the no-op stub so project completion auto-generates the report; operator can also POST to retry.
[Answer]: UtilizationAdapter wired via deps.set_utilization_port at startup (recommended)

### Q6 — Previous-report selection (06 §3.3)
**Recommended**: Prefer the latest COMPLETED report of the same `projectType` with earlier `completedAt`; else the latest other-type report (flag type/scale difference); else no comparison.
[Answer]: Same-type-first previous-report selection (recommended)

## Mandatory Functional Design Artifacts (generation checklist)
- [ ] `construction/backend-uf/functional-design/domain-entities.md` — UtilizationReport/UtilizationMetric/Feedback (owned) + read refs
- [ ] `construction/backend-uf/functional-design/business-logic-model.md` — aggregation + UF_MVP_V1 scoring + comparison + wiring
- [ ] `construction/backend-uf/functional-design/business-rules.md` — gating, idempotency, no-mutation boundary, cost/미수집, feedback rules
- [ ] (No frontend-components.md — backend-only; UI is U5 FeedbackSection)
- [ ] Validate against 02 + 06 §3.3

## Approval
Approve this plan (defaults) to generate U3 functional-design artifacts, or edit any `[Answer]:`.
