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

## Invariants honored
Multi-axis state kept separate; `round(100×COMPLETED/non-cancelled)` progress; Task COMPLETED = approved plan version + technical gate PASSED + push success + `executionMode`; milestone-result versioning + human review; idempotency (`requestId`) + optimistic concurrency (409); SSE snapshot-invalidation (heartbeat 15s).

## Cross-unit ports (stubs in U1)
- `app/ports/git_port.py` — `LocalStubGit` (real GitInterface = U2).
- `app/ports/utilization_port.py` — `NoopUtilization` (real UF = U3).
Swap via `app/orchestrator/deps.set_git_port(...)` / `set_utilization_port(...)`.

## Tests
`pytest` (executed in the Build & Test stage). Covers recommendation/assignment invariants, progress math, plan-version guards + 409, idempotency, and the full connected flow through project completion.
