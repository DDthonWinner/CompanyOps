# U4 frontend-tycoon — Client Logic / Data Flow

> Stage: CONSTRUCTION / Functional Design · Unit: frontend-tycoon · Date: 2026-09-08
> Client-side flows (06 §5/§6, Design §9). No server business logic here.

## Startup / project selection
```
AppShell mount → ApiClient.getProjects() → GlobalExecutiveBar dropdown
user selects project → store.setActiveProject(id) (persist) → subscribe():
  SseClient.connect(id)                     # sets CONNECTING
  on open → CONNECTED → ApiClient.getSnapshot(id) → store.applySnapshot
```

## Realtime sync (RT-1/2, 06 §5)
```
SSE 'project.updated' {revision} arrives:
  if revision > store.snapshot.revision: getSnapshot(id) → applySnapshot
heartbeat: EventSource native; if no message/heartbeat 45s → onerror
onerror → RECONNECTING → backoff 1s,2s,5s,10s (cap 10s) → on reopen: CONNECTED + full getSnapshot
applySnapshot(s): ignore if s.revision <= current (stale/duplicate); else replace + lastSyncAt=now
connection status + lastSyncAt always visible in GlobalExecutiveBar
```

## Render path (server → store → React/R3F)
```
store.snapshot → selectors → HUD (SideHUD/VelocityPod) + Canvas (desks/pawns/trays)
DevPawn status orb ← agent.status; WORKING animation ONLY when a task is RUNNING (Design §12)
DomainDesk monitor ← milestone.progressPercent for the role (CanvasTexture updated ≤5–10 fps, throttled)
numbers use JetBrains Mono; uncollected → "미수집"
```

## Selection path (scene → DOM, 06 §6)
```
Raycaster hit on pawn/desk/monitor/tray → 180ms bounce scale →
  window.dispatchEvent(new CustomEvent('tycoon-item-selected', { detail: TycoonSelection }))
AppShell listener:
  detail.type==='agent' → open AgentSheet(detail.projectAgentId)
  else → open DeskSheet(detail.roleCode)
CustomEvent never writes server state; it only opens a sheet reading the current snapshot.
```

## Camera (CommandDock, 05 §3.2.3)
```
dept button → tween Orthographic camera to that desk's position/zoom; Reset View → center studio
scroll → zoom (clamped); window resize → update frustum + renderer size
```

## Empty / failure states
```
no active project → empty state ("프로젝트를 선택하세요")
project with no agents → empty desks; VelocityPod "작업 없음"
WebGL init fails → WebGLFallback banner + link to Dashboard (state/selection preserved)
disconnected → do not mark any action successful; show DISCONNECTED
```
