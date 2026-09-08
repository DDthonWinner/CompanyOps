# Unit Test Execution — U1 backend-pm

> Stage: CONSTRUCTION / Build and Test · Date: 2026-09-08

## Run unit tests
```bash
cd backend
./venv/bin/python -m pytest -q
```
Tests use an isolated temp SQLite DB (`conftest.py` sets `DB_PATH` to a tmp file and re-seeds per test); they never touch the dev database.

## Results (this run)
- **Total**: 14 · **Passed**: 14 · **Failed**: 0 · **Exit**: 0
- Test files:
  - `tests/common/test_repositories.py` — seed roles present; project persistence; one-git-repo-per-project UNIQUE constraint.
  - `tests/pm/test_pm_service.py` — budget defaults/cap (PM-AC-001); recommendation includes PM; assign requires exactly one PM (PM-AC-002); assign→READY; duplicate profile rejected; **progress math** M1 67% / M2 50% / project 67% (PM-AC-006); empty milestone 0% "작업 없음".
  - `tests/orchestrator/test_flow.py` — plan version guard + 409 stale (MASTER-AC-003); idempotent command replay; **full connected flow** command→plan→approve→execute→QA→publish→COMPLETED (MASTER-AC-004) → milestone result PENDING (MASTER-AC-005) → approve → project COMPLETED (MASTER-AC-006/012); no-executable-task returns False.

## Coverage focus
Core invariants: multi-axis state, progress formula, plan-version guards, idempotency, task-completion preconditions, milestone-result versioning, project completion. Property-based testing intentionally disabled (Q11).

## Fixing failures
1. Read the failing assertion + traceback.
2. Adjust `app/…` source (not tests, unless the test encodes a wrong expectation).
3. Re-run `pytest -q` until green.
