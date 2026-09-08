# 04. 대시보드 요구사항

> 문서 ID: DASH · 상태: 통합 정리본 · 기준일: 2026-09-08
> 상위 문서: [마스터](00-master-requirements.md) · 공통 계약: [06](06-integration-contract.md) · 디자인: [Design](Design.md)
> 범위: Dashboard 탭의 조회·상호작용. 프로젝트 완료 후 AI 활용 Score/Comment 기록은 [UF](02-feedback-requirements.md), 계획/승인·실행/QA Gate는 오케스트레이터 책임이다.

MVP 공통 해석:

- 요구사항 ID: `DASH-001` 진행/Agent/Task, `DASH-002` Attention/Decision, `DASH-003` Milestone 결과 승인, `DASH-004` 계획/피드백/최종 승인, `DASH-005` QA/Gate, `DASH-006` 결과/Git/로그, `DASH-007` 연결 상태.
- 완료 Task 수 ÷ 취소되지 않은 전체 Task 수를 정수 반올림한다. Task가 없으면 0%와 `작업 없음`을 표시한다.
- Active Sprint Milestones는 각 Milestone의 **완료 Task 수 / 전체 Task 수**를 서버에서 계산해 표시한다. Project는 미소속 Task까지 집계한다. 가중치·수동 입력은 사용하지 않으며 빈 범위는 0%/작업 없음이다. CANCELLED는 기존 정책대로 집계에서 제외한다.
- Budget은 HIGH $250,000 / MEDIUM $180,000 / LOW $120,000의 표시용 기준이다. Token 사용량·Estimated Cost는 실제 계측값으로 별도 표시하고 미수집 값은 `미수집`으로 표시한다. 비용 추세/한도 제어는 P1이다.
- Artifact의 코드 Diff·변경 파일·Task Commit SHA·Branch URL·게시 실패 상태는 GIT 연동의 P0이다. 일반 문서의 다중 버전 비교·다운로드 확대만 P1이다.
- 중앙 Agent 작업 영역과 오른쪽 Attention Center를 유지한다. 별도 Workspace 엔터티를 만들지 않는다.

## 1. 목적

본 화면은 AI-DLC를 활용한 개발 과정에서 사용자가 프로젝트의 진행 상황을 확인하고, AI Agent와 상호작용하며, 필요한 시점에 의사결정을 내릴 수 있도록 하는 **Interactive Dashboard**이다.

단순히 진행률과 지표를 조회하는 Dashboard가 아니라 다음 역할을 수행한다.

* 개발 진행 상황 확인
* AI Agent의 현재 작업 확인
* Agent 간 작업 흐름 확인
* 사용자 판단이 필요한 항목 확인 및 처리
* Token / Cost 사용량 확인
* QA 및 개발 품질 상태 확인
* AI에게 추가 지시 전달
* 개발 방향 및 실행 상태 제어

즉, 본 화면은 **AI-DLC와 사용자가 함께 개발을 진행하기 위한 Human-AI Development Control Center** 역할을 한다.

---

## 2. Target Development Areas

Dashboard에서는 다음 AI-DLC 영역을 대상으로 한다.

```text
Project Management
        ↓
 ┌───────────────┐
 │               │
Frontend      Backend
 │               │
 └───────┬───────┘
         ↓
        QA
```

Frontend와 Backend의 역할·의존 흐름을 표시한다. MVP에서는 Project당 Task를 하나씩 실행하며, 독립 Task는 다른 Task의 결정 대기에 막히지 않고 실행 가능한 큐에 남는다. 실제 병렬 실행은 후속 확장이다.

---

## 3. Dashboard Main Information

프로젝트 진입 시 현재 단계, 전체 진행률, 진행 중인 작업, 실행 중인 Agent, 조건 대기 중인 Agent/Task, 사용자 결정·승인 대기를 확인할 수 있어야 한다.

| 항목 | 표시 기준 |
| --- | --- |
| 현재 개발 단계 | PM / Frontend / Backend / QA, 현재 실행 역할 |
| 전체 진행률 | 완료 Task 수 ÷ 전체 Task 수 × 100 |
| 실행 중인 Agent | 실제 실행 중인 Agent 수. 생성 완료, 승인 대기, 조건 대기, 선행 작업 대기는 제외 |
| 진행 중인 Task | RUNNING 상태 Task 수 |
| 조건 대기 Task / Agent | 중단 원인과 범위를 함께 표시 |
| 사용자 확인 필요 | 미처리 Decision, Milestone 결과 Approval, 계획 최종 실행 Approval |

진행률에는 난이도·복잡도 가중치를 사용하지 않는다. MVP는 정수 반올림한다. 예를 들어 8/12개 완료는 67%이다. 68%로 임의 표시하지 않는다.

계획을 작성하거나 검토하는 것만으로 실행 Task를 완료 처리하지 않는다. Task 추가·취소 시 분모 변경을 설명하며, 검토 중인 계획은 실제 작업 편성 전까지 Task 수에 자동 합산하지 않는다.

결과 생성 완료는 Artifact의 GENERATED 상태이다. Task는 승인된 Plan에 따라 기술 QA를 통과하고 Git 게시가 성공한 뒤 COMPLETED가 된다. Task별 사람 결과 승인은 없다. Milestone 결과 승인은 Task 진행률과 별도로 관리한다.

영역별 진행률과 함께 Running / Waiting / Completed / Blocked / Failed 등의 실행 상태 및 사람 승인 상태를 표시한다.

---

## 4. AI Agent Activity

