# Units of Work — Story Map

> Stage: INCEPTION / Units Generation · Date: 2026-09-08
> Maps all **29** stories (see `stories.md`; header corrected from an earlier 24 miscount) to the 5 units. Each story has a **Primary** owning unit and, where it spans tiers, **Supporting** units. Every story is assigned.

## Story → Unit

| Story | Pri | Primary unit | Supporting | Notes |
|---|---|---|---|---|
| PM-1 Create project | P1 | U1 backend-pm | U5 (creation UI) | budget→amount/cap; empty progress 0% |
| PM-2 Browse/select projects | P1 | U1 backend-pm | U4 (shell project select) | select persists as UI-only |
| PM-3 Recommend team | P1 | U1 backend-pm | U5 (matching UI) | rule-based, PM required |
| PM-4 Assign agents | P1 | U1 backend-pm | U5 (matching UI), U4 (HUD count) | cap enforced |
| PM-5 Milestones/tasks | P1 | U1 backend-pm | U5 (task board), U4 (velocity pod) | derived progress |
| PM-6 Edit/replace profile | P2 | U1 backend-pm | U5 (profile UI) | no auto-propagate |
| ORCH-1 Plan v1 | P1 | U1 backend-pm | U5 (plan panel/command input) | requestId idempotent |
| ORCH-2 Plan feedback | P1 | U1 backend-pm | U5 | expectedRevision→409 |
| ORCH-3 Final approval | P1 | U1 backend-pm | U5 | expectedVersion→409 |
| ORCH-4 Execute to completion | P1 | U1 backend-pm | U2 (publish) | COMPLETED preconditions |
| ORCH-5 Connected flow (integration) | P1 | U1 backend-pm | U2, U4, U5 | end-to-end demo |
| ORCH-6 Milestone result review | P1 | U1 backend-pm | U5 (approval card) | result-version 409 |
| ORCH-7 Demo/real execution | P1 | U1 backend-pm | — | ExecutionProvider + env flag |
| ORCH-8 Decisions record | P2 | U1 backend-pm | U5 (decision UI), U3 (metric) | no rework loop |
| GIT-1 Publish real push | P1 | U2 backend-git | U1 (validate/coordinate) | project/{id} branch |
| GIT-2 Idempotent republish | P1 | U2 backend-git | U1 | write-lock, SYNC_REQUIRED |
| UF-1 Utilization report | P1* | U3 backend-uf | U1 (source data), U5 (view) | *P1 story but unit U3 built in P2 window |
| UF-2 Utilization score | P1* | U3 backend-uf | U5 (view) | UF_MVP_V1 |
| UF-3 Feedback comments | P2 | U3 backend-uf | U5 (view/edit) | post-completion only |
| UF-4 Previous comparison | P2 | U3 backend-uf | U5 (view) | flag scope diffs |
| DASH-1 Attention Center | P1 | U5 frontend-dashboard | U1 (data) | dedup by requestId |
| DASH-2 Plan review UI | P1 | U5 frontend-dashboard | U1 (data) | §19 flow, no drag bypass |
| DASH-3 Task board/QA/activity | P1 | U5 frontend-dashboard | U1 (data) | text+icon status |
| DASH-4 Charts/dnd | P2 | U5 frontend-dashboard | — | no gate bypass |
| TY-1 Isometric office | P1 | U4 frontend-tycoon | U1 (data) | WebGL-fail → Dashboard |
| TY-2 Selection sheets | P1 | U4 frontend-tycoon | U1 (data) | tycoon-item-selected |
| TY-3 HUD/milestone | P1 | U4 frontend-tycoon | U1 (data) | tabular figures, 미수집 |
| RT-1 SSE sync | P1 | U4 frontend-tycoon (foundation) | U1 (SSE/snapshot) | shared store/clients |
| RT-2 Reconnect recovery | P2 | U4 frontend-tycoon (foundation) | U1 | backoff, preserve UI slice |

\* UF-1/UF-2 are P1 stories, but their owning unit `backend-uf` is scheduled in the P2 build window (Q4) because it can only run after a project completes; the connected-flow demo (ORCH-5) does not require UF.

## Coverage check
- **U1 backend-pm**: PM-1..6, ORCH-1..8, RT-1/2 (backend side), ORCH-5 — primary for 15 stories.
- **U2 backend-git**: GIT-1, GIT-2 — primary for 2.
- **U3 backend-uf**: UF-1..4 — primary for 4.
- **U4 frontend-tycoon**: TY-1..3, RT-1, RT-2 — primary for 5.
- **U5 frontend-dashboard**: DASH-1..4 — primary for 4.
- Primary total: 15+2+4+5+4 = **29** ✅ (all stories assigned; PM-2 shell-select and PM management UIs are supporting contributions to U4/U5).

## Priority overlay
- **P1**: PM-1..5, ORCH-1..7, GIT-1..2, UF-1..2, DASH-1..3, TY-1..3, RT-1 (23).
- **P2**: PM-6, ORCH-8, UF-3..4, DASH-4, RT-2 (6).
