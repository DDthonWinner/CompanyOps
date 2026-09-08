# U4 frontend-tycoon — Code Generation Summary

> Stage: CONSTRUCTION / Code Generation · Unit: frontend-tycoon · Date: 2026-09-08
> Application code under `frontend/` (workspace root). Doc summary only.

## Created (scaffold + config)
- `frontend/package.json`, `tsconfig.json`, `vite.config.ts` (+ vitest), `index.html`, `.env.example`, `postcss.config.js`, `tailwind.config.js`
- `src/main.tsx`, `src/index.css` (Design §5 tokens + fonts + glass utilities), `src/vite-env.d.ts`, `src/test/setup.ts`

## Shared foundation (owned by U4; consumed by U5)
- `src/api/{types,client,sse}.ts` — snapshot/selection types; fetch client (requestId + error envelope); SseClient (connection states, watchdog, backoff 1/2/5/10s, snapshot re-read)
- `src/store/useStore.ts` — Zustand snapshot store (revision guard) + persisted UI slice + roles ref
- `src/components/ui/{GlassPanel,Button,StatusPill,Sheet}.tsx` — tokenized primitives (status = text+icon+color; modal Escape/focus-return)
- `src/lib/roles.ts` — role colors/labels/desks
- `src/app/{AppShell,GlobalExecutiveBar,useConnection,selection}.tsx/ts` — shared shell, single top bar (project picker/tabs/connection), SSE wiring, pure selection resolver

## Tycoon view
- `src/features/tycoon/{TycoonView,TycoonCanvas,WebGLFallback,selectionEvent}.tsx/ts`
- `src/features/tycoon/scene/{Lighting,FloorGrid,Monitor,DomainDesk,DevPawn}.tsx` — R3F Ortho isometric; CanvasTexture monitors (redraw on data change); pawns bob only when WORKING; raycast click → `tycoon-item-selected`
- `src/features/tycoon/hud/{SideHUD,VelocityPod,CommandDock,AgentSheet,DeskSheet}.tsx`

## Tests (Vitest + RTL) — 11 passed
- store revision guard + sheet open/close; `resolveSelection`; SseClient state transitions + backoff + higher-revision re-read; VelocityPod renders server progress + review pill; GlobalExecutiveBar renders tabs/connection/project picker (fetch mocked).

## Build & fixes
- `npm run test` → **11/11 pass**. `npm run build` (tsc --noEmit + vite build) → **success**.
- Fixes during generation: build script switched from `tsc -b` to `tsc --noEmit && vite build` (composite/noEmit conflict); removed unused `tsconfig.node.json`.
- Notes (non-blocking): three.js makes the JS bundle ~988 kB (code-splitting is a future optimization); `npm audit` reports dev-dependency advisories — out of scope (Security extension disabled, PoC).

## Story coverage
TY-1..3, RT-1..2, shell-hosted PM-2 project select. U4 is read-only vs the backend; project creation & plan actions are U5.