기본 Agent는 Project Manager, Frontend, Backend, QA이다.

Agent Card 및 상세 패널에는 다음을 제공한다.

- Agent 이름, 담당 영역
- 실행 상태와 현재 Task
- 현재 Activity: 작업 수준의 구체적인 설명
- 다음 작업 및 필요한 선행 조건
- 담당 Task의 완료 수/전체 수 기준 진행률, 실행 시간, Token 사용량
- 결과 생성 상태: 생성 중 / 생성 완료 / 생성 실패
- 소속 Milestone 결과 검토 상태: 준비 중 / 승인 대기 / 승인 완료 / 수정 요청 / 반려
- 조건 대기 중인 경우 원인, 관련 Decision 또는 Approval, 영향받는 Task, 재개 조건

권장 표시 예:

| Agent | 실행 또는 생성 상태 | 사람 상태 / 대기 원인 |
| --- | --- | --- |
| PM | 요구사항 Task 게시 완료 · 100% | Milestone 결과 승인 대기 |
| Frontend | 독립 UI 작업 진행 중 | 기존 승인 범위 |
| Backend | BE-08 조건 대기 | 인증 전략 결정 대기 |
| QA | QA-32 조건 대기 | 인증 전략 결정 대기 → BE-08 완료 후 검증 |

같은 Agent가 이전 QA Run의 보고서를 생성 완료했고 후속 검증 작업은 대기 중일 수 있다. 서로 다른 Run과 Task를 명시하여 모순처럼 보이지 않게 한다.

---

## 5. Current / Next Step

현재 작업과 함께 다음 수행 예정 작업을 제공한다.

예:

```text
Backend Agent

Current
Implement Authentication API

Next
Write Unit Tests
→ Send to QA
```

이를 통해 사용자는 다음 질문에 답을 얻을 수 있어야 한다.

```text
지금 AI가 무엇을 하고 있는가?

왜 이 작업을 하고 있는가?

이 작업 이후에는 무엇을 하는가?
```

단, 모델의 내부 Chain of Thought는 표시하지 않고 작업 수준의 설명만 제공한다.

---

## 6. Development Flow & Agent Interaction

AI-DLC 내부에서 Agent 간에 Task와 결과가 이동하는 과정을 확인할 수 있어야 한다.

예:

```text
PM Agent
   │
   │ Task Assigned
   ↓
Frontend Agent
   │
   │ Implementation Completed
   ↓
QA Agent
```

QA 실패 시에는 다음과 같이 표현할 수 있다.

```text
QA Agent
   │
   │ Test Failed
   ↓
Backend Agent
   │
   │ Fix
   ↓
QA Agent
```

Dashboard에서는 다음 Interaction을 주요 Event로 표시한다.

* Task 생성
* Task 할당
* 작업 시작
* 작업 완료
* Agent 간 전달
* QA Feedback
* 사용자의 명시적인 수정 요청 (UF Comment와 별개)
* 사용자 Decision 전달

이를 통해 사용자는 AI Agent들이 독립적으로 움직이는 것이 아니라 하나의 개발 Lifecycle 안에서 협업하고 있음을 확인할 수 있어야 한다.

---

## 7. User Attention Center

사용자 개입이 필요한 항목을 일반 Activity와 분리하여 우선 표시한다.

- Decision Required
- Milestone의 Task·Artifact·QA·Commit 결과 묶음에 대한 사람 승인 대기
- 실행 계획에 대한 피드백·검토 또는 최종 실행 승인 대기
- QA 전체 검증 결과 확인·승인 및 추가 검증 여부 확인
- Requirement Clarification, Blocked Task, Critical Error, QA Exception, Risk, Token / Cost Limit

각 요청은 요청 Agent, 관련 Task, 사유, 현재 영향, 사용자 다음 Action을 포함한다. 동일 요청을 여러 카드로 보여주더라도 대기 건수는 요청 ID 기준으로 중복 집계하지 않는다.

결정 대기로 중단이 발생하면 다음을 동시에 제공한다.

1. 즉시 확인 가능한 알림 또는 상태 배너
2. 조건 대기 중인 Agent 및 Task 이름/ID
3. 중단 원인과 관련 결정 링크
4. 계속 진행 중인 독립 Agent/Task
5. 결정 이후 재개할 작업과 여전히 선행 조건을 기다릴 작업
6. Activity Timeline 이력

알림을 읽거나 닫는 것은 결정·승인 처리를 의미하지 않는다. 원인이 해결될 때까지 카드와 상세 상태는 유지한다.

---

## 8. Decision Request

Decision에는 요청 Agent, 관련 Task, 결정 내용, 필요한 이유, 선택지, AI 추천, 예상 영향, 중단 범위와 재개 조건을 제공한다.

지원 Action:

- Select Option / Accept Recommendation
- Ask AI / Custom Instruction
- 명시적인 최종 결정

선택 완료 시 결정 내용과 결정자를 기록하고 관련 Agent/Task에 전달한다.

결정이 필요한 작업과 그 작업에 의존하는 Agent/Task만 조건 대기한다. 연관 없는 기존 승인 범위의 작업은 계속 수행한다. 중단 범위는 Task dependency를 기준으로 설명할 수 있어야 한다.

예시:

~~~text
DEC-001 · 인증 전략 결정 대기

Backend / BE-08 인증 API 구현 → 조건 대기
QA / QA-32 인증 API 후속 검증 → 조건 대기
Frontend / FE-12 목 데이터 기반 로그인 UI → 실행 중 (Project 슬롯 1개)
Frontend / FE-13 상품 목록 반응형 개선 → 실행 가능 큐 대기

