# 06. 공통 데이터·API·이벤트 계약

> 문서 ID: CONTRACT · 상태: 통합 구현 기본안 · 기준일: 2026-09-08
> 상위 문서: [마스터](00-master-requirements.md)
> 이 문서는 기능별로 달랐던 상태와 누락된 연결 지점을 정의한다. 구체적 런타임/재연결 수치는 기존 사용자 합의가 아닌 해커톤 기본안이다.

## 1. 식별자와 저장 규칙

- DB 필드는 snake_case, JSON 필드는 camelCase, enum은 UPPER_SNAKE_CASE를 사용한다.
- 엔터티 ID는 UUID 문자열이다. 문서의 `PROJECT-001`, `TASK-001` 등은 설명용 별칭이다. requirementId는 `PM-001` 같은 문서 ID를 사용할 수 있다.
- Project 하위 요청은 projectId로 소속을 검증한다. 다른 Project의 Agent/Task/Milestone/Artifact 연결은 거부한다.
- 시각은 UTC ISO 8601로 저장·전송하고 화면에서 사용자 시간대로 표시한다. 시뮬레이션 시각은 없다.
- SQLite에 상태·승인·이력을 저장한다. 브라우저 캐시가 서버 상태를 덮어쓰지 않는다.
- 모듈 경로는 PM/오케스트레이터의 Project 하위 경로와 UF의 utilization/feedbacks 전역 경로를 구분한다.
- API 예시의 식별자 표기는 `{projectId}`로 통일한다. 내부 Python 인자 `project_id`와 동일 값이다.

## 2. 상태 계약

### 2.1 실행과 생성

| 대상 | 상태 | 규칙 |
| --- | --- | --- |
| Project | DRAFT, AGENT_MATCHING, READY, ACTIVE, COMPLETED, ARCHIVED | 실행 준비 성공 후 ACTIVE; 완료 조건 충족 시 COMPLETED; 아카이브는 사용자 동작 |
| ProjectAgent | ASSIGNED, IDLE, WORKING, WAITING, BLOCKED, REMOVED | Task 완료 후 IDLE; Agent 자체 DONE은 사용하지 않음 |
| Task | TODO, RUNNING, WAITING, BLOCKED, REVIEW, COMPLETED, FAILED, CANCELLED | COMPLETED는 승인된 Plan, 기술 QA 통과, Git 게시 성공, 실행 주체 기록 조건 충족 |
| Milestone | PLANNED, IN_PROGRESS, DONE, BLOCKED | 하위 Task에서 파생한 상태/진행률; 직접 수정 불가 |
| Artifact 생성 | GENERATING, GENERATED, FAILED | GENERATED는 사람 승인이나 Task 완료가 아님 |
| Plan | REVIEW, FINAL_APPROVAL_PENDING, APPROVED_WAITING, EXECUTING, COMPLETED, SUPERSEDED | 승인된 버전만 실행; 변경 시 새 버전 REVIEW |

Task의 기본 흐름은 `TODO → WAITING(조건이 있으면) → RUNNING → REVIEW → COMPLETED`다. 실행 오류는 FAILED, 환경/복구 문제는 BLOCKED다. 수정 승인 시 같은 Task에 attempt를 추가하고 RUNNING으로 전이하며 기존 결과는 이력으로 남긴다. CANCELLED는 아직 실행하지 않은 Task만 허용한다. 완료 Task를 다시 열어 과거 완료 결과를 덮어쓰지 않고 새 변경 Task를 만든다.

`waitReasons[]`는 `DEPENDENCY`, `DECISION`, `PLAN_APPROVAL`, `MILESTONE_APPROVAL`, `ADDITIONAL_VALIDATION`, `PROJECT_WRITE_LOCK`과 참조 ID를 가진다. 여러 이유가 있으면 전부 해결되어야 한다. Task의 REVIEW는 기술 QA 또는 Git 게시 준비 상태이며 사람의 Task별 결과 승인을 뜻하지 않는다. Pause/Resume API 및 PAUSED enum은 MVP에서 사용하지 않는다.

