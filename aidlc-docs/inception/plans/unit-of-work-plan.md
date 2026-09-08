# Unit of Work Plan — CompanyOps

> Stage: INCEPTION / Units Generation (Planning) · Date: 2026-09-08 · Project type: Greenfield
> Inputs: requirements.md, stories.md/personas.md, application-design/*. Decomposes the system into units of work for the CONSTRUCTION phase.

## Methodology & Approach
CompanyOps is a **modular monolith**: a single FastAPI backend service (internally modular) plus a single React/Vite SPA, in one monorepo (D8). A "unit of work" here is a **logical module** grouping related stories for development — not an independently deployable service. Each unit will pass through the per-unit CONSTRUCTION stages (Functional Design → NFR → Code Generation → Build & Test).

## Decomposition Decisions
Recommended defaults are pre-filled — change any `[Answer]:` if you disagree; otherwise approve as-is.

### Q1 — Deployment model
**Recommended**: **Modular monolith** — one backend FastAPI service (SQLite, in-process worker) + one React SPA. Monorepo `backend/` + `frontend/`. The only network boundary is frontend↔backend (HTTP + SSE).
[Answer]: Modular monolith, single backend service + single SPA (recommended)

### Q2 — Unit granularity / story grouping
**Recommended**: **6 units** — 5 backend modules + 1 frontend app:
- `backend-platform`, `backend-pm`, `backend-orchestration`, `backend-git`, `backend-uf`, `frontend-app`.
Alternatives: **coarse** (2 units: backend, frontend) or **fine** (8 units: split `frontend-app` into `frontend-shell`, `frontend-tycoon`, `frontend-dashboard`). 6 balances coherent boundaries against the number of CONSTRUCTION cycles for a hackathon.
[Answer]: Split into 5 units. 3 Backends (PM, git, User Feeback (any other backend services should be integrated into PM)) + 2 Frontends (Dashboard view, Tycoon View)

### Q3 — Inter-unit integration
**Recommended**: Backend units integrate via **in-process Python calls** (no inter-unit network); the orchestrator is the hub, PM is independent of execution, UF reads downstream read-only. The frontend consumes the `06` HTTP+SSE contract. Shared consistency via CommonPlatform (revision/receipts/snapshot/SSE).
[Answer]: In-process backend calls; frontend via HTTP+SSE contract (recommended)

### Q4 — Build / construction order
**Recommended**: P1 connected-flow first — **U1 backend-platform → U2 backend-pm → U3 backend-orchestration → U4 backend-git → U6 frontend-app** (enough to demo the connected flow), then **U5 backend-uf** and P2 fold-ins.
[Answer]: P1 first, then UF + P2 (recommended)

### Q5 — CONSTRUCTION cycle strategy
**Recommended**: **Per-unit, P1-first, sequential.** Because the cross-cutting contract is already fixed in `06`, run **NFR Requirements/Design once at the system level** and reference it per unit (rather than fully repeating it for all 6), while Functional Design + Code Generation + Build&Test run per unit.
Alternative: fully system-wide design, then code all units.
[Answer]: Per-unit sequential P1-first, with system-level NFR referenced per unit (recommended)

### Q6 — Code organization (greenfield)
**Recommended**: The approved D8 monorepo layout:
```
backend/app/{main,config,db,models,schemas}
  ├── common/         # U1 platform: revision, receipts, snapshot, sse, errors, activity
  ├── pm/             # U2
  ├── orchestrator/   # U3 (+ orchestrator/execution/ providers)
  ├── git_interface/  # U4
  └── uf/             # U5
backend/tests/{common,pm,orchestrator,git_interface,uf}
frontend/src/{app,store,api,features/{tycoon,dashboard,feedback},components/ui}   # U6
```
Application code at workspace root (never in aidlc-docs/); docs summaries under aidlc-docs/construction/{unit-name}/.
[Answer]: D8 monorepo layout as above (recommended)

### Team Alignment
N/A — single operator/developer context; no multi-team ownership boundaries. (Documented, not a question.)

## Mandatory Unit Artifacts (generation checklist)
- [ ] `application-design/unit-of-work.md` — unit definitions, responsibilities, owned entities, + greenfield code-organization strategy
- [ ] `application-design/unit-of-work-dependency.md` — inter-unit dependency matrix + build order
- [ ] `application-design/unit-of-work-story-map.md` — every story mapped to a unit
- [ ] Validate unit boundaries and dependencies
- [ ] Ensure all 24 stories are assigned to units

## Approval
**Unit of work plan complete.** Approve to proceed to generation, or edit any `[Answer]:` and tell me.
