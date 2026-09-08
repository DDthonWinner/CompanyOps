# Code Generation Plan — U2 `backend-git`

> Stage: CONSTRUCTION / Code Generation (Planning) · Unit: backend-git · Date: 2026-09-08
> Single source of truth for U2 code. Code location: `backend/app/git_interface/` (workspace root). Doc summary: `aidlc-docs/construction/backend-git/code/`.

## Unit Context
- **Stories**: GIT-1 (publish real push), GIT-2 (idempotent republish + sync status); supports ORCH-4/5.
- **Design**: `construction/backend-git/functional-design/*`, `03`, `06` §2.2/§7.
- **Dependency**: implements U1's `GitPort`; injected via `app.orchestrator.deps.set_git_port(...)` when `GIT_MODE=real`. No changes to U1 call sites.
- **Tech**: Python subprocess `git`; per-project checkout under `CHECKOUT_ROOT`; branch `project/{projectId}`.

## Generation Steps (numbered)
- [x] **Step 1 — Package structure** — `backend/app/git_interface/__init__.py`, `exceptions.py`, `models.py` (ApplyResult/PublishResult already in ports; add ChangeSetView/InitResult/SyncResult).
- [x] **Step 2 — git command wrapper** — `git_command.py` (`run_git(args, cwd, timeout)` arg-array subprocess; helpers for status/diff/rev-parse).
- [x] **Step 3 — path safety + file access** — `file_access.py` (`resolve_repository_path`, read/apply changes, `compute_changeset`).
- [x] **Step 4 — workspace** — `workspace.py` (checkout path, clone/branch init idempotent, ff-only sync).
- [x] **Step 5 — GitInterface** — `interface.py` implementing `GitPort`: `initialize_project_repository`, `apply_file_changes`, `get_task_changes`, `sync_milestone_repository`, `publish_task_changes` (commit + push, states, idempotent, SYNC_REQUIRED, missing-creds → FAILED).
- [x] **Step 6 — Wiring** — add `GIT_MODE` to `config.py`; in `app/main.py` startup, if `GIT_MODE=real` call `deps.set_git_port(GitInterface(...))`.
- [x] **Step 7 — Unit tests** — `backend/tests/git_interface/test_git_interface.py`: use a temp **local bare repo** as `GIT_REMOTE` (offline real git) to verify clone→branch→apply→commit→push (GIT-AC-001), idempotent re-push / NO_CHANGES (GIT-AC-002/004), path-safety rejection (GIT-AC-005). Plus an orchestrator flow test with the real GitInterface injected (real commit, not stub).
- [x] **Step 8 — Documentation** — `aidlc-docs/construction/backend-git/code/code-summary.md`; update backend README (GIT_MODE).
- [x] **Step 9 — Deployment artifacts** — none new (env var documented; `.env.example` add `GIT_MODE`). No CI (R-04a).

## Story traceability
| Step | Stories |
|---|---|
| 2–5 | GIT-1, GIT-2 |
| 6 | GIT-1 (real mode wiring) |
| 7 | GIT-1, GIT-2 (GIT-AC-001/002/004/005), ORCH-4/5 (real publish) |

## Notes
- Offline-testable: tests push to a `file://` bare repo — real subprocess git, no network/credentials, deterministic. Real GitHub push to `DDthonWinner/TestOutput` uses the same code path with `GIT_REMOTE` + env credentials.
- Frontend steps N/A.
- Tests run in the U2 Build & Test stage.

## Approval
Approve to generate U2 code (Steps 1–9).
