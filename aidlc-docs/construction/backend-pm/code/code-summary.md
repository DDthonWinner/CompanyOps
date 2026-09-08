# U1 backend-pm — Code Generation Summary

> Stage: CONSTRUCTION / Code Generation · Unit: backend-pm · Date: 2026-09-08
> Application code created under `backend/` (workspace root). This is a doc summary only.

## Created files (application code)
**Project structure & app core**
- `.gitignore`, `README.md` (root)
- `backend/requirements.txt`, `.env.example`, `run.sh`, `pytest.ini`, `README.md`, `seed.py`
- `backend/app/{__init__,config,db,main}.py`

**Platform (common)** — `backend/app/common/`
- `models.py` (all U1 SQLAlchemy models), `util.py`, `errors.py` (envelope), `platform.py` (revision/activity/receipts/write-lock/touch), `progress.py`, `snapshot.py`, `sse.py` (broker), `backup.py`, `txn.py` (mutate/read helper)

**PM** — `backend/app/pm/`
- `recommendation.py` (rule tables), `service.py`, `schemas.py`, `routes.py`

**Orchestrator** — `backend/app/orchestrator/`
- `service.py` (plan lifecycle, composition, publish coordination, milestone results, completion, decisions), `worker.py` (async worker + scheduler + startup recovery), `qa.py` (technical gate), `deps.py` (port wiring), `schemas.py`, `routes.py`
- `execution/{base,fixture,openai_provider,selector}.py`

**Ports (U2/U3 boundaries)** — `backend/app/ports/`
- `git_port.py` (GitPort + LocalStubGit), `utilization_port.py` (UtilizationPort + NoopUtilization)

**Tests** — `backend/tests/`
- `conftest.py`, `common/test_repositories.py`, `pm/test_pm_service.py`, `orchestrator/test_flow.py`

## Story coverage
PM-1..6, ORCH-1..8, RT-1/2 (backend/SSE). ORCH-5 exercised end-to-end by `test_flow.test_full_connected_flow`.

## Notes / deferrals
- Real git push + subprocess = U2 (LocalStubGit used now). UF aggregation = U3 (NoopUtilization).
- Token metrics are emitted on `artifact.updated` activity payloads; a dedicated token table is a U3 concern.
- Tests are written; execution happens in the **Build & Test** stage.
- Python 3.14 is very new — dependency wheels are verified during Build & Test; pins may be adjusted there.
