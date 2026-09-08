# System NFR Requirements — CompanyOps

> Stage: CONSTRUCTION / NFR Requirements · Scope: system-wide (once, per Q5) · Date: 2026-09-08
> Referenced by every unit (U1–U5). Consolidates cross-cutting NFRs from requirements.md NFR-1..9 + the resiliency baseline decisions. Single-node PoC (R1=E).

## 1. Non-Functional Requirements

### NFR-S1 Scalability
- Single human user; single FastAPI process; **one active write-Project at a time**; per-project **sequential** write execution (write-lock). Up to 16 assigned agents ≠ 16 concurrent executions. No horizontal scaling; multi-user/distributed workers are out of scope.

### NFR-S2 Performance
- Desktop-first 1920×1080. 3D CanvasTexture text updates throttled to **5–10 fps**; shadow map **≤ 2048²**; Ambient + 1 directional + 1 fill light. SSE **heartbeat 15s**. API latency best-effort (no hard SLA for the PoC). Snapshot assembled in one read transaction.

### NFR-S3 Availability / RTO / RPO
- **Single-node, Backup & Restore class** (RESILIENCY-02 = R1=E). Periodic SQLite file/DB backup + a documented restore runbook. No cross-region DR, no standby. Acceptable downtime = manual restart + restore.

### NFR-S4 Security
- Security extension **disabled** (Q9=B): no formal SECURITY-rule enforcement, no auth/authorization (single user). Git credentials and OpenAI key are provided via **server environment only**, never request input, never committed; `.env` and any secret files are git-ignored and excluded from the published `TestOutput` repo. Path-safety enforced by the git module.

### NFR-S5 Tech stack
See `tech-stack-decisions.md`.

### NFR-S6 Reliability
- Explicit **timeouts** on all external calls (OpenAI, git subprocess); **graceful degradation** to fixture mode when the OpenAI adapter fails. On process restart, RUNNING tasks/QA runs recover to **BLOCKED** (no auto re-run, no duplicate commit/model-call). **Idempotency** via `requestId`; **optimistic concurrency** via `expectedVersion`/`expectedRevision` → 409. State mutation + revision bump + activity append are atomic; external side-effects tracked via command-receipt stages.

### NFR-S7 Maintainability / Testing
- Layered backend (routers/services/repositories) + modular frontend. **Unit tests per layer** (pytest backend; Vitest + React Testing Library frontend). **Property-based testing disabled** (Q11=C). UI interactive elements carry stable `data-testid` (`{component}-{role}`).

### NFR-S8 Usability / Accessibility
- Status conveyed with **text/icon in addition to color**; modals support Escape/close/**focus return**; Korean **system-sans fallback** (web-font load failure must not block operation); **WebGL failure** offers a route to the Dashboard without losing selection/UI settings. Narrow screens show the Attention Center first.

## 2. Resiliency Baseline Decisions (RESILIENCY, enabled Q10 — directional)
| Rule | Decision | Notes |
|---|---|---|
| RESILIENCY-02 Availability/recovery | R1=E single-node Backup&Restore | NFR-S3 |
| RESILIENCY-03 Change management | **Exempt** | Single-dev hackathon PoC; no change board. Rationale documented. |
| RESILIENCY-04 CI/CD | **None — local deployment only** | User decision (R-04a override): no CI/CD workflow; run via local dev scripts. |
| RESILIENCY-04 Rollback | **Version-pinned redeploy** | git revert / previous build for the single node. |
| RESILIENCY-04 Deployment style | **Direct / in-place** | Acceptable for non-critical single-node PoC. |
| RESILIENCY-08 Regional topology | **Single-region / single-node** | Consistent with R1=E; no multi-zone/region. |
| RESILIENCY-14 Resiliency testing | **Defer to Operations** | Capture restore-from-backup scenario now; execute later. |
| RESILIENCY-15 Incident response | **Lightweight IR/COE** | Log error → restart to BLOCKED-safe state → manual review note; no on-call. |

## 3. Full RESILIENCY-01..15 Compliance
| Rule | Status | Basis |
|---|---|---|
| 01 Critical workload ID | Compliant | Single critical workload (FastAPI+SQLite); deps = OpenAI (opt), git remote. |
| 02 Availability/RTO/RPO | Compliant | R1=E Backup&Restore (NFR-S3). |
| 03 Change management | N/A (exempt) | User decision; rationale recorded. |
| 04 Automated deploy/rollback | Compliant (PoC) | No CI/CD (user), version-pinned rollback + direct deploy chosen. |
| 05 Monitoring/alerting | Partial → Ops | Local structured logs + health endpoint; full observability deferred (single-node). |
| 06 Health checks | Compliant | Shallow `/health` endpoint (NFR Design). |
| 07 Resiliency monitoring | N/A | Single-node PoC; no cloud posture tooling. |
| 08 Multi-zone/region | N/A | Single-region/single-node (user). |
| 09 Auto-scaling | N/A | Single process, no scaling. |
| 10 Dependency isolation | Compliant | Timeouts + graceful degradation to fixture (NFR-S6). |
| 11 DR strategy | Compliant | Backup & Restore. |
| 12 Backup/replication | Planned | Periodic SQLite backup; no cross-region replication (justified: PoC). |
| 13 Failover procedures | Deferred → Ops | Restore-from-backup runbook (NFR Design). |
| 14 Chaos/DR testing | Deferred → Ops | Restore scenario captured. |
| 15 Incident response | Compliant (lightweight) | Log → BLOCKED-safe → COE note. |

**No blocking resiliency findings** — every rule is compliant, planned, N/A, or explicitly deferred/exempt per user decisions.

## 4. Validation
Consistent with requirements.md NFR-1..9 and the resiliency baseline. Applies to all units; per-unit Functional Design/Code Generation reference this document rather than re-deriving NFRs.
