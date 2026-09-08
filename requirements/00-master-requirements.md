# 00. CompanyOps — 마스터 요구사항

> 문서 ID: MASTER · 상태: 기능 문서 기반 신규 통합본 · 기준일: 2026-09-08
> 목적: 1~2일 해커톤의 AWS AI-DLC 요구사항 진입점 및 서비스 오케스트레이션 기준
> 기존 마스터와 `old/`는 프로젝트 컨셉을 이해하기 위한 참고 자료이며 현재 요구사항의 기준으로 사용하지 않는다.

## 1. 제품 목표

CompanyOps는 사용자가 프로젝트를 만들고 AI 개발 팀을 배정하여, 계획·개발·결과 확인·AI 활용 평가를 진행하는 타이쿤 형태의 서비스다. 사용자는 같은 프로젝트를 **Tycoon Office**와 **Dashboard** 두 탭으로 관찰하고, 필요한 결정·계획 피드백·승인을 제공한다. Agent의 작업 결과는 GitHub의 Project branch와 Task별 Commit으로 확인하며, 프로젝트 완료 후 AI 활용 Score와 Feedback(Comment)을 확인한다.

타이쿤은 실제 개발 상태를 읽기 쉽게 표현하는 화면이다. 화면의 캐릭터 움직임만으로 작업 완료나 GitHub 반영을 판정하지 않는다.

AWS AI-DLC는 이 서비스를 만드는 개발 워크플로우로 사용한다. 서비스 런타임의 Task 실행·기술 QA·승인·Git 연동은 아래 모듈이 담당한다. AWS AI-DLC 자체를 런타임 엔진으로 내장하는 것은 필수 요구사항이 아니다.

## 2. 문서 구조와 적용 순서

| 순서 | 문서                                                            | 역할                                                                   |
| ---- | --------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 00   | 본 문서 (`00-master-requirements.md`)                           | 제품 범위, 전체 실행 흐름, 모듈 책임, 통합 완료 조건                   |
| 01   | [프로젝트·Agent Profile](01-project-management-requirements.md) | Project, Profile, 배정, 정원, Task/Milestone 데이터                    |
| 02   | [AI 활용 Feedback](02-feedback-requirements.md)                 | 프로젝트 완료 후 AI 활용 지표·Score·Feedback(Comment)·프로젝트 간 비교 |
| 03   | [GitHub Interface](03-github-interface-requirements.md)         | checkout, ChangeSet, Diff, Commit, Push                                |
| 04   | [Dashboard](04-dashboard-requirements.md)                       | 상태 관찰, 계획 피드백, Decision/승인, QA·AI 활용 결과 확인            |
| 05   | [Tycoon View](05-tycoon-view-requirements.md)                   | 오피스·좌석·캐릭터·HUD·씬 선택                                         |
| 06   | [통합 계약](06-integration-contract.md)                         | 상태·데이터·API·SSE·모듈 연동                                          |
| 참고 | [디자인 시스템](Design.md)                                      | 공통 스타일, 색상, 3D/DOM 표현                                         |

적용 우선순위는 **사용자 명시 합의 → 본 문서와 공통 계약 → 기능별 상세 → 디자인 → 참고 HTML/이미지**다. 구현 기본안은 해당 기능/공통 계약에 표시하며, 미확정 제품 정책은 사용자 결정 없이 확정 합의로 간주하지 않는다. 요구사항 문서는 `00`부터 `06`까지 연속 번호와 kebab-case 파일명을 사용하고, 목차는 `1 → 1.1 → 1.1.1`을 사용한다. 공통 참고 디자인은 `Design.md`로 별도 유지한다.

## 3. 우선 적용 합의

