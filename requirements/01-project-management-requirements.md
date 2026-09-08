# 01. 프로젝트 및 Agent Profile 관리 요구사항

> 문서 ID: PM · 상태: 통합 정리본 · 기준일: 2026-09-08
> 상위 문서: [마스터](00-master-requirements.md) · 공통 계약: [06](06-integration-contract.md)
> 범위: 프로젝트/프로필/배정/Task/Milestone 데이터. 실행·QA·SSE는 오케스트레이터, 프로젝트 완료 후 AI 활용 Report·Score·Comment는 UF, 승인 응답은 오케스트레이터, Git은 GIT, 좌석은 TY 담당.

MVP 해석 기준:

- 저장소 입력은 `https://github.com/DDthonWinner/TestOutput`으로 고정한다. Project마다 연결 레코드·checkout·branch를 분리하며 동일 원격 URL을 공유한다.
- 프로젝트 단위 Task 실행은 순차 처리한다. 등록 가능한 Agent 수와 동시 실행 수는 다르다.
- Task 상태·추가 실행 필드·승인 관계는 공통 계약을 적용한다. 아래 DB 설계는 관리 영역의 기본 모델이며 실행 모델 전체를 대신하지 않는다.
- 주요 요구사항 ID: `PM-001` Project CRUD, `PM-002` Budget/정원, `PM-003` Profile CRUD, `PM-004` 추천/배정, `PM-005` Task/Milestone, `PM-006` 문서 매핑.
- 1일차는 seed Profile/모델·생성·추천·배정·조회·Task/Milestone 연결을 우선한다. 2일차에 Profile 편집·비활성화·Agent 교체·문서 매핑을 마무리한다. 전체 MVP 완료 기준은 두 일차 범위를 포함한다.

## 1. 문서 목적

본 문서는 AI-DLC 기반 CompanyOps 대시보드에서 사용자가 담당하는 영역인 프로젝트 생성, Agent Profile 관리, 프로젝트 성격 및 Description 정의, 프로젝트별 Agent 배정 흐름을 설계하기 위한 상세 계획서이다.

이 영역의 핵심 목표는 사용자가 새 프로젝트를 생성하면 프로젝트의 규모, 예산 여유도, 필요 역할, 적정 Agent 수를 기준으로 PM Agent를 포함한 여러 Agent Profile을 프로젝트에 매칭하고, 이후 AI-DLC 워크플로우에서 실제 작업 주체로 활용될 Project Agent 구성을 생성하는 것이다.

## 2. 담당 영역 범위

### 2.1 포함 범위

- 프로젝트 생성 및 기본 정보 관리
- 프로젝트 Description 및 성격 정의
- 프로젝트 Budget 여유도 관리
- Budget 여유도별 기준 금액 관리
- 프로젝트 규모 및 적정 Agent 수 입력 또는 산정
- 프로젝트별 최대 Agent 수 관리
- 프로젝트와 Git repository 1:1 연결
- Agent Profile 생성, 조회, 수정, 비활성화
- 역할별 Agent Profile 관리
- PM Agent 필수 배정
- Budget, 규모, 필요 역할을 고려한 Agent Profile 추천 및 매칭
- 프로젝트에 배정된 Agent, 즉 Project Agent 생성
- 프로젝트에 배정된 Agent의 표시 이름, 색상, 아이콘 커스터마이징
- Agent별 LLM model 할당
- 역할별 markdown 파일 관리 기준 정의
- Project Agent와 Sprint Milestone 진행률 연결 기준 정의
- Project 하위 Task를 Milestone 단위로 그룹화하는 관리 구조 정의

### 2.2 제외 범위

- 실제 AI Agent 실행 로직
- LLM API 호출 및 프롬프트 실행
- Git clone, branch 생성, commit, push 실행
- SSE 기반 실시간 상태 전송
- 타이쿤 오피스 뷰의 애니메이션 처리
- 테스트 실행 및 코드 diff 분석

위 제외 범위는 본 설계의 직접 구현 대상은 아니지만, Project Agent가 생성된 이후 다른 AI-DLC 모듈에서 참조할 수 있도록 데이터 연결 지점은 정의한다.

## 3. 핵심 개념 정의

### 3.1 Project

사용자가 생성하는 개발 단위이다. 하나의 Project는 하나의 Git repository와 1:1로 연결되며, 반드시 한 명의 PM Agent를 배정받아야 한다.

### 3.2 Agent Profile

프로젝트에 배정되기 전의 Agent 템플릿 또는 인력 풀 개념이다. 역할, 숙련도, 사용 가능한 LLM model, 담당 markdown 파일 유형, 활성 상태 등의 정보를 가진다.

예시:

- Frontend Agent Profile
- Backend Agent Profile
- Database Agent Profile
- QA Agent Profile
- PM Agent Profile

### 3.3 Project Agent

특정 Project에 실제로 배정된 Agent이다. Agent Profile을 기반으로 생성되지만, 프로젝트 배정 이후에는 해당 프로젝트 내 역할, 상태, 할당 model, 담당 md 파일 경로, 작업 상태를 독립적으로 가진다.

Project Agent는 타이쿤 오피스 뷰와 대시보드에서 사용자가 식별할 수 있는 표시 정보도 함께 가진다. 사용자는 프로젝트에 Agent를 배정할 때 기본 추천값을 그대로 사용할 수 있고, 필요하면 Agent 이름, 색상, 아이콘을 직접 지정할 수 있다.

### 3.4 Budget 여유도

실제 금액이 아닌 프로젝트가 사용할 수 있는 AI Agent 리소스의 여유 수준이다.

- High: 충분함. 기준 금액 `$250,000`
- Medium: 보통. 기준 금액 `$180,000`
- Low: 제한적. 기준 금액 `$120,000`

MVP에서는 `HIGH`, `MEDIUM`, `LOW` enum으로 관리하되, 화면에서는 각 단계에 대응되는 기준 금액을 함께 표시할 수 있다. 이 금액은 실제 결제 금액이 아니라 시뮬레이션성 Budget 기준값이다.

### 3.5 프로젝트 규모

프로젝트의 복잡도와 작업량을 나타내는 값이다.

- Small
- Medium
- Large

MVP에서는 `SMALL`, `MEDIUM`, `LARGE` enum으로 관리한다.

### 3.6 역할별 Markdown 파일

각 Agent가 담당 역할에 맞게 관리하는 문서 파일이다. MVP에서는 실제 파일 생성까지는 선택 사항으로 두되, Project Agent별 담당 markdown 파일 경로를 데이터로 저장할 수 있어야 한다.

예시:

- PM Agent: `requirements.md`, `project-plan.md`
- Frontend Agent: `frontend.md`, `ui-spec.md`
- Backend Agent: `backend.md`, `api-spec.md`
- DB Agent: `database.md`, `schema.md`
- QA Agent: `test-plan.md`, `qa-report.md`

### 3.7 Workspace 용어 정의

디자인 목업의 `Workspace`는 본 담당 영역에서는 별도 공간 엔터티가 아니라 Project와 같은 의미로 사용한다. 따라서 MVP DB에는 `workspaces` 테이블을 별도로 두지 않는다.

목업에 보이는 Frontend Desk, Backend Desk, Database Cluster, PM Suite 같은 물리적 공간 배치 개념은 타이쿤 오피스 뷰 구현 범위에서 다룰 수 있으며, 본 문서의 프로젝트 생성 및 Agent 관리 범위에서는 제외한다.

### 3.8 Sprint Milestone

프로젝트 진행 상황을 여러 Task 묶음으로 나누어 보여주는 진행률 단위이다. Project Agent가 생성된 이후 각 Agent는 하나 이상의 Sprint Milestone에 연결될 수 있으며, 각 Project Task는 특정 Sprint Milestone 하위에 배치될 수 있다.

예시:

- FE: Canvas Virtualizer
- BE: Event Sourcing Broker
- DB: Vector Partitioning

### 3.9 Project Task

Project 안에서 관리되는 실제 작업 단위이다. Task는 Project에 반드시 속하며, MVP에서는 하나의 Task가 최대 하나의 Sprint Milestone에 속한다.

Task는 담당 Project Agent, 역할, 상태, 우선순위를 가질 수 있다. 대시보드에서는 Milestone을 펼쳤을 때 해당 Milestone에 포함된 Task 목록을 보여줄 수 있다.

## 4. DB 설계

MVP에서는 SQLite를 사용한다. POC 단계에서 프론트엔드 Local Storage를 병행하더라도, 서버 기준 데이터 모델은 SQLite 관계형 모델을 기준으로 설계한다.

SQLite는 PostgreSQL처럼 native UUID, ENUM, BOOLEAN 타입을 강제하지 않으므로 다음 저장 규칙을 기본으로 한다.

| 논리 타입 | SQLite 저장 타입 | 적용 방식 |
|---|---|---|
| UUID | TEXT | 애플리케이션에서 UUID 문자열 생성 |
| ENUM | TEXT | `CHECK` 제약조건으로 허용 값 제한 |
| BOOLEAN | INTEGER | `0`, `1`로 저장 |
| DATETIME | TEXT | ISO 8601 문자열로 저장 |
| JSON-like options | TEXT | MVP에서는 JSON 문자열 저장, 필요 시 별도 테이블로 정규화 |

