# U3 backend-uf — Business Rules

> Stage: CONSTRUCTION / Functional Design · Unit: backend-uf · Date: 2026-09-08
> Adopted from `02` + `06` §2.2/§3.3/§8. IDs prefixed BU-.

## Gating & idempotency
- BU-1: Report creation requires Project status == COMPLETED; otherwise 409 (`PROJECT_NOT_COMPLETED`). ACTIVE-project report/comment creation is rejected (06 §8).
- BU-2: Exactly one report per project; repeat `POST /api/utilization` returns the existing report (idempotent).
- BU-3: Feedback create/update allowed only for a completed project's report.

## No-mutation boundary (06 §2.2/§8)
- BU-4: UF is read-only vs work state: creating/updating report/metrics/feedback never changes Task status, progress, QA/technical gate, Git publish, or Agent execution.
- BU-5: UF does not evaluate product quality or QA pass-rate; those are excluded from score inputs.
- BU-6: UF owns only `/api/utilization*` and `/api/feedbacks`; it never owns `/api/projects/*`; all referenced IDs are validated for project membership.

## Metrics & score (UF_MVP_V1, 06 §3.3)
- BU-7: `aiCompletedTaskCount` = COMPLETED && executionMode==AI_AGENT; `eligibleTaskCount` = non-CANCELLED; MIXED tracked separately.
- BU-8: User-intervention counts (RESOLVED decisions, plan feedback, milestone REVISION_REQUESTED) are preserved as separate source counts, not merged into one score.
- BU-9: Score aspects: Autonomy, Area Distribution, Resource Efficiency per the formulas; an aspect with a zero/absent denominator or no comparable previous report is **N/A**.
- BU-10: Overall score = equal-weight mean of valid (non-N/A) aspects, renormalized, integer-rounded for display; N/A if none valid. Changing the formula requires a new `score_version`.
- BU-11: Token metrics come from measured source data (activity payloads); missing values are `미수집`, never 0. `estimatedCost` is `미수집` unless a price table exists.

## Comparison (06 §3.3)
- BU-12: Previous report = latest same-`projectType` COMPLETED with earlier `completedAt`; else latest other-type (flag type/scale difference); else no comparison.

## Feedback content (02 §6)
- BU-13: Feedback = aspect/severity/observation/impact/suggestion only; no targetAgent, no rework/resolve state; severity reflects AI-utilization efficiency (not product defects).
- BU-14: Comment count is the total number of records (not "unresolved").

## Wiring
- BU-15: `UtilizationAdapter` implements U1 `UtilizationPort`; project completion auto-triggers `create_report` (idempotent). Operator retry via `POST /api/utilization` returns the same report.