사용자가 JWT로 최종 결정
→ Backend / BE-08 구현 재개
→ QA / QA-32는 BE-08 완료까지 선행 작업 대기
→ BE-08 완료 이벤트 확인 후 QA-32 실행 가능
~~~

Decision 해결은 모든 작업을 무조건 재개하는 명령이 아니다. 다른 미해결 Decision, 선행 Task, 승인 Gate가 있으면 해당 대기를 유지한다.

기존 승인된 작업의 결정 응답과 새로운 구현 변경 지시는 구분한다. 결정 과정에서 실행 범위·계획 변경이 필요한 경우 19장의 계획·피드백·최종 실행 승인 절차를 적용한다.

---

## 9. Milestone Result Approval / Human Review

Task 결과 생성·기술 QA·Git 게시와 Milestone 사람 승인 상태를 독립적으로 관리한다. 사람 승인은 개별 Artifact나 Task가 아니라 Milestone 결과 버전에 적용한다.

~~~text
Milestone의 모든 비취소 Task COMPLETED
→ Task·Artifact·QA Run·Commit SHA를 Milestone 결과 버전으로 묶음
→ Milestone 결과 승인 대기 (진행률 100%)
   ├─ 승인 완료 → 다음 Milestone 실행 가능
   ├─ 수정 요청 → 수정 계획 검토 → 최종 실행 승인 → 새 결과 버전 → 재승인
   └─ 반려 → Milestone 승인 Gate 유지
~~~

| 구분 | 상태 |
| --- | --- |
| Milestone 작업 | 진행 중 / Task 완료 100% |
| 사람 검토 | Not Required / Pending / Approved / Revision Requested / Rejected |

화면에서는 진행률과 승인을 합치지 않는다. 예: “Task 6/6 완료 · Milestone 승인 대기”, “Task 6/6 완료 · Milestone 승인 완료”.

Approval Request에는 Milestone 결과 ID/버전, 포함 Task·Artifact·QA 결과·Commit, 생성 시점, 승인 후 시작할 다음 Milestone을 제공한다.

승인 전에는 다음 Milestone의 Task가 `MILESTONE_APPROVAL` 조건으로 대기한다. 현재 Milestone과 무관하며 명시적으로 독립 실행을 승인한 작업은 진행할 수 있다. Milestone 결과 구성이 바뀌면 이전 승인 상태를 새 버전에 승계하지 않는다.

수정·추가 검증 요청은 실행 지시로 즉시 처리하지 않는다. 계획을 먼저 작성하고 피드백과 최종 실행 승인을 거친다.

---

## 10. Impact Preview

중요한 결정과 변경 계획에는 사용자가 이해할 수 있는 영향 정보를 제공한다.

- 영향받는 영역, Agent, Task 및 dependency
- 조건 대기되는 작업과 계속 진행되는 독립 작업
- 변경·재생성할 결과물 및 재검증 범위
- 재개 또는 실행 조건
- 추가 Token / Cost / 시간 추정치가 있으면 Estimated로 표시

확정되지 않은 영향은 확정값처럼 표현하지 않는다. 피드백으로 계획이 바뀌면 영향 정보도 같은 계획 버전에 맞춰 갱신한다.

영향 미리보기나 추천안 확인 자체는 실행 승인이 아니다.

---

## 11. Task Status

Task 목록 및 상세에서 작업명, ID, Domain, 담당 Agent, 실행 상태, Token, 선행/후행 Task, 관련 Decision/Approval, 재개 조건을 확인한다.

| 실행 상태 | 의미 |
| --- | --- |
| TODO | 아직 시작하지 않은 작업 |
| RUNNING | 실제 작업 진행 중 |
| WAITING | 선행 Task, 결정 또는 실행 계획 승인 조건 대기 |
| BLOCKED | 설정 누락 등 해결이 필요한 진행 불가 상태 |
| REVIEW | 생성 또는 실행 결과 검토 대기 |
| COMPLETED | 승인된 Plan에 따라 기술 QA를 통과하고 Git 게시까지 완료 |
| CANCELLED | 실행 전 취소된 작업; 진행률 분모에서 제외 |
| FAILED | 작업 실행 실패 |

WAITING에는 waitReasons와 관련 request ID, 대기 대상 Task/조건을 둔다. 사람 승인 상태는 위 실행 상태와 별도로 제공한다.

Task 선택 시 Side Panel에서 상세와 Requirement → Task → Artifact → Test 추적 관계를 제공한다.

---

## 12. Quality Gate

Quality Gate는 다음 단계로 이동 가능한지를 나타낸다. 테스트 결과와 사람 결과 확인 승인을 구분한다.

기본 판단 항목:

- Frontend Build
- Backend Unit Test
- Critical QA Failure
- Requirement Coverage
- QA 전체 실행 완료 여부
- Milestone 결과에 포함된 QA 결과와 전체 결과에 대한 사람 검토·승인
- 미해결 실패 및 필요한 재검증
- 필요한 단계 승인 (별도 Release Approval 워크플로우는 후속 확장)

사용자가 QA 결과를 확인해도 실패한 테스트를 통과로 변경하지 않는다. 기술 Gate를 통과하지 못한 Milestone 결과는 승인할 수 없다.

예:

~~~text
Milestone 02 · QA Run #03: 전체 실행 완료
39 Passed / 3 Failed
Milestone 결과 승인: 불가
추가 검증: 없음
Quality Gate: 보류 — 실패 3건 수정·재검증 필요
최종 완료 조건: 미충족
~~~