문서 내 컬럼 타입은 구현 편의를 위해 SQLite 저장 타입을 기준으로 작성하되, 설명에서 필요한 논리적 의미를 함께 명시한다.

### 4.1 ERD 개요

```text
Project 1 --- 1 GitRepository (프로젝트별 연결 레코드; 원격 URL 재사용 가능)
Project 1 --- N ProjectAgent
Project 1 --- N SprintMilestone
Project 1 --- N ProjectTask
AgentProfile 1 --- N ProjectAgent
Role 1 --- N AgentProfile
Role 1 --- N ProjectAgent
LlmModel 1 --- N AgentProfile
LlmModel 1 --- N ProjectAgent
ProjectAgent 1 --- N ProjectAgentDocument
ProjectAgent N --- N SprintMilestone
SprintMilestone 1 --- N ProjectTask
Role 1 --- N RoleDocumentTemplate
```

### 4.2 주요 엔터티

#### 4.2.1 projects

프로젝트 기본 정보를 저장한다.

| 컬럼명 | 타입 | 필수 | 설명 |
|---|---:|---:|---|
| id | TEXT | Y | 프로젝트 ID. UUID 문자열 |
| name | VARCHAR(100) | Y | 프로젝트명 |
| description | TEXT | Y | 프로젝트 설명 |
| project_type | VARCHAR(50) | N | 프로젝트 성격. 예: dashboard, ecommerce, internal_tool |
| budget_level | TEXT | Y | `HIGH`, `MEDIUM`, `LOW` |
| budget_amount | INT | Y | Budget 여유도에 대응되는 기준 금액. HIGH 250000, MEDIUM 180000, LOW 120000 |
| project_size | TEXT | Y | `SMALL`, `MEDIUM`, `LARGE` |
| desired_agent_count | INT | N | 사용자가 입력한 적정 Agent 수 |
| recommended_agent_count | INT | N | 시스템이 산정한 추천 Agent 수 |
| max_agent_count | INT | Y | 프로젝트에 배정 가능한 최대 Agent 수 |
| status | TEXT | Y | `DRAFT`, `AGENT_MATCHING`, `READY`, `ACTIVE`, `COMPLETED`, `ARCHIVED` |
| completed_at | TEXT | N | 프로젝트 완료 일시. `COMPLETED` 전환 시 기록 |
| created_by | VARCHAR(100) | N | 생성자 식별자 |
| created_at | TEXT | Y | 생성 일시. ISO 8601 |
| updated_at | TEXT | Y | 수정 일시. ISO 8601 |

제약조건:

- `name`은 빈 문자열일 수 없다.
- `budget_level`은 `HIGH`, `MEDIUM`, `LOW` 중 하나여야 한다.
- `budget_amount`는 `budget_level`에 따라 `HIGH = 250000`, `MEDIUM = 180000`, `LOW = 120000`으로 저장한다.
- `project_size`는 `SMALL`, `MEDIUM`, `LARGE` 중 하나여야 한다.
- `desired_agent_count`는 입력 시 1 이상이어야 한다.
- `max_agent_count`는 1 이상이어야 한다.
- 실제 배정된 활성 Project Agent 수는 `max_agent_count`를 초과할 수 없다.
- 프로젝트가 `READY`, `ACTIVE`, `COMPLETED`가 되려면 PM 역할의 Project Agent가 반드시 1명 존재해야 한다.

#### 4.2.2 git_repositories

프로젝트와 연결되는 Git repository 정보를 저장한다.

| 컬럼명 | 타입 | 필수 | 설명 |
|---|---:|---:|---|
| id | TEXT | Y | Git repository ID. UUID 문자열 |
| project_id | TEXT | Y | 연결된 프로젝트 ID |
| provider | TEXT | Y | `GITHUB` (MVP 고정) |
| repository_url | TEXT | Y | Git repository URL |
| default_branch | VARCHAR(100) | N | 기본 브랜치. 예: main |
| access_scope | TEXT | N | `READ_ONLY`, `READ_WRITE` |
| created_at | TEXT | Y | 생성 일시. ISO 8601 |
| updated_at | TEXT | Y | 수정 일시. ISO 8601 |

제약조건:

- `project_id`는 unique여야 한다.
- 하나의 Project는 하나의 Git repository만 가질 수 있다.
- `repository_url`은 URL 형식을 만족해야 한다.

#### 4.2.3 roles

Agent 역할 마스터 데이터를 저장한다.

| 컬럼명 | 타입 | 필수 | 설명 |
|---|---:|---:|---|
| id | TEXT | Y | 역할 ID. UUID 문자열 |
| code | VARCHAR(50) | Y | 역할 코드. 예: PM, FRONTEND, BACKEND |
| name | VARCHAR(100) | Y | 역할명 |
| description | TEXT | N | 역할 설명 |
| is_required_for_project | INTEGER | Y | 모든 프로젝트 필수 여부. `0` 또는 `1` |
| created_at | TEXT | Y | 생성 일시. ISO 8601 |
| updated_at | TEXT | Y | 수정 일시. ISO 8601 |

초기 역할 데이터:

| code | name | 필수 여부 |
|---|---|---:|
| PM | PM Agent | Y |
| FRONTEND | Frontend Agent | N |
| BACKEND | Backend Agent | N |
| DATABASE | Database Agent | N |
| QA | QA Agent | N |
| DEVOPS | DevOps Agent | N |
| DESIGN | Design Agent | N |

제약조건:

- `code`는 unique여야 한다.
- `PM` 역할은 시스템 기본 역할로 삭제할 수 없다.

#### 4.2.4 llm_models

Agent에게 할당 가능한 LLM model 정보를 저장한다.

| 컬럼명 | 타입 | 필수 | 설명 |
|---|---:|---:|---|
| id | TEXT | Y | 모델 ID. UUID 문자열 |
| provider | VARCHAR(50) | Y | 모델 제공자. 예: OpenAI, Anthropic |
| model_name | VARCHAR(100) | Y | 실제 모델명 |
| display_name | VARCHAR(100) | Y | 화면 표시명 |
| grade | TEXT | Y | `BASIC`, `STANDARD`, `ADVANCED` |
| is_active | INTEGER | Y | 사용 가능 여부. `0` 또는 `1` |
| created_at | TEXT | Y | 생성 일시. ISO 8601 |
| updated_at | TEXT | Y | 수정 일시. ISO 8601 |

예시:

| display_name | grade | 설명 |
|---|---|---|
| Claude Haiku | BASIC | 초급 또는 저비용 Agent용 |
| GPT Standard | STANDARD | 일반 Agent용 |
| ChatGPT Astras | ADVANCED | 고급 Agent 또는 PM Agent용 |

제약조건:

- `provider + model_name` 조합은 unique여야 한다.
- 비활성 모델은 신규 Agent Profile 또는 Project Agent에 배정할 수 없다.

#### 4.2.5 agent_profiles

프로젝트에 배정 가능한 Agent Profile을 저장한다.

| 컬럼명 | 타입 | 필수 | 설명 |
|---|---:|---:|---|
| id | TEXT | Y | Agent Profile ID. UUID 문자열 |
| name | VARCHAR(100) | Y | Agent Profile 이름 |
| role_id | TEXT | Y | 담당 역할 ID |
| default_llm_model_id | TEXT | Y | 기본 할당 LLM model |
| skill_level | TEXT | Y | `JUNIOR`, `MID`, `SENIOR` |
| description | TEXT | N | Agent 설명 |
| default_md_template | VARCHAR(255) | N | 기본 md 파일 템플릿 또는 경로 |
| default_color | VARCHAR(20) | N | 기본 표시 색상. 예: `#4F46E5` |
| default_icon_key | VARCHAR(50) | N | 기본 아이콘 키. 예: `code`, `database`, `clipboard-check` |
| is_active | INTEGER | Y | 사용 가능 여부. `0` 또는 `1` |
| created_at | TEXT | Y | 생성 일시. ISO 8601 |
| updated_at | TEXT | Y | 수정 일시. ISO 8601 |

제약조건:

- `role_id`는 roles.id를 참조한다.
- `default_llm_model_id`는 llm_models.id를 참조한다.
- 비활성 Agent Profile은 신규 프로젝트 매칭 후보에서 제외한다.
- PM 역할의 Agent Profile은 최소 1개 이상 활성 상태로 존재해야 한다.
- `default_color`는 HEX color 형식을 권장한다.
- `default_icon_key`는 프론트엔드에서 허용한 아이콘 키 목록 중 하나여야 한다.

#### 4.2.6 project_agents

프로젝트에 실제 배정된 Agent를 저장한다.

