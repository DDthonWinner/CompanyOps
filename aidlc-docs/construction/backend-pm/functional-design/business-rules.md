# U1 backend-pm — Business Rules

> Stage: CONSTRUCTION / Functional Design · Unit: backend-pm · Date: 2026-09-08
> Rules, validations, invariants, and error model. Adopted (Q1/Q6) from `01` §7, `00` §7, `06` §2/§4.3, `01` §10 — cross-referenced, not re-invented. Rule IDs prefixed BR-.

## Project rules (`01` §7.1, `00` §7)
- BR-P1: Every Project links exactly one GitRepository (unique project_id); MVP remote fixed to `DDthonWinner/TestOutput`.
- BR-P2: `budget_amount` and default `max_agent_count` derive from `budget_level` (HIGH 250000/16, MEDIUM 180000/12, LOW 120000/8); user-set `max_agent_count` may not exceed the budget default and may not go below current assigned count (409).
- BR-P3: READY/ACTIVE/COMPLETED require exactly one non-REMOVED primary PM.
- BR-P4: READY requires assignment complete; ACTIVE requires successful repo prep (else stay READY + reason).
- BR-P5: ACTIVE projects reject auto re-recommendation and reject removing/replacing running agents or lowering cap below assigned (409).
- BR-P6: Project → COMPLETED only when every non-cancelled task ∈ a milestone and COMPLETED, no empty milestone, and every milestone's latest result APPROVED; transition owned by orchestrator (not general PATCH). Records `completed_at`.
- BR-P7: Deletion = archive (ARCHIVED), never physical.

## PM / Agent rules (`01` §7.2–7.6)
- BR-A1: PM exactly 1 per project; PM cannot be deleted (replace only); no active PM profile ⇒ recommendation fails (409).
- BR-A2: AgentProfile edits do NOT propagate to existing ProjectAgents; inactive profiles/models excluded from new recommend/assign.
- BR-A3: No duplicate AgentProfile within a project (unique); re-assigning a removed profile reactivates the existing row.
- BR-A4: ProjectAgent has independent display name/color(#hex)/icon_key(allowed list)/model; fallbacks: profile default → role fallback.
- BR-A5: Active ProjectAgent count ≤ `max_agent_count` (enforced in the assignment transaction, safe under concurrency).
- BR-A6: "Hire AI Agent" = assign an existing profile (create ProjectAgent), never create a profile.

## Milestone / Task rules (`01` §7.7–7.8, `06` §2/§3.2)
- BR-M1: Milestone status & progress are DERIVED read-only; direct writes → 400.
- BR-M2: Task belongs to a Project; ≤ 1 milestone; may exist milestone-less (but must join a milestone before project completion).
- BR-M3: Progress = `round(100 × COMPLETED / non-CANCELLED)`; empty ⇒ 0% / "작업 없음"; no weighting; recomputed on create/status/cancel/move.
- BR-M4: CANCELLED only for not-yet-executed tasks; excluded from denominator; history retained. Completed tasks are not reopened — create a new change task instead.
- BR-M5: Task → COMPLETED requires **approved plan version + technical gate PASSED + git push success + `execution_mode != null`**; MIXED if attempts include both AI and human.
- BR-M6: Human approval applies to MilestoneResult versions, never individual tasks; 100% progress can coexist with PENDING result approval.
- BR-M7: Next milestone's first task waits on `MILESTONE_APPROVAL` until the prior milestone's latest result is APPROVED (first milestone / explicitly-independent milestones excepted).
- BR-M8: Task dependencies are same-project only; self-reference/cycles rejected (409).

## Plan / execution rules (`06` §2.1/§2.2, `04` §19, `00` §5)
- BR-X1: Commands create plans (REVIEW); no execution on submit or feedback or review-complete.
- BR-X2: Only the approved plan version executes; any new revision returns to REVIEW and supersedes; approving/duplicating an old version cannot execute a new one.
- BR-X3: Task flow TODO → WAITING(if conditions) → RUNNING → REVIEW → COMPLETED; FAILED = run error; BLOCKED = env/recovery; revision attempts add a TaskAttempt and keep prior history.
- BR-X4: No Pause/Resume/PAUSED in MVP; conditions expressed via wait_reasons; resolving one condition rechecks all.
- BR-X5: Per-project single write-lock held across change→QA→publish; reads/plans not blocked; on restart RUNNING → BLOCKED (no auto re-run, no duplicate commit/model-call).

## QA / gate rules (`06` §7, `04` §12)
- BR-Q1: technical_gate PASSED only if fully run + all required PASS + no exec error; required SKIPPED/missing config ≠ pass.
- BR-Q2: pass_rate = round(100 × Passed/(Passed+Failed)); SKIPPED excluded; 0 run ⇒ N/A; unparsed ⇒ 미수집.
- BR-Q3: Unrun tests are never reported as success; QA results bind to artifact content_hash; code change after QA ⇒ re-QA.
- BR-Q4: Demo-mode QA PASS is explicitly labeled "demo QA" and never presented as real (Q3).
- BR-Q5: FAILED gate disables milestone-result approval; viewing results does not change failure counts.

## Git publish rules (via U2; `03`, `06` §2.2)
- BR-G1: Publish preconditions validated server-side (not client `approved=true`).
- BR-G2: States NOT_STARTED/NO_CHANGES/COMMITTED_LOCAL/PUSHED/FAILED/SYNC_REQUIRED; push failure keeps local SHA; idempotent retry reuses commit.
- BR-G3: No force-push, no auto-merge, no default-branch direct writes; remote divergence ⇒ SYNC_REQUIRED (re-sync + re-QA).
- BR-G4: Git credentials from server env only, never request input; path-safety enforced (checkout-relative; no `.git`, no traversal).

## UF boundary (`06` §2.2/§3.3)
- BR-U1: UF report/score/comment creation is post-COMPLETED only and never mutates task/agent/progress/QA/git state; ACTIVE ⇒ 409; repeat ⇒ existing report.

## Snapshot / realtime rules (`06` §5)
- BR-S1: State mutation + revision bump + activity append in one transaction; SSE emitted after commit.
- BR-S2: Disconnected clients never mark commands succeeded; snapshot older than store is ignored.

## Idempotency / concurrency / errors (`06` §4.3, `01` §10)
- BR-E1: Mutating ops carry `requestId`; same id + same payload → prior result; same id + different payload → 409.
- BR-E2: `expectedVersion`/`expectedRevision` mismatch → 409 with `{code,message,details,requestId}`; client re-reads latest.
- Error status map (from `01` §10 + `06` §4.3):

| Situation | Code |
|---|---|
| Missing/invalid input (git url, budget/size enum, color/icon, blank name) | 400 |
| Framework schema validation | 422 |
| Entity not found | 404 |
| Cap exceeded, duplicate profile, duplicate md path, ACTIVE re-recommend, stale version/revision, dependency cycle | 409 |
| External git/LLM failure | 502/503 |
| No active PM profile (recommendation) | 409 |
| PM count ≠ 1 on assign | 400 |

## Validation invariants (cross-cutting)
- BR-V1: All child references validated for same-project membership; cross-project links rejected.
- BR-V2: Enums constrained via CHECK; UUID TEXT; booleans 0/1; datetimes ISO 8601 UTC; arrays JSON TEXT.
- BR-V3: State axes never merged (execution / artifact-gen / milestone-review / plan / QA / connection kept separate).
