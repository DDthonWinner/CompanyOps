# NFR Design Plan — SYSTEM (once, cross-cutting)

> Stage: CONSTRUCTION / NFR Design (Planning) · Scope: system-wide (Q5) · Date: 2026-09-08
> Input: `construction/system/nfr-requirements/*`. Expresses NFR-S1..S8 + resiliency decisions as design patterns + logical components. Referenced by every unit.

## Methodology & Approach
Translate the approved system NFRs into concrete, technology-aware patterns and a logical-component inventory. All decisions follow directly from the approved NFR requirements; recommended defaults pre-filled — override any `[Answer]:` you disagree with.

## NFR Design Decisions
### D1 — Resilience patterns
**Recommended**: (a) explicit **timeouts** on OpenAI + git subprocess; (b) **graceful degradation** to fixture provider on OpenAI failure; (c) **idempotency** via command-receipt store; (d) **optimistic concurrency** (expectedVersion/Revision → 409); (e) **restart recovery** RUNNING→BLOCKED (no auto re-run/dup commit); (f) **per-project write-lock**. Circuit breaker/bulkhead marked **N/A** (single low-volume external dep; timeout+fallback suffices).
[Answer]: As above (recommended)

### D2 — Scalability patterns
**Recommended**: single-node **in-process async worker** draining a **persisted job/command queue**; **sequential per-project write** execution; reads/plans unblocked. No auto-scaling/sharding.
[Answer]: In-process async worker + persisted queue, sequential writes (recommended)

### D3 — Performance patterns
**Recommended**: **SSE snapshot-invalidation** (lightweight revision events, not full payloads); client re-reads a **single-transaction snapshot**; **throttled** 3D CanvasTexture updates (5–10 fps); DB **indices** on hot lookups (project_id, status, milestone_id, request_id); revision as monotonic int.
[Answer]: Snapshot-invalidation + single-tx snapshot + throttling + hot indices (recommended)

### D4 — Security patterns
**Recommended**: **env-based secrets** (OpenAI key, git creds) never in code/requests/published repo; `.gitignore` for `.env`/secrets/DB; **path-safety** in git module (checkout-relative, no `.git`, no traversal, arg arrays/no shell); **Pydantic input validation**; no auth (single-user). Security extension disabled.
[Answer]: Env secrets + path-safety + Pydantic validation, no auth (recommended)

### D5 — Logical components (infrastructure)
**Recommended**: RevisionService, ActivityLog, CommandReceiptStore, SnapshotAssembler, SSEBroker (heartbeat 15s), WriteLockManager (per-project mutex), ExecutionQueue (persisted), ExecutionProvider selector (fixture/openai), QAGate, PublishCoordinator, **SQLite BackupJob** (periodic file copy), **/health** endpoint (shallow + optional deep DB check), ErrorEnvelope middleware.
[Answer]: Component set as above (recommended)

### D6 — Availability / DR design (single-node)
**Recommended**: **periodic SQLite file backup** (timestamped copies + retention) with a **restore runbook**; **version-pinned rollback** (git revert/previous build); **lightweight IR/COE**: on failure log + set affected work BLOCKED + manual review note. DR test scenario (restore-from-backup) captured for Operations.
[Answer]: Periodic SQLite backup + restore runbook + version rollback + lightweight IR (recommended)

## Mandatory NFR Design Artifacts (generation checklist)
- [x] `construction/system/nfr-design/nfr-design-patterns.md` — resilience/scalability/performance/security/DR patterns mapped to NFR-S* and RESILIENCY-*
- [x] `construction/system/nfr-design/logical-components.md` — logical/infrastructure components, responsibilities, integration points
- [x] Validate against nfr-requirements.md (no blocking resiliency findings)

## Approval
Approve this plan (defaults above) to generate the system NFR design artifacts, or edit any `[Answer]:` and tell me.
