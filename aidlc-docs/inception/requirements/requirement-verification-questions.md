# Requirements Clarification Questions — CompanyOps

Your requirements (`00`–`06` + `Design.md`) are unusually complete: they already fix the data model, state machine, invariants, API contract, SSE recovery, acceptance criteria, and design system. I will treat those as authoritative and **not** re-ask settled product policy.

The questions below cover only the decisions the documents intentionally leave open for build time — chiefly **how real vs. simulated the demo is** and **hackathon scope** — plus three mandatory AI-DLC extension opt-in prompts.

Please answer each by filling in the letter after the `[Answer]:` tag. If none fit, pick **Other** and describe. Let me know when you're done.

---

## Question 1 — AI / LLM connection mode
The master doc (§9, §MASTER-AC) allows either a real model-calling demo or a fixture mode labeled "데모 데이터 / AI 서버 미연결". What should the build target?

A) **Real LLM calls** — orchestrator/worker actually invoke a model for at least one Task (requires an API key available in the server environment)

B) **Fixture / simulated mode** — deterministic seeded data and a simulated worker; screens clearly show "AI 서버 미연결 / 데모 데이터"; no external model calls

C) **Both, behind a config flag** — default to fixture mode for reliable demos, with a real-LLM adapter switchable via env var (Recommended for a hackathon)

X) Other (please describe after [Answer]: tag below)

[Answer]: 

## Question 2 — If real LLM calls are used, which provider/model?
Only relevant if Q1 = A or C. The requirements list example models from OpenAI and Anthropic as display metadata.

A) **Anthropic Claude** (e.g., a current Claude model) as the real execution model

B) **OpenAI GPT** as the real execution model

C) Not applicable — fixture mode only (Q1 = B)

X) Other (please describe after [Answer]: tag below)

[Answer]: 

## Question 3 — GitHub publish mode
GIT-003..005 target the fixed remote `https://github.com/DDthonWinner/TestOutput` with real clone/commit/push. Real push needs credentials on the server.

A) **Real remote push** to `DDthonWinner/TestOutput` — server has git credentials configured; final demo shows a real commit on `project/{projectId}`

B) **Local git only** — real `git` operations (clone/commit/branch) against a local bare repo or local clone, no network push; publish status still modeled faithfully

C) **Both, behind a config flag** — local by default, real remote push when credentials are present (Recommended)

X) Other (please describe after [Answer]: tag below)

[Answer]: 

## Question 4 — Hackathon build scope
Given the 1–2 day framing (§8), where should the first end-to-end target land?

A) **Priority-1 connected flow only** — seed/recommend/assign team, two tabs (Tycoon + Dashboard), plan→approve→one small Milestone: Task exec → test → commit/push → Milestone result approval. Defer P1 items.

B) **Full MVP** — all P0 items across PM / UF / GIT / DASH / TY as written in the docs (larger; may exceed 1–2 days)

C) **Priority-1 connected flow first, then fold in Priority-2** (Profile edit/replace, Decisions, UF report/score/comment, SSE reconnect recovery) as time allows (Recommended)

X) Other (please describe after [Answer]: tag below)

[Answer]: 

## Question 5 — Repository / project layout
How should the codebase be organized in this repo?

A) **Monorepo**: `backend/` (FastAPI + SQLite) and `frontend/` (React+TS+Vite) side by side at the repo root, with a top-level README/dev scripts (Recommended)

B) **Two separate top-level folders with independent tooling**, no shared root scripts

C) Single combined app served by FastAPI (frontend built into backend static)

X) Other (please describe after [Answer]: tag below)

[Answer]: 

## Question 6 — Frontend tooling defaults
The docs specify React + TypeScript + Tailwind + shadcn/ui + Zustand + React Three Fiber/Three.js. To confirm the surrounding toolchain:

A) **Vite + npm** as the build tool and package manager (Recommended)

B) Vite + pnpm

C) Next.js

X) Other (please describe after [Answer]: tag below)

[Answer]: 

## Question 7 — Backend runtime/dependency tooling
For the FastAPI backend:

A) **Python 3.11+ with a venv + `requirements.txt`**, SQLite via SQLAlchemy (Recommended)

B) Python with Poetry / pyproject

C) Python with `uv`

X) Other (please describe after [Answer]: tag below)

[Answer]: 

## Question 8 — Real-time transport confirmation
The contract (§5) specifies SSE for two-tab state sync with snapshot re-read on revision events. Confirm:

A) **Yes — SSE exactly as the contract specifies** (heartbeat 15s, disconnect after 45s, backoff 1/2/5/10s, snapshot recovery) (Recommended)

B) Use WebSocket instead of SSE

C) Polling only for the MVP

X) Other (please describe after [Answer]: tag below)

[Answer]: 

---

## Question 9 — Security Extensions (AI-DLC opt-in)
Should security extension rules be enforced for this project?

A) Yes — enforce all SECURITY rules as blocking constraints (recommended for production-grade applications)

B) No — skip all SECURITY rules (suitable for PoCs, prototypes, and experimental projects)

X) Other (please describe after [Answer]: tag below)

[Answer]: 

## Question 10 — Resiliency Extensions (AI-DLC opt-in)
Should the resiliency baseline be applied to this project?

**What this extension is.** Enabling it applies a set of **directional, design-time best practices** for building resilient systems, derived from the **AWS Well-Architected Framework (Reliability Pillar)** and resilience-review guidance. It steers requirements, design, and code toward fault tolerance, high availability, observability, and recoverability.

**What this extension is NOT.** Enabling it does **not** make your workload production-ready, nor certify any availability, RTO, or RPO target. It is a **starting point**, not a substitute for a formal AWS Well-Architected Review.

A) Yes — apply the resiliency baseline as directional best practices and design-time guidance (recommended for business-critical workloads)

B) No — skip the resiliency baseline (suitable for PoCs, prototypes, and experimental projects where rapid iteration matters more than reliability)

X) Other (please describe after [Answer]: tag below)

[Answer]: 

## Question 11 — Property-Based Testing Extension (AI-DLC opt-in)
Should property-based testing (PBT) rules be enforced for this project?

A) Yes — enforce all PBT rules as blocking constraints (recommended for projects with business logic, data transformations, serialization, or stateful components)

B) Partial — enforce PBT rules only for pure functions and serialization round-trips (suitable for projects with limited algorithmic complexity)

C) No — skip all PBT rules (suitable for simple CRUD applications, UI-only projects, or thin integration layers with no significant business logic)

X) Other (please describe after [Answer]: tag below)

[Answer]: 