### 2.2 기술 QA·승인·게시

| 축 | 상태 | 규칙 |
| --- | --- | --- |
| QARun 실행 | QUEUED, RUNNING, COMPLETED, ERROR | COMPLETED는 검사 처리 종료이며 전부 PASS를 의미하지 않음 |
| TestResult | PASS, FAIL, SKIPPED | ERROR는 Run/검사 실행 오류 증거에 별도 기록 |
| 기술 Gate | PENDING, PASSED, FAILED, ERROR | 필수 검사 전부 PASS이어야 PASSED |
| 사람 검토 | NOT_REQUIRED, PENDING, APPROVED, REVISION_REQUESTED, REJECTED | Plan 또는 MilestoneResult ID/버전에 연결 |
| 추가 검증 선택 | UNANSWERED, NONE, REQUESTED | Milestone 결과 승인 요청에서 명시적 선택 필요 |
| Git 게시 | NOT_STARTED, NO_CHANGES, COMMITTED_LOCAL, PUSHED, FAILED, SYNC_REQUIRED | 기존 Commit 존재 시 실패에도 SHA 유지 |
| 연결(UI) | CONNECTING, CONNECTED, RECONNECTING, DISCONNECTED, ERROR | 실제 snapshot/heartbeat 근거로만 표시 |

Task 게시 가능 조건은 `approvedPlanVersion == task.planVersion && technicalGate == PASSED && currentHash == qaValidatedHash`다. Task별 Artifact/QA 사람 승인은 요구하지 않는다. Push 성공과 `executionMode != null`을 모두 확인해야 Task를 COMPLETED로 바꾼다.

Milestone 결과 승인은 `MilestoneResult` 버전에 적용한다. 결과 버전은 해당 Milestone의 비취소 Task ID·Artifact hash·QA Run ID·Commit SHA 목록을 정렬하여 만든 snapshot/hash다. 구성이 바뀌면 새 버전을 생성하고 이전 승인은 승계하지 않는다. 모든 Task가 COMPLETED되면 결과 검토를 열고, 포함된 필수 QA Gate가 PASSED일 때만 승인 동작을 활성화한다. 사용자가 `reviewStatus=APPROVED`와 `additionalValidation=NONE`을 같은 요청으로 명시해야 승인된다. `REQUESTED`이면 승인 대신 추가 검증 Plan을 만든다.

사람 승인은 두 목적을 구분한다. Plan 실행 승인은 실행 전에 Plan 버전에 적용하고, 개발 결과 승인은 실행 후 MilestoneResult 버전에 적용한다. 개별 Task/Artifact/QARun에는 별도 사람 결과 승인을 만들지 않는다.

Project 완료 조건은 모든 비취소 Task가 Milestone에 속해 COMPLETED이고 모든 Milestone의 최신 결과가 APPROVED인 것이다. 마지막 Milestone 승인 트랜잭션에서 Project를 COMPLETED로 바꾸고 `completedAt`을 기록한다. 비취소 미소속 Task, 빈 Milestone, 승인 대기/수정 요청/반려 Milestone이 있으면 완료 전환을 거부한다.

UF Comment는 AI 활용에 대한 기록 데이터다. Report·Score·Comment의 생성·수정은 Task 상태·진행률·QA/게시 Gate를 변경하지 않는다. 실제 QA 실패에 따른 차단은 QARun 기반 기술 Gate에서 처리한다.

## 3. 모듈 사이 공통 데이터

### 3.1 PM 관리 모델의 보완 필드

[PM 상세 모델](01-project-management-requirements.md)에 다음 실행 연결 데이터를 추가한다.