모든 Task의 기술 조건과 Git 게시가 완료되고 사용자 승인만 필요한 경우에는 “Task 완료 100% · Milestone 결과 승인 대기”로 명확히 표시한다.

---

## 13. QA Run, Result Review & Additional Validation

QA가 한 번의 전체 검증을 마치면, 어떤 대상을 무엇으로 검증했는지와 결과를 묶어 사용자에게 제공한다. 진행 중의 부분 결과를 전체 완료 결과처럼 보여주지 않는다.

QA Run 보고서 필수 항목:

- Run ID, 대상 빌드/결과물 버전, 검증 범위, 시작·종료 시각
- 전체 실행 완료 여부
- 대상별 검증 내용과 기대 결과
- Total / Passed / Failed / Skipped 및 통과율
- 실패 대상, 원인 또는 확인된 증거, 관련 Task/Artifact
- 미검증 항목 및 범위의 한계
- 이미 제안된 수정·재검증과 실행 승인 여부
- 사용자 판단이 필요한 사항

통과율의 분모에 어떤 항목을 포함했는지 설명한다. MVP는 Passed/(Passed+Failed)를 정수 반올림한다. 예: 42건 실행, 39건 통과 → 93%. SKIPPED는 분모에서 제외하고, 실행 0건이면 N/A로 표시한다.

QA 결과는 Milestone 결과 승인 요청에 포함한다. 모든 Task와 QA 처리가 끝난 후 사용자에게 다음을 요청한다.

1. 검증 범위와 결과를 확인했으며 결과가 괜찮은지
2. 추가로 필요한 검증이 있는지

선택 흐름:

~~~text
Milestone Task·QA 완료 → Milestone 결과 버전 생성 → 사람 결과 검토
  ├─ 결과 승인 + 추가 검증 없음
  │   → Milestone 결과 승인 완료 기록
  │   → 실패/미해결 조건은 유지, Gate는 별도로 판정
  └─ 추가 검증 필요
      → 검증 대상·조건·기대 결과 입력
      → 추가 검증 계획 제시
      → 사용자와 피드백 반복
      → 최종 실행 승인
      → 의존 조건 충족 시 추가 검증 실행
      → 새 Run과 변경된 Task 결과를 묶은 새 Milestone 결과 버전으로 재승인 요청
~~~

추가 검증 여부는 Milestone 승인 요청에서 명시적으로 선택한다. 무응답·시간 경과·보고서 열람을 승인 또는 “추가 검증 없음”으로 처리하지 않는다.

실패가 발견되면 수정·재검증 요청을 제안할 수 있지만, 새로운 실행 범위는 계획 검토와 최종 승인을 거쳐야 한다. MVP 통합 기본안은 승인 없는 자동 수정 0회이며, 후속 자동화 정책은 별도로 정한다.

후속 QA Task가 선행 개발 Task를 기다리더라도 완료된 이전 Run의 보고서는 독립적으로 열람·검토할 수 있어야 한다.

---

## 14. Token / Cost Usage

AI-DLC에서는 Token을 개발 과정에서 사용하는 주요 Resource로 취급한다.

Dashboard에서는 최소 다음 정보를 제공한다.

### 14.1 Project

```text
Total Tokens
Input Tokens
Output Tokens
Estimated Cost
```

### 14.2 Agent

```text
PM          210K
Frontend    380K
Backend     420K
QA          230K
```

### 14.3 Task

개별 Task 상세 화면에서도 해당 작업에 사용된 Token을 확인할 수 있어야 한다.

가능한 경우 개발 단계별 또는 시간별 Token Usage Trend를 제공한다.

---

## 15. Token / Cost Guard

P1에서 사용자가 별도로 설정한 실제 Token 또는 Cost 한도에 접근하거나 초과하는 경우 Warning을 제공한다.

예:

```text
Token Budget

820K / 1M

82% Used

Backend implementation may exceed the current budget.

[ Continue ]

[ 상세 보기 ]

[ Adjust Limit ]
```

단순 사용량 표시를 넘어 사용자가 AI Resource 사용을 제어할 수 있도록 한다.

---

## 16. Activity Timeline & Notifications

개발 흐름과 사용자 판단을 이해하는 데 필요한 Event를 제공한다. 내부 System Log 전체를 기본 화면에 노출하지 않는다.

필수 Event:

- Agent / Task 시작, 완료, 실패
- Task 할당, 결과 전달, QA Feedback
- Agent 결과 생성 완료 및 결과물 버전
- Milestone 결과 승인 대기, 승인 완료, 수정 요청, 반려
- Decision 요청, 중단 범위, 사용자 결정
- 연관 Agent/Task 조건 대기와 중단 원인
- 결정 해결 후 재개 및 남아 있는 선행 조건
- 변경 계획 생성, 피드백, 새 버전, 검토 완료
- 최종 실행 승인, 승인 버전, 실제 실행 시작 또는 조건 대기
- QA Run 전체 완료, Milestone 결과 승인 요청, 승인 완료, 수정·추가 검증 요청
- 연결 끊김, 재연결, 오류 및 재시도

각 Event에는 시각, 주체, 관련 Task/Run/Plan/Decision/MilestoneResult 식별자를 포함한다. 상태 변경과 알림·Timeline 기록은 같은 사실을 표현해야 한다.

조건 대기 알림은 읽음 상태와 별개로 실제 중단이 해결되었는지를 표시한다. 연결 단절 시 받은 것으로 확인되지 않은 Event를 완료된 사실처럼 기록하지 않는다.

