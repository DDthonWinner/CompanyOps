# U4 frontend-tycoon — Frontend Components

> Stage: CONSTRUCTION / Functional Design · Unit: frontend-tycoon · Date: 2026-09-08
> Component hierarchy, props/state, interactions, API integration. Grounds Design §4 + `05`. Shared foundation (owned by U4) marked ★.

## Component tree
```
★ AppShell
  ├── ★ GlobalExecutiveBar        (brand + project picker + Tycoon/Dashboard tabs + connection status + plan-review btn)
  └── ActiveView
      └── TycoonView              (this unit)
          ├── TycoonCanvas        (R3F <Canvas>, Orthographic iso)
          │   ├── Lighting        (ambient + 1 directional + 1 fill)
          │   ├── FloorGrid
          │   ├── DomainDesk[]     (per role: mat color, trim, CanvasTexture monitor)
          │   ├── DevPawn[]        (per assigned agent: bobbing, floating status orb)
          │   └── InOutTrays[]     (inbox #2563eb / outbox #059669)
          └── HUDOverlay          (HTML, glass)
              ├── SideHUD          (project summary, dept/agent nav, assigned/cap, budget)
              ├── VelocityPod      (role milestones + progress + review status; expand → tasks)
              ├── CommandDock      (dept camera jumps + Reset View)
              ├── AgentSheet       (modal; agent detail)
              └── DeskSheet        (modal; desk queue: inbox/outbox/tasks)
  └── WebGLFallback               (if WebGL unavailable → message + link to Dashboard)
```

## Shared foundation (★) — props/state
- **AppShell**: no props; mounts GlobalExecutiveBar; renders `ui.activeTab` view; hosts the `tycoon-item-selected` listener that opens AgentSheet/DeskSheet.
- **GlobalExecutiveBar**: props `{ activeTab, onTabChange }`; reads store `activeProjectId`, `snapshot.project`, `connection`; project dropdown from `GET /api/projects`; "계획 검토" button routes to Dashboard plan panel (U5). Always shows connection status + last-sync.
- **SnapshotStore** (Zustand): see `domain-entities.md`. Actions: `setActiveProject(id)`, `applySnapshot(snap)`, `setConnection(state)`, `setActiveTab`, `setCamera`, selectors `agents/tasks/milestones/attention`.
- **ApiClient**: `getProjects()`, `getSnapshot(pid)`, plus command methods (used by U5) — see U1 contract.
- **SseClient**: `connect(pid)`, `disconnect()`, emits connection-state changes; triggers `getSnapshot` on connect + higher revision.

## Tycoon components — props/state & interactions
| Component | Key props | Interaction |
|---|---|---|
| TycoonCanvas | `agents, milestones` (from store) | sets up camera/raycaster; renders desks/pawns/trays |
| DomainDesk | `roleCode, color, progress, agentsInRole` | click → dispatch `{type:'desk', roleCode}`; monitor shows role milestone % via CanvasTexture (throttled) |
| DevPawn | `agent` | bobbing sine; status orb by execution state; click → dispatch `{type:'agent', projectAgentId}` |
| InOutTrays | `roleCode, inboxCount, outboxCount` | click → `{type:'inbox'|'outbox', roleCode}` |
| SideHUD | `project, agents` | dept/agent nav → camera jump / open sheet |
| VelocityPod | `milestones` | expand → task list (from snapshot); shows `completed/total`, server percent, reviewStatus |
| CommandDock | `roles` | camera move/zoom to dept; Reset View |
| AgentSheet | `projectAgentId` | shows name/model/role/current+next task/status/wait/gen-status/milestone review; Escape/close/focus-return |
| DeskSheet | `roleCode` | role milestone progress, agent count, tasks; Inbox=TODO/WAITING, Outbox=COMPLETED, REVIEW separate |

## API integration points
- `GET /api/projects` (project picker), `GET /api/projects/{id}/snapshot` (all rendered state), `GET /api/projects/{id}/events` (SSE). U4 is **read-only** against the backend; command endpoints are exercised by U5.

## data-testid conventions
`gebar-project-select`, `gebar-tab-tycoon`, `gebar-tab-dashboard`, `gebar-connection`, `tycoon-canvas`, `desk-{roleCode}`, `pawn-{projectAgentId}`, `agent-sheet`, `desk-sheet`, `velocitypod-milestone-{id}`.
