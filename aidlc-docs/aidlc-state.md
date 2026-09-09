# AI-DLC State Tracking

## Project Information
- **Project Type**: Greenfield
- **Start Date**: 2026-09-08
- **Current Stage**: CONSTRUCTION 완료 후 안정성·완성도 보완 (2026-09-09). 아래 "현재 상태 갱신 (2026-09-09)" 참고. 이 아래 워크스페이스 스냅샷은 2026-09-08 시작 시점 기록입니다.

## Workspace State
_(2026-09-08 시작 시점 스냅샷 — 이후 코드가 생성되었습니다. 현재 상태는 문서 하단의 갱신 절 참고.)_
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
- [x] Code Generation (per unit) - U1, U2, U3, U4, U5 DONE
- [x] Build and Test (per unit) - backend 25/25 + frontend 19/19 PASS (all units)

### 🟡 OPERATIONS PHASE
- [ ] Operations - PLACEHOLDER (out of MVP scope)

## Current Status
- **Lifecycle Phase**: CONSTRUCTION — COMPLETE (all 5 units); OPERATIONS is a placeholder
- **Current Stage**: Build & Test — U3 backend-uf (PASS); all units done, awaiting approval
- **Next Stage**: OPERATIONS (placeholder) — MVP construction complete
- **Status**: All 5 units built & tested. Backend 25/25 + frontend 19/19 pass; both builds green. P1 connected flow complete end-to-end. REVIEW gate open.

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

## 현재 상태 갱신 (2026-09-09)

위쪽 "Build and Test"·"Current Status" 항목의 `backend 25/25 + frontend 19/19`는 **2026-09-08 유닛별 구축 완료 시점의 기록**입니다(이력으로 보존). 그 이후 안정성·완성도·보안 보완 작업을 진행했으며, 요구사항→설계→구현→검증 연결은 [construction/stability-review.md](construction/stability-review.md)에 정리했습니다.

2026-09-09 실행 기준 최신 검증 결과:
- 백엔드 전체 `pytest`: 49개 통과.
- 프론트엔드 타입 검사(`tsc --noEmit`): 통과.
- 프론트엔드 전체 `vitest`: 55개 통과, 3개 실패. 실패 3개(`GlobalExecutiveBar.test.tsx`, `ScrollWorld.test.tsx`, `flow.test.tsx`)는 안정성 개선과 무관하며, 병합된 마을 뷰 네비게이션 개편에서 컴포넌트 대비 테스트 미갱신으로 발생합니다(개선 전 베이스 커밋에서도 동일 실패). 해당 화면 담당자가 갱신하는 것이 적절합니다.

이 절은 과거 승인·검증 이력을 새로 승인한 것으로 바꾸지 않으며, 현재 상태만 별도로 기록합니다.