| ID         | 요구사항                                                                                                                                                                                                             |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MASTER-001 | Workspace = Project. 별도 Workspace 엔터티나 생성 흐름을 만들지 않는다. 서버 Git checkout 경로는 내부 구현 정보다.                                                                                                   |
| MASTER-002 | Desk·좌석·오피스 배치는 TY 모듈의 책임이다. PM은 Project Agent 목록과 역할/표시 정보만 제공한다.                                                                                                                     |
| MASTER-003 | `Agents 12/16`은 현재 Project에 배정된 제거되지 않은 Agent 수 / 최대 배정 수다. 실행 중인 Agent 수와 구분한다.                                                                                                       |
| MASTER-004 | Budget은 HIGH $250,000 / MEDIUM $180,000 / LOW $120,000. 표시용 리소스 기준이며 실제 LLM 지출·잔액이 아니다.                                                                                                         |
| MASTER-005 | Active Sprint Milestones에 하위 전체 Task 중 완료 Task의 비율과 목록을 표시한다. 가중치·PM 판단·수동 입력을 사용하지 않는다. 사람의 결과 승인은 Milestone 단위로 처리한다.                                           |
| MASTER-006 | 시뮬레이션 시간·배속·Pause는 MVP에서 제외한다. 수동 Pause/Resume 조작도 제공하지 않는다. 결정·승인·선행 조건 대기는 유지한다.                                                                                        |
| MASTER-007 | Task별 결과 승인은 두지 않는다. Task는 승인된 Plan에 따라 실행되어 기술 QA를 통과하고 Git 게시가 성공하면 COMPLETED가 된다. 모든 Task가 완료된 Milestone은 결과 승인 대기가 되며, 승인 후 다음 Milestone을 시작한다. |

## 4. MVP 범위와 실행 환경

### 4.1 공통 기술 기준

- 프론트엔드: React + TypeScript, Tailwind CSS, shadcn/ui, Zustand. 타이쿤은 React Three Fiber/Three.js 기반 고정 등각투영 3D로 2.5D 느낌을 구현한다.
- 백엔드: Python FastAPI, SQLite, 서버 측 Task 실행 worker, SSE. LangChain은 선택 어댑터이며 모듈 간 계약의 전제는 아니다.
- SQLite가 프로젝트·실행·기술 QA·승인·AI 활용 지표·이력의 기준 저장소다. Local Storage에는 선택 탭·카메라 등 화면 설정만 저장한다.
- 단일 사용자·단일 서버 프로세스·동시에 하나의 활성 개발 Project를 기본안으로 한다. Project 목록과 프로젝트별 데이터 분리는 지원한다. 다중 사용자 인증/권한·분산 worker는 후속 범위다.
- Project당 쓰기 Task는 순차 실행한다. 최대 16명 배정은 16개 동시 실행을 의미하지 않는다.
- MVP 저장소는 `https://github.com/DDthonWinner/TestOutput`으로 고정한다. Project별 연결 레코드와 `project/{projectId}` branch를 둔다. 임의 Repository 선택은 후속 확장이다.

### 4.2 다섯 핵심 기능

| 기능 | MVP 필수                                                                                                                                  | 후속 확장                                            |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| PM   | Project CRUD/아카이브, Budget·정원, Profile CRUD/비활성화, PM 정확히 1명, 규칙 기반 추천·배정, 모델/표시 정보, Task/Milestone·문서 경로   | 성과 기반 추천, Marketplace, 실제 비용 기반 배정     |
| UF   | 프로젝트 완료 후 Autonomy·Resource Efficiency·Area Distribution 집계, AI 활용 Score, Feedback(Comment), 이전 프로젝트 비교                | 활용 지표 기반 개선 제안 자동 생성                   |
| GIT  | 고정 원격 clone, Project branch, 파일/MD 변경, Diff, 승인된 Task Commit·Push, 실패/재시도                                                 | PR·자동 Merge, 다중 원격, Agent별 branch             |
| DASH | 진행률·Agent/Task, Attention Center, Decision, 계획 반복 피드백·최종 실행 승인, Milestone 결과 승인, QA/Gate, AI 활용 결과, Artifact/Git, SSE 연결 상태 | 비용 추세/한도 제어, 고급 이력 검색, Rollback        |
| TY   | 등각투영 오피스, 역할별 데스크·Agent, 상태 애니메이션·선택 패널, 공통 Project/Budget/정원/Milestone HUD                                   | 좌석 편집/드래그, 고급 이동/전달 효과, 모바일 최적화 |

기본 데모 팀은 PM·Frontend·Backend·QA 4명이다. Database를 추가한 5명 구성도 지원하며 FE/BE/DB/PM 데스크는 기본 배경으로 제공한다. QA와 추가 역할은 같은 오피스 안의 보조 데스크/좌석으로 표현한다. 12/16은 동적 표시의 예시이지 고정 seed 요구사항이 아니다.

## 5. 전체 사용자·오케스트레이션 흐름

### 5.1 프로젝트 준비와 실행 승인