| 컬럼명 | 타입 | 필수 | 설명 |
|---|---:|---:|---|
| id | TEXT | Y | Project Agent ID. UUID 문자열 |
| project_id | TEXT | Y | 프로젝트 ID |
| agent_profile_id | TEXT | Y | 기반 Agent Profile ID |
| role_id | TEXT | Y | 프로젝트 내 역할 ID |
| llm_model_id | TEXT | Y | 프로젝트에서 실제 사용할 LLM model |
| display_name | VARCHAR(100) | Y | 프로젝트 내 Agent 표시명. 사용자가 직접 지정 가능 |
| display_color | VARCHAR(20) | Y | 프로젝트 내 Agent 표시 색상. 예: `#0EA5E9` |
| icon_key | VARCHAR(50) | Y | 프로젝트 내 Agent 아이콘 키. 예: `monitor`, `server`, `database` |
| assignment_reason | TEXT | N | 추천 또는 배정 사유 |
| status | TEXT | Y | `ASSIGNED`, `IDLE`, `WORKING`, `WAITING`, `BLOCKED`, `REMOVED` |
| is_primary_pm | INTEGER | Y | 프로젝트 대표 PM 여부. `0` 또는 `1` |
| created_at | TEXT | Y | 생성 일시. ISO 8601 |
| updated_at | TEXT | Y | 수정 일시. ISO 8601 |

제약조건:

- `project_id`는 projects.id를 참조한다.
- `agent_profile_id`는 agent_profiles.id를 참조한다.
- `role_id`는 roles.id를 참조한다.
- `llm_model_id`는 llm_models.id를 참조한다.
- READY/ACTIVE/COMPLETED 프로젝트에는 제거되지 않은 `is_primary_pm = true`인 Agent가 정확히 1명이어야 한다. DRAFT/AGENT_MATCHING에서는 배정 전 0명을 허용한다.
- `is_primary_pm = true`인 경우 role은 반드시 `PM`이어야 한다.
- `display_name`은 프로젝트 내에서 사용자가 알아볼 수 있는 이름이어야 하며 빈 문자열일 수 없다.
- `display_color`는 HEX color 형식을 권장하며, MVP에서는 프론트엔드 기본 팔레트 중 하나로 제한할 수 있다.
- `icon_key`는 프론트엔드가 지원하는 아이콘 키 목록 중 하나여야 한다.
- 한 프로젝트에서 같은 Agent Profile을 중복 배정할 수 있는지는 정책으로 결정한다. MVP에서는 중복 배정을 금지한다.

SQLite DDL 예시:

```sql
CREATE TABLE project_agents (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  agent_profile_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  llm_model_id TEXT NOT NULL,
  display_name TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
  display_color TEXT NOT NULL CHECK (display_color GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]'),
  icon_key TEXT NOT NULL,
  assignment_reason TEXT,
  status TEXT NOT NULL CHECK (status IN ('ASSIGNED', 'IDLE', 'WORKING', 'WAITING', 'BLOCKED', 'REMOVED')),
  is_primary_pm INTEGER NOT NULL DEFAULT 0 CHECK (is_primary_pm IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (agent_profile_id) REFERENCES agent_profiles(id),
  FOREIGN KEY (role_id) REFERENCES roles(id),
  FOREIGN KEY (llm_model_id) REFERENCES llm_models(id),
  UNIQUE (project_id, agent_profile_id)
);
```

참고:

- SQLite에서는 partial unique index를 사용해 한 프로젝트에 primary PM이 1명만 존재하도록 강제할 수 있다.
- PM의 role 검증처럼 여러 테이블을 함께 봐야 하는 조건은 애플리케이션 서비스 레이어에서 트랜잭션으로 검증한다.

```sql
CREATE UNIQUE INDEX ux_project_agents_primary_pm
ON project_agents(project_id)
WHERE is_primary_pm = 1 AND status != 'REMOVED';
```

#### 4.2.7 role_document_templates

역할별 기본 markdown 문서 템플릿 정보를 저장한다.

| 컬럼명 | 타입 | 필수 | 설명 |
|---|---:|---:|---|
| id | TEXT | Y | 템플릿 ID. UUID 문자열 |
| role_id | TEXT | Y | 역할 ID |
| file_name | VARCHAR(100) | Y | 기본 파일명 |
| description | TEXT | N | 문서 목적 |
| is_required | INTEGER | Y | 필수 생성 여부. `0` 또는 `1` |
| created_at | TEXT | Y | 생성 일시. ISO 8601 |
| updated_at | TEXT | Y | 수정 일시. ISO 8601 |

예시:

| role | file_name | 필수 여부 |
|---|---|---:|
| PM | requirements.md | Y |
| PM | project-plan.md | N |
| FRONTEND | frontend.md | Y |
| BACKEND | backend.md | Y |
| DATABASE | database.md | Y |
| QA | test-plan.md | Y |

#### 4.2.8 project_agent_documents

Project Agent가 프로젝트 내에서 담당하는 markdown 파일 정보를 저장한다.

| 컬럼명 | 타입 | 필수 | 설명 |
|---|---:|---:|---|
| id | TEXT | Y | 문서 ID. UUID 문자열 |
| project_agent_id | TEXT | Y | Project Agent ID |
| project_id | TEXT | Y | 프로젝트 ID |
| role_document_template_id | TEXT | N | 기반 템플릿 ID |
| file_path | VARCHAR(255) | Y | 프로젝트 내 md 파일 경로 |
| document_type | VARCHAR(50) | N | 문서 유형 |
| status | TEXT | Y | `PLANNED`, `CREATED`, `UPDATED`, `ARCHIVED` |
| created_at | TEXT | Y | 생성 일시. ISO 8601 |
| updated_at | TEXT | Y | 수정 일시. ISO 8601 |

제약조건:

- `project_agent_id`는 project_agents.id를 참조한다.
- `project_id`는 projects.id를 참조한다.
- 한 프로젝트 내 `file_path`는 unique여야 한다.

#### 4.2.9 sprint_milestones

프로젝트의 Sprint Milestone과 역할별 진행률 표시 정보를 저장한다.

| 컬럼명 | 타입 | 필수 | 설명 |
|---|---:|---:|---|
| id | TEXT | Y | Sprint Milestone ID. UUID 문자열 |
| project_id | TEXT | Y | 프로젝트 ID |
| title | VARCHAR(150) | Y | Milestone 이름. 예: Canvas Virtualizer |
| role_id | TEXT | N | 주 담당 역할 ID |
| status | 파생 응답 | Y | 하위 Task에서 계산: `PLANNED`, `IN_PROGRESS`, `DONE`, `BLOCKED`; 직접 저장/수정하지 않음 |
| display_color | VARCHAR(20) | N | 화면 표시 색상. 역할 색상과 다를 경우 사용 |
| sort_order | INT | Y | 화면 표시 순서 |
| created_at | TEXT | Y | 생성 일시. ISO 8601 |
| updated_at | TEXT | Y | 수정 일시. ISO 8601 |

제약조건:

- `project_id`는 projects.id를 참조한다.
- `role_id`는 roles.id를 참조한다.
- `title`은 빈 문자열일 수 없다.

진행률은 DB 입력 컬럼으로 저장하지 않고 하위 `project_tasks`를 집계한 읽기 전용 응답으로 제공한다.

| 응답 필드 | 계산 |
| --- | --- |
| progressCurrent | 해당 Milestone의 COMPLETED Task 수 |
| progressTotal | 해당 Milestone의 CANCELLED 제외 전체 Task 수 |
| progressPercent | total=0이면 0, 그 외 round(100 × current / total) |

- Task별 가중치·PM 판단값·수동 진행률 입력을 사용하지 않는다. Task 없는 Milestone은 0/0, 0%, `작업 없음`으로 표시한다.
- Task 생성·상태 전이·취소·Milestone 이동에 따라 자동 재계산한다. 이동 시 이전/새 Milestone을 모두 갱신한다.
- Milestone 상태도 하위 Task에서 파생한다: 대상 0개 또는 전부 TODO이면 PLANNED, 대상 전부 COMPLETED이면 DONE, 미완료 중 BLOCKED/FAILED가 있으면 BLOCKED, 나머지는 IN_PROGRESS다. WAITING/REVIEW 사유는 하위 Task에 표시한다.
- Milestone에 Agent가 여러 명 연결되어도 Task ID를 한 번만 센다. Project 진행률은 Milestone 미소속 Task도 포함한 Project 전체 Task로 계산하며 Milestone 퍼센트를 평균내지 않는다.
- Milestone 결과의 사람 승인 상태는 진행률과 별도이며 공통 Approval/MilestoneResult가 소유한다. 하위 Task가 모두 COMPLETED이면 진행률은 100%이고 결과 승인 PENDING이 될 수 있다.
- 다음 Milestone의 첫 Task는 이전 Milestone 결과가 APPROVED일 때 실행할 수 있다. 첫 Milestone과 명시적으로 독립 실행을 승인한 Milestone은 예외다.

#### 4.2.10 project_agent_milestones

Project Agent와 Sprint Milestone의 연결 정보를 저장한다.

| 컬럼명 | 타입 | 필수 | 설명 |
|---|---:|---:|---|
| id | TEXT | Y | 연결 ID. UUID 문자열 |
| project_id | TEXT | Y | 프로젝트 ID |
| project_agent_id | TEXT | Y | Project Agent ID |
| sprint_milestone_id | TEXT | Y | Sprint Milestone ID |
| responsibility_type | TEXT | Y | `OWNER`, `CONTRIBUTOR`, `REVIEWER` |
| created_at | TEXT | Y | 생성 일시. ISO 8601 |
| updated_at | TEXT | Y | 수정 일시. ISO 8601 |

제약조건:

- `project_id`는 projects.id를 참조한다.
- `project_agent_id`는 project_agents.id를 참조한다.
- `sprint_milestone_id`는 sprint_milestones.id를 참조한다.
- 같은 `project_agent_id + sprint_milestone_id + responsibility_type` 조합은 중복될 수 없다.

#### 4.2.11 project_tasks

Project 하위의 Task를 저장한다. Task는 특정 Sprint Milestone에 포함될 수 있으며, 담당 Project Agent와 역할을 연결할 수 있다.

| 컬럼명 | 타입 | 필수 | 설명 |
|---|---:|---:|---|
| id | TEXT | Y | Project Task ID. UUID 문자열 |
| project_id | TEXT | Y | 프로젝트 ID |
| sprint_milestone_id | TEXT | N | 소속 Sprint Milestone ID |
| assigned_project_agent_id | TEXT | N | 담당 Project Agent ID |
| role_id | TEXT | N | 주 담당 역할 ID |
| title | VARCHAR(150) | Y | Task 제목 |
| description | TEXT | N | Task 설명 |
| status | TEXT | Y | `TODO`, `RUNNING`, `WAITING`, `BLOCKED`, `REVIEW`, `COMPLETED`, `FAILED`, `CANCELLED` |
| execution_mode | TEXT | N | 실제 수행 주체. `AI_AGENT`, `HUMAN`, `MIXED`; 실행 전에는 null |
| priority | TEXT | Y | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| sort_order | INT | Y | Milestone 내 표시 순서 |
| created_at | TEXT | Y | 생성 일시. ISO 8601 |
| updated_at | TEXT | Y | 수정 일시. ISO 8601 |

제약조건:

- `project_id`는 projects.id를 참조한다.
- `sprint_milestone_id`는 sprint_milestones.id를 참조한다.
- `assigned_project_agent_id`는 project_agents.id를 참조한다.
- `role_id`는 roles.id를 참조한다.
- `title`은 빈 문자열일 수 없다.
- MVP에서는 Task가 하나의 Milestone에만 속할 수 있다.
- Task description에는 작업 범위와 완료 조건을 기록한다. AI 활용 평가는 description을 제품 품질 기준으로 채점하지 않고 실제 실행 주체와 사용량 계측을 집계한다.
- `execution_mode`는 Task 실행 이력에서 확정하며 화면에서 임의 수정하지 않는다. UF의 AI 완료 Task 비율은 `COMPLETED`이면서 `AI_AGENT`인 Task를 기준으로 계산한다.
- Task를 COMPLETED로 전환할 때 `execution_mode`는 null일 수 없다. 여러 실행 attempt에 AI와 사람 수행이 함께 있으면 `MIXED`로 기록한다.

## 5. API 설계

API는 FastAPI 기반 REST API를 기준으로 설계한다. 실시간 상태 갱신이나 Agent 실행 이벤트는 별도 SSE 모듈에서 담당하며, 본 문서에서는 프로젝트 및 Agent 관리 API만 정의한다.

### 5.1 Project API

#### 5.1.1 프로젝트 생성

`POST /api/projects`

책임:

- 프로젝트 기본 정보 생성
- Budget 여유도, Budget 기준 금액, 프로젝트 규모, Description 저장
- 프로젝트별 최대 Agent 수 계산 또는 저장
- Git repository 1:1 연결 정보 생성
- 프로젝트 상태를 `DRAFT` 또는 `AGENT_MATCHING`으로 설정

Request:

```json
{
  "name": "AI-DLC CompanyOps Dashboard",
  "description": "AI coding agents working in a 2.5D tycoon-style office dashboard.",
  "projectType": "internal_dashboard",
  "budgetLevel": "MEDIUM",
  "projectSize": "MEDIUM",
  "maxAgentCount": 12,
  "desiredAgentCount": 5,
  "gitRepository": {
    "provider": "GITHUB",
    "repositoryUrl": "https://github.com/DDthonWinner/TestOutput",
    "defaultBranch": "main",
    "accessScope": "READ_WRITE"
  }
}
```

Response:

```json
{
  "id": "project-uuid",
  "name": "AI-DLC CompanyOps Dashboard",
  "status": "AGENT_MATCHING",
  "budgetLevel": "MEDIUM",
  "budgetAmount": 180000,
  "projectSize": "MEDIUM",
  "maxAgentCount": 12,
  "desiredAgentCount": 5,
  "recommendedAgentCount": 5,
  "gitRepository": {
    "id": "repo-uuid",
    "repositoryUrl": "https://github.com/DDthonWinner/TestOutput"
  },
  "createdAt": "2026-09-07T01:00:00Z"
}
```

#### 5.1.2 프로젝트 목록 조회

`GET /api/projects`

Query:

- `status`
- `budgetLevel`
- `projectSize`
- `keyword`

책임:

- 프로젝트 목록 및 기본 배정 현황 조회
- 목록 화면에서 PM 배정 여부와 Agent 수를 빠르게 표시할 수 있도록 요약 제공

Response:

```json
{
  "items": [
    {
      "id": "project-uuid",
      "name": "AI-DLC CompanyOps Dashboard",
      "status": "READY",
      "budgetLevel": "MEDIUM",
      "budgetAmount": 180000,
      "projectSize": "MEDIUM",
      "assignedAgentCount": 5,
      "maxAgentCount": 12,
      "hasPrimaryPm": true,
      "repositoryUrl": "https://github.com/DDthonWinner/TestOutput",
      "updatedAt": "2026-09-07T01:10:00Z"
    }
  ],
  "total": 1
}
```

#### 5.1.3 프로젝트 상세 조회

`GET /api/projects/{projectId}`

책임:

- 프로젝트 기본 정보 조회
- Git repository 정보 조회
- 배정된 Project Agent 목록 조회
- 역할별 md 파일 목록 조회

#### 5.1.4 프로젝트 수정

`PATCH /api/projects/{projectId}`

책임:

- Description, 프로젝트 성격, Budget, 규모, 희망 Agent 수, 최대 Agent 수 수정
- 프로젝트가 이미 `ACTIVE` 상태인 경우 Agent 재산정은 자동 적용하지 않고 별도 추천 API를 호출하도록 분리

#### 5.1.5 프로젝트 삭제 또는 아카이브

`POST /api/projects/{projectId}/archive`

책임:

- 프로젝트를 물리 삭제하지 않고 `ARCHIVED` 상태로 변경
- 연결된 Project Agent도 신규 실행 대상에서 제외

### 5.2 Agent Profile API

#### 5.2.1 Agent Profile 생성

`POST /api/agent-profiles`

책임:

- 역할, 기본 LLM model, 숙련도, 설명을 가진 Agent Profile 생성

Request:

```json
{
  "name": "Senior Frontend Builder",
  "roleCode": "FRONTEND",
  "defaultLlmModelId": "model-uuid",
  "skillLevel": "SENIOR",
  "description": "React 기반 UI 구현과 상태 관리에 특화된 Agent Profile",
  "defaultMdTemplate": "frontend.md",
  "defaultColor": "#0EA5E9",
  "defaultIconKey": "monitor"
}
```

Response:

```json
{
  "id": "agent-profile-uuid",
  "name": "Senior Frontend Builder",
  "role": {
    "code": "FRONTEND",
    "name": "Frontend Agent"
  },
  "skillLevel": "SENIOR",
  "defaultLlmModel": {
    "id": "model-uuid",
    "displayName": "ChatGPT Astras"
  },
  "defaultColor": "#0EA5E9",
  "defaultIconKey": "monitor",
  "isActive": true
}
```

#### 5.2.2 Agent Profile 목록 조회

`GET /api/agent-profiles`

Query:

- `roleCode`
- `skillLevel`
- `isActive`
- `modelGrade`

책임:

- 역할별 Agent Profile 후보 조회
- 프로젝트 매칭 화면에서 선택 가능한 Agent 목록 제공

#### 5.2.3 Agent Profile 상세 조회

`GET /api/agent-profiles/{agentProfileId}`

책임:

- Agent Profile 기본 정보 조회
- 기본 문서 템플릿 및 사용 가능한 model 정보 조회
- 과거 프로젝트 배정 이력은 MVP 이후 확장

#### 5.2.4 Agent Profile 수정

`PATCH /api/agent-profiles/{agentProfileId}`

책임:

- 이름, 설명, 기본 model, 숙련도, 기본 md 템플릿, 기본 색상, 기본 아이콘 수정
- 이미 Project Agent로 생성된 항목에는 자동 반영하지 않는다.

#### 5.2.5 Agent Profile 비활성화

`POST /api/agent-profiles/{agentProfileId}/deactivate`

책임:

- 신규 프로젝트 매칭 후보에서 제외
- 기존 Project Agent에는 영향 없음

### 5.3 Project Agent Matching API

#### 5.3.1 프로젝트 Agent 추천안 생성

`POST /api/projects/{projectId}/agent-recommendations`

책임:

- 프로젝트 규모, Budget 여유도, 희망 Agent 수, 프로젝트 성격을 기반으로 역할별 Agent Profile 추천
- 프로젝트의 `maxAgentCount`를 초과하지 않는 범위에서 추천
- PM Agent를 반드시 포함
- 추천 결과는 바로 확정하지 않고 사용자가 이름, 색상, 아이콘, model을 수정할 수 있는 임시안으로 반환

Request:

```json
{
  "desiredAgentCount": 5,
  "requiredRoleCodes": [
    "PM",
    "FRONTEND",
    "BACKEND",
    "DATABASE",
    "QA"
  ],
  "allowModelUpgrade": true
}
```

Response:

```json
{
  "projectId": "project-uuid",
  "recommendedAgentCount": 5,
  "recommendations": [
    {
      "roleCode": "PM",
      "agentProfileId": "pm-profile-uuid",
      "llmModelId": "advanced-model-uuid",
      "displayName": "PM Agent",
      "displayColor": "#7C3AED",
      "iconKey": "clipboard-list",
      "reason": "모든 프로젝트는 PM Agent가 필수이며, 중간 규모 프로젝트 관리를 위해 고급 모델을 추천합니다."
    },
    {
      "roleCode": "FRONTEND",
      "agentProfileId": "fe-profile-uuid",
      "llmModelId": "standard-model-uuid",
      "displayName": "Frontend Agent",
      "displayColor": "#0EA5E9",
      "iconKey": "monitor",
      "reason": "대시보드 UI 구현이 핵심이므로 Frontend 역할을 포함합니다."
    }
  ]
}
```

#### 5.3.2 프로젝트 Agent 배정 확정

`POST /api/projects/{projectId}/agents`

책임:

- 사용자가 확정한 Agent Profile 목록을 Project Agent로 생성
- 사용자가 지정한 Agent 표시 이름, 색상, 아이콘을 Project Agent에 저장
- PM Agent가 정확히 1명 포함되었는지 검증
- 확정 후 활성 Agent 수가 프로젝트의 `maxAgentCount`를 초과하지 않는지 검증
- 역할별 기본 markdown 문서 매핑 생성
- 프로젝트 상태를 `READY`로 변경

Request:

```json
{
  "agents": [
    {
      "agentProfileId": "pm-profile-uuid",
      "roleCode": "PM",
      "llmModelId": "advanced-model-uuid",
      "displayName": "PM Agent",
      "displayColor": "#7C3AED",
      "iconKey": "clipboard-list",
      "isPrimaryPm": true
    },
    {
      "agentProfileId": "fe-profile-uuid",
      "roleCode": "FRONTEND",
      "llmModelId": "standard-model-uuid",
      "displayName": "Frontend Agent",
      "displayColor": "#0EA5E9",
      "iconKey": "monitor"
    }
  ]
}
```

Response:

```json
{
  "projectId": "project-uuid",
  "status": "READY",
  "assignedAgents": [
    {
      "id": "project-agent-uuid",
      "roleCode": "PM",
      "displayName": "PM Agent",
      "displayColor": "#7C3AED",
      "iconKey": "clipboard-list",
      "llmModel": {
        "displayName": "ChatGPT Astras"
      },
      "documents": [
        {
          "filePath": "docs/pm/requirements.md",
          "status": "PLANNED"
        }
      ]
    }
  ]
}
```

#### 5.3.3 프로젝트 Agent 목록 조회

`GET /api/projects/{projectId}/agents`

책임:

- 프로젝트에 배정된 Agent 목록 조회
- 타이쿤 오피스 뷰에서 Agent 색상, 아이콘, 상태 표시를 위한 기본 데이터 제공

#### 5.3.4 프로젝트 Agent 교체

`PATCH /api/projects/{projectId}/agents/{projectAgentId}`

책임:

- 특정 Project Agent의 LLM model, 표시명, 표시 색상, 아이콘, 상태, 기반 Agent Profile 변경
- PM 교체 시 기존 primary PM 해제와 신규 primary PM 지정이 하나의 트랜잭션으로 처리되어야 한다.

Request:

```json
{
  "displayName": "Frontend Captain",
  "displayColor": "#22C55E",
  "iconKey": "layout-dashboard",
  "llmModelId": "standard-model-uuid",
  "status": "IDLE"
}
```

#### 5.3.5 프로젝트 Agent 제거

`DELETE /api/projects/{projectId}/agents/{projectAgentId}`

책임:

- Project Agent를 물리 삭제하지 않고 `REMOVED` 상태로 변경
- PM Agent는 제거할 수 없다. PM을 변경하려면 교체 API를 사용한다.

### 5.4 Sprint Milestone API

#### 5.4.1 Sprint Milestone 생성

`POST /api/projects/{projectId}/sprint-milestones`

책임:

- 프로젝트에 표시할 Sprint Milestone 생성
- Milestone 제목, 담당 역할, 표시 색상 저장; 진행률은 연결된 Task에서 계산

Request:

```json
{
  "title": "Canvas Virtualizer",
  "roleCode": "FRONTEND",
  "displayColor": "#4F46E5",
  "sortOrder": 1
}
```

Response:

```json
{
  "id": "milestone-uuid",
  "projectId": "project-uuid",
  "title": "Canvas Virtualizer",
  "roleCode": "FRONTEND",
  "status": "PLANNED",
  "progressCurrent": 0,
  "progressTotal": 0,
  "progressPercent": 0,
  "displayColor": "#4F46E5"
}
```

#### 5.4.2 Sprint Milestone 목록 조회

`GET /api/projects/{projectId}/sprint-milestones`

책임:

- 프로젝트 상세 화면 또는 대시보드의 Active Sprint Milestones 카드에 표시할 목록 조회
- 역할별 진행률, 상태, 담당 Agent 연결 정보를 함께 제공
- MilestoneResult의 resultVersion, reviewStatus, additionalValidation과 다음 Milestone 실행 가능 여부를 함께 제공

#### 5.4.3 Sprint Milestone 수정

`PATCH /api/projects/{projectId}/sprint-milestones/{milestoneId}`

책임:

- Milestone 제목, 표시 색상, 순서 수정
- status/progressCurrent/progressTotal/progressPercent는 읽기 전용이다. 요청에 포함하면 400으로 거부한다.

#### 5.4.4 Project Agent와 Milestone 연결

`POST /api/projects/{projectId}/sprint-milestones/{milestoneId}/agents`

책임:

- 특정 Project Agent를 Milestone의 owner, contributor, reviewer로 연결
- 역할별 진행률 카드와 Agent 상세 화면에서 현재 담당 Milestone을 표시할 수 있도록 연결 데이터 생성

Request:

```json
{
  "projectAgentId": "project-agent-uuid",
  "responsibilityType": "OWNER"
}
```

### 5.5 Project Task API

#### 5.5.1 Project Task 생성

`POST /api/projects/{projectId}/tasks`

책임:

- Project 하위 Task 생성
- 필요 시 특정 Sprint Milestone에 Task를 배치
- 담당 Project Agent와 역할 연결

Request:

```json
{
  "sprintMilestoneId": "milestone-uuid",
  "assignedProjectAgentId": "project-agent-uuid",
  "roleCode": "FRONTEND",
  "title": "Implement milestone progress card",
  "description": "Active Sprint Milestones 카드에서 하위 Task 진행 상황을 표시한다.",
  "status": "TODO",
  "priority": "HIGH",
  "sortOrder": 1
}
```

Response:

```json
{
  "id": "task-uuid",
  "projectId": "project-uuid",
  "sprintMilestoneId": "milestone-uuid",
  "assignedProjectAgentId": "project-agent-uuid",
  "roleCode": "FRONTEND",
  "title": "Implement milestone progress card",
  "status": "TODO",
  "priority": "HIGH"
}
```

#### 5.5.2 Project Task 목록 조회

`GET /api/projects/{projectId}/tasks`

Query:

- `sprintMilestoneId`
- `assignedProjectAgentId`
- `roleCode`
- `status`
- `priority`

책임:

- Project 전체 Task 목록 조회
- 특정 Milestone 하위 Task 목록 조회
- Agent 상세 화면에서 담당 Task 목록 조회

#### 5.5.3 Project Task 수정

`PATCH /api/projects/{projectId}/tasks/{taskId}`

책임:

- Task 제목, 설명, 우선순위, 담당 Agent, 소속 Milestone 수정; 실행 상태 전이는 오케스트레이터가 검증한다.
- Task 상태 변경·생성·취소·Milestone 이동 후 Project와 해당 Milestone 진행률을 자동 재계산하고 동일 revision으로 제공

#### 5.5.4 Project Task Milestone 이동

`PATCH /api/projects/{projectId}/tasks/{taskId}/milestone`

책임:

- Task를 다른 Sprint Milestone으로 이동
- Milestone별 Task 그룹을 사용자가 재구성할 수 있도록 지원

Request:

```json
{
  "sprintMilestoneId": "target-milestone-uuid",
  "sortOrder": 2
}
```

### 5.6 Metadata API

#### 5.6.1 역할 목록 조회

`GET /api/roles`

책임:

- Agent Profile 생성 및 프로젝트 매칭 화면에서 사용할 역할 목록 제공

#### 5.6.2 LLM model 목록 조회

`GET /api/llm-models`

책임:

- Agent Profile 생성 및 Project Agent 배정 시 선택 가능한 model 목록 제공

#### 5.6.3 역할별 문서 템플릿 조회

`GET /api/role-document-templates`

Query:

- `roleCode`

책임:

- 역할별 기본 markdown 파일 후보 제공

## 6. 서비스 흐름

### 6.1 프로젝트 생성 흐름