| 모델 | 필수 연결 데이터 |
| --- | --- |
| Project | repository 설정, revision, activePlanId/Version, completedAt(nullable) |
| ProjectAgent | currentTaskId(nullable), activitySummary, nextTaskId(nullable); 실행 상태는 worker가 갱신 |
| Task | requirementIds[], dependencyTaskIds[], approvedPlanId/Version, currentAttemptId, waitReasons[], executionMode(AI_AGENT/HUMAN/MIXED/null), revision |
| TaskAttempt | id, taskId, sequence, artifactVersion, 시작/종료/실패 원인 |
| ArtifactVersion | id, taskId/attemptId, version, 생성 상태, filePaths[], baseCommitSha, contentHash |
| PlanVersion | id, projectId, version, request, steps, agents, scope, dependencies, validation, impact, status |
| PlanFeedback | id, planId/version, text, createdAt |
| Decision | id, scopeTaskIds[], reason, options, selectedAnswer, status(OPEN/RESOLVED), resolvedAt |
| Approval | id, kind(PLAN_EXECUTION/MILESTONE_RESULT), targetId/version, status, actor, requestId |
| QARun | 실행 worker/QA Agent가 보고한 대상 버전/hash, 범위, 검사 결과·증거, 시작/종료, 기술 Gate, reportArtifactId |
| MilestoneResult | id, milestoneId, version, resultHash, task/artifact/qaRun/commit snapshot, reviewStatus, additionalValidation, createdAt |
| UtilizationReport | UF의 projectId, status, score/scoreVersion, previousReportId(nullable), 집계 시점과 원천 revision; Project당 1개 |
| UtilizationMetric | reportId, aspect(AUTONOMY/RESOURCE_EFFICIENCY/AREA_DISTRIBUTION), metricKey/value/unit, roleCode(nullable), measuredAt, collectionStatus |
| Feedback(Comment) | reportId, aspect, severity, observation, impact, suggestion; Agent 배정·재작업·resolve 상태 없음 |
| TaskPublish | taskId/attemptId/artifactVersion, requestId, status, commitSha, branchUrl, error |
| ActivityEvent | id, projectId, revision, type, entityId, payload, occurredAt |
| CommandReceipt | requestId, payloadHash, operation, accepted/result/error; 재시도 중복 방지 |

배열은 MVP에서 JSON TEXT로 저장 가능하다. Task dependency는 같은 Project 안에서만 참조하며 자기 참조·순환 의존은 거부한다. requirementIds는 문서 내 요구사항 표식의 선택적 추적 문자열이며 별도 Requirement 엔터티가 아니다. requirementIds와 Task description은 개발 추적 정보이며 UF의 제품 품질 평가 기준으로 사용하지 않는다.

### 3.2 집계와 표시

- assignedAgentCount: status != REMOVED인 Project Agent 수. 실제 실행 수는 WORKING 수로 따로 계산한다.
- 프로젝트 Task 진행률: CANCELLED 제외 전체 Task 중 COMPLETED의 비율, 정수 반올림. 검토 중 계획의 step은 편성 전 Task 분모에 포함하지 않는다.
- Project/Milestone 진행률: 해당 범위의 `progressCurrent = COMPLETED 수`, `progressTotal = CANCELLED 제외 전체 Task 수`, `progressPercent = total > 0 ? round(100 × current / total) : 0`. 모두 서버 계산 읽기 전용이다.
- Project는 미소속 Task까지 포함하고, Milestone은 소속 Task만 센다. 다중 Agent 연결로 중복 집계하지 않으며 Milestone 퍼센트 평균·Task 가중치·PM 수동 입력을 사용하지 않는다.
- Task 생성/완료/취소/이동 시 해당 집계를 갱신한다. snapshot의 Task와 집계는 같은 DB 읽기 트랜잭션/revision에서 가져오고 SSE `milestone.updated`/`project.updated`로 두 탭을 갱신한다.
- 빈 범위는 0/0, 0%, `작업 없음`이다. Task 추가로 분모가 늘면 진행률은 내려갈 수 있다. CANCELLED 제외는 기존 정책을 유지하며 취소 이력을 남긴다.
- Milestone 상태: 대상 없음/전부 TODO는 PLANNED, 대상 전부 COMPLETED는 DONE, 미완료 BLOCKED/FAILED 포함 시 BLOCKED, 그 외 IN_PROGRESS. DONE 이후 Task를 추가하면 다시 계산한다.
- Agent별 진행률을 표시할 때도 담당 Task의 완료 수/전체 수를 사용한다. 개별 Task에는 임의의 37% 같은 진행률을 입력하지 않고 상태를 표시한다. UF Score의 관점별 가중치는 진행률과 무관하다.
- Token: 실측 input/output/total 또는 null. Cost: provider 가격 설정이 있을 때만 추정치와 산정 기준을 반환한다. Budget과 차감 계산하지 않는다.
- 요구사항/Task/Artifact/Test/Commit의 ID 연결을 상세 화면에서 조회 가능하게 한다.