---

## 17. Artifact / Result

AI가 생성한 최근 결과물을 Dashboard에서 확인할 수 있어야 한다.

대상:

```text
Requirement
Design
Source Code
Test Code
Test Result
Document
Report
```

예:

```text
Recent Artifacts

requirement.md
PM Agent · 2 min ago

LoginPage.tsx
Frontend Agent · 1 min ago

auth.controller.ts
Backend Agent · 30 sec ago
```

Artifact를 선택하면 Preview 또는 상세 화면으로 연결한다.

가능한 경우 수정된 파일은 Before / After 또는 Diff 형태로 확인할 수 있도록 한다.

---

## 18. Requirement Traceability

AI가 구현한 결과가 어떤 Requirement에서 시작되었는지 추적할 수 있어야 한다. MVP에서는 Task 제목·설명의 요구사항/Acceptance Criteria를 기준으로 추적하며 문서의 requirementIds는 선택적 표식이다. 별도 Requirement DB를 만들지 않는다.

기본 관계:

```text
Requirement
     ↓
   Task
     ↓
Implementation
     ↓
   Test
```

예:

```text
REQ-LOGIN-001

→ FE-12 / BE-08
→ LoginPage.tsx / auth.ts
→ QA-32
```

모든 정보를 메인 Dashboard에 항상 표시할 필요는 없으며, 관련 Task 또는 Requirement 상세 화면에서 Drill-down 형태로 제공할 수 있다.

---

## 19. User Command & Plan-First Execution

사용자는 AI-DLC / PM / Frontend / Backend / QA를 대상으로 추가 지시를 입력한다.

새로운 개발 변경 또는 추가 검증 지시는 바로 실행하지 않는다. 다음 절차를 따른다.

~~~text
사용자 요청 접수
→ AI 실행 계획 제시 (v1)
→ 사용자 검토 및 피드백
→ 계획 수정 (v2, v3, ...)
→ 사용자가 검토 완료
→ 최종 실행 승인 대기
→ 사용자가 현재 계획 버전의 실행을 명시적으로 최종 승인
→ 실행 조건 확인
   ├─ 충족: 실행 시작
   └─ 미충족: 승인 완료 상태로 조건 대기
→ 실행 결과 보고
~~~

계획에는 요청 내용, 목표, 수행 단계, 담당 Agent, 변경 범위, 제외 범위, 의존 조건, 결과물, 검증 방법 및 알려진 영향을 제공한다.

피드백은 횟수 제한이나 시간 제한으로 강제 종료하지 않는다. 사용자가 충분히 검토했다고 판단할 때까지 반복할 수 있어야 한다.

명확히 구분해야 하는 Action:

- 요청 전송: 계획 검토를 시작하며 실행하지 않음
- 피드백 반영: 새 계획 버전을 생성하며 실행하지 않음
- 검토 완료: 최종 승인 단계로 이동하며 실행하지 않음
- 최종 실행 승인: 확인한 계획 버전의 실행을 승인

피드백이 추가되어 계획이 변경되면 다시 검토 상태로 돌아간다. 이전 버전의 승인이나 열려 있던 이전 승인창으로 새 버전을 실행할 수 없어야 한다.

최종 승인 화면은 계획 ID·버전·대상·핵심 영향을 식별할 수 있어야 한다. 같은 승인 요청을 중복 전송해도 실행은 중복 시작하지 않는다.

최종 승인 전에는 해당 변경의 코드 수정·작업 실행·추가 검증을 시작하지 않는다. 검토 중인 새 지시와 무관한 기존 승인 작업은 계속 수행한다.

설명·조회만 수행하는 요청과 실행 범위를 바꾸는 요청은 구분한다. 설명·조회 응답을 실행 승인으로 해석하지 않는다.

---

## 20. 실행 제어와 조건 대기

MVP는 Add Instruction / Change Direction / Decision 응답 / 승인 기능을 제공한다. 시뮬레이션 시간·배속·Pause와 수동 전체 Pause/Resume/Stop 버튼은 제공하지 않는다.

결정·승인·선행 작업이 필요한 Task는 안전한 실행 경계에서 WAITING 또는 REVIEW 상태를 유지한다. 실행 중인 LLM 호출을 임의로 동결하는 기능을 의미하지 않는다. 조건이 해결되면 모든 waitReasons를 다시 확인하여 실행 가능한 Task만 순차 실행한다.

독립 Task는 계속 실행 가능한 상태이며, Project 실행 슬롯이 비면 수행할 수 있다. 새 지시 및 방향 변경은 19장의 계획·피드백·최종 실행 승인 흐름을 거친다. 연결이 끊긴 동안 미확인 요청은 적용 완료로 표시하지 않는다.

---

## 21. Checkpoint / Recovery

프로젝트의 주요 개발 시점을 Checkpoint로 표시할 수 있다.

예:

```text
Requirement Approved

Architecture Confirmed

MVP Build Completed

QA Passed
```

Checkpoint는 사용자가 개발 과정의 중요한 기준점을 이해하도록 하는 것이 기본 목적이다.

실제 Rollback 기능을 지원하는 경우에는 단순 화면 상태가 아니라 Source Code, Artifact, Task 상태 등 복원 가능한 범위를 명확하게 정의해야 한다.

따라서 초기 버전에서는 **Checkpoint History를 우선 제공하고 실제 Rollback은 별도 기능으로 확장 가능**하도록 구성한다.

---

## 22. Risk / Blocked Status