```text
1. 사용자가 프로젝트 기본 정보를 입력한다.
2. 사용자가 프로젝트 Description과 프로젝트 성격을 입력한다.
3. 사용자가 Budget 여유도와 프로젝트 규모를 선택한다.
4. 사용자가 희망 Agent 수를 입력하거나 비워둔다.
5. 사용자가 고정 Git repository URL을 확인한다.
6. 서버가 Budget 여유도에 대응되는 기준 금액을 계산한다.
7. 서버가 프로젝트별 최대 Agent 수를 계산하거나 사용자가 입력한 값을 검증한다.
8. 서버가 Project와 GitRepository를 생성한다.
9. 서버가 추천 Agent 수를 산정한다.
10. 프로젝트 상태가 AGENT_MATCHING으로 변경된다.
```

### 6.2 PM Agent 필수 배정 흐름

```text
1. 프로젝트 Agent 추천 API가 호출된다.
2. 서버가 활성 상태의 PM Agent Profile을 조회한다.
3. PM Agent Profile이 없으면 추천 실패 응답을 반환한다.
4. PM Agent Profile이 있으면 추천 목록 첫 번째 또는 필수 항목으로 포함한다.
5. Budget이 HIGH 또는 프로젝트 규모가 LARGE인 경우 고급 모델을 우선 추천한다.
6. 사용자가 추천안을 확정하면 Project Agent로 생성한다.
```

### 6.3 Agent 수 산정 및 입력 흐름

```text
1. 사용자가 desiredAgentCount를 입력한 경우 해당 값을 우선 사용한다. maxAgentCount 초과 입력은 400으로 거부한다.
2. 입력하지 않은 경우 projectSize와 budgetLevel을 기반으로 recommendedAgentCount를 계산한다.
3. recommendedAgentCount는 최소 1명이며, PM Agent를 반드시 포함한다.
4. recommendedAgentCount는 maxAgentCount를 초과할 수 없다.
5. 추천 역할 목록은 프로젝트 성격과 Agent 수에 따라 구성된다.
```

기본 추천 규칙:

| project_size | budget_level | 추천 Agent 수 | 기본 역할 |
|---|---|---:|---|
| SMALL | LOW | 2 | PM, BACKEND (UI 중심은 FRONTEND) |
| SMALL | MEDIUM | 3 | PM, FRONTEND, BACKEND |
| SMALL | HIGH | 4 | PM, FRONTEND, BACKEND, QA |
| MEDIUM | LOW | 3 | PM, FRONTEND, BACKEND |
| MEDIUM | MEDIUM | 5 | PM, FRONTEND, BACKEND, DATABASE, QA |
| MEDIUM | HIGH | 6 | PM, FRONTEND, BACKEND, DATABASE, QA, DEVOPS |
| LARGE | LOW | 5 | PM, FRONTEND, BACKEND, DATABASE, QA |
| LARGE | MEDIUM | 7 | PM, FRONTEND, BACKEND, DATABASE, QA, DEVOPS, DESIGN |
| LARGE | HIGH | 8 | PM, FRONTEND, BACKEND, DATABASE, QA, DEVOPS, DESIGN, 추가 역할 |

MVP는 FULLSTACK 역할을 추가하지 않는다. LARGE + HIGH의 8번째 Agent는 필요 역할의 다른 활성 Profile을 추천한다. Profile 수가 부족하면 가능한 수와 부족 역할을 반환하며 정원이나 중복 Profile 제한을 우회하지 않는다.

기본 최대 Agent 수 규칙:

| budget_level | 기준 금액 | 기본 최대 Agent 수 |
|---|---:|---:|
| LOW | $120,000 | 8 |
| MEDIUM | $180,000 | 12 |
| HIGH | $250,000 | 16 |

MVP에서는 프로젝트 생성 시 `budget_level`을 선택하면 `budget_amount`와 `max_agent_count`를 기본값으로 설정한다. 사용자가 `maxAgentCount`를 직접 입력하는 경우에도 Budget 단계별 기본 최대치를 초과하지 않도록 제한한다.

### 6.4 역할별 Agent Profile 매칭 흐름

```text
1. 추천 역할 목록을 만든다.
2. 각 역할별 활성 Agent Profile을 조회한다.
3. 프로젝트 Budget과 규모에 맞는 skillLevel 및 modelGrade를 우선순위로 정렬한다.
4. 가장 적합한 Agent Profile을 추천안에 포함한다.
5. Agent Profile의 기본 이름, 색상, 아이콘을 추천 표시값으로 함께 내려준다.
6. 사용자가 추천 Agent를 교체하거나 이름, 색상, 아이콘, model을 변경할 수 있다.
7. 최종 확정 시 Project Agent를 생성한다.
```

추천 우선순위 예시:

| budget_level | 우선 skill_level | 우선 model_grade |
|---|---|---|
| LOW | JUNIOR 또는 MID | BASIC |
| MEDIUM | MID | STANDARD |
| HIGH | SENIOR | ADVANCED |

### 6.5 Project Agent 생성 흐름

```text
1. 사용자가 Agent 배정을 확정한다.
2. 서버가 PM Agent가 정확히 1명인지 검증한다.
3. 서버가 각 Agent Profile과 Role, LLM model의 유효성을 검증한다.
4. 서버가 displayName, displayColor, iconKey의 유효성을 검증한다.
5. 서버가 ProjectAgent 레코드를 생성한다.
6. 서버가 역할별 RoleDocumentTemplate을 조회한다.
7. 서버가 ProjectAgentDocument를 생성한다.
8. 프로젝트 상태를 READY로 변경한다.
9. 이후 AI-DLC 실행 모듈은 ProjectAgent 목록을 기준으로 작업을 시작한다.
```

### 6.6 Sprint Milestone 연결 흐름

```text
1. 프로젝트가 생성되고 Project Agent 배정이 완료된다.
2. 사용자가 Sprint Milestone을 생성하거나 기본 Milestone 템플릿을 불러온다.
3. 사용자가 Milestone 하위에 Project Task를 생성하거나 기존 Task를 배치한다.
4. 각 Milestone에 주 담당 역할과 Project Agent를 연결한다.
5. 각 Task에 담당 Project Agent와 역할을 연결한다.
6. 서버가 연결된 완료 Task 수/전체 Task 수를 집계하여 progressCurrent, progressTotal, progressPercent를 반환한다.
7. 대시보드에서는 역할별 색상과 진행률을 Active Sprint Milestones 카드에 표시한다.
8. Milestone 상세 또는 펼침 영역에서는 하위 Task 목록을 표시한다.
9. Project Agent 상세 화면에서는 현재 연결된 Milestone과 담당 Task 목록을 표시한다.
```

## 7. 기본 비즈니스 룰

### 7.1 프로젝트 룰

- 프로젝트는 반드시 하나의 Git repository와 연결되어야 한다.
- 프로젝트 하나는 하나의 Git repository만 가질 수 있다.
- 프로젝트가 `READY` 상태가 되려면 Agent 배정이 완료되어야 한다.
- 프로젝트가 `ACTIVE` 상태가 된 이후에는 Agent 추천안을 자동 적용하지 않는다. 실행 중인 Agent의 제거·교체 및 현재 배정 수보다 낮은 정원 변경은 409로 거부한다.
- 프로젝트는 모든 비취소 Task가 Milestone에 속해 COMPLETED이고 빈 Milestone 없이 각 Milestone의 최신 결과가 APPROVED일 때 `COMPLETED`가 된다. 이 상태 전이는 오케스트레이터가 수행하며 일반 수정 API로 우회하지 않는다.
- 프로젝트 삭제는 MVP에서 물리 삭제가 아니라 아카이브로 처리한다.
- 디자인 목업의 `Workspace`는 본 문서 범위에서는 Project와 같은 의미로 해석한다.
- Frontend Desk, Backend Desk, Database Cluster, PM Suite 같은 공간 배치 단위는 본 구현 범위에서 제외한다.

### 7.2 PM Agent 룰

- 모든 프로젝트에는 PM Agent가 반드시 1명 필요하다.
- 한 프로젝트에 primary PM은 정확히 1명만 존재할 수 있다.
- PM Agent는 일반 삭제할 수 없으며 교체만 가능하다.
- 활성 PM Agent Profile이 하나도 없으면 프로젝트 Agent 추천을 진행할 수 없다.

### 7.3 Agent Profile 룰

- Agent Profile은 프로젝트 배정 전의 재사용 가능한 템플릿이다.
- Agent Profile이 수정되어도 이미 생성된 Project Agent에는 자동 반영하지 않는다.
- 비활성 Agent Profile은 신규 추천 및 신규 배정 대상에서 제외한다.
- Agent Profile에는 기본 LLM model이 반드시 있어야 한다.
- Agent Profile에는 기본 색상과 기본 아이콘을 둘 수 있다.
- 기본 색상과 기본 아이콘은 프로젝트 배정 시 추천값으로 사용되며, 확정된 Project Agent에는 독립적으로 저장된다.

### 7.4 Project Agent 룰

