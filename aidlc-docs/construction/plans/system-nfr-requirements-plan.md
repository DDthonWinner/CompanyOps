# NFR Requirements Plan — SYSTEM (once, cross-cutting)

> Stage: CONSTRUCTION / NFR Requirements (Planning) · Scope: system-wide (Q5) · Date: 2026-09-08
> Referenced by every unit. Inputs: requirements.md NFR-1..9, application-design/*, U1 functional design, resiliency-baseline.md. Tech-agnostic NFR + tech-stack confirmation + the deferred resiliency decisions.

## Methodology & Approach
Consolidate cross-cutting NFRs once. Most are already fixed in requirements.md (NFR-1..9) and the `06` contract, so those are confirmed here. The **resiliency baseline (enabled Q10)** requires the user to decide RESILIENCY-03/04/08/14/15 during NFR — these are asked below. Recommended defaults (appropriate to the single-node PoC per R1=E) are pre-filled; **please review the resiliency ones especially** and override any `[Answer]:` you disagree with.

## General NFR Decisions (confirm)
### N1 — Scalability
**Recommended**: Single-user, single server process, one active write-Project at a time, sequential per-project writes; up to 16 assigned agents ≠ 16 concurrent. No horizontal scaling. (NFR-1, Master §4.1)
[Answer]: Single-node, sequential per-project writes (recommended)

### N2 — Performance
**Recommended**: Desktop-first 1920×1080; 3D CanvasTexture text throttled 5–10 fps; shadow map ≤ 2048²; SSE heartbeat 15s; API best-effort responsiveness (no hard latency SLA for the PoC). (NFR-6, Design §10)
[Answer]: 3D throttle + heartbeat as specified, best-effort API latency (recommended)

### N3 — Availability / RTO / RPO
**Recommended**: Single-node, Backup & Restore class (R1=E); periodic SQLite file/DB backup + documented restore; no cross-region DR. (NFR-7, RESILIENCY-02/11/12)
[Answer]: Single-node Backup&Restore, periodic SQLite backup (recommended)

### N4 — Security
**Recommended**: Security extension disabled (Q9=B); single-user, no auth/authorization in MVP; git credentials live in server env only and are never committed to `TestOutput`; `.env`/secrets git-ignored; OpenAI key from env. (NFR-8)
[Answer]: No auth (single-user); secrets in env, git-ignored (recommended)

### N5 — Tech stack (confirm)
**Recommended**: Backend Python 3.11+, FastAPI, SQLAlchemy, SQLite, `sse-starlette` (or equivalent) for SSE, `openai` SDK (optional, real mode); Frontend Vite + npm, React + TS, Tailwind, shadcn/ui, Zustand, React Three Fiber + Three.js; testing pytest (backend) + Vitest/RTL (frontend). (NFR-1, requirements §1.1)
[Answer]: Stack as above (recommended)

### N6 — Reliability
**Recommended**: Explicit timeouts on all external calls (OpenAI, git subprocess) + graceful degradation to fixture mode; restart recovery sets RUNNING tasks/runs → BLOCKED (no auto re-run/duplicate commit); idempotency (requestId) + optimistic concurrency (409). (NFR-7, RESILIENCY-10, `06` §5.2)
[Answer]: Timeouts + fixture fallback + restart-to-BLOCKED + idempotency (recommended)

### N7 — Maintainability / Testing
**Recommended**: Layered structure with unit tests per layer (business/API/repository, frontend components); PBT disabled (Q11=C); UI elements get stable `data-testid` (`{component}-{role}`). (NFR-9, code-generation automation rules)
[Answer]: Per-layer unit tests, PBT off, data-testid on UI (recommended)

### N8 — Usability / Accessibility
**Recommended**: Status conveyed with text/icon + color; modals support Escape/close/focus-return; Korean system-sans fallback; WebGL failure offers a route to Dashboard without losing selection. (NFR-3, Design §12, `05`)
[Answer]: Accessibility per Design §12 (recommended)

---

## Resiliency Baseline Decisions (RESILIENCY — you must decide; please review)
### R-03 — Change management (RESILIENCY-03)
Options: A) existing org process · B) propose lightweight (change record + approval + rollback note) · C) N/A exempt (document rationale).
**Recommended**: **C — exempt**; rationale: single-developer hackathon PoC, no production change board. (B available if you want a lightweight process.)
[Answer]: C — exempt (hackathon PoC) (recommended)

### R-04a — CI/CD tooling (RESILIENCY-04)
Options: A) existing pipeline · B) propose a pipeline.
**Recommended**: **B — propose a minimal GitHub Actions workflow** (install + run tests) as an optional, non-blocking artifact; local run remains the primary path for the PoC.
[Answer]: Only local deployment planned, no CI/CD workflow

### R-04b — Rollback mechanism (RESILIENCY-04)
Options: A) version-pinned redeploy · B) blue/green · C) canary · D) DB-aware · E) existing.
**Recommended**: **A — redeploy previous version** (git revert / previous build); simplest for single-node.
[Answer]: A — version-pinned redeploy (recommended)

### R-04c — Deployment style (RESILIENCY-04)
Options: A) direct/in-place · B) rolling · C) blue/green · D) canary.
**Recommended**: **A — direct/in-place**; acceptable for a non-critical single-node PoC.
[Answer]: A — direct/in-place (recommended)

### R-08 — Regional topology (RESILIENCY-08)
Options: A) single-region multi-zone · B) multi-region active-passive · C) multi-region active-active.
**Recommended**: **A — single-region (single-node for this PoC)**; consistent with R1=E. No multi-zone/region.
[Answer]: A — single-region/single-node (recommended)

### R-14 — Resiliency testing approach (RESILIENCY-14)
Options: A) existing practice · B) propose DR/chaos plan · C) defer to Operations (capture scenarios now).
**Recommended**: **C — defer to Operations**; capture a restore-from-backup test scenario now, execute later.
[Answer]: C — defer to Operations, capture restore scenario (recommended)

### R-15 — Incident response (RESILIENCY-15)
Options: A) existing IR process · B) propose lightweight IR + Correction-of-Errors.
**Recommended**: **B — propose lightweight**: log the error, restart to BLOCKED-safe state, manual review note; no on-call for a PoC.
[Answer]: B — propose lightweight IR/COE (recommended)

## Mandatory NFR Requirements Artifacts (generation checklist)
- [ ] `construction/system/nfr-requirements/nfr-requirements.md` — consolidated NFRs (N1–N8) + resiliency decisions (R-03/04/08/14/15) + full RESILIENCY-01..15 compliance table
- [ ] `construction/system/nfr-requirements/tech-stack-decisions.md` — confirmed stack + rationale + key libraries/versions
- [ ] Validate against requirements.md NFR-1..9 and resiliency baseline

## Approval
Approve this plan (defaults above — especially confirm the resiliency R-* decisions) to generate the system NFR requirements artifacts, or edit any `[Answer]:` and tell me.
