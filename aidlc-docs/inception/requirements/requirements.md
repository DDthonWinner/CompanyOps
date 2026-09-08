# CompanyOps — Requirements (AI-DLC Requirements Analysis)

> Status: Draft for approval · Stage: INCEPTION / Requirements Analysis · Date: 2026-09-08
> Sources: `requirements/00-master-requirements.md` … `06-integration-contract.md`, `Design.md`, plus build-time answers (`requirement-verification-questions.md`) and resiliency answer (`resiliency-clarification-questions.md`).
> This document synthesizes the authoritative source requirements into the AI-DLC requirements baseline. Where the source docs fix a decision (data model, state machine, API contract, SSE, design system), it is treated as binding and referenced rather than re-derived.

---

## 1. Intent Summary

CompanyOps is a **tycoon-style operations app** in which a single human operator creates software **Projects**, assigns a team of **AI agents** to them, drives a **plan → approve → execute → review** loop for development work, and reviews an **AI-utilization score and feedback** when a project completes. The experience is presented through two views that share one product shell: a **Tycoon Office** (2.5D isometric 3D office) and a **Dashboard** (Human–AI control center). A server-side **orchestrator** connects requests, plans, task execution, technical QA, and Git publishing.

- **Request type**: New project (greenfield).
- **Scope**: Cross-system — React/TypeScript frontend + Python FastAPI backend + local SQLite + server-side task worker + SSE + Git integration + optional LLM adapter.
- **Complexity**: Complex (multi-module, stateful, real-time, plan-gated execution).
- **AI-DLC is the build methodology**, not a runtime dependency: the app does not embed the AI-DLC engine.

### 1.1 Build-time decisions (from clarification answers)
| # | Decision | Chosen |
|---|---|---|
| Q1 | LLM connection mode | Both behind a config flag; **default = demo/fixture** ("데모 데이터 / AI 서버 미연결") |
| Q2 | Real-LLM provider | **OpenAI GPT** adapter (used only when real mode is switched on) |
| Q3 | GitHub publish | **Real remote push** to `https://github.com/DDthonWinner/TestOutput`, branch `project/{projectId}` |
| Q4 | Scope order | **Priority-1 connected flow first**, then fold in Priority-2 as time allows |
| Q5 | Repository layout | **Monorepo**: `backend/` + `frontend/` at repo root with top-level dev scripts/README |
| Q6 | Frontend tooling | **Vite + npm** (React + TS + Tailwind + shadcn/ui + Zustand + React Three Fiber/Three.js) |
| Q7 | Backend tooling | **Python 3.11+**, venv + `requirements.txt`, SQLite via **SQLAlchemy** |
| Q8 | Real-time transport | **SSE exactly per the integration contract** (heartbeat 15s, disconnect 45s, backoff 1/2/5/10s, snapshot recovery) |
| R1 | RTO/RPO + DR (RESILIENCY-02) | **E — single-node/single-region**; local durability (SQLite file + periodic backup); no cross-region DR |

### 1.2 Extension configuration
- **Security extension**: DISABLED (Q9=B). No SECURITY rules enforced.
- **Resiliency baseline**: ENABLED (Q10=A) as directional design-time guidance. RTO/RPO target = Backup & Restore–class, single-node (R1=E).
- **Property-Based Testing**: DISABLED (Q11=C).

---

## 2. Product Architecture (binding constraints)

- **Single shared `GlobalExecutiveBar`** mounted once at `AppShell` top; two tabs — **Tycoon Office** (3D) and **Dashboard**. No third top-level tab. AI-utilization **Feedback is a Dashboard section**, not a tab. (Design §4.1)
- **Five feature modules**: **PM** (projects, agent profiles, project-agents, tasks, milestones), **UF** (AI-utilization feedback), **GIT** (GitHub interface), **DASH** (dashboard), **TY** (tycoon view). A **common orchestrator** is a backend responsibility, not a sixth feature.
- **Data ownership**: PM owns Project/ProjectTask/SprintMilestone/ProjectAgent/AgentProfile. UF owns UtilizationReport/UtilizationMetric/Feedback and references PM IDs read-only.
- **UI persistence**: Local Storage stores UI-only settings (selected tab, camera); all work data lives in server SQLite.

---

## 3. Functional Requirements

### 3.1 Project & Agent Management (PM)
- **FR-PM-1** Create/list/select Projects; a project carries name, scale/stage badge, and a budget level (HIGH $250,000/cap 16, MEDIUM $180,000/cap 12, LOW $120,000/cap 8 — display-only, not real spend).
- **FR-PM-2** Maintain reusable **Agent Profiles**; **assign** existing profiles to the current project ("Hire AI Agent" = assign profile to project) up to the budget cap.
- **FR-PM-3** Recommend a team composition for a project per the recommendation rules in `01`.
- **FR-PM-4** Create **SprintMilestones** per role and **ProjectTasks**; expose task lists and milestone completion as `completed / total (non-cancelled)`.
- **FR-PM-5** Profile edit/replace is **Priority-2** (fold in after the connected flow).
- **FR-PM-6** APIs per `01` (`/api/projects`, `/api/projects/{id}`, `/api/projects/{id}/tasks`, agent/profile/milestone endpoints).