### 3.3 UF 원천 지표 계약

- `aiCompletedTaskCount`는 `status=COMPLETED && executionMode=AI_AGENT`인 Task 수다. 분모 `eligibleTaskCount`는 CANCELLED를 제외한 전체 Task 수이며, `aiCompletedTaskRatio = aiCompletedTaskCount / eligibleTaskCount`다. MIXED Task 수와 비율은 별도 지표로 제공한다.
- 영역별 수행 분포는 완료 Task의 `roleCode`와 `executionMode`를 사용한다. PM/Frontend/Backend/QA 외 역할은 `OTHER`로 합산하되 원래 roleCode를 상세 데이터에 유지한다.
- 사용자 개입은 RESOLVED Decision 수, PlanFeedback 수, Milestone `REVISION_REQUESTED` 수를 각각 집계한다. 이를 하나의 임의 점수로 합치지 않고 원천 건수를 보존한다.
- Token은 모델 호출마다 projectId, taskId(nullable), projectAgentId(nullable), roleCode(nullable), stage, input/output/total, measuredAt을 기록한다. Cost는 사용 모델·가격표 버전·통화를 함께 저장하며 계산할 수 없으면 null/미수집이다.
- UF는 Project가 COMPLETED된 revision의 원천 snapshot을 읽어 집계한다. 같은 Project에 대한 Report 생성 재시도는 기존 Report를 반환하며 중복 Report를 만들지 않는다.
- MVP `scoreVersion=UF_MVP_V1`은 세 관점을 같은 가중치로 평균한다. Autonomy는 `100 × AI_AGENT 완료 Task / eligibleTaskCount`, Area Distribution은 `100 × AI_AGENT 또는 MIXED 수행이 있는 핵심 영역 수 / 완료 Task가 있는 핵심 영역 수`다. 핵심 영역은 PM/Frontend/Backend/QA이며 분모가 0이면 해당 관점은 N/A다.
- Resource Efficiency는 AI 환산 Task(`AI_AGENT=1`, `MIXED=0.5`)당 totalTokens를 직전 비교 Report와 비교하여 `min(100, 100 × 이전 Report의 Task당 Token / 현재 Report의 Task당 Token)`으로 계산한다. 비교 Report·Token·AI 환산 Task가 없거나 0이면 N/A다. Cost는 보조 지표로 표시하고 중복 반영하지 않는다.
- 종합 Score는 유효 관점만 같은 가중치로 재정규화해 정수 반올림하고, 유효 관점이 전부 없으면 N/A다. 제품 품질·QA 통과율은 입력에 포함하지 않으며 산식 변경 시 새 scoreVersion을 사용한다.
- 직전 비교 Report는 같은 `projectType`의 COMPLETED Project 중 현재 Project보다 `completedAt`이 이른 최신 Report를 우선한다. 없으면 다른 유형을 포함한 최신 Report를 사용하고 화면에 유형/규모 차이를 표시하며, Report 자체가 없으면 비교 없음으로 반환한다.

## 4. HTTP 계약

### 4.1 기본 조회·관리