1. 사용자가 프로젝트명·설명·규모·Budget을 입력한다. 고정 GitHub URL과 최대 Agent 수를 확인한다.
2. PM 모듈이 활성 Profile/모델로 팀을 추천한다. 사용자가 이름·색·아이콘·모델을 조정하고 PM 1명을 포함해 확정하면 READY가 된다.
3. 오케스트레이터가 요구사항과 팀에 맞는 계획을 생성한다. 사용자는 피드백을 반복하고, **검토 완료**와 **해당 버전 최종 실행 승인**을 별도로 처리한다.
4. 승인된 계획만 Task/Milestone으로 편성한다. 저장소 접근과 실행 설정을 확인하고 checkout을 준비한 뒤 ACTIVE로 전환한다. 준비 실패 시 READY를 유지하고 실패 사유를 표시한다.

### 5.2 Task 실행과 기술 QA·게시

1. 오케스트레이터가 승인·Decision·의존성을 확인하여 실행 가능한 Task를 고른다. 해당 Project의 쓰기 실행 잠금을 획득한다.
2. 실행 worker가 배정된 Agent/모델을 호출하고, Git Interface로 코드·Task 결과 MD를 ChangeSet에 반영한다.
3. 생성된 Artifact 버전/내용 hash를 고정하고 실행 worker/QA Agent가 승인된 검증 계획의 테스트를 수행하여 결과를 보고한다. 이는 02번 AI 활용 평가가 아니라 Task 완료를 위한 기술 QA다. 생성 완료는 Task 완료와 구분한다.
4. Task가 속한 Plan 버전의 실행 승인과 기술 QA 통과를 확인한 뒤 같은 Artifact 버전의 ChangeSet을 Commit·Push한다.
5. 게시 성공 시 Task를 COMPLETED로 전환하고 실행 잠금을 해제한다. Task별 결과 승인은 요청하지 않는다. 다음 Task가 이전 결과 위에서 실행된다. 승인된 검증 전용 Task는 변경이 없어도 기술 QA 통과 후 완료할 수 있다.
6. Milestone의 모든 비취소 Task가 COMPLETED가 되면 Task 결과·QA·Commit을 묶은 Milestone 결과 버전을 생성하고 사람 승인을 요청한다. 승인 전 진행률은 100%지만 `승인 대기`로 표시하며 다음 Milestone은 시작하지 않는다.
7. 사용자가 Milestone 결과를 승인하면 승인 상태를 기록하고 다음 Milestone을 실행할 수 있다. 추가 검증·수정 요청 시 새 Plan을 검토·최종 승인해 실행하며 새 Milestone 결과 버전에 다시 승인받는다.
8. SQLite 상태 변경과 이력을 저장하고 SSE로 두 탭을 갱신한다. GitHub 완료 표시는 원격 게시 성공에 근거한다.
9. 모든 비취소 Task가 Milestone에 속해 있고 COMPLETED이며 모든 Milestone 결과가 APPROVED이면 Project를 COMPLETED로 전환한다. 오케스트레이터는 그 시점에 UF Report 생성을 한 번 요청하고, UF는 누적된 AI 활용 원천 데이터를 멱등 집계하여 UtilizationReport와 Score를 생성하고 Feedback(Comment)을 기록·조회할 수 있게 한다.

### 5.3 대기·수정·실패

- Decision과 선행 조건은 WAITING, 결과 검토는 REVIEW로 표현한다. 결정 하나를 해결해도 나머지 조건을 검사한다.
- 계획 검토나 Decision 대기 중 독립 Task는 실행 가능 큐에 남는다. 다만 이미 변경된 checkout의 기술 QA/게시 대기 중에는 다른 쓰기 Task가 접근할 수 없다.
- Milestone 수정·추가 검증은 계획 → 반복 피드백 → 검토 완료 → 최종 실행 승인 후 실행한다. 결과 구성이 바뀌면 새 Milestone 결과 버전을 만들고 이전 승인을 승계하지 않는다.
- 수정 attempt는 같은 Task의 새 버전으로 관리하고 기존 실패 이력을 보존한다. 자동 수정 재시도는 기본 0회이며 사용자 승인 없이 실행하지 않는다.
- Push 실패는 기술 QA 실패와 분리한다. 기존 로컬 Commit을 보존하고 같은 게시 요청 재시도 시 중복 Commit을 생성하지 않는다.
- 실행 프로세스 중단 시 RUNNING 작업을 자동 재실행하지 않는다. 재시작 후 BLOCKED로 복구하고 checkout·QA·게시 상태를 확인한다.

## 6. 책임과 연결 지점

