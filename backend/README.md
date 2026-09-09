# CompanyOps Backend (U1 `backend-pm`)

FastAPI + SQLite + in-process task worker + SSE. Implements PM management, plan-first
orchestration, technical QA, publish coordination, milestone results, project completion,
and the execution provider (fixture default / OpenAI).

## Setup & run
```bash
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python seed.py            # roles, models, doc templates, starter profiles
uvicorn app.main:app --reload    # or ./run.sh
```
Docs: `http://127.0.0.1:8000/docs` · Health: `/health`

## Environment (.env)
| Var | Default | Meaning |
|---|---|---|
| `EXECUTION_MODE` | `demo` | `demo` (fixture) or `openai` (real GPT, falls back to fixture) |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | — / `gpt-4o-mini` | real-mode credentials |
| `DB_PATH` | `./data/companyops.db` | SQLite file |
| `BACKUP_DIR` | `./backups` | periodic backup target |
| `QA_TEST_CMD` | (empty) | real test command; empty ⇒ labeled demo PASS |
| `GIT_MODE` | `stub` | `stub` (deterministic demo) or `real` (subprocess git + real push) |
| `GIT_REMOTE` | `.../TestOutput` | git output target (used in `real` mode) |
| `CHECKOUT_ROOT` | `./checkouts` | per-project working copies (`real` mode) |

### Git modes
- `GIT_MODE=stub` (default) — `LocalStubGit`; deterministic, no real git, safe for demos.
- `GIT_MODE=real` — the U2 `GitInterface` (subprocess git) is injected at startup: real clone of `GIT_REMOTE`, per-project branch `project/{projectId}`, real commit + push. Requires git credentials in the server environment; missing credentials surface as a `FAILED`/`COMMITTED_LOCAL` publish (never a crash).

## Key endpoints (06 §4)
- PM: `POST/GET /api/projects`, `GET/PATCH /api/projects/{id}`, `/agent-profiles`, `/roles`, `/llm-models`, project-scoped `/agents`, `/sprint-milestones`, `/tasks`, `/agent-recommendations`.
- Orchestration (project-scoped): `GET /snapshot`, `GET /events` (SSE), `POST /commands`, `POST /plans/{id}/{feedback|review-complete|approve}`, `POST /decisions/{id}/resolve`, `GET /qa-runs/{id}`, `GET/POST /sprint-milestones/{id}/result[/reviews]`, `POST /tasks/{id}/publish`, `GET /tasks/{id}/artifacts`, `GET /activity`.
- UF (global): `POST/GET /api/utilization`, `GET /api/utilization/{reportId}[/metrics|/feedbacks]`, `POST /api/utilization/{reportId}/feedbacks`, `PUT /api/feedbacks/{feedbackId}`. Report auto-generated on project COMPLETED (UF_MVP_V1); post-completion only.

## Invariants honored
Multi-axis state kept separate; `round(100×COMPLETED/non-cancelled)` progress; Task COMPLETED = approved plan version + technical gate PASSED + push success + `executionMode`; milestone-result versioning + human review; idempotency (`requestId`) + optimistic concurrency (409); SSE snapshot-invalidation (heartbeat 15s).

## Cross-unit ports (stubs in U1)
- `app/ports/git_port.py` — `LocalStubGit` (real GitInterface = U2).
- `app/ports/utilization_port.py` — `NoopUtilization` (real UF = U3).
Swap via `app/orchestrator/deps.set_git_port(...)` / `set_utilization_port(...)`.

## Tests
`pytest` (executed in the Build & Test stage). Covers recommendation/assignment invariants, progress math, plan-version guards + 409, idempotency, and the full connected flow through project completion.


## Five-role connected demo

Run `venv/bin/python seed_flow_demo.py` from `backend`, then refresh the project picker
at `http://localhost:5173` and select **데모 · 5역할 전체 개발 흐름**.

- PM / Frontend / Backend / Database / QA: one assigned agent each.
- 12 tasks with explicit agent IDs and dependencies; PM preparation is 2/12 complete.
- In **결정 필요**, enter `샘플 데이터로 진행` and click **결정 전달** to release the
  remaining tasks: implementation → QA → PM report. Finish with **Milestone 결과 승인**.
- Fixture approval is recorded with actor `seed-flow-demo-v1`, not a human reviewer.
  Tokens, QA and generated artifacts are demo data. No remote git/model operations.
- Requires demo execution, stub git and no QA shell command. Existing projects are
  preserved; rerunning reuses the demo, and `--new` creates a separate run.
- Fixture tasks can finish quickly; the worker does not simulate long-running AI calls.

Validation: `venv/bin/python -m pytest tests/orchestrator/test_flow_demo.py -q` uses
an isolated test database and checks the decision-to-milestone-approval lifecycle.