### 3.2 Orchestration & Plan-first Execution (orchestrator + DASH)
- **FR-ORCH-1** Every execution follows **Request → Plan(v1) → Feedback ↔ Revised Plan → review-complete → Final Execution Approval → Execute → Review**. (Master §5, Dashboard §19)
- **FR-ORCH-2** Idempotency via `requestId`; concurrency via `expectedVersion`/`expectedRevision`, returning **409** on mismatch.
- **FR-ORCH-3** A Task reaches **COMPLETED** only when: approved Plan version + technical QA passed + Git publish success + `executionMode` recorded. Human approval applies to **Milestone-result versions**, not individual tasks.
- **FR-ORCH-4** Multi-axis state kept separate (never merged): execution (TODO/RUNNING/WAITING/BLOCKED/REVIEW/COMPLETED/FAILED/CANCELLED), artifact-generation (GENERATING/GENERATED/FAILED), milestone-result review (PENDING/APPROVED/REVISION_REQUESTED/REJECTED), plan (REVIEW/FINAL_APPROVAL_PENDING/APPROVED_WAITING/EXECUTING), QA run, connection.
- **FR-ORCH-5** Progress = `round(100 × COMPLETED / non-CANCELLED tasks)`; empty ⇒ 0% / "작업 없음"; no weighting.
- **FR-ORCH-6** Commands/plans/decisions HTTP surface per contract §4 (`/snapshot`, `/events`, `/commands`, `/plans`, `/decisions`, `/tasks/{id}/publish`).
- **FR-ORCH-7** **LLM adapter**: default **demo/fixture** mode (deterministic seeded data; screens show "AI 서버 미연결 / 데모 데이터"); a **real OpenAI-GPT adapter** is selectable via env var/flag. `executionMode` is recorded per task.

### 3.3 AI-Utilization Feedback (UF)
- **FR-UF-1** During a project, collect/accumulate utilization source data (tokens, task/decision/approval counts).
- **FR-UF-2** On project completion (QA + all stages done), aggregate a **UtilizationReport**, compute an AI-utilization **Score** (`UF_MVP_V1`; aspects Autonomy / Resource Efficiency / Area Distribution; uncollected aspect excluded and re-normalized; N/A if none; integer-rounded display).
- **FR-UF-3** Record **Feedback** comments (aspect/severity/observation/impact/suggestion). Feedback is **post-completion only**; no rework loop, no task assignment.
- **FR-UF-4** Compare current vs previous project reports; flag comparison limits when scope differs.
- **FR-UF-5** APIs: `/api/utilization*` and `/api/feedbacks` only (per `02`).

### 3.4 GitHub Interface (GIT)
- **FR-GIT-1** Python `GitInterface` using subprocess `git` with path-safety guards; fixed remote `https://github.com/DDthonWinner/TestOutput`.
- **FR-GIT-2** Per-project checkout to branch `project/{projectId}` with a per-project **write-lock**.
- **FR-GIT-3** **Idempotent publish** with states COMMITTED_LOCAL / PUSHED / SYNC_REQUIRED; **real remote push** enabled (Q3=A). No force-push, no auto-merge.
- **FR-GIT-4** Publish success is a precondition for Task COMPLETED (FR-ORCH-3).

### 3.5 Dashboard (DASH)
- **FR-DASH-1** Human–AI Control Center with an **Attention Center** surfacing items needing human action (plan review, final approval, milestone-result review).
- **FR-DASH-2** Plan-first review UI (§19): view plan versions, request changes, give final execution approval; never bypass execution/approval via drag.
- **FR-DASH-3** Task columns/status, QA results, Activity summary; component tree per `04` §24.
- **FR-DASH-4** Priority-2: dnd-kit scheduling, Recharts trend charts, Decisions surface, UF report/score/comments, SSE reconnect recovery UX.

### 3.6 Tycoon View (TY)
- **FR-TY-1** R3F/Three.js fixed **isometric 2.5D** office (Orthographic camera, azimuth 45°, elevation 35.264°); domain desks (FE/BE/DB/QA/PM), dev pawns, inbox/outbox, status monitors.
- **FR-TY-2** Glassmorphism HUD in 4 anchored regions (Side/Velocity/Command/Modals) per Design §4.
- **FR-TY-3** Raycaster selection dispatches the `tycoon-item-selected` CustomEvent → React opens the matching Agent/Desk sheet.
- **FR-TY-4** WORKING animation shown only for real Task execution; WebGL failure offers a route to the Dashboard.

