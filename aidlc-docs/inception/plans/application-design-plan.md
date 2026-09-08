# Application Design Plan — CompanyOps

> Stage: INCEPTION / Application Design (Planning) · Date: 2026-09-08
> Inputs: requirements.md, stories.md/personas.md, and source contracts `00`–`06` + `Design.md`.
> Purpose: high-level component identification, interfaces, service-layer orchestration, and dependencies. Detailed per-unit business logic is deferred to Functional Design (CONSTRUCTION).

## Methodology & Approach
1. Identify functional components across backend (PM, Orchestrator, GIT, UF, Platform/SSE) and frontend (AppShell, Tycoon, Dashboard, shared store/API client).
2. Define each component's responsibilities and interfaces (method signatures only; rules come later).
3. Define the service layer and orchestration patterns (plan-first lifecycle, execution/QA/publish, snapshot/SSE).
4. Map component dependencies, communication patterns, and data flow.
5. Consolidate into `application-design.md`.

## Design Decisions
The source docs fix the data model, state machine, API contract, and SSE behavior. The remaining open choices are **structural/architectural**. Recommended defaults are pre-filled — change any `[Answer]:` if you disagree; otherwise approve as-is.

### D1 — Backend architecture style
**Recommended**: Layered — FastAPI **routers** (HTTP) → **service layer** (business rules + transactions + version/idempotency checks) → **repository layer** (SQLAlchemy) → SQLite. Cross-cutting: snapshot/revision, SSE broker, command-receipt store.
[Answer]: Layered routers→services→repositories (recommended)

### D2 — Orchestrator & task worker runtime
**Recommended**: A single **in-process background worker** (asyncio task) that drains a **persisted command/job queue**, executing per-project **write** work **sequentially** while honoring the per-project write-lock. Matches the single-process, one-active-write-Task-at-a-time MVP. Reads/plans are not blocked.
[Answer]: In-process async worker draining a persisted queue, sequential per-project writes (recommended)

### D3 — AI execution provider abstraction
**Recommended**: An `ExecutionProvider` interface with two implementations — `FixtureExecutionProvider` (**default**, deterministic seeded output; surfaces "AI 서버 미연결 / 데모 데이터") and `OpenAIExecutionProvider` (real GPT). Selected by env flag (e.g. `EXECUTION_MODE=demo|openai`). LangChain is an optional wrapper, not required. `executionMode` recorded per task.
[Answer]: ExecutionProvider interface + Fixture(default)/OpenAI impls behind env flag (recommended)

### D4 — Snapshot & SSE mechanism
**Recommended**: A per-project monotonic **`revision`** integer bumped **in the same DB transaction** as any state change; an `activity_events` append log; `GET /snapshot` returns the full read model at the current revision; `GET /events` (SSE) emits `project.updated` carrying the revision; client re-reads snapshot on higher revision. Heartbeat 15s per contract.
[Answer]: Per-project revision counter + activity log + snapshot-invalidation SSE (recommended)

### D5 — Frontend state architecture
**Recommended**: A **single Zustand store** holding the latest **server snapshot** for the active project (business state is read-only, snapshot-driven), plus a separate **UI slice** (selected tab, camera) persisted to Local Storage. An **API client** issues commands (with `requestId`) and returns receipts; the SSE client triggers snapshot re-reads. Both Tycoon and Dashboard read the same store.
[Answer]: Single snapshot-driven Zustand store + UI slice + API/SSE clients (recommended)

### D6 — Concurrency & idempotency implementation
**Recommended**: A `command_receipts` table keyed by `requestId` (+ payload hash) for idempotent replay; `expectedVersion`/`expectedRevision` checks in the service layer returning **409** with the `{code,message,details,requestId}` error envelope. Plan/approval/command-receipt + state change committed in one transaction; external Git/LLM effects tracked via receipt processing stages.
[Answer]: command_receipts + service-layer version checks + 409 envelope (recommended)

### D7 — GitInterface placement & locking
**Recommended**: `GitInterface` as a backend module (`git_interface/`) wrapping subprocess `git` with per-project checkout dirs + path-safety, fronted by a **per-project write-lock** (in-process mutex) that the orchestrator's publish flow acquires across change→QA→publish. Real remote push; credentials from server env, never from request input.
[Answer]: git_interface module + per-project write-lock, orchestrator-driven publish (recommended)

### D8 — Monorepo package/module layout
**Recommended**:
```
backend/app/  (main, config, db, models, schemas)
  ├── pm/            # projects, profiles, agents, milestones, tasks
  ├── orchestrator/  # plans, decisions, approvals, worker, qa, snapshot, sse
  ├── git_interface/ # clone/sync/read/write/diff/publish
  ├── uf/            # utilization reports, metrics, feedback
  └── common/        # revision, receipts, errors, activity
frontend/src/
  ├── app/           # AppShell, GlobalExecutiveBar, routing
  ├── store/         # zustand snapshot + ui slices
  ├── api/           # http client, sse client
  ├── features/tycoon/  features/dashboard/  features/feedback/
  └── components/ui/ # shadcn
```
[Answer]: Module layout as above (recommended)

## Mandatory Design Artifacts (generation checklist)
- [ ] `application-design/components.md` — components, purpose, responsibilities, interfaces
- [ ] `application-design/component-methods.md` — method signatures + I/O types (rules deferred to Functional Design)
- [ ] `application-design/services.md` — service definitions, responsibilities, orchestration
- [ ] `application-design/component-dependency.md` — dependency matrix, communication patterns, data-flow diagrams
- [ ] `application-design/application-design.md` — consolidation of the above
- [ ] Validate design completeness and consistency against the `06` contract

## Approval
Approve this plan (defaults above) to generate the design artifacts, or edit any `[Answer]:` and tell me.
