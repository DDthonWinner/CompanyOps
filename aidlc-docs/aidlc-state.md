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
- [ ] Application Design - EXECUTE
- [ ] Units Generation - EXECUTE

### 🟢 CONSTRUCTION PHASE
- [ ] Functional Design - EXECUTE
- [ ] NFR Requirements - EXECUTE
- [ ] NFR Design - EXECUTE (resolves deferred RESILIENCY-03/04/08/14/15)
- [ ] Infrastructure Design - SKIP (single-node local PoC, no IaC)
- [ ] Code Generation - EXECUTE
- [ ] Build and Test - EXECUTE

### 🟡 OPERATIONS PHASE
- [ ] Operations - PLACEHOLDER

## Current Status
- **Lifecycle Phase**: INCEPTION
- **Current Stage**: Workflow Planning — complete, awaiting plan approval
- **Next Stage**: Application Design (after approval)
- **Status**: execution-plan.md created. Execute: Application Design, Units Generation, Functional Design, NFR Requirements, NFR Design, Code Generation, Build and Test. Skip: Infrastructure Design. REVIEW gate open.

## Execution Plan Summary
- **Stages to Execute**: Application Design, Units Generation, Functional Design, NFR Requirements, NFR Design, Code Generation, Build and Test
- **Stages to Skip**: Reverse Engineering (greenfield), Infrastructure Design (single-node local PoC, no IaC)