| 책임 주체                   | 소유 데이터/행동                                                                           | 다른 모듈과의 연결                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| PM                          | Project/Profile/ProjectAgent/Task/Milestone, 추천·배정 검증                                | 실행할 팀·모델·Repository 설정 제공                                                                |
| 오케스트레이터(공통 백엔드) | Plan/PlanFeedback·Decision/Approval, Task 스케줄, 실행 worker/QA·Gate 집계, 상태 전이, SSE | PM·UF·GIT 연동, 사용자의 일반 변경 지시 계획/승인/실행, 두 탭 상태 제공                            |
| UF                          | UtilizationReport/UtilizationMetric/Feedback(Comment)                                      | Project 완료 판정 후 Task·Token·Cost·Decision·승인 데이터를 읽기 전용 집계; Agent 전달·재작업 없음 |
| GIT                         | checkout/branch/ChangeSet/게시 결과                                                        | 승인 버전 검증 후 파일·Commit·Push 처리                                                            |
| DASH                        | 사용자 조치·검토 화면                                                                      | HTTP 명령, snapshot/SSE 조회                                                                       |
| TY                          | 3D 씬/데스크/좌석/카메라/선택                                                              | 동일 Project Agent와 Task 상태를 화면으로 투영                                                     |

오케스트레이터는 **여섯 번째 제품 기능이 아니라 다섯 기능을 잇는 필수 공통 구현 책임**이다. 이 책임을 “다른 모듈이 구현할 것”으로 남기지 않는다. 개발 착수 전에 공통 오케스트레이터 담당자를 배정한다.

## 7. 공통 계산과 불변 조건

- Budget별 기본 정원은 LOW 8 / MEDIUM 12 / HIGH 16이다. 사용자는 기본 정원 이하로 설정할 수 있고, 현재 배정 수 미만으로 낮출 수 없다.
- READY/ACTIVE/COMPLETED에는 제거되지 않은 PM이 정확히 1명이다. Profile 변경은 기존 Project Agent에 자동 전파하지 않는다.
- 프로젝트 진행률은 `round(100 × COMPLETED Task 수 / CANCELLED 제외 Task 수)`다. 분모 0이면 0%와 `작업 없음`을 표시한다. 난이도 가중치를 사용하지 않는다.
- Milestone 진행률도 해당 Milestone의 COMPLETED Task 수 / CANCELLED 제외 전체 Task 수로 자동 계산한다. 분모 0은 0%/작업 없음이다. progressCurrent/progressTotal/progressPercent는 읽기 전용이며 Task 생성·완료·취소·이동 시 갱신한다. Project 전체 진행률은 미소속 Task를 포함하고 Milestone 퍼센트를 평균내지 않는다.
- Task 완료 조건은 `승인된 Plan 버전 + 기술 QA 통과 + Git 게시 성공 + 실행 주체 기록`이다. 사람의 결과 승인은 Task가 아닌 Milestone 결과 버전에 적용되며 Task 진행률을 되돌리지 않는다.
- Milestone 결과 승인 상태는 진행률과 별도다. 100%여도 PENDING/REVISION_REQUESTED/REJECTED이면 다음 Milestone을 시작하지 않는다.
- UF의 AI 활용 Score/Comment는 Project가 COMPLETED된 뒤 생성하며 QA Gate·Task/Milestone 진행률·Git 게시 상태를 변경하지 않는다. QA 검증과 제품 품질 판정은 UF 범위가 아니다.
- 연결·생성·실행·기술 QA·사람 검토·Git 게시·AI 활용 평가는 서로 다른 축이다. 100% 생성 또는 QA 보고서 열람으로 완료/승인을 추정하지 않는다.
- Task의 실행 주체는 `AI_AGENT`, `HUMAN`, `MIXED` 중 하나로 기록한다. UF의 AI 완료 Task 수는 `COMPLETED && executionMode == AI_AGENT`인 Task만 세며, MIXED는 영역별 참고 수치로 별도 표시한다.
- 모델명·Token·Cost는 서버 설정/계측에서 가져온다. 목업 숫자와 모델명을 실제 계측값으로 사용하지 않는다.

## 8. 해커톤 구현 순서

### 8.1 우선순위 1 — 연결된 최소 흐름

1. 공통 계약과 fixture를 정하고, Project/팀 seed·추천·배정·Task/Milestone API 및 SQLite를 연결한다.
2. AppShell 두 탭, 공통 Project store, Tycoon 기본 씬, Dashboard Agent/Task/Attention을 구현한다.
3. 계획 버전·피드백·최종 승인과 Task worker를 연결한다. 작은 Milestone의 Task 실행 → 실제 테스트 → Task별 Commit/Push → Milestone 결과 승인 흐름을 완주한다.

