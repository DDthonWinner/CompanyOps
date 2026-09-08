# Application Design — CompanyOps (Consolidated)

> Stage: INCEPTION / Application Design · Date: 2026-09-08 · Project type: Greenfield
> This consolidates `components.md`, `component-methods.md`, `services.md`, and `component-dependency.md`. It is high-level (components, interfaces, service orchestration, dependencies). Detailed per-unit business rules are produced in Functional Design (CONSTRUCTION).

## 1. Overview
CompanyOps is a monorepo (D8): a Python FastAPI backend (layered routers→services→repositories→SQLite) and a React/Vite frontend (single snapshot-driven Zustand store). The backend orchestrator is the connective responsibility that turns operator commands into approved plans, executes tasks through a single in-process async worker, gates them behind technical QA, publishes them to GitHub, and streams state to both views via SSE. The AI work is behind an `ExecutionProvider` abstraction defaulting to a deterministic fixture provider, switchable to real OpenAI GPT.

Architectural decisions of record: **D1** layered backend · **D2** in-process async worker + persisted queue (sequential per-project writes) · **D3** ExecutionProvider (Fixture default / OpenAI) behind `EXECUTION_MODE` · **D4** per-project revision + activity log + snapshot-invalidation SSE · **D5** single snapshot-driven Zustand store + UI slice · **D6** command_receipts + service-layer version checks + 409 envelope · **D7** git_interface module + per-project write-lock · **D8** monorepo package layout.

## 2. Components
See `components.md`. Backend: **PMService** (BC-1), **OrchestratorService** (BC-2, sub-services a–i), **GitInterface** (BC-3), **UFService** (BC-4), **ExecutionProvider** (BC-5), **CommonPlatform** (BC-6: revision/activity/receipts/snapshot/SSE/errors/db), **HTTP routers** (BC-7). Frontend: **AppShell+GlobalExecutiveBar** (FC-1), **SnapshotStore** (FC-2), **ApiClient** (FC-3), **SseClient** (FC-4), **TycoonView** (FC-5), **DashboardView** (FC-6), **FeedbackSection** (FC-7), **shared UI/tokens** (FC-8).

## 3. Interfaces / Methods
See `component-methods.md` — signatures with I/O types for every backend service and frontend client/store. Mutating methods take `request_id` and version/revision guards and run in a revision-bumping transaction.

## 4. Services & Orchestration
See `services.md` — eight orchestration patterns: OP-1 project prep→ACTIVE, OP-2 plan-first lifecycle, OP-3 execution+QA+publish, OP-4 milestone review→completion, OP-5 completion→UF, OP-6 snapshot/SSE, OP-7 idempotency/concurrency, OP-8 3D selection.

## 5. Dependencies
See `component-dependency.md` — dependency matrix (orchestrator is the hub; PM independent of execution; UF read-only downstream), communication patterns (HTTP command/query, SSE invalidation, in-process queue, subprocess git, external OpenAI, DOM CustomEvent), and data-flow diagrams DF-1..3.

## 6. Mapping to modules & stories
| Module | Components | Primary stories |
|---|---|---|
| PM | PMService, routers | PM-1..6 |
| Orchestrator | BC-2a..i, CommonPlatform | ORCH-1..8, RT-1..2 |
| GIT | GitInterface, PublishCoordinator | GIT-1..2 |
| UF | UFService, FeedbackSection | UF-1..4 |
| DASH | DashboardView | DASH-1..4 |
| TY | TycoonView | TY-1..3 |

## 7. Consistency with the `06` contract (validation)
- **State axes kept separate** — execution / artifact-gen / milestone-review / plan / QA / connection are distinct fields, never merged. ✅
- **Task COMPLETED** only on approvedPlanVersion + technical gate PASSED + push success + executionMode. ✅ (PublishCoordinator)
- **Progress math** `round(100×COMPLETED/non-cancelled)`, 0/0→0% "작업 없음", read-only server-computed. ✅ (PMService aggregation)
- **Milestone result** = sorted snapshot/hash; approval on result version; stale version 409; APPROVED requires additionalValidation=NONE. ✅ (MilestoneResultService)
- **Project completion** = all non-cancelled tasks in milestones COMPLETED + all latest results APPROVED; triggers one UF report. ✅
- **UF** global paths, post-completion only, idempotent, 409 when ACTIVE, never mutates work state. ✅
- **SSE** snapshot-invalidation, heartbeat 15s, 45s disconnect, backoff 1/2/5/10s, re-read on revision. ✅
- **Idempotency/concurrency** requestId receipts + expectedVersion/Revision → 409 envelope. ✅
- **Git** fixed remote, `project/{projectId}`, per-project write-lock, no force-push/auto-merge, credentials from env. ✅
- **3D selection** CustomEvent for selection only; state via SSE/snapshot→store→React/3D. ✅

## 8. Resiliency touchpoints (baseline, single-node per R1=E)
- Single critical workload (FastAPI+SQLite); dependencies = OpenAI (optional), git remote — both with explicit timeouts and graceful degradation to fixture mode (RESILIENCY-10, NFR-7).
- Shallow health endpoint planned; SQLite periodic backup (RESILIENCY-06/12) — detailed in NFR Design.
- Deferred to NFR Design: RESILIENCY-03/04/08/14/15.

## 9. Out of scope here (later stages)
Per-unit functional rules (Functional Design), concrete NFRs and resiliency decision resolution (NFR Requirements/Design), actual DDL/endpoint code and file layout instantiation (Units Generation → Code Generation). Infrastructure Design skipped (single-node local PoC).