AI가 개발 진행 과정에서 위험이나 진행 불가능 상태를 발견한 경우 이를 표시한다.

예:

```text
Backend Agent

BLOCKED

Reason
Database connection information is missing.

Recommended Action
Provide database configuration.
```

또는:

```text
Risk Detected

QA coverage for payment flow is insufficient.

Recommended Action
Add integration tests.
```

Risk는 AI의 임의적인 확률값보다는 **발견된 문제와 근거가 명확한 상태 정보**를 중심으로 제공한다.

---

## 23. Main Screen Priority & Layout

데스크톱 권장 구성:

- 글로벌 내비게이션 바(최상단 고정): Tycoon Office와 공유하는 **통합 글로벌 내비게이션 바**([Design 4.1](Design.md)). 제품명·현재 Project·Tycoon Office/Dashboard 탭·항상 보이는 실제 연결 상태를 제공한다. Dashboard는 별도 상단 헤더/탭을 만들지 않고 이 공통 바를 마운트한다.
- 화면 상단: 프로젝트 단계, Task 수 기준 진행률, 실행·대기 건수. 연결 상태는 글로벌 내비게이션 바에서 항상 확인한다.
- 중앙: Agent 작업 영역 및 PM → Frontend / Backend → QA 개발 흐름
- 오른쪽: Decision / Milestone 결과 승인 / 계획 최종 승인을 모은 Attention Center
- 하단: Agent 요약, QA·Quality Gate, Activity, Artifact, 사용자 지시 입력
- 상세: Side Panel 또는 Modal로 현재 Dashboard 문맥 유지

모바일·좁은 화면에서는 Attention Center를 작업 공간보다 먼저 표시한다. 중단 범위 알림과 연결 상태도 우선 접근할 수 있어야 한다.

정보 우선순위:

1. 사용자 조치: Decision, Approval, Blocked, Critical Error
2. 현재 개발 상태: Progress, Current Phase, Active Task, Agent Activity
3. 결과·품질: QA 보고, Quality Gate, Artifact
4. Resource: Token, Cost, Usage Trend

UI 톤은 제공된 레퍼런스의 밝은 배경, 흰색 카드, 보라색 포인트, 부드러운 그림자와 작업 공간 느낌을 따른다. 정보와 상태를 읽기 어렵게 만드는 과도한 장식은 피한다.

---

## 24. Recommended Dashboard Components

~~~text
AppShell
├── GlobalExecutiveBar        // Tycoon Office와 공유하는 통합 글로벌 내비게이션 바 (제품명·Project·Tycoon Office/Dashboard 탭·연결 상태). Design 4.1
└── DashboardPage
    ├── ProjectProgress
    ├── DependencyWaitNotice
    ├── DevelopmentFlow / AgentWorkArea
    ├── AttentionCenter
    │   ├── DecisionCard
    │   ├── MilestoneResultApprovalCard
    │   ├── PlanApprovalCard
    │   └── QAReviewCard
    ├── AgentOverview / AgentCard
    ├── CurrentAndNextStep
    ├── ActiveTaskList / DependencyDetailPanel
    ├── PlanReviewPanel
    │   ├── PlanVersion
    │   ├── FeedbackHistory
    │   ├── ImpactPreview
    │   └── FinalExecutionApproval
    ├── QARunReport / QAReview / AdditionalValidationRequest
    ├── QualityGate
    ├── TokenUsage
    ├── ActivityTimeline
    ├── RecentArtifacts / ArtifactPreview
    └── CommandInput
~~~

컴포넌트 이름은 구현 예시이다. 이전의 DashboardPage 로컬 ProjectHeader·ConnectionStatus는 두지 않고, 제품명·Project·연결 상태는 공용 GlobalExecutiveBar가 제공한다. 상태의 단일 기준을 공유하여 요약, 카드, 상세, 알림의 상태가 서로 달라지지 않게 한다.

---

## 25. MVP Priority

### 25.1 P0 — MVP

- Project Status / Task 수 기준 Progress
- Development Flow / Agent Status / Current & Next Activity
- Active Task 및 dependency에 따른 대기·실행 재개 상태
- 연관 Agent/Task 조건 대기 알림과 영향 범위 UI
- User Attention Center / Decision
- Task 완료와 Milestone 결과 승인 대기의 분리
- Milestone 결과 승인 / 수정 요청
- 지시 → 계획 → 반복 피드백 → 검토 완료 → 최종 실행 승인
- 승인 버전 식별 및 중복 실행 방지
- Activity Timeline
- QA 전체 결과를 포함한 Milestone 결과 승인 / 추가 검증 여부 확인
- 추가 검증 계획의 피드백·최종 승인
- Quality Gate와 Milestone 결과 승인의 구분
- Token Usage / Recent Artifact / Command Input
- 결정·승인·의존성에 따른 조건 대기 및 실행 재개
- 항상 보이는 실시간 연결 상태, 마지막 동기화 시각, 연결 끊김 안내

### 25.2 P1 — 확장

- 정량적인 Impact 추정 및 Token Usage Trend
- Token / Cost Guard
- Requirement Traceability 고도화
- 일반 Artifact 다중 버전 Diff 고도화 (Task Git Diff는 P0)
- Decision / Approval History 검색
- Risk Summary / Checkpoint History

### 25.3 P2 — 고도화

- Actual Rollback
- Advanced Cost Prediction
- Multiple Agent Comparison
- Custom Dashboard
- Automatic Risk Analysis
- User Intervention Level