### 8.2 우선순위 2 — 필수 기능 마무리와 통합

1. Profile 편집/비활성화·배정 교체, 역할 문서 경로, Decision/추가 검증, Git 실패 재시도를 마무리한다.
2. 프로젝트 완료 후 UF 활용 지표·Score·Comment·이전 프로젝트 비교와 SSE 재연결·새로고침·서버 재시작 복구, 정원/PM 검증, 승인 버전·중복 요청을 점검한다.
3. 타이쿤 표현과 Dashboard 가독성을 정리하고 아래 인수 시나리오를 수행한다.

1일만 가능한 경우 1일차 결과는 축소 데모이며 전체 MVP 완료와 구분한다. 선택 기능부터 미루고 승인·기술 QA·실제 게시·상태 일관성은 완료 검증에서 생략하지 않는다.

## 9. 통합 인수 조건

| ID            | 시나리오                                               | 통과 기준                                                                           |
| ------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| MASTER-AC-001 | HIGH Project와 기본 팀 생성                            | $250,000, 배정 수/16, PM 정확히 1명; 새로고침 후 유지                               |
| MASTER-AC-002 | 두 탭 이동·Agent 선택                                  | 같은 Project/Agent/Task/승인 상태; TY 선택으로 실제 Agent 상세 표시                 |
| MASTER-AC-003 | 계획 v1 피드백 → v2                                    | v1 승인으로 v2 실행 불가; 검토 완료만으로 실행 안 됨; 중복 최종 승인에도 실행 한 번 |
| MASTER-AC-004 | 승인된 Plan의 Task 실행 → QA → 게시                    | QA 통과와 Git Push 후 Task COMPLETED; Task별 사람 승인 요청 없음                    |
| MASTER-AC-005 | Milestone의 모든 Task 완료                             | 진행률 100%, Milestone 결과 승인 PENDING, 다음 Milestone 실행 대기                  |
| MASTER-AC-006 | Milestone 승인/수정 요청                               | 승인 시 다음 Milestone 실행 가능; 수정 요청은 새 Plan 승인·실행·새 결과 버전·재승인 |
| MASTER-AC-007 | Git Push 실패 → 재시도                                 | 로컬 SHA 유지, 중복 Commit 없음, 성공 확인 전 게시 완료로 표시하지 않음             |
| MASTER-AC-008 | SSE 단절·재연결                                        | 단절/마지막 동기화 시각 표시; snapshot 복구 후 두 탭 일치                           |
| MASTER-AC-009 | 정원 초과/다른 Project 연결/이전 버전 승인             | 서버에서 거부하고 기존 상태 보존                                                    |
| MASTER-AC-010 | Project 완료 후 AI 활용 Report·Score·Comment 생성/조회 | AI 수행 Task·개입·Token/Cost·영역 분포 집계; Agent 전달·재작업·품질 Gate 변경 없음  |
| MASTER-AC-011 | M1 2/3, M2 1/2, 미소속 1/1 완료                        | M1 67%, M2 50%, Project 4/6=67%; 빈 Milestone 0%; Task 변경 시 두 탭 자동 갱신      |
| MASTER-AC-012 | ACTIVE Project에서 UF Report 생성 요청                 | 거부; 모든 비취소 Task가 Milestone에 속해 완료되고 모든 Milestone이 승인되어 COMPLETED일 때만 생성 |

최종 데모는 실제 모델 호출을 통한 최소 1개 Task 변경, 실제 테스트, 실제 GitHub Push를 검증한다. 인증·모델 연결이 준비되지 않은 fixture 모드는 `데모 데이터 / AI 서버 미연결 / 미게시`를 표시하고 부분 시연으로 기록한다. 외부 연결 준비 상태는 구현 착수 시 확인한다.

## 10. 참조 자료

- [타이쿤 참고 이미지](tycoon-reference-image.png)
- [타이쿤 참고 HTML](tycoon-reference-code.html)

이미지/HTML의 Axiom 브랜드·가짜 계측·배속/Pause/경과 시간·Runway/Burn rate는 현재 요구사항이 아니다. 디자인 문서의 적용 표에 따라 필요한 시각 요소만 사용한다. `old/` 파일은 수정하지 않는다.