PM의 `/api/projects`, `/api/agent-profiles`, `/api/roles`, `/api/llm-models`, 프로젝트 하위 `/agents`, `/tasks`, `/sprint-milestones` API를 재사용한다. 조회 응답은 상태를 반환하고 관리 PATCH로 승인 Gate를 우회해 RUNNING/COMPLETED를 지정할 수 없다. 실행 상태 전이는 서버 오케스트레이터가 담당한다.

### 4.2 공통 오케스트레이션 API

| Method / 경로 (`/api/projects/{projectId}` 기준) | 입력/역할 | 주요 응답 |
| --- | --- | --- |
| GET `/snapshot` | 두 탭 초기화·재연결 | revision, Project/Agent/Task/Milestone, 계획/대기 승인/QA/AI 활용 Report·Comment/Git 요약, 최근 이벤트 |
| GET `/events` | SSE 구독 | heartbeat, project.updated 이벤트 |
| POST `/commands` | requestId, instruction, targetAgentIds | planId, version, REVIEW; 코드 실행 없음 |
| POST `/plans/{planId}/feedback` | requestId, expectedVersion, feedback | 새 version, REVIEW |
| POST `/plans/{planId}/review-complete` | requestId, expectedVersion | FINAL_APPROVAL_PENDING |
| POST `/plans/{planId}/approve` | requestId, expectedVersion | 승인 기록, APPROVED_WAITING 또는 EXECUTING |
| POST `/decisions/{decisionId}/resolve` | requestId, expectedRevision, answer | 해결 기록, 남은 waitReasons |
| GET `/qa-runs/{runId}` | Run 조회 | 범위, 결과, 증거, 기술 Gate, 사람 검토 |
| GET `/sprint-milestones/{milestoneId}/result` | 결과 조회 | resultVersion/hash, Task·Artifact·QA·Commit 요약, 승인 상태 |
| POST `/sprint-milestones/{milestoneId}/result/reviews` | requestId, expectedResultVersion, reviewStatus, additionalValidation, feedback | Milestone 승인 또는 수정·추가 검증 Plan 생성 |
| POST `/tasks/{taskId}/publish` | requestId, artifactVersion, qaRunId | TaskPublish; 버전·기술 QA·Plan 승인 서버 검증 |
| GET `/tasks/{taskId}/artifacts` | 결과 조회 | 버전, 내용/Diff, Test/Commit 연결 |
| GET `/activity` | cursor, limit | 저장된 업무 이벤트 |

UF는 UtilizationReport·UtilizationMetric·Feedback(Comment)을 저장하고 PM/오케스트레이터의 완료 snapshot과 계측 데이터를 읽기 전용으로 참조한다. 계획 피드백·Decision·승인·QA·실제 후속 실행은 오케스트레이터 책임이다. UF는 별도 제품 품질 Evaluation이나 자동 재작업 Agent를 만들지 않는다. 브라우저의 임의 명령 실행 API를 만들지 않는다.

UF 경로는 위 표의 Project 접두사 규칙에서 제외한다. `/api/utilization`, `/api/utilization/{reportId}/metrics`, `/api/utilization/{reportId}/feedbacks`, `/api/feedbacks/{feedbackId}` 등 [02번 9.2장](02-feedback-requirements.md)의 전역 경로를 사용한다. UF는 `/api/projects/*`를 소유하지 않으며 모든 연결 ID의 Project 소속을 서버에서 검증한다. Project COMPLETED 전환 후 오케스트레이터가 `POST /api/utilization`을 호출하며, 운영자가 같은 API로 실패 건을 재시도할 수 있다. Project가 COMPLETED가 아니면 409를 반환하고, 같은 Project에 반복 요청하면 기존 Report를 반환한다. Feedback 생성·수정도 완료된 Project의 Report에만 허용한다.

### 4.3 명령·오류 처리