- Project Agent는 Agent Profile을 기반으로 생성된다.
- Project Agent는 프로젝트별로 독립적인 LLM model을 가질 수 있다.
- Project Agent는 프로젝트별로 독립적인 표시 이름, 색상, 아이콘을 가질 수 있다.
- 사용자가 표시 이름을 입력하지 않으면 Agent Profile 이름 또는 역할명을 기반으로 기본 이름을 생성한다.
- 사용자가 색상이나 아이콘을 선택하지 않으면 Agent Profile의 기본 색상과 기본 아이콘을 사용한다.
- Agent Profile에도 기본값이 없으면 역할별 fallback 색상과 아이콘을 사용한다.
- MVP에서는 한 프로젝트 안에서 같은 Agent Profile의 중복 배정을 금지한다.
- Project Agent는 역할별 markdown 문서 정보를 가진다.
- Project Agent 상태는 AI-DLC 실행 모듈에서 확장하여 사용할 수 있다.
- 활성 상태의 Project Agent 수는 프로젝트의 `max_agent_count`를 초과할 수 없다.
- `Hire AI Agent` 동작은 Agent Profile 생성이 아니라 기존 Agent Profile을 프로젝트에 추가 배정하는 Project Agent 생성 플로우로 처리한다.

### 7.5 Agent 표시 정보 룰

- `display_name`은 프로젝트 내 Agent를 구분하기 위한 사용자 지정 이름이다.
- 동일 프로젝트 내 Agent 표시 이름 중복은 허용하되, UI 혼동을 줄이기 위해 중복 경고를 제공한다.
- `display_color`는 HEX color 형식을 기본으로 한다.
- MVP에서는 색상 선택을 자유 입력보다 사전 정의된 팔레트 선택 방식으로 제공한다.
- `icon_key`는 프론트엔드에서 지원하는 아이콘 목록의 key 값이다.
- 아이콘 파일 자체를 DB에 저장하지 않고, `icon_key`만 저장한다.
- 역할별 기본 아이콘 예시는 PM `clipboard-list`, Frontend `monitor`, Backend `server`, Database `database`, QA `clipboard-check`이다.

### 7.6 Budget 및 Model 배정 룰

- Budget은 실제 비용이 아닌 리소스 여유도를 의미한다.
- Budget 단계별 기준 금액은 `HIGH = $250,000`, `MEDIUM = $180,000`, `LOW = $120,000`으로 표시한다.
- `budget_amount`는 `budget_level`에서 파생되는 값이며, MVP에서는 사용자가 임의로 직접 입력하지 않는다.
- Budget이 높을수록 더 높은 등급의 LLM model과 숙련도 높은 Agent를 추천한다.
- Budget이 낮아도 PM Agent는 반드시 배정한다.
- 사용자는 추천된 model을 수동으로 변경할 수 있다.
- 비활성 LLM model은 신규 배정할 수 없다.

### 7.7 Sprint Milestone 룰

- Sprint Milestone은 Project에 속한다.
- Sprint Milestone은 특정 역할 또는 여러 Project Agent와 연결될 수 있다.
- Sprint Milestone은 여러 Project Task를 포함할 수 있다.
- Sprint Milestone은 생성·편집 가능하며, 상태와 진행률은 하위 Task에서 자동 계산한다.
- 진행률은 `COMPLETED Task 수 / CANCELLED 제외 전체 Task 수`로 계산한다. Task가 없으면 0%다.
- 사람의 결과 승인은 Milestone 단위로 처리한다. Task별 결과 승인은 생성하지 않는다.
- 모든 비취소 Task가 COMPLETED가 되면 Milestone 결과 버전과 승인 요청을 생성한다. 승인 전에도 진행률은 100%지만 다음 Milestone은 `MILESTONE_APPROVAL` 조건으로 대기한다.
- 승인 후 Task/Artifact/QA/Commit 구성이 바뀌면 새 결과 버전을 만들고 다시 승인받는다. 이전 승인 이력은 보존한다.
- 역할별 진행률 카드에서는 Milestone의 `display_color`가 있으면 우선 사용하고, 없으면 역할 또는 Project Agent 색상을 fallback으로 사용한다.
- Project Agent가 제거되더라도 기존 Milestone 이력은 삭제하지 않고 연결 상태를 별도 정책으로 관리한다.

### 7.8 Project Task 룰

- Task는 반드시 Project에 속한다.
- MVP에서는 Task가 최대 하나의 Sprint Milestone에 속한다.
- Task는 Milestone 없이 Project 하위에 바로 존재할 수 있으나, 데모 화면에서는 Milestone 단위 그룹화를 기본으로 한다.
- Task는 담당 Project Agent 없이 생성할 수 있다.
- 담당 Project Agent가 지정된 경우 해당 Agent는 같은 Project에 속해야 한다.
- Task의 역할이 지정된 경우 담당 Project Agent의 역할과 다를 수 있으나, UI에서는 역할 불일치 경고를 제공할 수 있다.
- Task 변경 시 Milestone과 Project 진행률을 자동 갱신한다. FAILED/WAITING/REVIEW는 완료 Task에 포함하지 않는다.
- Task는 승인된 Plan 버전에 따라 실행되고 기술 QA를 통과한 같은 Artifact 버전이 Git에 게시되며 실행 주체가 기록되면 COMPLETED가 된다. Milestone 사람 승인까지 기다리지 않는다.
- Project 완료 전 모든 비취소 Task는 Milestone에 속해야 한다. 모든 비취소 Task가 COMPLETED이고 모든 Milestone의 최신 결과가 APPROVED이면 Project를 COMPLETED로 전환하고 `completed_at`을 기록한다.
- COMPLETED 전환 이후 UF가 Task 실행 주체·영역, Token/Cost, 사용자 Decision·승인/수정 요청 이력을 읽기 전용으로 집계한다. 이 집계는 Task 상태나 진행률을 변경하지 않는다.

### 7.9 Markdown 문서 룰

- 역할별 필수 markdown 문서는 Project Agent 생성 시 계획 상태로 등록한다.
- MVP에서는 파일의 실제 생성 여부와 DB 등록을 분리할 수 있다.
- 파일 경로는 프로젝트 내에서 중복될 수 없다.
- 역할별 문서 템플릿은 추후 Agent 실행 프롬프트와 연결될 수 있어야 한다.

## 8. MVP 범위

### 8.1 MVP에 포함할 기능

- Project CRUD
- Git repository 1:1 연결
- Budget 여유도, Budget 기준 금액, 프로젝트 규모, 희망 Agent 수 저장
- 프로젝트별 최대 Agent 수 저장 및 초과 배정 방지
- Role 마스터 데이터
- LLM model 마스터 데이터
- Agent Profile CRUD
- Agent Profile 기본 색상 및 기본 아이콘 관리
- PM Agent 필수 검증
- 프로젝트 Agent 추천 API
- 프로젝트 Agent 배정 확정 API
- Project Agent 표시 이름, 색상, 아이콘 저장
- Project Agent 목록 조회
- 역할별 markdown 문서 템플릿 등록
- Project Agent별 문서 경로 등록
- Sprint Milestone 생성, 조회, 수정
- Project Agent와 Sprint Milestone 연결
- 역할별 Milestone 진행률 표시용 데이터 제공
- Project Task 생성, 조회, 수정
- Project Task를 Sprint Milestone 하위로 그룹화
- Project Task와 담당 Project Agent 연결

### 8.2 MVP에서 단순화할 기능

- Agent 추천 알고리즘은 rule-based 방식으로 구현한다.
- 실제 LLM 비용 계산은 하지 않는다.
- Budget 기준 금액은 실제 비용 정산이 아니라 화면 표시와 리소스 규모 판단용으로만 사용한다.
- 프로젝트 생성은 고정 데모 GitHub URL만 허용하며, 실행 시작 시 Git 모듈이 실제 접근 가능 여부를 검증한다.
- markdown 파일은 실제 파일 생성 없이 DB 경로 등록만 우선 가능하다.
- Sprint Milestone 진행률은 동일 가중 Task 개수로 서버에서 자동 산정한다.
- Task 상태 변경에 따른 Milestone 진행률 자동 계산은 MVP 필수다.
- 디자인 목업의 공간 배치, 자리 배정, 좌표 저장은 본 담당 범위에서 제외한다.
- Agent Profile의 과거 성능, 작업 성공률, 테스트 성공률 기반 추천은 MVP 이후로 미룬다.

### 8.3 MVP 이후 확장 후보

- Agent별 작업 성과 기반 추천
- 여러 GitHub Repository 선택 및 GitHub API 연동 확대
- PR 생성·리뷰 및 Agent별 별도 branch (Project branch와 Task commit 연결은 이번 MVP의 Git 모듈 범위)
- Agent별 token 사용량과 Budget 소진율 계산
- Agent Profile marketplace 또는 preset 기능
- 프로젝트 성격 자동 분석
- Description 기반 필요 역할 자동 추론
- 역할별 md 파일 자동 생성
- Agent 간 의존성 그래프 관리

## 9. 구현 우선순위

### 9.1 마스터 데이터 및 기본 Project 생성

- roles seed data
- llm_models seed data
- projects 테이블
- git_repositories 테이블
- Budget 단계별 기준 금액 및 max_agent_count 기본값
- 프로젝트 생성 및 조회 API

### 9.2 Agent Profile 관리

- agent_profiles 테이블
- Agent Profile CRUD API
- 역할별 Profile 조회 API
- 비활성화 처리