### 3.7 Real-time sync (contract §5)
- **FR-RT-1** SSE snapshot-invalidation model: heartbeat 15s, disconnect after 45s, reconnect backoff 1/2/5/10s, re-read snapshot on revision events; state path SSE/snapshot → Zustand → React/Three.js.

---

## 4. Non-Functional Requirements

- **NFR-1 (Platform/tooling)** Monorepo `backend/` (FastAPI, Python 3.11+, venv + requirements.txt, SQLAlchemy/SQLite) + `frontend/` (Vite + npm, React+TS+Tailwind+shadcn/ui+Zustand+R3F). Top-level dev scripts + README.
- **NFR-2 (Data conventions)** DB fields snake_case; JSON camelCase; enums UPPER_SNAKE_CASE; UUIDs as TEXT; enums via CHECK; booleans as INTEGER 0/1; datetimes ISO 8601 UTC.
- **NFR-3 (Design system)** Design tokens/colors, fonts (Space Grotesk / Inter / JetBrains Mono), 5-level glassmorphism, discipline accent colors, 1920×1080 desktop-first, Korean sans fallback, accessibility (color+text/icon, modal Escape/close/focus-return).
- **NFR-4 (Real-time)** SSE exactly as contract §5 (see FR-RT-1).
- **NFR-5 (Consistency/concurrency)** Idempotent commands (`requestId`), optimistic concurrency (`expectedVersion`/`expectedRevision` → 409), no merged status axes.
- **NFR-6 (Performance)** Throttle 3D CanvasTexture text to ~5–10 fps; shadow map ≤ 2048².
- **NFR-7 (Resiliency — directional, single-node)** RTO/RPO = Backup & Restore class, single-node/single-region (R1=E). SQLite is the single stateful store; provide periodic file/DB backup and documented restore. External calls (LLM, git subprocess) MUST have explicit timeouts and graceful degradation to demo/fixture mode. A shallow health endpoint SHOULD be exposed. Per baseline, deployment/CI-CD/rollback/incident-response/DR-testing decisions are **deferred to NFR Design**.
- **NFR-8 (Security)** Extension disabled (Q9=B). No formal SECURITY rule enforcement. Note: real git push requires server-side credentials — keep them out of source control and out of the repo published to `TestOutput`.
- **NFR-9 (Testing)** Standard build-and-test per code-generation stage; property-based testing disabled (Q11=C).

---

## 5. Acceptance Criteria (traceability)

Binding acceptance criteria are defined in the source docs and carried forward:
- **Master**: MASTER-AC-001…012 (product scope, orchestration, invariants, final demo shows a real GitHub push).
- **PM**: `01` acceptance criteria.
- **UF**: AC-001…007 (`02` §10).
- **DASH**: `04` §26.
- **Design**: `Design.md` §11 completion conditions.

Priority for first end-to-end target (Q4=C): **P1 connected flow** — seed/recommend/assign team → two tabs → plan→approve→one small Milestone → Task exec → QA → real commit/push → milestone-result approval; then fold in P2 (profile edit/replace, Decisions, UF report/score/comment, SSE reconnect recovery).

---

## 6. Resiliency Compliance Summary (baseline)

| Rule | Status | Note |
|---|---|---|
| RESILIENCY-01 Critical workload ID | Compliant | Single critical workload = FastAPI+SQLite app; dependencies = OpenAI (optional), git remote. |
| RESILIENCY-02 Availability/recovery targets | Compliant | R1=E: single-node Backup&Restore class; documented in NFR-7. |
| RESILIENCY-03 Change management | Deferred | To NFR Design (baseline allows). |
| RESILIENCY-04 Automated deploy/rollback | Deferred | To NFR Design. |
| RESILIENCY-05 Monitoring/alerting | Deferred | To NFR Design; single-node PoC. |
| RESILIENCY-06 Health checks | Partial/planned | Shallow health endpoint planned (NFR-7). |
| RESILIENCY-07 Resiliency monitoring | N/A | Single-node PoC, no cloud posture tooling. |
| RESILIENCY-08 Multi-zone/region | N/A | Single-node/single-region chosen (R1=E). |
| RESILIENCY-09 Auto-scaling | N/A | Single process; no horizontal scaling. |
| RESILIENCY-10 Dependency isolation | Compliant (design intent) | Timeouts + graceful degradation to fixture mode (NFR-7). |
| RESILIENCY-11 DR strategy | Compliant | Backup & Restore per R1=E. |
| RESILIENCY-12 Backup/replication | Planned | Periodic SQLite file/DB backup; no cross-region replication (justified: PoC). |
| RESILIENCY-13 Failover procedures | N/A/Deferred | Restore-from-backup runbook to NFR Design. |
| RESILIENCY-14 Chaos/DR testing | Deferred | To NFR Design. |
| RESILIENCY-15 Incident response | Deferred | To NFR Design. |

**No blocking resiliency findings remain** (RESILIENCY-02 resolved).
