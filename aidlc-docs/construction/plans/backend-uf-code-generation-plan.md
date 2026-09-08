# Code Generation Plan — U3 `backend-uf`

> Stage: CONSTRUCTION / Code Generation (Planning) · Unit: backend-uf · Date: 2026-09-08
> Single source of truth for U3 code. Code location: `backend/app/uf/` (+ wire `db.py`/`main.py`). Doc summary: `aidlc-docs/construction/backend-uf/code/`.

## Unit Context
- **Stories**: UF-1..4 (+ ORCH-8 decision counts).
- **Design**: `construction/backend-uf/functional-design/*`, `02`, `06` §3.3.
- **Dependency**: implements U1's `UtilizationPort`; reads PM/orchestrator/activity data read-only.
- **Tech**: FastAPI + SQLAlchemy (existing backend project).

## Generation Steps (numbered)
- [ ] **Step 1 — Models** — `backend/app/uf/__init__.py`, `uf/models.py` (UtilizationReport, UtilizationMetric, Feedback). Register with `Base` by importing `app.uf.models` in `db.init_db`.
- [ ] **Step 2 — Repository** — `uf/repository.py` (report/metric/feedback persistence + read helpers for tasks/decisions/plan-feedback/milestone-results/activity tokens).
- [ ] **Step 3 — Service** — `uf/service.py`: `create_report` (409 if not COMPLETED, idempotent), `aggregate`, `compute_score` (UF_MVP_V1), `select_previous`, feedback CRUD, report/metrics getters.
- [ ] **Step 4 — Schemas + routes** — `uf/schemas.py` (Pydantic), `uf/routes.py` (`POST/GET /api/utilization`, `GET /api/utilization/{id}`, `/metrics`, `GET/POST /{id}/feedbacks`, `PUT /api/feedbacks/{id}`).
- [ ] **Step 5 — Adapter + wiring** — `uf/adapter.py` (`UtilizationAdapter` implements `UtilizationPort`); in `app/main.py` include the uf router and `deps.set_utilization_port(UtilizationAdapter())` at startup.
- [ ] **Step 6 — Tests** — `backend/tests/uf/test_uf.py`: 409 when project not COMPLETED; idempotent single report; UF_MVP_V1 score (Autonomy from AI_AGENT ratio; Area distribution; Resource N/A on first report); feedback create post-completion; **end-to-end**: run the connected flow to project COMPLETED with the real UtilizationAdapter wired → a report is auto-created and score computed.
- [ ] **Step 7 — Docs** — `aidlc-docs/construction/backend-uf/code/code-summary.md`; note UF endpoints in backend README.

## Story traceability
| Step | Stories |
|---|---|
| 1–3 | UF-1, UF-2, UF-4 (aggregate/score/compare) |
| 4 | UF-1..4 (API) |
| 3 (feedback) / 4 | UF-3 |
| 5 | UF-1 (completion auto-trigger) |
| 6 | UF-1..4 + ORCH-5 completion path |

## Notes
- Tokens aggregated from `activity_events` `artifact.updated` payloads (read-only); cost `미수집`.
- No changes to U1/U2/U4/U5 call sites; UtilizationAdapter replaces the no-op stub via `deps`.
- Tests run in U3 Build & Test.

## Approval
Approve to generate U3 code (Steps 1–7).
