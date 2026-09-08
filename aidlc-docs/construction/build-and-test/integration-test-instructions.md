# Integration Test Instructions — U1 backend-pm

> Stage: CONSTRUCTION / Build and Test · Date: 2026-09-08
> True cross-unit integration (frontend↔backend, real Git U2, UF U3) is exercised as those units land. For U1, integration = the API + worker + ports wired together end-to-end.

## Scenario 1: Connected backend flow (API → worker → ports) — VERIFIED
- **Description**: project creation → team assignment → plan-first lifecycle → worker execution → QA gate → publish (stub) → milestone result → project completion, driven through HTTP.
- **Setup**: `DB_PATH=/tmp/companyops_smoke.db ./venv/bin/python` with FastAPI `TestClient` (triggers lifespan + worker).
- **Steps / Expected** (observed this run):
  - `GET /health` → `{status: ok, executionMode: demo}`
  - `POST /api/projects` (MEDIUM/SMALL) → status AGENT_MATCHING, budgetAmount 180000, cap 12
  - `POST /api/projects/{id}/agents` (PM + BACKEND) → READY, 2 agents
  - `POST /commands` → plan v1 REVIEW
  - `POST /plans/{id}/review-complete` with wrong `expectedVersion` → **409 STALE_VERSION**
  - `POST /plans/{id}/approve` → EXECUTING; worker runs
  - `GET /snapshot` → task COMPLETED (executionMode AI_AGENT), milestone 100%/PENDING, git PUSHED (stub commit `stub000001` on `project/{id}`)
- **Cleanup**: delete the temp DB file.

## Scenario 2: SSE snapshot-invalidation (manual)
- Subscribe `GET /api/projects/{id}/events` (SSE) in one client; issue a command/approve in another; observe `project.updated` events carrying rising `revision`; re-read `/snapshot`. Heartbeat every 15s.

## Deferred cross-unit integration
- **U2 backend-git**: replace `LocalStubGit` via `deps.set_git_port(RealGitInterface())`; re-run Scenario 1 expecting a **real commit/push** to `DDthonWinner/TestOutput`.
- **U3 backend-uf**: replace `NoopUtilization`; after project COMPLETED, expect a UtilizationReport.
- **U4/U5 frontend**: Vitest/RTL + end-to-end against the running API.

## Run
```bash
cd backend
DB_PATH=/tmp/companyops_it.db ./venv/bin/python -m pytest tests/orchestrator/test_flow.py -q
```
(The `test_full_connected_flow` test is the automated form of Scenario 1.)
