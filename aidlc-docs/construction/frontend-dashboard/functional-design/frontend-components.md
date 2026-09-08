# U5 frontend-dashboard — Frontend Components

> Stage: CONSTRUCTION / Functional Design · Unit: frontend-dashboard · Date: 2026-09-08
> Component tree (04 §24), props/state, interactions, API integration. Builds on U4 shared foundation.

## Component tree (replaces U4 DashboardPlaceholder)
```
DashboardView                          (rendered when ui.activeTab==='dashboard')
├── DashboardHeaderStrip               (stage, task-count progress, running/waiting counts)
├── ProjectSetupBar                    (when no active project or status DRAFT/AGENT_MATCHING)
│   ├── ProjectCreateDialog            (PM-1)
│   └── AgentMatchingPanel             (PM-3/4: recommend → edit → assign)
├── layout: [ center | right ]
│   ├── center
│   │   ├── DevelopmentFlow / AgentOverview   (PM→FE/BE→QA; AgentCard list)
│   │   ├── ActiveTaskList              (columns by exec status; text+icon)
│   │   ├── PlanReviewPanel             (PlanVersion, FeedbackHistory, ImpactPreview, FinalExecutionApproval)
│   │   ├── QARunReport + QualityGate
│   │   ├── ActivityTimeline
│   │   └── RecentArtifacts
│   └── right: AttentionCenter
│       ├── DecisionCard
│       ├── PlanApprovalCard
│       ├── MilestoneResultApprovalCard
│       └── QAReviewCard
├── CommandInput                        (bottom; send instruction → plan)
└── FeedbackSection                     (UF: metrics/score/comments/comparison)
```
Narrow screens: AttentionCenter renders first (Design §12).

## Key components — props/state & API
| Component | Reads (store snapshot) | Writes (ApiClient) |
|---|---|---|
| ProjectCreateDialog | — | `createProject` |
| AgentMatchingPanel | project, roles, profiles | `recommendAgents`, `assignAgents` (+ `listAgentProfiles`/`listLlmModels`) |
| ProjectProgress/HeaderStrip | project (progress, counts) | — |
| AgentOverview / AgentCard | agents, tasks | — |
| ActiveTaskList | tasks (+ waitReasons) | — |
| PlanReviewPanel | plans | `postCommand` (via CommandInput), `planFeedback`, `planReviewComplete`, `planApprove` |
| CommandInput | activeProjectId | `postCommand` |
| DecisionCard | pendingDecisions | `resolveDecision` |
| MilestoneResultApprovalCard | milestones (+ result) | `getMilestoneResult`, `reviewMilestoneResult` |
| QARunReport / QualityGate | qaRuns | `getQaRun` |
| ActivityTimeline | — | `getActivity` |
| RecentArtifacts | tasks | `getTaskArtifacts` |
| FeedbackSection | project.status | `getUtilization`, `getFeedbacks`, `createFeedback`/`updateFeedback` |

## Interactions (04 §19/§9)
- CommandInput.send → create plan → PlanReviewPanel shows v1 (REVIEW).
- PlanReviewPanel: **Request Changes** (feedback+expectedVersion) → new version; **Review Complete** → FINAL_APPROVAL_PENDING; **Final Execution Approval** (expectedVersion) → execute. Distinct buttons; explanations shown; no auto-execute.
- MilestoneResultApprovalCard: **Approve** (reviewStatus=APPROVED, additionalValidation=NONE, expectedResultVersion) or **Request Revision**; disabled if technical gate FAILED.
- DecisionCard: select option / custom → resolve.
- On any 409 → toast "최신 상태로 갱신되었습니다" + snapshot already re-read via SSE.

## data-testid conventions
`dash-view`, `dash-progress`, `attention-center`, `plan-review-panel`, `plan-approve-btn`, `plan-feedback-btn`, `command-input`, `command-send`, `milestone-approve-{id}`, `decision-resolve-{id}`, `project-create-open`, `agent-matching-assign`, `feedback-section`.
