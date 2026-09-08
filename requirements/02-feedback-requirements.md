# 02. AI 활용 Feedback 요구사항

> 문서 ID: FB · 모듈명: AI Utilization Feedback(UF) · 상태: AI 활용 중심 재작성 · 기준일: 2026-09-08
> 상위 문서: [마스터](00-master-requirements.md) · 데이터 소유권: [PM](01-project-management-requirements.md) · 화면: [Dashboard](04-dashboard-requirements.md) · 연동: [06](06-integration-contract.md)
> 서비스 내부의 **AI 활용 지표**를 측정·기록·조회하고, AI 활용에 대한 Feedback(Comment)을 남긴다. 제품 자체의 Frontend/Backend/Security 품질 평가는 이 기능의 범위에서 제외한다. Agent 자동 전달·담당 Agent 배정·재작업 요청/실행 Loop도 범위에서 제외한다.

## 1. 개요와 목적

CompanyOps의 AI 개발 팀이 개발을 수행하는 과정에서 **AI를 얼마나·어떻게 활용했는지**를 지표로 측정·기록한다.

이 기능의 궁극적인 목적은 사용자가 **AI 활용 지표를 보고, 앞으로 AI를 더 잘 활용할 수 있도록 도움을 받는 것**이다. 제품 결과물의 품질(요구사항 충족, Frontend/Backend/Security 등)을 평가하지 않으며, 지표를 근거로 개발 Agent에게 자동 재작업을 지시하지 않는다.

이 기능의 최종 결과는 AI 활용 Score와 AI 활용에 대한 Feedback(Comment)이다. Comment는 활용 패턴에 대한 관찰과 개선 의견을 설명하는 기록이며, Task 실행 지시나 해결 상태를 관리하는 티켓, 사람 실행 승인을 의미하지 않는다.

## 2. 평가 관점

AI 활용 측면만을 대상으로 하며, 다음 관점에서 지표를 수집·기록한다.

| 관점(aspect) | 내용 |
| --- | --- |
| Autonomy | AI가 완료한 Task 규모와 자율 수행 정도 |
| Resource Efficiency | Token·Cost 등 AI Resource 사용 효율 |
| Area Distribution | PM/Frontend/Backend/QA 영역별 AI 활용 분포 |

지표는 일관된 관찰 기준이며 절대적인 합격 인증을 의미하지 않는다. 실제 계측값과 미수집 값을 구분하고, 미수집 값은 `미수집`으로 표시한다.

## 3. Feedback 시점

AI 활용 생산성에 대한 Feedback은 **QA를 포함한 모든 개발 단계가 종료되어 프로젝트가 완료된 시점**에 진행한다. QA까지 모두 끝난 뒤에만 해당 프로젝트 전체를 대상으로 AI 활용 Feedback을 기록할 수 있다.

```text
프로젝트 진행 중: AI 활용 지표(원천 데이터) 수집·누적
→ QA 포함 모든 개발 단계 종료 → 프로젝트 완료
→ AI 활용 지표 집계(UtilizationReport 생성)
→ AI 활용 Score 계산
→ AI 활용 Feedback(Comment) 기록
→ 조회·이전 프로젝트 비교
```

- 프로젝트 진행 중에는 지표를 수집·누적만 하고, Feedback 기록은 프로젝트 완료 이후에 수행한다.
- 프로젝트 단위로 하나의 AI 활용 Feedback 세트를 남긴다.
- Report 생성은 활용 기록 완료이며, Agent 호출·코드 변경·재작업 요청을 자동 발생시키지 않는다.

## 4. AI 활용 지표 (Utilization Metrics)

프로젝트 완료 시점에 다음 지표를 집계한다.

### 4.1 작업 수행 지표
- AI가 완료한 Task 수 / 취소되지 않은 전체 Task 수
- 영역별(PM/Frontend/Backend/QA) AI 수행 Task 분포

### 4.2 Resource 지표
- Total / Input / Output Token
- Estimated Cost (미수집 시 `미수집`)
- 영역별(PM/Frontend/Backend/QA) Token 사용량
- 개발 단계별 또는 시간별 Token Usage Trend (가능한 경우)

### 4.3 종합 활용도
- AI 활용 종합 Score (지표 기반 산출)
- 이전 프로젝트 대비 비교 (이전 Report가 있는 경우)

## 5. AI 활용 Score

Score는 활용 지표를 근거로 산출하며 **AI 활용 효율 관점** 전용이다. 제품 품질 Score나 Task 진행률과 섞지 않는다.

- 각 관점(Autonomy, Resource Efficiency, Area Distribution)을 지표 기반으로 점수화한다.
- 지표가 미수집이면 해당 관점은 집계에서 제외하고 유효 관점만으로 재정규화한다.
- 유효 관점이 없으면 Score는 N/A로 표시한다.
- 화면 표시는 정수 반올림한다.

Score는 절대 합격선이 아니라 프로젝트 간 AI 활용을 일관되게 비교하고 개선점을 찾기 위한 지표다.

## 6. Feedback(Comment)

### 6.1 Comment 데이터

Feedback은 오직 AI 활용 측면만 다루며, 지표에서 관찰된 사실·영향·개선 제안으로 구성한다.

```json
{
  "feedbackId": "feedback-uuid",
  "reportId": "report-uuid",
  "projectId": "project-uuid",
  "aspect": "RESOURCE_EFFICIENCY",
  "severity": "MEDIUM",
  "observation": "Backend 영역에서 Token 사용량이 다른 영역 대비 크게 높았다",
  "impact": "동일 결과 대비 Resource 소모가 커서 전체 비용 효율이 낮아졌다",
  "suggestion": "Backend 작업 단위를 더 작게 분할하면 AI Resource 효율이 높아진다"
}
```