우선순위는 요구사항 범위이며 현재 데모 구현 완료 목록을 의미하지 않는다.

---

## 26. Acceptance Criteria

1. 사용자는 현재 개발 단계, 전체 Task 수, 완료 Task 수 및 가중치 없는 진행률을 확인할 수 있다.
2. PM / Frontend / Backend / QA의 현재 작업과 다음 작업을 확인할 수 있다.
3. Task 완료 100%, Milestone 결과 승인 대기, 승인 완료, 수정 요청을 명확히 구별할 수 있다.
4. Decision이 필요한 경우 관련 Agent/Task가 조건 대기되고, 독립 작업은 계속 진행한다.
5. 중단 시 알림 및 UI에서 Agent/Task ID, 사유, 결정 링크, 재개 조건, 계속 진행 중인 작업을 확인할 수 있다.
6. 사용자 결정 이후 관련 작업만 재개되며, 미완료 선행 Task가 있는 후속 작업은 계속 대기한다.
7. 결정 하나를 해결해도 다른 미해결 Decision/Approval/Dependency는 유지한다.
8. 새 지시를 전송해도 개발 변경·추가 검증은 즉시 실행되지 않는다.
9. 사용자는 계획과 영향을 확인하고 여러 번 피드백할 수 있다.
10. 피드백으로 계획이 바뀌면 새 버전으로 다시 검토하고 최종 승인해야 한다.
11. 검토 완료만으로 실행되지 않으며, 별도의 최종 실행 승인이 필요하다.
12. 이전 계획 버전 승인 및 중복 승인 요청으로 새 버전 또는 중복 실행을 시작할 수 없다.
13. 최종 승인 완료 상태와 실제 실행 시작 상태를 구분하고 남은 대기 조건을 표시한다.
14. Milestone의 Task와 QA 완료 후 결과 버전에서 검증 범위·대상별 결과·실패 증거·미검증 범위·Commit을 확인할 수 있다.
15. 사용자는 Milestone 결과를 승인하거나 수정·추가 검증을 요청할 수 있으며, 추가 검증 여부에 명시적으로 응답한다.
16. 추가 검증은 계획·피드백·최종 실행 승인 이후에만 시작한다.
17. 실패한 기술 Gate가 있으면 Milestone 결과를 승인할 수 없으며, 결과 화면을 확인해도 실패 건수는 유지된다.
18. Project / Agent / Task 수준의 Token을 확인할 수 있다.
19. 주요 Artifact를 미리보기하고 관련 Requirement/Task/Test를 추적할 수 있다.
20. 사용자 지시, 계획 버전, 승인, Agent 전달, 대기·실행 재개가 Timeline에 기록된다.
21. 연결 상태를 항상 확인할 수 있고, 연결 단절 시 마지막 상태·시각 및 동기화되지 않았음을 알 수 있다.
22. 연결 단절·재시도 동안 확인되지 않은 명령을 실행 완료로 표시하지 않는다.
23. 모바일에서는 사용자 조치 항목이 작업 공간보다 먼저 표시된다.

필수 검증 시나리오:

| 시나리오 | 기대 결과 |
| --- | --- |
| 인증 전략 미확정 | Backend / QA 조건 대기, Frontend 독립 작업 실행 |
| 인증 전략 확정, BE-08 미완료 | Backend 재개, QA-32 선행 작업 대기 |
| BE-08 완료 | dependency 충족 후 QA-32 실행 가능 |
| 결정 하나 해결, 다른 승인 미완료 | 나머지 조건 대기 유지 |
| 계획 피드백 추가 | 새 버전 검토로 복귀, 이전 승인 효력 없음 |
| 검토 완료 후 최종 승인하지 않음 | 실행하지 않음 |
| 최종 승인 요청 중복 전송 | 한 번만 승인·실행 |
| QA 39 통과 / 3 실패 | Milestone 결과 승인 불가, 실패 3건 및 Gate 보류 유지 |
| Milestone Task 6/6·QA 통과·게시 완료 | 진행률 100%, Milestone 결과 승인 대기, 다음 Milestone 실행 대기 |
| 추가 검증 요청만 전송 | 계획 검토만 시작, 실제 검증은 보류 |
| 연결 끊김 | 상태 단절 표시, 미확인 명령 완료 처리 금지 |

---

## 27. Core UX Concept

~~~text
Observe → Understand → Decide → Control → Observe
~~~

변경 요청의 실행 흐름:

~~~text
Request → Plan → Feedback ↔ Revised Plan → Final Approval → Execute → Review
~~~

사용자는 다음 질문에 바로 답할 수 있어야 한다.

- 어디까지 개발되었는가?
- AI는 지금 무엇을 하고, 다음에는 무엇을 하는가?
- 어떤 Agent/Task가 왜 멈췄고, 무엇은 계속 진행되는가?
- 내 결정 이후 바로 재개되는 작업과 더 기다려야 하는 작업은 무엇인가?
- Agent가 생성만 마친 것인가, 사람이 승인한 것인가?
- 지금 보는 계획은 몇 번째 버전이며 최종 실행 승인을 했는가?
- QA는 무엇을 검증했고 어떤 결과·한계가 있는가?
- 추가로 검증할 내용이 있는가?
- 현재 연결과 표시 정보는 최신인가?
- Token과 비용은 얼마나 사용했고 어떤 결과물이 생성되었는가?

본 Dashboard는 AI의 계획·실행·결과를 관찰하고 필요한 순간 사용자가 판단하여 개발 방향을 제어하는 Human-AI Development Control Center이다.

---

