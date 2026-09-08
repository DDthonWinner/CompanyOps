# U2 backend-git — Code Generation Summary

> Stage: CONSTRUCTION / Code Generation · Unit: backend-git · Date: 2026-09-08
> Application code under `backend/app/git_interface/` (workspace root). Doc summary only.

## Created files
- `backend/app/git_interface/__init__.py`
- `exceptions.py` (GitError, PathSafetyError, SyncRequired)
- `models.py` (InitResult, SyncResult, ChangeSetView; re-exports ApplyResult/PublishResult)
- `git_command.py` (`run_git`/`run_git_raw`: arg-array subprocess, `GIT_TERMINAL_PROMPT=0`, timeouts)
- `file_access.py` (`resolve_repository_path` path-safety, `apply_changes`, `read_file`)
- `workspace.py` (idempotent clone + branch `project/{id}`, ff-only sync, unborn-branch safe)
- `interface.py` (`GitInterface` implementing U1 `GitPort`: init/apply/get_changes/sync/publish)

## Modified files
- `backend/app/config.py` — added `GIT_MODE` (stub|real)
- `backend/app/main.py` — `_wire_git_port()` injects real `GitInterface` at startup when `GIT_MODE=real`
- `backend/.env.example` — added `GIT_MODE`
- `backend/README.md` — git modes documented

## Tests (backend/tests/git_interface/test_git_interface.py)
Offline via a temporary `file://` bare repo (real subprocess git, no network/credentials):
- `test_init_clone_and_branch`, `test_apply_commit_push` (GIT-AC-001), `test_new_file_in_changeset` (GIT-AC-004),
  `test_idempotent_republish_no_new_commit` (GIT-AC-002), `test_path_safety_rejects_escape` (GIT-AC-005),
  `test_no_changes`, `test_connected_flow_with_real_git` (ORCH-4/5 — real commit, not stub).

## Result
Full suite green: **21 passed** (14 U1 + 7 U2). The real GitInterface drops into the U1 flow via `deps.set_git_port(...)` with no U1 changes; the same code path pushes to `DDthonWinner/TestOutput` in `GIT_MODE=real`.

## Story coverage
GIT-1, GIT-2 (+ ORCH-4/5 real publish). Fixes applied during generation: `workspace._ensure_branch` uses `git branch --show-current` (unborn-branch safe); `workspace.initialize` rev-parse HEAD is non-raising.
