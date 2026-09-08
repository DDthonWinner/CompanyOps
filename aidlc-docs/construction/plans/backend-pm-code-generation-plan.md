# Code Generation Plan — U1 `backend-pm`

> Stage: CONSTRUCTION / Code Generation (Planning) · Unit: backend-pm · Date: 2026-09-08
> **Single source of truth for U1 code generation.** Workspace root: `/home/jaewo/github/CompanyOps` (greenfield). Code location: `backend/` at workspace root (NEVER in aidlc-docs/). Doc summaries: `aidlc-docs/construction/backend-pm/code/`.

## Unit Context
- **Scope**: PM + Orchestration + Platform/Common + Execution Provider (all backend except Git/UF).
- **Stories implemented**: PM-1..6, ORCH-1..8, RT-1/2 (backend/SSE side), ORCH-5 (integration). (UI surfaces are U4/U5.)
- **Design inputs**: functional-design/* (U1), application-design/*, system nfr-requirements/* + nfr-design/*, source `00`/`01`/`06`.
- **Dependencies handled via ports** (dependency order U1 first):
  - `GitPort` (publish/apply/read/diff) — U1 defines the Protocol + a **LocalStubGit** default; the real `GitInterface` (U2) is injected later.
  - `UtilizationPort` (report trigger on completion) — U1 defines the Protocol + a **no-op stub**; real UF (U3) injected later.
- **Tech**: Python 3.11+ (venv + requirements.txt), FastAPI, SQLAlchemy 2.x, SQLite, Pydantic v2, sse-starlette, pytest. `EXECUTION_MODE=demo|openai`.

## Code Location (greenfield monorepo, D8)
```
backend/app/{main.py,config.py,db.py}
  common/   pm/   orchestrator/(+execution/)   ports/
backend/tests/{common,pm,orchestrator}
backend/{requirements.txt,.env.example,README.md,run.sh,seed.py}
.gitignore (root)   README.md (root)
```

## Generation Steps (numbered; check off during Part 2)

- [x] **Step 1 — Project Structure Setup (greenfield)**
  - Root `.gitignore` (`.env`, `*.db`, `__pycache__`, `venv/`, `node_modules/`, `checkouts/`), root `README.md` (monorepo overview + run instructions).
  - `backend/requirements.txt`, `backend/.env.example` (EXECUTION_MODE, OPENAI_API_KEY, DB_PATH, BACKUP_DIR, GIT_REMOTE, CHECKOUT_ROOT), `backend/README.md`, `backend/run.sh` (venv + uvicorn).
  - `backend/app/__init__.py`, `config.py` (env settings), `db.py` (engine/session/UnitOfWork), `main.py` (FastAPI app + routers + middleware + health + SSE).
  - _Stories_: foundation for all.

- [x] **Step 2 — Repository Layer Generation**
  - `common/models.py` (SQLAlchemy models: all U1 entities per domain-entities.md; CHECK enums, TEXT UUIDs, 0/1 booleans, ISO datetimes, JSON-as-TEXT arrays).
  - Repositories per aggregate: `pm/repository.py`, `orchestrator/repository.py`, `common/repository.py` (activity, receipts, revision).
  - _Stories_: PM-1..6 (persistence), ORCH-1..8 (persistence).

- [x] **Step 3 — Repository Layer Unit Testing** — `tests/common/test_repositories.py` (CRUD, constraints, same-project validation).
- [x] **Step 4 — Repository Layer Summary** — `aidlc-docs/construction/backend-pm/code/repository-summary.md`.

- [x] **Step 5 — Business Logic Generation**
  - `common/`: `revision.py`, `activity.py`, `receipts.py` (idempotency), `snapshot.py` (assembler), `sse.py` (broker + heartbeat), `errors.py` (envelope + exceptions), `write_lock.py`, `backup.py`, `progress.py` (aggregation).
  - `pm/service.py`: project CRUD/archive, budget derivation, recommendation (`01` §6.3/6.4 tables), assignment transaction, milestones/tasks CRUD + move, progress/status derivation.
  - `orchestrator/service.py` (or split files): planning lifecycle, decisions, approvals, scheduler, queue, milestone-result versioning + review, completion, publish coordinator.
  - `orchestrator/worker.py`: async worker loop; `orchestrator/execution/` providers (`base.py`, `fixture.py`, `openai_provider.py`, `selector.py`).
  - `orchestrator/qa.py`: technical QA gate (real cmd if present else labeled demo-PASS; ties to content hash).
  - `ports/git_port.py` (Protocol + LocalStubGit), `ports/utilization_port.py` (Protocol + NoopUtilization).
  - `seed.py`: roles, llm_models, role_document_templates, starter AgentProfiles (≥1 PM).
  - _Stories_: PM-1..6, ORCH-1..8, RT-1/2 (SSE/snapshot/revision).

- [x] **Step 6 — Business Logic Unit Testing** — `tests/pm/`, `tests/orchestrator/`: recommendation & cap/PM invariants (PM-AC-001..003), progress math (PM-AC-006/011), plan-first version guards + 409 (MASTER-AC-003), task COMPLETED preconditions, milestone result versioning, idempotency.
- [x] **Step 7 — Business Logic Summary** — `.../code/business-logic-summary.md`.

- [x] **Step 8 — API Layer Generation**
  - `pm/schemas.py`, `orchestrator/schemas.py` (Pydantic v2, camelCase aliases).
  - `pm/routes.py` (`/api/projects*`, `/api/agent-profiles*`, `/api/roles`, `/api/llm-models`, `/api/role-document-templates`, project-scoped agents/milestones/tasks).
  - `orchestrator/routes.py` (`/snapshot`, `/events` SSE, `/commands`, `/plans/*`, `/decisions/*`, `/qa-runs/*`, `/sprint-milestones/*/result*`, `/tasks/*/publish`, `/tasks/*/artifacts`, `/activity`).
  - `common/middleware.py` (error envelope), `/health` route.
  - _Stories_: PM-1..6, ORCH-1..8, RT-1.

- [x] **Step 9 — API Layer Unit Testing** — `tests/**/test_routes*.py` (happy path + 400/404/409 envelope, idempotency replay, stale-version 409).
- [x] **Step 10 — API Layer Summary** — `.../code/api-summary.md`.

- [x] **Step 11 — DB bootstrap / seed** — `db.create_all` on startup (MVP; Alembic optional later) + `seed.py` runnable; wire seed into run.sh/README.
- [x] **Step 12 — Documentation** — backend README (setup/run/env/endpoints), root README update; `.../code/README-notes.md`.
- [x] **Step 13 — Deployment Artifacts** — `run.sh` (venv+uvicorn), `.env.example`; **no CI** (R-04a). Frontend steps N/A (U1 backend-only).

## Story Traceability
| Step | Stories |
|---|---|
| 1 | foundation (all) |
| 2–4 | PM-1..6, ORCH-1..8 (persistence) |
| 5–7 | PM-1..6, ORCH-1..8, RT-1/2 |
| 8–10 | PM-1..6, ORCH-1..8, RT-1 |
| 11–13 | PM-5 (seed data), foundation |

## Notes
- Frontend generation steps **N/A** for U1 (backend-only).
- `GitPort`/`UtilizationPort` stubs keep U1 buildable and testable now; real U2/U3 implementations injected in their units without changing U1 call sites.
- Tests are written now; **executed in the Build & Test stage**.

## Approval
Approve this plan to generate the U1 code (Steps 1–13), or request changes. This plan is the single source of truth for the generation pass.