## 28. Realtime Connection & State Freshness

상단 등 항상 보이는 위치에 실제 서비스의 연결 상태를 표시한다. 연결 상태와 개발 실행 상태는 구분한다. Task가 조건 대기 상태여도 통신 연결은 정상일 수 있다.

| 연결 상태 | 표시와 동작 |
| --- | --- |
| Connecting | 연결 확인 중. 아직 최신 상태로 확정하지 않음 |
| Connected | 이벤트 수신 또는 상태 동기화 확인, 마지막 갱신 시각 표시 |
| Reconnecting | 자동 재연결 중임을 알리고 기존 데이터를 마지막 확인 상태로 표시 |
| Disconnected / Offline | 연결 단절 및 데이터가 최신이 아닐 수 있음을 표시 |
| Error | 확인된 오류와 가능한 다음 Action 제공 |

브라우저가 온라인이라는 사실만으로 Agent 서버 연결 정상이라고 표시하지 않는다. 운영 환경에서는 실제 heartbeat 또는 성공한 상태 동기화에 근거해야 한다.

연결 단절 중에는 미확인 결정·승인·제어 요청을 성공 처리하지 않는다. 재연결 후 실제 Task 상태와 요청 처리 결과를 동기화하며 중복 실행을 방지한다.

실제 서비스와 연결되지 않은 프로토타입은 “데모 연결”, “AI 서버 미연결”을 명시한다. 데모 타이머를 실제 Agent heartbeat처럼 표시하지 않는다.

전송은 SSE를 사용한다. heartbeat·timeout·재연결·snapshot 복구는 [공통 계약](06-integration-contract.md)의 MVP 기본안을 따른다.

---

## 29. State & Approval Relationships

실행·생성·사람 승인·연결을 단일 status 값 하나로 합치지 않는다.

| 축 | 예시 |
| --- | --- |
| 실행 | TODO / RUNNING / WAITING / BLOCKED / REVIEW / COMPLETED / FAILED / CANCELLED |
| 결과 생성 | GENERATING / GENERATED / FAILED |
| Milestone 결과 검토 | PENDING / APPROVED / REVISION_REQUESTED / REJECTED |
| 계획 | REVIEW / FINAL_APPROVAL_PENDING / APPROVED_WAITING / EXECUTING |
| QA Run | RUNNING / COMPLETED, 개별 PASS / FAIL / SKIPPED |
| 연결 | CONNECTING / CONNECTED / RECONNECTING / DISCONNECTED / ERROR |

권장 관계:

~~~text
Requirement → Task → Agent → Artifact version → QA → Git Publish
Milestone → Milestone Result version → Human Review → Next Milestone
Decision → affected Task / Agent → Wait reason → Execution condition
Command → Plan version → Feedback → Final execution approval → Execution
QA Run → Milestone Result → Human review / Additional validation plan
~~~

서로 다른 상태를 동시에 보여줄 수 있어야 한다. 예: “Task 6/6 완료 · Milestone 승인 대기”, “Milestone 승인 완료 · 다음 Task 선행 조건 대기”, “QA 실패 3건 · Milestone 승인 불가”.

---

## 30. AI 활용 Feedback 패널 연동

[02번 요구사항](02-feedback-requirements.md)에 따라 프로젝트 완료 후 AI 활용 지표·Score·Feedback(Comment)·이전 프로젝트 비교를 Dashboard 내부 섹션/상세 패널로 제공한다. 제품의 Frontend/Backend/Security 품질 평가 화면이나 별도 최상위 탭을 추가하지 않는다.

- `DASH-008`: Project 상태가 ACTIVE일 때는 수집 중인 Token/Cost·Task 실행 주체 등 원천 지표와 `프로젝트 완료 후 집계` 안내를 표시한다. `COMPLETED` 이후에는 Autonomy/Resource Efficiency/Area Distribution 점수, 종합 Score 또는 N/A, scoreVersion, AI 수행 Task 비율, 사용자 개입, Token/Cost, 영역별 분포와 Trend를 표시한다. Score 설명에서 적용 산식과 N/A 제외 여부를 확인할 수 있어야 한다.
- `DASH-009`: Comment의 aspect/severity/observation/impact/suggestion을 조회하고, 완료된 Project의 Report에만 입력·수정할 수 있게 한다. 건수는 미해결 건수가 아닌 전체 Comment 수로 표시한다.
- `DASH-010`: `/api/utilization`, `/api/utilization/{reportId}/metrics`, `/api/utilization/{reportId}/feedbacks`, `/api/feedbacks/{feedbackId}`로 생성·조회·수정하며 이전 Project Report와 핵심 지표를 비교한다.
- 일반 사용자 지시의 계획 피드백(19장), Milestone 결과 수정 요청(9장), 추가 검증(13장)은 오케스트레이터의 별도 동작이다. UF Comment를 Agent에게 전달하거나 Comment 저장을 실행·재작업 지시로 해석하지 않는다.
- AI 활용 Score는 Task 진행률·QA Gate·제품 품질 Score와 구분한다. 미수집 지표는 0으로 바꾸지 않고 `미수집`으로 표시하며, 비교 대상의 규모·성격이 다르면 비교 한계를 표시한다.
- 인수 기준: ACTIVE Project의 Report/Comment 생성은 거부되고 완료 안내가 표시됨; COMPLETED Project는 AI 수행 Task 비율·Token/Cost·영역별 분포·Score/Comment를 조회 가능; Comment 기록만으로 Task/Agent/진행률/Git 상태가 변하지 않음.
