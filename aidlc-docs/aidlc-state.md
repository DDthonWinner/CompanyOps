# AI-DLC State Tracking

## Project Information
- **Project Type**: Greenfield
- **Start Date**: 2026-09-08
- **Current Stage**: INCEPTION - Requirements Analysis

## Workspace State
- **Existing Code**: No
- **Reverse Engineering Needed**: No
- **Programming Languages**: (none yet; target = Python FastAPI backend + React/TypeScript frontend)
- **Build System**: (none yet)
- **Project Structure**: Empty (requirements + AI-DLC rules only)
- **Workspace Root**: /home/jaewo/github/CompanyOps

## Code Location Rules
- **Application Code**: Workspace root (NEVER in aidlc-docs/)
- **Documentation**: aidlc-docs/ only
- **Structure patterns**: See code-generation.md Critical Rules

## Extension Configuration
_Decided at Requirements Analysis (2026-09-08) via requirement-verification-questions.md Q9–Q11._

| Extension | Enabled | Answer | Full rules loaded |
|---|---|---|---|
| Security | No | Q9 = B (skip) | No |
| Resiliency (baseline) | Yes | Q10 = A (directional best practices) | Yes — resiliency-baseline.md |
| Property-Based Testing | No | Q11 = C (skip) | No |

**Resiliency note**: Applied as directional design-time guidance. RESILIENCY-02 (RTO/RPO + DR strategy) is a mandatory user decision required before finalizing requirements — pending in `resiliency-clarification-questions.md`. RESILIENCY-03/04/08/14/15 deferred to NFR Design per the baseline rules.

## Build-time Decisions (Requirements Analysis)
| # | Decision | Answer |
|---|---|---|
| Q1 | LLM connection mode | Both behind a flag, **default = demo/fixture** |
| Q2 | Real-LLM provider | OpenAI GPT |
| Q3 | GitHub publish | Real remote push to `DDthonWinner/TestOutput` |
| Q4 | Scope | P1 connected flow first, then fold in P2 |
| Q5 | Layout | Monorepo `backend/` + `frontend/` |
| Q6 | Frontend tooling | Vite + npm |
| Q7 | Backend tooling | Python 3.11+ venv + requirements.txt + SQLAlchemy |
| Q8 | Real-time transport | SSE exactly per contract |

## Stage Progress

### 🔵 INCEPTION PHASE
- [x] Workspace Detection
- [x] Reverse Engineering (SKIPPED — greenfield, no existing code)
- [x] Requirements Analysis (approved via option B → User Stories)
- [x] User Stories (approved — 24 stories / 7 epics)
- [x] Workflow Planning (execution-plan.md created; awaiting approval)
- [x] Application Design - DONE
- [x] Units Generation - artifacts generated (awaiting approval)

### 🟢 CONSTRUCTION PHASE
_Sequence: U1 Functional Design → System NFR Requirements → System NFR Design → U1 Code Gen/Build&Test → U2 → U4 → U5 → U3 (each FD→CodeGen→Build&Test)._
- [~] Functional Design (per unit) - U1 DONE; U2/U4/U5/U3 pending
- [x] NFR Requirements (system-level, once) - DONE
- [x] NFR Design (system-level, once) - DONE (resolved deferred RESILIENCY-03/04/08/14/15)
- [ ] Infrastructure Design - SKIP (single-node local PoC, no IaC)
- [~] Code Generation (per unit) - U1, U2, U4 DONE; U5/U3 pending
- [~] Build and Test (per unit) - backend 21/21 + frontend 11/11 PASS; U5/U3 pending

### 🟡 OPERATIONS PHASE
- [ ] Operations - PLACEHOLDER

## Current Status
- **Lifecycle Phase**: CONSTRUCTION
- **Current Stage**: Code Generation — U5 frontend-dashboard (code generated + verified, awaiting approval)
- **Next Stage**: U5 Build & Test (formalize), then U3 backend-uf
- **Status**: Dashboard app generated (control center + PM create/matching + plan-first/approval UI + UF section); wired into AppShell. `npm run test` 19/19; `npm run build` success. REVIEW gate open.

## Units of Work
- **U1 backend-pm** — PM + Orchestration + Platform/Common + Execution Provider
- **U2 backend-git** — GitInterface + publish
- **U3 backend-uf** — utilization reports/metrics/feedback
- **U4 frontend-tycoon** — Tycoon view + shared frontend foundation (AppShell/GlobalExecutiveBar/store/api/sse/UI)
- **U5 frontend-dashboard** — Dashboard + Feedback (depends on U4)
- **Build order (P1 first)**: U1 → U2 → U4 → U5, then U3 (UF) + P2.

## Execution Plan Summary
- **Stages to Execute**: Application Design, Units Generation, Functional Design, NFR Requirements, NFR Design, Code Generation, Build and Test
- **Stages to Skip**: Reverse Engineering (greenfield), Infrastructure Design (single-node local PoC, no IaC)