- 상태 변경 요청에 requestId를 사용한다. 같은 ID/같은 payload는 기존 결과를 반환하고 같은 ID/다른 payload는 409로 거부한다.
- expectedVersion/expectedRevision 불일치는 409이며 최신 상태를 다시 읽는다. 이전 Plan 또는 Milestone 결과 승인창으로 새 버전을 승인하지 않는다.
- 비동기 작업 접수는 202 + commandId/status를 반환한다. 접수는 실행 성공이 아니며 최종 결과를 snapshot/SSE에서 확인한다.
- 오류 형태: `{ "code": "STALE_VERSION", "message": "계획 버전이 변경되었습니다.", "details": {}, "requestId": "..." }`.
- 의미/형식 유효성 오류는 400(프레임워크 스키마 오류 422 가능), 없음 404, 상태 충돌 409, 외부 시스템 오류 502/503. UI는 code와 재시도 가능 여부를 사용한다.
- plan/approval/command receipt와 상태 변경을 트랜잭션으로 저장한다. 외부 Git/LLM 작업은 receipt의 처리 단계를 기록하여 DB commit과 외부 부작용 사이의 실패를 복구한다.

## 5. SSE와 프론트엔드 상태 동기화

### 5.1 이벤트 형식

```text
id: 41
event: project.updated
data: {"eventId":"41","projectId":"project-uuid","revision":18,"type":"task.updated","entityId":"task-uuid","occurredAt":"2026-09-08T01:00:00Z"}
```

MVP SSE는 **snapshot 무효화 알림**으로 사용한다. 클라이언트는 새로운 revision 이벤트를 받으면 snapshot을 다시 읽고 같은 Zustand store에 반영한다. 두 탭이 개별적으로 업무 상태를 계산/저장하지 않는다. 이벤트 유실 복구를 위해 복잡한 모든 payload 재생 엔진을 만들 필요는 없다.

업무 type은 project.updated, agent.updated, task.updated, milestone.updated, milestone-result.updated, plan.updated, decision.updated, approval.updated, qa.updated, utilization.updated, artifact.updated, feedback.updated, git.updated를 사용한다. heartbeat는 업무 Activity에 쌓지 않는다.

### 5.2 연결·복구 기본안

- 먼저 SSE를 연결하고 snapshot을 읽는다. 초기 조회 중 더 높은 revision 알림이 오면 다시 snapshot을 읽는다.
- 서버는 기본 15초마다 heartbeat를 전송한다. 45초 동안 heartbeat/업데이트가 없거나 연결 오류가 나면 RECONNECTING/ DISCONNECTED를 표시한다.
- 재연결은 1/2/5/10초의 제한된 backoff로 시도하며 최대 간격 10초를 유지한다. 성공 후 전체 snapshot을 재조회한다.
- Last-Event-ID는 전달할 수 있으나 MVP는 이를 영구 replay 보장으로 사용하지 않는다. 최신 snapshot과 `/activity`가 복구 기준이다.
- 중복/오래된 revision은 무시한다. snapshot 응답이 현재 store보다 오래되면 적용하지 않는다.
- 연결 상태·마지막 성공한 snapshot 시각은 항상 표시한다. 연결 단절 시 승인/실행 요청을 성공으로 낙관 표시하지 않는다.
- 서버 재시작 후 RUNNING Task/Run을 확인하여 불확실한 작업은 BLOCKED/ERROR로 복구한다. 새 Agent 호출/Commit을 자동 중복 실행하지 않는다.

## 6. 3D 선택 계약

```ts
type TycoonSelection = {
  projectId: string;
  type: 'agent' | 'desk' | 'monitor' | 'inbox' | 'outbox';
  projectAgentId?: string;
  roleCode?: string;
};
```

씬이 `tycoon-item-selected` CustomEvent를 발송하고 DOM은 ID로 공통 store를 조회해 상세 패널을 연다. agent 선택에는 projectAgentId가 필수이고, 나머지는 roleCode가 필수다. 목업의 오래된 userData 전체를 실제 업무 상태로 사용하지 않는다.