- `aspect`: 활용 관점 (AUTONOMY / RESOURCE_EFFICIENCY / AREA_DISTRIBUTION)
- `observation`: 지표에서 관찰된 사실
- `impact`: 해당 활용 패턴이 개발에 미친 영향
- `suggestion`: 다음 프로젝트에서 AI 활용을 개선하기 위한 제안

프로젝트 소속은 Report를 통해 확인한다. targetAgent, 재작업 상태, resolve/배정 기능은 두지 않는다. Comment 수는 전체 기록 건수이며 미해결 작업 수로 표시하지 않는다.

### 6.2 Severity

Severity는 제품의 보안·기능 결함이 아니라 **AI 활용 효율 관점**에서 판단한다.

- HIGH: AI 활용 효율을 크게 저해한 패턴 (잦은 중단, 과도한 재작업, Resource 낭비).
- MEDIUM: 개선하면 활용도가 눈에 띄게 향상될 패턴.
- LOW: 사소한 개선 여지.

Severity는 영향 설명이며 Comment 생성만으로 Task를 중단하거나 재작업을 지시하지 않는다.

## 7. 결과 예시

```json
{
  "projectId": "PRJ-001",
  "reportId": "UF-001",
  "utilizationScore": 82,
  "metrics": {
    "aiCompletedTaskRatio": 0.83,
    "userDecisions": 4,
    "revisionRequests": 3,
    "reworkRequests": 2,
    "totalTokens": 1240000,
    "estimatedCost": "미수집"
  },
  "status": "COMPLETED"
}
```

## 8. 화면과 비교

React/TypeScript 기반 Dashboard 내부 섹션/상세 패널로 제공한다. 세 번째 최상위 탭은 만들지 않는다.

| 섹션 | 표시 |
| --- | --- |
| 활용 요약 | Project, AI 활용 종합 Score, 핵심 지표 요약(AI 수행 Task 비율, 사용자 개입 건수, Token/Cost) |
| 활용 지표 상세 | 작업 수행/사용자 개입/Resource 지표, 영역별 분포, Token Usage Trend |
| Feedback | Aspect, Severity, Observation, Impact, Suggestion |
| 이전/현재 비교 | Report별 활용 Score·핵심 지표, 이전 프로젝트 대비 변화 |

프로젝트 규모·성격이 다르면 비교의 한계를 표시한다. AI 활용 Score와 제품 품질·Task 진행률을 구분한다.

## 9. 데이터 소유권과 API

### 9.1 소유권

UF 모듈은 UtilizationReport / UtilizationMetric / Feedback을 소유한다. Project/ProjectTask/SprintMilestone/ProjectAgent는 PM 소유이며 각 ID를 읽기 전용으로 참조한다. 지표의 원천 데이터(Token, Task, Decision, 승인 등)는 PM/Dashboard 모듈이 수집하며, UF 모듈은 프로젝트 완료 시 이를 집계하여 Report로 저장한다.

```text
Project (PM 모듈 소유, project_id 참조)
└── ProjectTask (PM 모듈 소유, project_task_id 참조)

UF 모듈이 소유하는 엔터티
UtilizationReport   (project_id로 대상 프로젝트와 연결, 프로젝트 완료 시 생성)
├── UtilizationMetric
└── Feedback
```

### 9.2 API 경로

UF는 `/api/utilization`과 `/api/feedbacks`만 소유한다. Project/Task는 PM의 `GET /api/projects/{projectId}`, `GET /api/projects/{projectId}/tasks`로 조회한다.

| Method / 경로 | 역할 |
| --- | --- |
| POST `/api/utilization` | body의 projectId로 프로젝트 완료 후 활용 리포트 생성·집계 |
| GET `/api/utilization?projectId={projectId}` | 프로젝트 활용 리포트 목록 |
| GET `/api/utilization/{reportId}` | 리포트 상세 |
| GET `/api/utilization/{reportId}/metrics` | 활용 지표 상세 |
| GET `/api/utilization/{reportId}/feedbacks` | 리포트의 Feedback 목록 |
| POST `/api/utilization/{reportId}/feedbacks` | Feedback 생성 |
| PUT `/api/feedbacks/{feedbackId}` | Feedback 수정 |

## 10. MVP Acceptance Criteria

- AC-001: 프로젝트 완료 시 AI 활용 지표가 집계되어 조회된다.
- AC-002: 사용자는 AI 수행 Task 비율, 사용자 개입 건수, Token/Cost 등 핵심 지표를 확인할 수 있다.
- AC-003: 영역별(PM/Frontend/Backend/QA) AI 활용 분포를 확인할 수 있다.
- AC-004: AI 활용 종합 Score가 산출된다.
- AC-005: 사용자는 AI 활용에 대한 Feedback(observation/impact/suggestion)을 조회할 수 있다.
- AC-006: Feedback은 프로젝트 완료 이후에만 기록된다.
- AC-007: 이전 프로젝트와 현재 프로젝트의 AI 활용 지표를 비교할 수 있다.

## 11. Future Development

향후 AI 활용 지표를 기반으로 개선 제안을 자동 생성하는 Assist 기능을 도입한다. 단, 지표를 근거로 개발 Agent에게 자동 재작업을 지시하는 Loop는 본 시스템의 범위에 포함하지 않는다.

본 시스템의 핵심 목표는 사용자가 AI 활용 지표를 명확히 확인하고, 이를 통해 앞으로 AI를 더 잘 활용하도록 돕는 것이다.
