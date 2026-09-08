# System NFR Design — Logical Components

> Stage: CONSTRUCTION / NFR Design · Scope: system-wide · Date: 2026-09-08
> Infrastructure/logical components that realize the NFR patterns. These live mainly in `backend/app/common/` (U1 platform) with frontend counterparts in `frontend/src/{store,api}` (U4).

## Backend logical components

| Component | Responsibility | Integration | Realizes |
|---|---|---|---|
| **RevisionService** | Per-project monotonic `revision`; `bump(project_id, tx)` within the mutation transaction | called by every mutating service | atomic freshness (NFR-S6/perf) |
| **ActivityLog** | Append `activity_events`; `/activity` cursor read | called with revision bump | timeline, recovery |
| **CommandReceiptStore** | Idempotency: `begin_command(requestId)` → NEW/REPLAY/CONFLICT(409); `complete_command` | wraps all mutating commands | idempotency (NFR-S6) |
| **SnapshotAssembler** | Build full read model at current revision in one read tx | `GET /snapshot` | perf, consistency |
| **SSEBroker** | `/events` stream; heartbeat 15s; emit `project.updated{revision,type,entityId}` after commit | publishes post-commit | realtime (NFR-S2) |
| **WriteLockManager** | Per-project mutex (asyncio lock) held across change→QA→publish | acquired by Scheduler/PublishCoordinator | serialize writes (NFR-S1) |
| **ExecutionQueue** | Persisted job/command queue; single async worker drains it | worker loop | scalability (NFR-S1) |
| **ExecutionProvider selector** | `select_provider(EXECUTION_MODE)` → Fixture(default)/OpenAI; timeouts + fallback | called by worker | resilience (NFR-S6) |
| **QAGate** | Run tests (real cmd or labeled demo-PASS); compute technical gate tied to content hash | after artifact generation | reliability |
| **PublishCoordinator** | Validate preconditions → GitInterface publish → COMPLETED on push+executionMode | calls U2 under write-lock | git integrity |
| **BackupJob** | Periodic timestamped SQLite copy + retention | scheduled task / manual trigger | availability (NFR-S3) |
| **HealthEndpoint** | `/health` shallow (+ optional deep DB check) | FastAPI route | monitoring (RESILIENCY-06) |
| **ErrorEnvelope middleware** | Map exceptions → `{code,message,details,requestId}` + HTTP status (400/404/409/422/502/503) | FastAPI exception handlers | error contract (`06` §4.3) |
| **Config/Secrets loader** | Env-based config (EXECUTION_MODE, OPENAI_API_KEY, git creds, DB/backup paths) | app bootstrap | security (NFR-S4) |
| **UnitOfWork/Session** | SQLAlchemy session + transaction boundary | all repositories | atomicity |

## Frontend logical components (U4-owned, U5 consumes)

| Component | Responsibility | Realizes |
|---|---|---|
| **SnapshotStore (Zustand)** | Single source of truth; apply snapshot only if newer revision; UI slice in Local Storage | consistency, perf |
| **ApiClient** | Commands with `requestId` + expectedVersion/Revision; surface error envelope + retryability; never optimistic while disconnected | idempotency, reliability |
| **SseClient** | Connection states (CONNECTING/CONNECTED/RECONNECTING/DISCONNECTED/ERROR); 45s disconnect; backoff 1/2/5/10s; snapshot re-read on (re)connect & higher revision | realtime recovery (NFR-S2, RESILIENCY) |
| **ConnectionStatus (in GlobalExecutiveBar)** | Always-visible status + last-sync time | availability visibility |

## Integration notes
- **One transaction** per mutation: state write + RevisionService.bump + ActivityLog.append; SSEBroker publishes only after commit.
- **Idempotency + concurrency** enforced at the service layer before any state write; external git/LLM effects recorded as receipt processing stages so partial failures (DB committed, push failed) recover deterministically.
- **Degradation path**: OpenAI failure → fixture provider; WebGL failure → Dashboard route; disconnect → no optimistic success, reconcile on reconnect.
- **No new infra** (queues/caches/circuit breakers as external services) — all components are in-process for the single-node PoC.