서버 → store → React/3D는 상태 렌더링 경로이고, 씬 → CustomEvent → DOM은 선택 경로다. CustomEvent는 SSE나 서버 저장을 대체하지 않는다.

## 7. QA 결과 연동 기준

이 절은 Dashboard의 QA/Gate를 위한 실행 결과 계약이다. 실제 검증은 worker/QA Agent가 수행하고 오케스트레이터가 기술 Gate와 사람 승인 조건을 집계한다. UF는 QA 결과를 제품 품질로 평가하지 않으며, QA 단계의 AI 호출량이 있으면 Resource 원천 계측만 읽는다.

- QARun은 대상 Artifact 버전/hash, 범위, 테스트별 기대 결과/PASS/FAIL/SKIPPED, 실행 증거, 전체 완료 여부, 미검증 범위를 제공한다.
- Total = Passed + Failed + Skipped. 통과율은 Passed/(Passed+Failed)를 정수 반올림하고 실행된 검사가 0개면 N/A다. 파싱하지 못한 수치는 미수집으로 표시한다.
- 기술 Gate는 전체 검증 완료, 필수 검사 전부 PASS, 실행 오류 없음일 때 PASSED다. 필수 SKIPPED/검사 누락/설정 누락은 통과가 아니다.
- 승인된 검증 계획과 실제 실행 명령·종료 코드/결과를 연결한다. 정확한 테스트 명령과 도구는 저장소 확인 후 결정한다. 테스트가 실행되지 않았으면 성공으로 보고하지 않는다.
- QA 결과는 MilestoneResult에 포함한다. Dashboard에서 Milestone 단위 검토/추가 검증 응답을 받고 오케스트레이터가 저장한다. 실패 Gate가 있으면 승인을 비활성화하며 결과 열람은 실패 상태를 바꾸지 않는다. UF의 AI 활용 Score도 Gate를 대체하지 않는다.
- 개발 Task 내부의 검증 Run은 별도 후행 QA Task의 완료를 기다리지 않는다. 별도 QA Task는 게시된 개발 Task들을 대상으로 통합 검증을 수행한다. 개발 완료가 후행 QA 완료를 기다리고 후행 QA가 개발 완료를 기다리는 순환을 만들지 않는다.
- 검증 도중 코드가 바뀌면 해당 결과는 최신 버전의 검증 근거가 될 수 없다. Git 게시 전 동일 hash를 확인한다.

## 8. 통합 확인 기준

- 같은 fixture의 ID/상태/진행률을 API·Dashboard·Tycoon에서 동일하게 해석한다. 빈 Milestone, Task 추가·취소·완료·Milestone 이동·다중 Agent 연결에도 중복 없이 재계산한다.
- UF Report·Comment 생성/수정은 활용 지표·Score·Comment만 갱신하고 Task 수·상태·진행률·Agent 실행을 변경하지 않는다.
- ACTIVE Project의 UF Report/Comment 생성은 거부하며, 완료 조건 충족과 Project COMPLETED 전환 뒤 Project당 Report 하나만 생성한다.
- Task별 QA 통과와 Push 후 COMPLETED가 되며, Milestone 결과 승인 대기/반려가 기존 Task의 COMPLETED와 진행률 100%를 되돌리지 않는다.
- MilestoneResult 중복 승인 요청은 한 번만 처리하고, 오래된 resultVersion 승인은 409로 거부한다. APPROVED 이후 다음 sortOrder Milestone의 `MILESTONE_APPROVAL` 대기를 해제한다.
- 계획/Artifact 버전 변경·중복 승인·SSE 재연결·Push 재시도에 대해 실행/게시가 중복되지 않는다.
- 다른 Project의 ID, 순환 dependency, 현재 배정 수 미만 정원, 승인 없는 완료 상태 변경은 서버에서 차단한다.
- 실측값이 없는 Token/Cost/속도는 null/미수집으로 일관되게 표시한다.
