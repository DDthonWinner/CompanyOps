# Code Generation Plan — U4 `frontend-tycoon`

> Stage: CONSTRUCTION / Code Generation (Planning) · Unit: frontend-tycoon · Date: 2026-09-08
> Single source of truth for U4 code. Code location: `frontend/` (workspace root). Doc summary: `aidlc-docs/construction/frontend-tycoon/code/`.

## Unit Context
- **Stories**: TY-1..3, RT-1..2, shell-hosted PM-2 project select. Builds the **shared frontend foundation** consumed by U5.
- **Design**: `construction/frontend-tycoon/functional-design/*`, `Design.md`, `05`, `06` §5/§6.
- **Backend**: read-only against U1 (`GET /api/projects`, `/snapshot`, `/events`). Base URL `VITE_API_BASE` (default `http://127.0.0.1:8000`).
- **Tech**: Vite + React 18 + TypeScript + Tailwind + shadcn-style primitives + Zustand + React Three Fiber/Three.js; tests Vitest + React Testing Library.

## Generation Steps (numbered)
- [x] **Step 1 — Scaffold** — `frontend/package.json`, `tsconfig*.json`, `vite.config.ts`, `index.html`, `.env.example` (`VITE_API_BASE`), `postcss.config.js`, `tailwind.config.js`, `src/main.tsx`, `src/index.css` (design tokens as CSS vars + fonts + glass utilities), `src/vite-env.d.ts`.
- [x] **Step 2 — Types + API/SSE clients** — `src/api/types.ts` (Snapshot/Agent/Task/Milestone/TycoonSelection), `src/api/client.ts` (fetch + requestId + error envelope), `src/api/sse.ts` (EventSource + connection states + backoff + snapshot re-read hook).
- [x] **Step 3 — Store** — `src/store/useStore.ts` (Zustand: activeProjectId, snapshot, connection, ui slice persisted to localStorage; `applySnapshot` revision guard; selectors).
- [x] **Step 4 — Shared UI primitives** — `src/components/ui/{Button,Badge,GlassPanel,Sheet,StatusPill}.tsx` (shadcn-flavored, tokenized), `src/lib/roles.ts` (color/icon maps).
- [x] **Step 5 — App shell** — `src/app/AppShell.tsx` (mounts GEBar; renders active tab; hosts `tycoon-item-selected` listener → opens sheets), `src/app/GlobalExecutiveBar.tsx` (brand, project picker from `/api/projects`, Tycoon/Dashboard tabs, connection status + last-sync, plan-review button placeholder), `src/app/useConnection.ts` (wire SseClient→store).
- [x] **Step 6 — Tycoon scene (R3F)** — `src/features/tycoon/TycoonView.tsx`, `TycoonCanvas.tsx` (Ortho iso camera, lighting), `scene/{FloorGrid,DomainDesk,DevPawn,InOutTrays,Monitor}.tsx` (CanvasTexture throttled), `useRaycastSelection.ts` (dispatch CustomEvent), `WebGLFallback.tsx`.
- [x] **Step 7 — HUD** — `src/features/tycoon/hud/{SideHUD,VelocityPod,CommandDock,AgentSheet,DeskSheet}.tsx`.
- [x] **Step 8 — Tests (Vitest + RTL)** — `src/**/__tests__/`: store `applySnapshot` revision guard; SseClient backoff/state transitions (mocked EventSource); GlobalExecutiveBar renders project/connection; VelocityPod renders milestone progress/reviewStatus; selection listener opens the right sheet. (3D canvas logic kept thin/pure; not rendered in jsdom.)
- [x] **Step 9 — Build config + docs** — ensure `npm run build` (tsc + vite build) and `npm run test` (vitest) work; `README` notes; `aidlc-docs/construction/frontend-tycoon/code/code-summary.md`.

## Story traceability
| Step | Stories |
|---|---|
| 1–5 | RT-1/2, PM-2 (shell + store + clients + GEBar) |
| 6–7 | TY-1, TY-2, TY-3 |
| 8 | RT-1/2, TY-2/3 (logic-level) |

## Notes
- Backend must be running for live data; tests mock fetch/EventSource (no backend needed).
- 3D is low-poly (boxes/cylinders/spheres) per `05`; correctness over fidelity for the PoC.
- No project creation / plan actions here (U5).
- Tests + `npm run build` are executed in the U4 Build & Test stage.

## Approval
Approve to generate U4 code (Steps 1–9).
