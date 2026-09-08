# U4 frontend-tycoon — Client Rules

> Stage: CONSTRUCTION / Functional Design · Unit: frontend-tycoon · Date: 2026-09-08
> Client-side rules (Design §12, `05`, `06` §5/§6). IDs prefixed FR-TY-.

## State & sync
- FR-TY-1: Business state is read-only from the server snapshot; the browser never authors work state. Only `ui` (tab, camera) persists to Local Storage.
- FR-TY-2: `applySnapshot` applies only if `revision` is newer; stale/duplicate revisions ignored.
- FR-TY-3: Connection status + last-sync time are always visible; while DISCONNECTED, no action is shown as succeeded.
- FR-TY-4: Reconnect backoff 1/2/5/10s (cap 10s); full snapshot re-read after (re)connect; 45s silence ⇒ RECONNECTING/DISCONNECTED.

## Rendering & status
- FR-TY-5: Status is conveyed with **text/icon + color**, never color alone (a11y). Role color vs agent custom color distinguished; desks use role color, pawns use agent color.
- FR-TY-6: `WORKING` animation only for a task actually RUNNING; WAITING/REVIEW are not animated as working (Design §12).
- FR-TY-7: Numeric values use tabular figures (JetBrains Mono); uncollected values render "미수집" (never 0).
- FR-TY-8: Progress/percentages are taken from the server snapshot as-is (no client recomputation/weighting).
- FR-TY-9: CanvasTexture monitor updates throttled to 5–10 fps; shadow map ≤ 2048².

## Selection & modals (06 §6)
- FR-TY-10: Scene selection uses the `tycoon-item-selected` CustomEvent only; `agent` requires `projectAgentId`, others require `roleCode`.
- FR-TY-11: Modals support Escape, explicit close, and focus return; scrim click closes.
- FR-TY-12: DeskSheet: Inbox = TODO/WAITING tasks, Outbox = COMPLETED, REVIEW shown separately; no separate message-queue entity.

## Shell & navigation
- FR-TY-13: `GlobalExecutiveBar` is mounted once in AppShell and shared with the Dashboard (U5); no view builds its own top bar. Two tabs only (Tycoon Office / Dashboard); no third tab.
- FR-TY-14: Selected tab persists as a UI-only setting; it never overwrites server state.
- FR-TY-15: Project creation and PM management are **not** in U4 (U5 owns them); U4 provides a read-only picker + empty states.

## Resilience
- FR-TY-16: WebGL unavailable/init failure ⇒ show a fallback with a route to the Dashboard; decorative effects may be reduced but functional state/selection is preserved.
- FR-TY-17: Web-font load failure must not block operation (Korean system-sans fallback).

## Config
- FR-TY-18: API base URL from `VITE_API_BASE` (default `http://127.0.0.1:8000`). No secrets in the frontend.
