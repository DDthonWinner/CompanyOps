# U5 frontend-dashboard — Client View-Model Types

> Stage: CONSTRUCTION / Functional Design · Unit: frontend-dashboard · Date: 2026-09-08
> Reuses U4 `api/types.ts` (Snapshot/Agent/Task/Milestone). Adds request/response shapes for write actions + UF. No DB.

## Reused (from U4)
`Snapshot`, `ProjectSummary`, `Agent`, `Task`, `Milestone`, `TycoonSelection`, `ErrorEnvelope`.

## Write request shapes (06 §4.2, 01 §5, 02 §9.2)
```ts
interface CreateProjectReq { name: string; description?: string; projectType?: string;
  budgetLevel: "HIGH"|"MEDIUM"|"LOW"; projectSize: "SMALL"|"MEDIUM"|"LARGE";
  maxAgentCount?: number; desiredAgentCount?: number;
  gitRepository?: { repositoryUrl?: string }; }

interface RecommendReq { desiredAgentCount?: number; requiredRoleCodes?: string[] }
interface AssignAgentReq { agentProfileId: string; roleCode: string; llmModelId?: string;
  displayName?: string; displayColor?: string; iconKey?: string; isPrimaryPm?: boolean }
interface AssignReq { agents: AssignAgentReq[] }

interface CommandReq { requestId: string; instruction: string; targetAgentIds?: string[];
  steps?: Array<{ title: string; roleCode?: string; milestoneTitle?: string; priority?: string }> }
interface VersionedReq { requestId: string; expectedVersion: number }
interface FeedbackReq extends VersionedReq { feedback: string }
interface ResolveDecisionReq { requestId: string; expectedRevision?: number; answer: string }
interface MilestoneReviewReq { requestId: string; expectedResultVersion: number;
  reviewStatus: "APPROVED"|"REVISION_REQUESTED"|"REJECTED"; additionalValidation: "NONE"|"REQUESTED"; feedback?: string }
```

## Plan / QA / MilestoneResult views (read)
```ts
interface PlanView { id: string; version: number;
  status: "REVIEW"|"FINAL_APPROVAL_PENDING"|"APPROVED_WAITING"|"EXECUTING"|"COMPLETED"|"SUPERSEDED";
  request?: string; steps?: Array<Record<string, unknown>> }
interface QaRunView { id: string; taskId: string; runStatus: string; technicalGate: string;
  results?: { total: number; passed: number; failed: number; skipped: number }; demo?: boolean }
interface MilestoneResultView { id: string; milestoneId: string; version: number;
  reviewStatus: string; additionalValidation: string; snapshot?: Record<string, unknown> }
```

## UF views (02 §7, 04 §30)
```ts
interface UtilizationReport { projectId: string; reportId: string; utilizationScore: number|null;
  scoreVersion: string; metrics: Record<string, number|string>; status: string; previousReportId?: string|null }
interface Feedback { feedbackId: string; reportId: string; aspect: string; severity: string;
  observation: string; impact: string; suggestion: string }
```

## Attention item (derived, dedup by requestId — 04 §7)
```ts
type AttentionKind = "DECISION"|"PLAN_APPROVAL"|"MILESTONE_RESULT"|"QA_REVIEW";
interface AttentionItem { kind: AttentionKind; id: string; title: string; detail?: string }
```
