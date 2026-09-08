# CompanyOps — User Personas

> Stage: INCEPTION / User Stories · Date: 2026-09-08
> Source: `aidlc-docs/inception/requirements/requirements.md` + `requirements/00`–`06`.

CompanyOps is single-operator software. There is **one primary human persona** who authors and consumes all stories. AI Agents and the Orchestrator/Worker are **in-system actors** — they appear in stories as the "who does the work," but they are not story authors and have no independent goals of their own beyond executing the operator's approved plans.

---

## P1 — Operator (Primary, Human)

- **Role**: The human running CompanyOps — creates projects, staffs them with AI agents, drives the plan→approve→execute→review loop, and reviews AI-utilization outcomes.
- **Goals**:
  - Stand up a project and get a sensible AI team assigned quickly.
  - Stay in control: nothing executes without an approved plan; milestone results are reviewed before they count as done.
  - See live, trustworthy state across both the Tycoon Office and the Dashboard.
  - Learn how well AI was utilized and how to do better next time.
- **Motivations**: Control, clarity, and momentum. Wants a playful, tactile "operations tycoon" feel without losing rigor (real Git output, real QA gating).
- **Frustrations**: Merged/ambiguous status; work that runs without approval; stale or conflicting numbers between views; opaque AI cost/usage.
- **Key touchpoints**: GlobalExecutiveBar, Tycoon Office (3D), Dashboard (Attention Center, plan review, task board), UF feedback section.
- **Success criteria**: Can complete a P1 connected flow end-to-end — seed/recommend/assign team → plan → approve → one milestone's task executes → QA passes → real commit/push → milestone-result approval — and then read a utilization report.

---

## System Actor — AI Agent (In-system, non-authoring)

- **What it is**: An assigned `ProjectAgent` (instantiated from a reusable `AgentProfile`) that performs tasks in a discipline (Frontend / Backend / Database / QA-DevOps / PM).
- **Behavior in stories**: Executes an approved plan's task; produces artifacts; surfaces execution/QA state. Represented visually as a desk + dev pawn in the Tycoon view.
- **Constraints**: Does not self-assign, does not act without an approved plan, does not auto-rework based on feedback. Human approval applies at the milestone-result level.

## System Actor — Orchestrator / Worker (In-system, non-authoring)

- **What it is**: The backend responsibility that turns a request into a plan, gates execution behind approval, runs the server-side task worker, coordinates technical QA and Git publishing, and streams state via SSE.
- **Behavior in stories**: Enforces idempotency (`requestId`) and optimistic concurrency (`expectedVersion`/`expectedRevision` → 409), records `executionMode` (demo/fixture vs real OpenAI), and computes progress.
- **Constraints**: Never merges the separate state axes; never force-pushes or auto-merges Git; never marks a task COMPLETED unless approved plan + QA pass + publish success + executionMode are all satisfied.

---

## Persona → Epic map

| Persona / Actor | PM | ORCH | UF | GIT | DASH | TY |
|---|---|---|---|---|---|---|
| Operator (P1) | ✅ authors | ✅ authors | ✅ authors | ✅ (via task publish) | ✅ authors | ✅ authors |
| AI Agent | executes | executes | measured | commits work | shown | shown |
| Orchestrator/Worker | — | drives | aggregates | publishes | feeds state | feeds state |
