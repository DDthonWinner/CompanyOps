# Functional Design Plan — U4 `frontend-tycoon`

> Stage: CONSTRUCTION / Functional Design (Planning) · Unit: frontend-tycoon · Date: 2026-09-08
> Scope: **shared frontend foundation** (AppShell, GlobalExecutiveBar, SnapshotStore, ApiClient, SseClient, tokens, shared UI — owned here per Q7=B) **+ Tycoon 2.5D view**. Stories TY-1..3, RT-1..2, + shell-hosted PM-2 project select.
> Inputs: `05`, `Design.md`, `06` §5/§6, system NFR. Consumes the U1 HTTP+SSE contract.

## Methodology & Approach
`Design.md` + `05` fix the visual system, scene spec, and selection contract; `06` fixes state sync. This stage defines the client component hierarchy, state shapes, data flow, and UI rules. Recommended defaults pre-filled — override any `[Answer]:`.

## Functional Design Decisions
### Q1 — Shared foundation shape
**Recommended**: `AppShell` mounts `GlobalExecutiveBar` once (product/project/tabs/connection) + renders the active tab view. `SnapshotStore` (Zustand) = `{ activeProjectId, snapshot, connection, ui:{activeTab,camera} }`; business state read-only from snapshot, `ui` persisted to Local Storage. `ApiClient` (fetch, attaches `requestId`, parses error envelope). `SseClient` (EventSource; states + backoff 1/2/5/10s; re-read snapshot on connect + higher revision).
[Answer]: Foundation as above (recommended)

### Q2 — Tycoon scene structure (R3F)
**Recommended**: `TycoonCanvas` (R3F `<Canvas>`, Orthographic camera azimuth 45°/elevation 35.264°, ambient+1 directional+1 fill), `FloorGrid`, `DomainDesk` per role (FE/BE/DB/PM + QA aux) with `CanvasTexture` monitor (throttled 5–10 fps), `DevPawn` per assigned agent (bobbing sine), `InOutTrays`. Raycaster click → 180ms bounce → `window.dispatchEvent('tycoon-item-selected', TycoonSelection)`.
[Answer]: R3F scene as above (recommended)

### Q3 — HUD overlay
**Recommended**: HTML overlay (Level 2/3 glass): `SideHUD` (project summary, dept/agent nav, assigned/cap, budget figure), `VelocityPod` (role milestones: title, completed/total, server percent, review status; expand → tasks), `CommandDock` (camera dept jumps + reset view), `AgentSheet` + `DeskSheet` modals (Escape/close/focus-return) opened from selection.
[Answer]: HUD regions as above (recommended)

### Q4 — Data flow & selection
**Recommended**: server → SSE(revision) → `ApiClient.getSnapshot` → `SnapshotStore.applySnapshot` (only if newer) → React/R3F render. Scene selection → CustomEvent → a listener in AppShell reads store by id and opens the matching sheet (agent→AgentSheet by projectAgentId; desk/monitor/inbox/outbox→DeskSheet by roleCode). CustomEvent is selection-only (never writes server state).
[Answer]: SSE→snapshot→store→render; CustomEvent selection-only (recommended)

### Q5 — Styling / tokens
**Recommended**: Tailwind config with Design §5 tokens as CSS vars; fonts Space Grotesk/Inter/JetBrains Mono; discipline accent colors (Indigo/Emerald/Amber/Rose/Sky); 5-level glassmorphism utilities; status shown with text/icon + color; `data-testid` on interactive elements; WebGL-init failure → banner + route to Dashboard.
[Answer]: Tailwind + Design tokens + a11y + WebGL fallback (recommended)

### Q6 — Project selection & config
**Recommended**: `GlobalExecutiveBar` project picker reads `GET /api/projects` (read-only); selecting sets `activeProjectId` (persisted). API base URL from `VITE_API_BASE` (default `http://127.0.0.1:8000`). Project **creation/PM management UIs are U5** (frontend-dashboard); U4 renders whatever the active project's snapshot contains and offers a "no project selected" empty state.
[Answer]: Read-only project picker + VITE_API_BASE; creation is U5 (recommended)

## Mandatory Functional Design Artifacts (generation checklist)
- [x] `construction/frontend-tycoon/functional-design/frontend-components.md` — component tree, props/state, interactions, API integration points
- [x] `construction/frontend-tycoon/functional-design/business-logic-model.md` — client data-flow (snapshot/SSE/selection), camera/throttle logic
- [x] `construction/frontend-tycoon/functional-design/business-rules.md` — client rules (revision guard, no optimistic-while-disconnected, a11y, WebGL fallback)
- [x] `construction/frontend-tycoon/functional-design/domain-entities.md` — client state shapes / TS types mirroring the snapshot
- [x] Validate against 05 + Design + 06 §5/§6

## Approval
Approve this plan (defaults) to generate U4 functional-design artifacts, or edit any `[Answer]:`.
