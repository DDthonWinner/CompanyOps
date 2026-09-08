# U4 frontend-tycoon — Client State Shapes

> Stage: CONSTRUCTION / Functional Design · Unit: frontend-tycoon · Date: 2026-09-08
> TypeScript types mirroring the U1 snapshot (06 §4.2). No DB — client state only.

## Snapshot types (from `GET /snapshot`)
```ts
type ExecStatus = "TODO"|"RUNNING"|"WAITING"|"BLOCKED"|"REVIEW"|"COMPLETED"|"FAILED"|"CANCELLED";

interface ProjectSummary {
  id: string; name: string; status: string; budgetLevel: "HIGH"|"MEDIUM"|"LOW";
  budgetAmount: number; maxAgentCount: number; assignedAgentCount: number;
  workingAgentCount: number; hasPrimaryPm: boolean; progressPercent: number;
  progressCurrent: number; progressTotal: number; emptyLabel: string|null;
  activePlanId: string|null; completedAt: string|null;
}
interface Agent { id: string; roleId: string; displayName: string; displayColor: string;
  iconKey: string; status: string; isPrimaryPm: boolean; currentTaskId: string|null;
  nextTaskId: string|null; activitySummary: string|null; llmModelId: string; }
interface Task { id: string; sprintMilestoneId: string|null; assignedProjectAgentId: string|null;
  roleId: string|null; title: string; status: ExecStatus; executionMode: string|null;
  priority: string; waitReasons: string[]; dependencyTaskIds: string[]; }
interface Milestone { id: string; title: string; roleId: string|null; displayColor: string|null;
  status: string; progressCurrent: number; progressTotal: number; progressPercent: number;
  emptyLabel: string|null; resultVersion: number|null; reviewStatus: string|null; }
interface Snapshot { revision: number; project: ProjectSummary; agents: Agent[]; tasks: Task[];
  milestones: Milestone[]; plans: any[]; pendingDecisions: any[]; qaRuns: any[]; git: any[]; }
```

## Selection contract (06 §6)
```ts
type TycoonSelection = {
  projectId: string;
  type: "agent"|"desk"|"monitor"|"inbox"|"outbox";
  projectAgentId?: string;   // required when type==="agent"
  roleCode?: string;         // required otherwise
};
```

## Store shape (Zustand)
```ts
type ConnState = "CONNECTING"|"CONNECTED"|"RECONNECTING"|"DISCONNECTED"|"ERROR";
interface UiSlice { activeTab: "tycoon"|"dashboard"; camera: { target?: string }; }  // persisted
interface StoreState {
  activeProjectId: string|null;
  snapshot: Snapshot|null;
  lastSyncAt: string|null;
  connection: ConnState;
  ui: UiSlice;
  // actions
  setActiveProject(id: string): void;
  applySnapshot(s: Snapshot): void;    // only if s.revision > snapshot.revision
  setConnection(c: ConnState): void;
  setActiveTab(t): void; setCamera(c): void;
}
```

## Role → visual mapping (Design §5.2)
```ts
const ROLE_COLOR = { FRONTEND:"#4f46e5", BACKEND:"#059669", DATABASE:"#d97706",
  QA:"#0284c7", DEVOPS:"#0284c7", PM:"#e11d48", DESIGN:"#4f46e5" };
const INBOX="#2563eb", OUTBOX="#059669";
```

## Persistence
Only `ui` (activeTab, camera) → Local Storage. All business state comes from the server snapshot; the browser never authors work state (06 §1).
