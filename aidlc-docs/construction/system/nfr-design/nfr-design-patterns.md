# System NFR Design — Patterns

> Stage: CONSTRUCTION / NFR Design · Scope: system-wide · Date: 2026-09-08
> Patterns implementing NFR-S1..S8 + RESILIENCY decisions. Referenced by all units.

## Resilience (NFR-S6, RESILIENCY-10/15)
| Pattern | Design | Maps to |
|---|---|---|
| **Timeouts** | Every external call bounded: `git` subprocess `timeout=120s`; OpenAI client per-request timeout (e.g., 60s). No unbounded waits. | RESILIENCY-10 |
| **Graceful degradation** | On OpenAI error/timeout, fall back to `FixtureExecutionProvider`; record the mode actually used in `execution_mode`. | RESILIENCY-10, NFR-S6 |
| **Idempotency** | `CommandReceiptStore` keyed by `requestId`(+payload hash): NEW / REPLAY / CONFLICT(409). Applied to every mutating command incl. publish. | `06` §4.3 |
| **Optimistic concurrency** | `expectedVersion`/`expectedRevision` compared in service layer; mismatch → 409 `{code,message,details,requestId}`. | `06` §4.3 |
| **Restart recovery** | On startup, RUNNING tasks/QA runs → BLOCKED; no auto re-run, no duplicate commit/model-call; verify checkout/QA/publish state. | `06` §5.2 |
| **Write-lock** | Per-project mutex held across change→QA→publish; reads/plans not blocked. | `03`, `00` §5.2 |
| **Atomic state+revision** | State change + `revision` bump + `activity` append in one DB transaction; SSE emitted only after commit. External side-effects tracked as receipt processing stages. | `06` §4.3/§5 |
| Circuit breaker / bulkhead | **N/A** — single low-volume external dep; timeout + fallback suffices. Documented, not a finding. | RESILIENCY-10 |

## Scalability (NFR-S1, RESILIENCY-08/09)
- **In-process async worker** drains a **persisted job/command queue**; **one active write per project** (sequential); reads/plans concurrent. No auto-scaling, no sharding (single-node, single-region — RESILIENCY-08 N/A, RESILIENCY-09 N/A). Assigned agents (≤16) ≠ concurrent executions.

## Performance (NFR-S2)
- **SSE snapshot-invalidation**: events carry only `{revision,type,entityId}`; client re-reads a **single-transaction snapshot** — avoids heavy per-event payloads and divergent state.
- **Throttled 3D**: CanvasTexture text updated 5–10 fps; shadow ≤2048²; limited lights.
- **DB indices** on hot lookups: `project_tasks(project_id,status)`, `project_tasks(sprint_milestone_id)`, `sprint_milestones(project_id)`, `project_agents(project_id)`, `command_receipts(request_id)`, `activity_events(project_id,revision)`.
- **Monotonic revision** int per project for cheap freshness checks.

## Security (NFR-S4, Security extension disabled)
- **Secrets in env only** (OpenAI key, git creds, DB path); `.gitignore` covers `.env`, secret files, local DB, checkouts — never published to `TestOutput`.
- **Path-safety** (git module): checkout-relative paths only; reject absolute/traversal/symlink-escape/`.git`; git via **arg arrays, no shell**.
- **Input validation** via Pydantic v2 schemas at the API boundary; enum CHECK constraints in DB.
- **No auth** (single-user MVP) — documented; management PATCH cannot bypass approval gates to force RUNNING/COMPLETED.

## Availability / DR (NFR-S3, RESILIENCY-02/11/12/13/14/15)
- **Backup**: periodic timestamped SQLite file copy (`BackupJob`) with simple retention; DB path configurable.
- **Restore runbook**: stop process → replace DB file from latest good backup → restart → verify snapshot. (Captured for Operations; RESILIENCY-14 test scenario.)
- **Rollback**: version-pinned redeploy (git checkout previous commit / previous build). Direct/in-place deploy.
- **Incident response (lightweight IR/COE)**: on failure → structured error log + set affected work BLOCKED (safe state) + manual review note; no on-call.
- **Health**: `/health` shallow (process up) + optional deep (DB reachable).

## Maintainability / Testing (NFR-S7)
- Layered separation (routers/services/repositories; frontend features/store/api). Unit tests per layer (pytest; Vitest+RTL). PBT off. Stable `data-testid` on UI interactive elements.

## Compliance
All patterns map to NFR-S* and RESILIENCY-* with **no blocking findings** (see nfr-requirements.md compliance table).
