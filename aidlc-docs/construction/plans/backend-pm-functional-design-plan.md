# Functional Design Plan — U1 `backend-pm`

> Stage: CONSTRUCTION / Functional Design (Planning) · Unit: backend-pm · Date: 2026-09-08
> Scope: PM + Orchestration + Platform/Common + Execution Provider (all backend except Git/UF).
> Inputs: unit-of-work.md, unit-of-work-story-map.md, application-design/*, requirements.md, and source `00`/`01`/`06`. Technology-agnostic business logic; no infra concerns.

## Methodology & Approach
Formalize the unit's domain entities, business-logic model, and business rules. Because `01` (ERD + rules) and `06` (state contract, aggregation, idempotency, scoring inputs) already fix most logic, this stage **adopts those verbatim as the source of truth** and only resolves the functional gaps below.

## Functional Design Decisions
Recommended defaults pre-filled — change any `[Answer]:` if you disagree; otherwise approve as-is.

### Q1 — Domain entities & rules source of truth
**Recommended**: Adopt the `01` ERD (§4.2 tables) + `06` §3.1 supplemental execution fields as `domain-entities.md`, and `01` §7 + `00` §7 + `06` §2 invariants as `business-rules.md` — verbatim, with cross-references, not re-invented.
[Answer]: Adopt 01 + 06 verbatim as entities/rules source (recommended)

### Q2 — Fixture execution provider behavior (demo default)
**Recommended**: `FixtureExecutionProvider` produces **deterministic per-(roleCode, task) artifacts** — a small code stub + a `.ai-dlc/tasks/{taskId}.md` result note — seeded by taskId so runs are reproducible; emits simulated token metrics (input/output/total as deterministic numbers) tagged demo; sets `executionMode=AI_AGENT`. Screens show "AI 서버 미연결 / 데모 데이터".
[Answer]: Deterministic per-(role,task) stub + result MD + simulated tokens, executionMode=AI_AGENT (recommended)

### Q3 — Technical QA behavior (both modes)
**Recommended**: QAGate runs the repo's **real test command if one is detected** (e.g., `npm test`/`pytest`) against the checkout; if none is configured, it records a **seeded deterministic PASS** with evidence explicitly labeled "demo QA" (never reported as real). Gate PASSED only if all required checks PASS + fully run + no exec error; results tie to the artifact contentHash. No test run ⇒ not reported as success.
[Answer]: Real test cmd if present, else labeled demo-PASS; gate ties to contentHash (recommended)

### Q4 — Approved plan → Task/Milestone composition
**Recommended**: On plan `approve`, compose the plan's steps into `ProjectTask`s under role-based `SprintMilestone`s (creating milestones as needed), set `approvedPlanId/Version` on each task, wire `dependencyTaskIds` from plan dependencies (reject self/cycle), then attempt repo checkout and transition Project→ACTIVE (else stay READY + reason). Steps under review are NOT counted as tasks until composed.
[Answer]: Compose approved plan steps into milestone-grouped tasks with deps, then ACTIVE (recommended)

### Q5 — Seed / master data
**Recommended**: Seed `roles` (PM/FRONTEND/BACKEND/DATABASE/QA/DEVOPS/DESIGN), `llm_models` (Claude Haiku=BASIC, GPT Standard=STANDARD, ChatGPT Astras=ADVANCED for display; plus one real OpenAI model id used when `EXECUTION_MODE=openai`), `role_document_templates` per `01` §4.2.7, and a starter set of active `AgentProfiles` (≥1 PM). A demo fixture Project is optional and created on demand, not auto-seeded.
[Answer]: Seed roles/models/templates + starter profiles (≥1 PM); demo project on demand (recommended)

### Q6 — Error & edge-case handling
**Recommended**: Adopt `06` §4.3 error envelope + `01` §10 error table as `business-rules.md` error section: 400 validation, 404 missing, 409 conflicts (cap, cycle, stale version/revision, ACTIVE re-recommend, duplicate profile), 422 schema, 502/503 external (git/LLM). Idempotency via requestId; optimistic concurrency via expectedVersion/Revision.
[Answer]: Adopt 06 §4.3 + 01 §10 error model (recommended)

## Mandatory Functional Design Artifacts (generation checklist)
- [ ] `construction/backend-pm/functional-design/domain-entities.md` — entities, fields, relationships (01 ERD + 06 supplemental)
- [ ] `construction/backend-pm/functional-design/business-logic-model.md` — algorithms/workflows: recommendation, plan lifecycle, scheduler, worker, QA gate, publish coordination, milestone result, completion, progress aggregation, revision/snapshot/receipts
- [ ] `construction/backend-pm/functional-design/business-rules.md` — rules, validations, invariants, error model
- [ ] (No `frontend-components.md` — U1 is backend-only)
- [ ] Validate against 00/01/06 contract

## Approval
Approve this plan (defaults above) to generate the U1 functional-design artifacts, or edit any `[Answer]:` and tell me.