### 9.3 Agent 추천 및 배정

- 추천 Agent 수 산정 로직
- PM Agent 필수 추천
- 역할별 Agent Profile 추천
- Project Agent 생성 API
- PM 정확히 1명 검증
- max_agent_count 초과 배정 검증

### 9.4 Sprint Milestone 연결

- sprint_milestones 테이블
- project_agent_milestones 테이블
- project_tasks 테이블
- Sprint Milestone CRUD API
- Project Agent와 Milestone 연결 API
- Project Task CRUD API
- 역할별 진행률 응답 제공

### 9.5 문서 매핑

- role_document_templates 테이블
- project_agent_documents 테이블
- Project Agent 생성 시 기본 md 문서 경로 등록

### 9.6 AI-DLC 연동 준비

- Project Agent 상태 필드 정리
- SSE 상태 이벤트에서 참조할 Agent ID 제공
- Git 작업 모듈에서 참조할 repository 정보 제공
- 타이쿤 오피스 뷰에서 사용할 Agent 목록 응답 최적화

## 10. 예외 및 에러 케이스

| 상황 | 응답 코드 | 처리 |
|---|---:|---|
| Git repository URL 누락 | 400 | 프로젝트 생성 실패 |
| Budget enum 값 오류 | 400 | 허용 값 안내 |
| 프로젝트 규모 enum 값 오류 | 400 | 허용 값 안내 |
| maxAgentCount 초과 배정 | 409 | Agent 추가 배정 불가 |
| Budget 단계와 맞지 않는 budgetAmount 입력 | 400 | 서버 계산값 사용 안내 |
| 활성 PM Agent Profile 없음 | 409 | Agent 추천 불가 |
| PM Agent 없이 배정 확정 | 400 | 배정 확정 실패 |
| PM Agent가 2명 이상 | 400 | 배정 확정 실패 |
| 비활성 Agent Profile 배정 시도 | 400 | 배정 실패 |
| 비활성 LLM model 배정 시도 | 400 | 배정 실패 |
| 지원하지 않는 icon_key 입력 | 400 | 배정 또는 수정 실패 |
| display_color 형식 오류 | 400 | HEX color 형식 안내 |
| display_name 누락 또는 공백 | 400 | 기본 이름 생성 또는 입력 요청 |
| 프로젝트 내 중복 Agent Profile 배정 | 409 | 배정 실패 |
| 프로젝트 내 중복 markdown 경로 | 409 | 문서 생성 실패 |
| Milestone 상태/진행률 직접 입력 | 400 | 읽기 전용 필드이며 하위 Task 집계값 반환 |
| 존재하지 않는 Project Agent를 Milestone에 연결 | 404 | 연결 실패 |
| 존재하지 않는 Milestone에 Task 연결 | 404 | Task 생성 또는 이동 실패 |
| 다른 Project의 Agent를 Task 담당자로 지정 | 400 | 담당 Agent 재선택 요청 |
| ACTIVE 프로젝트의 자동 재추천 시도 | 409 | 수동 확인 요구 |

## 11. 화면 연동 관점

### 11.1 프로젝트 생성 화면

필요 입력값:

- 프로젝트명
- 프로젝트 설명
- 프로젝트 성격
- Budget 여유도
- 프로젝트 규모
- 희망 Agent 수
- 최대 Agent 수
- Git repository URL

화면 출력:

- Budget 단계별 기준 금액
- 추천 Agent 수
- 현재 Agent 수 / 최대 Agent 수
- 다음 단계: Agent 매칭으로 이동

### 11.2 Agent Profile 관리 화면

필요 기능:

- 역할별 Agent Profile 목록
- Agent Profile 생성 및 수정
- 기본 LLM model 선택
- 숙련도 설정
- 기본 색상 선택
- 기본 아이콘 선택
- 활성화 및 비활성화

### 11.3 프로젝트 Agent 매칭 화면

필요 기능:

- 프로젝트 요약 표시
- 추천 역할 및 Agent Profile 목록 표시
- PM Agent 필수 표시
- Agent Profile 교체
- LLM model 변경
- Agent 표시 이름 입력
- Agent 색상 선택
- Agent 아이콘 선택
- 현재 Agent 수 / 최대 Agent 수 표시
- Agent 배정 확정

### 11.4 프로젝트 상세 화면

필요 표시:

- 프로젝트 기본 정보
- Git repository 정보
- 배정된 Project Agent 목록
- PM Agent 표시
- Agent별 표시 이름, 색상, 아이콘
- 현재 Agent 수 / 최대 Agent 수
- Active Sprint Milestone 목록
- 역할별 Milestone 진행률
- Milestone별 하위 Task 목록
- Agent별 담당 Task 목록
- 역할별 markdown 문서 목록
- AI-DLC 실행 상태 연동 영역

### 11.5 디자인 목업과의 용어 정리

- 목업의 `Workspace` 메뉴는 본 담당 영역에서는 Project 목록 또는 현재 Project 컨텍스트로 해석한다.
- `Agents 12/16` 표시는 현재 Project에 배정된 활성 Agent 수와 `max_agent_count`를 의미한다.
- `Hire AI Agent` 버튼은 Agent Profile 신규 생성이 아니라 현재 Project에 Agent를 추가 배정하는 플로우로 연결한다.
- `Budget Runway` 영역은 MVP에서 Budget 단계별 기준 금액을 표시하는 용도로 시작한다.
- `Active Sprint Milestones` 영역은 `sprint_milestones`와 `project_agent_milestones` 데이터를 기반으로 표시한다.
- Milestone을 펼쳤을 때 보이는 Task 목록은 `project_tasks` 데이터를 기반으로 표시한다.
- 시뮬레이션 시간, 속도 조절, 일시정지 기능은 본 MVP 범위에서 제외한다.
- 공간 좌표, 좌석, Desk 배치 정보는 본 담당 범위에서 제외한다.

## 12. 결론

이 설계의 중심은 Agent Profile과 Project Agent를 분리하는 것이다. Agent Profile은 재사용 가능한 Agent 템플릿이고, Project Agent는 특정 프로젝트에 실제로 배정된 실행 주체이다.

프로젝트 생성 단계에서는 사용자가 프로젝트의 성격, Budget 여유도, 규모, 희망 Agent 수, 최대 Agent 수, Git repository를 입력한다. 이후 시스템은 PM Agent를 반드시 포함한 추천안을 만들고, 사용자가 이름, 색상, 아이콘, model을 확인하거나 수정한 뒤 확정하면 Project Agent와 역할별 markdown 문서 매핑이 생성된다.

디자인 목업 기준으로는 Workspace를 별도 DB 개념으로 추가하지 않고 Project와 동일한 컨텍스트로 해석한다. 대신 `Agents 12/16` 같은 capacity 표시, Budget 단계별 기준 금액, Active Sprint Milestone 진행률은 본 요구사항에 반영한다.

MVP에서는 복잡한 AI 추천보다 명확한 rule-based 매칭과 데이터 구조 안정성을 우선한다. 이 구조를 먼저 잡아두면 이후 실제 AI-DLC 실행, GitHub 연동, 타이쿤 오피스 시각화, Agent 성능 기반 추천으로 자연스럽게 확장할 수 있다.

## 13. 인수 기준

| ID | 검증 | 기대 결과 |
| --- | --- | --- |
| PM-AC-001 | HIGH/MEDIUM/LOW 프로젝트 생성 | 각각 $250,000/16, $180,000/12, $120,000/8 기본값 |
| PM-AC-002 | PM 0명/2명으로 배정 확정 | 실패; 1명일 때만 READY |
| PM-AC-003 | 16명 정원에 17번째 배정 | 409; 동시 요청에도 정원 초과 없음 |
| PM-AC-004 | Profile 수정 후 기존 Project Agent 조회 | 기존 표시 정보·모델은 유지 |
| PM-AC-005 | 다른 Project의 Agent/Milestone 연결 | 거부; 기존 데이터 유지 |
| PM-AC-006 | M1 2/3 완료, M2 1/2 완료, 미소속 1/1 완료 | M1 67%, M2 50%, Project 4/6=67%; 모든 Task 동일 가중 |
| PM-AC-007 | 새로고침 및 서버 재시작 | SQLite에서 Project/배정/Task/Milestone 복구 |
| PM-AC-008 | 빈 Milestone·Task 추가/취소/이동/완료 | 0/0은 0%; 이전/새 Milestone·Project 집계 동기화; 수동 입력 400 |
| PM-AC-009 | Milestone Task 전부 완료 | 진행률 100%, 결과 승인 PENDING; Task는 COMPLETED 유지, 다음 Milestone은 승인까지 대기 |
| PM-AC-010 | 모든 Task 완료 및 모든 Milestone 최신 결과 승인 | 미소속 Task와 빈 Milestone이 없으면 Project COMPLETED 및 completedAt 기록; 이후 UF 집계 가능 |

배정/교체/정원 검증은 하나의 DB 트랜잭션에서 수행한다. 제거된 Profile의 재배정은 기존 Project Agent를 재활성화하는 방식으로 처리하여 UNIQUE 제약과 충돌하지 않게 한다. 재활성화 시에도 PM·정원·활성 Profile/모델 검증을 동일하게 적용한다.
