# U3 backend-uf — Code Generation Summary

> Stage: CONSTRUCTION / Code Generation · Unit: backend-uf · Date: 2026-09-08
> Application code under `backend/app/uf/` (+ small wiring). Doc summary only.

## Created
- `backend/app/uf/__init__.py`
- `uf/models.py` (UtilizationReport, UtilizationMetric, Feedback) — registered via `db.init_db` import
- `uf/repository.py` (read-only source helpers: eligible tasks, decision/plan-feedback/revision counts, token totals from `activity_events` payloads, role-code map)
- `uf/service.py` (create_report [409/idempotent], aggregate, UF_MVP_V1 compute_score, select_previous, feedback CRUD, getters)
- `uf/schemas.py`, `uf/routes.py` (`/api/utilization*`, `/api/feedbacks`)
- `uf/adapter.py` (`UtilizationAdapter` implements `UtilizationPort`)
- `backend/tests/uf/test_uf.py`

## Modified
- `backend/app/db.py` — `init_db` imports `uf.models` to register tables
- `backend/app/ports/utilization_port.py` — `request_report(project_id, session=None)` (share completion txn)
- `backend/app/orchestrator/service.py` — completion triggers UF in the same txn via a `begin_nested()` savepoint (UF failure never rolls back completion)
- `backend/app/main.py` — include UF router + `_wire_utilization_port()` (deps.set_utilization_port)
- `backend/tests/conftest.py` — register UF tables in the test DB
- `backend/README.md` — UF endpoints

## Tests & fix
- Full backend suite **25/25 pass** (21 prior + 4 UF): 409 when not COMPLETED, idempotent single report, UF_MVP_V1 score (Autonomy/Area 100, Resource N/A first report), feedback post-completion, **e2e completion auto-generates the report** with the real adapter wired.
- Fix during gen: explicit `session.flush()` before serializing metrics (session autoflush is off).

## Story coverage
UF-1..4 (+ ORCH-8 decision counts). Read-only vs work state; tokens from activity payloads; cost 미수집. Completion auto-report via UtilizationPort with no U4/U5 changes and no U1 call-site change (only the port timing/signature seam).
