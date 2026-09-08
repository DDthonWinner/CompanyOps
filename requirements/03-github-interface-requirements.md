# 03. GitHub Interface 요구사항

> 문서 ID: GIT · 상태: 통합 정리본 · 기준일: 2026-09-08
> 상위 문서: [마스터](00-master-requirements.md) · 공통 계약: [06](06-integration-contract.md)
> 범위: 파일 변경·Diff·Git 게시. 실행 순서/테스트/승인 판정은 상위 서비스 책임이다.

- 요구사항 ID: `GIT-001` 초기화, `GIT-002` 동기화, `GIT-003` 파일 접근, `GIT-004` ChangeSet/Diff, `GIT-005` Commit/Push, `GIT-006` 실패/재시도.
- Project별 하나의 실행 잠금을 공유하여 파일 변경→기술 QA→게시 사이에 다른 Task가 같은 checkout을 변경하지 않게 한다. 다른 Task의 읽기·계획 작업은 가능하다.
- 게시의 검증 근거는 오케스트레이터의 QARun/기술 Gate다. UF의 AI 활용 Score·Comment는 Git 게시 입력이나 차단 조건이 아니다.
- 아래 코드/JSON은 인터페이스 설명 예시다. 게시의 버전·기술 QA·멱등성 검증은 공통 계약을 반드시 함께 적용한다.

## 1. 프로젝트 개요

### 1.1 목적

Project, Milestone, Task 단위로 수행된 코드 변경을 고정 GitHub Repository에 반영하기 위한 공통 Git Interface를 제공한다.

Git Interface는 LangChain Agent의 Tool 또는 Python FastAPI의 서비스 로직에서 호출한다. 실제 Git 명령은 Git Interface 내부에서 Python `subprocess`를 통해 실행하며, Repository 준비부터 파일 변경, Task 단위 Commit·Push까지의 Git 작업만 담당한다.

### 1.2 대상 Repository

- Repository URL: `https://github.com/DDthonWinner/TestOutput`
- 기본 Branch: Repository 기본 Branch 또는 서버 설정값
- 작업 Branch: `project/{project_id}`
- Workspace는 Project의 동의어다. 별도 제품 공간이 아니며, Git 모듈은 Project별 서버 checkout 디렉터리와 `project/{project_id}` Branch를 사용한다.
- Milestone 수는 가변이다. 2개는 데모 예시이며, Milestone 없는 Task는 Project 시작 시 동기화한 checkout에서 실행한다.

### 1.3 Git 반영 기준

- Project 시작 시 Repository를 Clone한다.
- Milestone 시작 시 원격 변경사항을 Pull한다.
- Task 수행 중에는 동일한 Project checkout의 파일을 읽고 수정한다.
- Task가 승인된 Plan에 따라 실행되고 기술 QA를 통과하면 코드와 MD 파일 변경을 함께 Commit하고 Push한다. 사람 결과 승인은 Milestone 단위이며 Task 게시의 선행 조건이 아니다.
- 다음 Task는 이전 Task의 Commit이 반영된 동일 checkout에서 시작한다.

---

## 2. Git Interface 구성

```text
┌──────────────────────┐     ┌────────────────────────┐
│ LangChain Agent      │     │ Python FastAPI Logic   │
│ Git Tool 호출        │     │ Service 직접 호출     │
└──────────┬───────────┘     └───────────┬────────────┘
           └──────────────┬──────────────┘
                          ▼
                ┌────────────────────┐
                │ Python GitInterface│
                │ clone / pull       │
                │ read / write       │
                │ commit / push      │
                └─────────┬──────────┘
                          ▼
                subprocess.run([...])
                          ▼
                       Git CLI
                          ▼
 https://github.com/DDthonWinner/TestOutput
```

- LangChain Agent를 사용하는 경우 GitInterface 메서드를 Agent Tool로 감싸서 호출한다.
- FastAPI 로직을 사용하는 경우 Service에서 GitInterface 메서드를 직접 호출한다.
- 두 방식 모두 동일한 GitInterface와 동일한 Project checkout을 사용한다.
- LangChain 또는 FastAPI가 Git 명령 문자열을 직접 만들지 않고 GitInterface에 필요한 값만 전달한다.

Git Interface는 다음 기능을 제공한다.

1. Project Repository 초기화
2. Milestone 시작 전 최신 코드 동기화
3. Repository 파일 조회
4. 코드 및 MD 파일 변경 적용
5. 현재 변경사항과 Diff 조회
6. Task 완료 Commit 생성
7. 원격 Project Branch Push

---

## 3. 핵심 기능 요구사항

### 3.1 Project Repository 초기화

**기능명**: `initialize_project_repository`

**목적**: Project가 시작될 때 고정 Repository의 독립 작업공간을 생성한다.

**처리 순서**:

1. `project_id`에 해당하는 checkout 경로를 생성한다.
2. 고정 Repository를 checkout에 Clone한다.
3. `project/{project_id}` 작업 Branch를 생성한다.
4. checkout 경로, Branch 이름 및 기준 Commit SHA를 반환한다.

```text
git clone https://github.com/DDthonWinner/TestOutput {workspace}
git switch -c project/{project_id}
```

**입력**:

```json
{
  "projectId": "PROJECT-001"
}
```

**출력**:

```json
{
  "projectId": "PROJECT-001",
  "checkoutPath": "checkouts/PROJECT-001",
  "branch": "project/PROJECT-001",
  "baseCommitSha": "a1b2c3d4"
}
```

### 3.2 Milestone Repository 동기화

**기능명**: `sync_milestone_repository`

**목적**: Milestone 시작 시 원격 Repository의 최신 변경사항을 Project checkout에 반영한다.

**처리 순서**:

1. 원격 Repository 정보를 조회한다.
2. 원격 Project Branch가 있으면 Project Branch를 Pull한다.
3. 원격 Project Branch가 아직 없으면 기본 Branch의 최신 내용을 반영한다.
4. 동기화된 Commit SHA를 Milestone 시작 기준점으로 반환한다.

```text
git fetch origin
git pull --ff-only origin {target_branch}
```

**입력**:

```json
{
  "projectId": "PROJECT-001",
  "milestoneId": "MILESTONE-01"
}
```

**출력**:

```json
{
  "projectId": "PROJECT-001",
  "milestoneId": "MILESTONE-01",
  "synced": true,
  "headCommitSha": "b2c3d4e5"
}
```

Task는 동일한 Project checkout에서 순차 수행하므로 Task마다 Clone하거나 Pull하지 않는다. Milestone 시작 시 한 번 동기화하며, Push 직전에 원격 변경이 확인되면 게시를 보류한다. 동기화로 내용이 바뀌면 기술 QA를 다시 수행하고 새 Artifact 버전에 게시 조건을 다시 확인해야 한다.

### 3.3 Repository 파일 조회

**기능명**: `read_repository_file`

**목적**: 호출자가 Task 수행에 필요한 Repository 파일을 조회한다.

**입력**:

```json
{
  "projectId": "PROJECT-001",
  "path": "src/App.tsx"
}
```

**출력**:

```json
{
  "path": "src/App.tsx",
  "content": "파일 내용",
  "exists": true
}
```

**처리 조건**:

- Project checkout 내부의 상대 경로만 허용한다.
- `.git` 내부 파일은 조회하지 않는다.
- 파일이 없으면 `exists: false`를 반환한다.

### 3.4 Repository 파일 변경

**기능명**: `apply_file_changes`

**목적**: Task가 생성한 코드 및 MD 파일 변경을 Project checkout에 적용한다.

**입력**:

```json
{
  "projectId": "PROJECT-001",
  "taskId": "TASK-001",
  "changes": [
    {
      "path": "src/App.tsx",
      "operation": "update",
      "content": "수정된 전체 파일 내용"
    },
    {
      "path": ".ai-dlc/tasks/TASK-001.md",
      "operation": "create",
      "content": "Task 수행 결과"
    }
  ]
}
```

**지원 작업**:

- `create`: 새로운 파일 생성
- `update`: 기존 파일 수정
- `delete`: 기존 파일 삭제

**처리 조건**:

- 파일 변경은 checkout에만 적용하며 즉시 Commit하지 않는다.
- 코드 파일과 MD 파일을 동일한 방식으로 처리한다.
- 변경된 파일은 해당 `task_id`의 ChangeSet으로 기록한다.
- checkout 외부 경로와 `.git` 내부 경로 변경은 거부한다.

**출력**:

```json
{
  "taskId": "TASK-001",
  "applied": true,
  "changedFiles": ["src/App.tsx", ".ai-dlc/tasks/TASK-001.md"]
}
```

### 3.5 변경사항 조회

**기능명**: `get_task_changes`

**목적**: Commit 전에 현재 Task가 변경한 파일과 Git Diff를 확인한다.

```text
git status --porcelain
git diff --stat
git diff
```

**출력**:

```json
{
  "taskId": "TASK-001",
  "hasChanges": true,
  "changedFiles": ["src/App.tsx", ".ai-dlc/tasks/TASK-001.md"],
  "diffStat": "2 files changed, 42 insertions(+), 8 deletions(-)",
  "diff": "diff --git ..."
}
```

### 3.6 Task 완료 Commit 및 Push

**기능명**: `publish_task_changes`

**목적**: 완료된 Task의 코드 및 MD 변경을 하나의 Commit으로 생성하고 원격 Project Branch에 Push한다.

**호출 조건**:

- 상위 오케스트레이터가 현재 Artifact 버전의 기술 QA 통과와 승인된 Plan 버전을 확인해야 한다. Task는 아직 REVIEW이며, 게시 성공 후 오케스트레이터가 COMPLETED로 바꾼다. Task별 사람 결과 승인은 확인하지 않는다.
- Task ChangeSet에 하나 이상의 변경 파일이 있어야 한다.
- `task_id`, Task 제목, 승인된 artifactVersion 및 qaRunId가 필요하다. milestoneId는 미소속 Task에 한해 null을 허용한다.

**처리 순서**:

1. 현재 변경 파일과 Diff를 조회한다.
2. Task ChangeSet에 포함된 코드와 MD 파일을 Stage한다.
3. Task 단위 Commit을 생성한다.
4. 원격 Project Branch의 최신 상태를 확인한다.
5. 원격 변경으로 QA 대상 코드가 달라질 수 있으면 게시를 중단하고 `SYNC_REQUIRED`를 반환한다. 상위 오케스트레이터가 동기화·기술 QA 재실행·새 Artifact 버전 확인을 거친다.
6. 동일 Project Branch에 Push한다.
7. Commit SHA, 변경 파일, Diff 요약 및 Branch URL을 반환한다.

```text
git add {task_changed_files}
git commit -m "feat(TASK-001): 회의실 목록 화면 구현"
git push origin project/PROJECT-001
```

첫 번째 Task Push에서는 원격 Branch가 없을 수 있으므로 다음 명령을 사용한다.

```text
git push -u origin project/PROJECT-001
```

**입력**:

```json
{
  "projectId": "PROJECT-001",
  "milestoneId": "MILESTONE-01",
  "taskId": "TASK-001",
  "taskTitle": "회의실 목록 화면 구현",
  "commitType": "feat"
}
```

**출력**:

```json
{
  "projectId": "PROJECT-001",
  "milestoneId": "MILESTONE-01",
  "taskId": "TASK-001",
  "published": true,
  "commitSha": "c3d4e5f6",
  "branch": "project/PROJECT-001",
  "branchUrl": "https://github.com/DDthonWinner/TestOutput/tree/project/PROJECT-001",
  "changedFiles": ["src/App.tsx", ".ai-dlc/tasks/TASK-001.md"]
}
```

---

## 4. MD 파일 반영 요구사항

Git Interface는 일반 코드 파일과 MD 파일을 구분하지 않고 동일한 ChangeSet으로 처리한다.

권장 MD 경로는 다음과 같다.

```text
.ai-dlc/
├── project.md
├── context.md
├── milestones/
│   ├── milestone-01.md
│   └── milestone-02.md
└── tasks/
    ├── TASK-001.md
    └── TASK-002.md
```

Task 완료 시 다음 변경을 하나의 Commit에 포함할 수 있어야 한다.

- Task에서 생성하거나 수정한 코드
- Task 수행 결과 MD
- 공통 Context 변경 MD
- Milestone 진행 상태 MD

Task의 Commit SHA는 Commit 생성 이후 확정되므로 Git Interface의 반환값으로 관리한다. 해당 SHA를 MD에 반드시 기록해야 하는 경우에는 다음 Task 또는 Milestone 상태 갱신 Commit에서 반영한다.

---

## 5. Python 구현 방식

### 5.1 모듈 구성

```text
git_interface/
├── interface.py
├── workspace.py
├── file_access.py
├── git_command.py
├── models.py
└── exceptions.py
```

### 5.2 Interface 정의 예시

```python
class GitInterface:
    def initialize_project_repository(self, project_id: str): ...

    def sync_milestone_repository(
        self,
        project_id: str,
        milestone_id: str,
    ): ...

    def read_repository_file(
        self,
        project_id: str,
        path: str,
    ): ...

    def apply_file_changes(
        self,
        project_id: str,
        task_id: str,
        changes: list,
    ): ...

    def get_task_changes(
        self,
        project_id: str,
        task_id: str,
    ): ...

    def publish_task_changes(
        self,
        project_id: str,
        milestone_id: str,
        task_id: str,
        task_title: str,
        commit_type: str,
    ): ...
```

### 5.3 호출 방식

LangChain Agent에서는 GitInterface 메서드를 Tool로 연결한다.

```python
from langchain.tools import tool

@tool
def publish_task_changes(
    project_id: str,
    milestone_id: str,
    task_id: str,
    task_title: str,
):
    """완료된 Task 변경을 Commit하고 원격 Branch에 Push한다."""
    return git_interface.publish_task_changes(
        project_id=project_id,
        milestone_id=milestone_id,
        task_id=task_id,
        task_title=task_title,
        commit_type="feat",
    )
```

FastAPI 로직에서는 GitInterface를 직접 호출한다.

```python
@router.post("/api/projects/{project_id}/tasks/{task_id}/publish")
def publish_task(project_id: str, task_id: str, request: PublishRequest):
    return git_interface.publish_task_changes(
        project_id=project_id,
        milestone_id=request.milestone_id,
        task_id=task_id,
        task_title=request.task_title,
        commit_type=request.commit_type,
    )
```

### 5.4 Git 명령 실행

Python에서는 Git CLI를 `subprocess.run()`으로 호출한다.

```python
from pathlib import Path
import subprocess

def run_git(args: list[str], workspace: Path) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=workspace,
        capture_output=True,
        text=True,
        timeout=120,
        check=True,
    )
    return result.stdout
```

- Git 명령은 문자열이 아니라 인자 배열로 전달한다.
- `shell=True`는 사용하지 않는다.
- 모든 명령은 해당 Project checkout을 `cwd`로 사용한다.
- Git 인증정보는 서버 환경에서 제공하며 Interface 입력값으로 받지 않는다.

### 5.5 파일 경로 확인

```python
from pathlib import Path

def resolve_repository_path(
    workspace: Path,
    relative_path: str,
) -> Path:
    workspace = workspace.resolve()
    target = (workspace / relative_path).resolve()

    if target == workspace or workspace not in target.parents:
        raise ValueError("Repository 외부 경로입니다.")

    if ".git" in target.parts:
        raise ValueError(".git 경로는 변경할 수 없습니다.")

    return target
```

---

## 6. 전체 Git 처리 흐름

```text
[Project 시작]
initialize_project_repository
→ Repository Clone
→ project/{project_id} Branch 생성

[Milestone 1 시작]
sync_milestone_repository
→ 원격 최신 코드 Pull

[Task 수행]
read_repository_file
→ apply_file_changes
→ get_task_changes

[Task 완료]
publish_task_changes
→ 코드와 MD Stage
→ Task Commit
→ 원격 변경 확인
→ Project Branch Push

[다음 Task]
→ 이전 Commit이 반영된 checkout에서 계속 수행

[Milestone 2 시작]
sync_milestone_repository
→ 원격 최신 코드 Pull
→ 동일한 Task 처리 반복
```

---

## 7. 오류 처리

| 오류 상황                 | Interface 처리                             |
| ------------------------- | ------------------------------------------ |
| Clone 실패                | 초기화 실패 반환                           |
| Project checkout 없음    | 요청 거부                                  |
| Pull 충돌                 | 동기화 실패 및 충돌 파일 반환              |
| Repository 외부 경로 요청 | 파일 작업 거부                             |
| 변경 파일 없음            | Commit·Push 수행하지 않음                  |
| Commit 실패               | 기존 변경을 checkout에 유지하고 실패 반환 |
| Push 인증 실패            | 로컬 Commit SHA와 오류 반환                |
| 원격 변경 충돌            | 게시 중단 및 SYNC_REQUIRED 반환              |

오류 발생 시 Force Push, 자동 충돌 덮어쓰기 및 기본 Branch 직접 수정은 수행하지 않는다.

---

## 8. MVP 개발 범위

### 8.1 핵심 기능

- `TestOutput` Repository Clone
- Project별 checkout과 작업 Branch 생성
- Milestone 시작 시 Pull
- Repository 파일 읽기
- 코드 및 MD 파일 생성·수정·삭제
- Task별 변경 파일과 Diff 조회
- Task 완료 시 코드와 MD를 하나의 Commit으로 생성
- Task Commit을 원격 Project Branch에 Push
- Commit SHA, Branch URL 및 변경 파일 반환

### 8.2 제외 기능

- 여러 Repository 선택
- 기본 Branch 직접 Push
- Force Push
- 자동 Merge 및 Pull Request 생성
- Git 충돌 자동 해결
- Task 실행 순서 및 Agent 판단 로직
- 테스트 실행 및 Task 완료 여부 판단

---

## 9. 완료 조건

- Project 시작 시 고정 Repository가 독립 checkout에 Clone된다.
- `project/{project_id}` Branch가 생성된다.
- 각 Milestone 시작 시 원격 최신 코드가 반영된다.
- 호출자가 Repository 파일을 읽고 코드와 MD 파일을 변경할 수 있다.
- Task가 승인된 Plan과 기술 QA 조건을 통과할 때 해당 Task의 변경만 Commit된다.
- Task별 Commit이 원격 Project Branch에 Push된다.
- GitHub에서 Task별 Commit 이력을 확인할 수 있다.
- 다음 Task가 이전 Task의 최신 코드에서 작업을 이어갈 수 있다.
- 결과값으로 Commit SHA, Branch URL, 변경 파일과 Diff를 확인할 수 있다.

## 10. 통합 시 필수 보완 규칙

### 10.1 승인 대상과 ChangeSet

- `get_task_changes`는 기존 파일 Diff뿐 아니라 신규 미추적 파일과 삭제 파일도 포함한다. `git diff`만으로 신규 파일을 누락하지 않는다.
- ChangeSet에는 taskId, attemptId, artifactVersion, baseCommitSha, 변경 경로, 내용 hash를 저장한다. 기술 QA는 같은 내용 hash에 연결한다.
- `publish_task_changes`는 artifactVersion, qaRunId, approvedPlanVersion, requestId를 추가 입력받고 서버에 저장된 Plan 승인·기술 Gate와 현재 ChangeSet hash를 검증한다. 클라이언트가 보낸 `approved=true`만 신뢰하지 않는다.
- 코드·Task 결과 MD는 기술 QA 전에 생성하여 같은 Artifact 버전의 검증 대상에 포함한다. 이후 MD를 변경하는 경우에도 새 Artifact 버전으로 취급한다.
- 프로젝트 상대 경로만 허용한다. 절대 경로·상위 경로 이탈·심볼릭 링크 이탈·`.git` 접근을 거부하며, Stage에는 `--` 경계와 검증된 경로 목록을 사용한다.

### 10.2 재시도 및 빈 변경

- 초기화 재호출은 같은 checkout/branch를 확인해 재사용한다. 기존 디렉터리를 덮어쓰지 않는다.
- Push 실패 시 `COMMITTED_LOCAL`과 SHA·오류를 저장하고, 같은 requestId 재시도는 기존 Commit을 Push한다. 새 Commit을 중복 생성하지 않는다.
- 원격에서 이미 해당 SHA가 확인되면 게시 성공으로 복구한다. 인증·네트워크 실패를 테스트 실패로 바꾸지 않는다.
- 원격 divergence는 자동 rebase/강제 Push로 해결하지 않는다. 수정된 내용은 기술 QA와 게시 조건을 다시 확인한다.
- 변경이 없으면 `NO_CHANGES`를 반환한다. 기존 결과를 검증만 하는 승인된 Task에는 적용할 수 있지만, 코드/문서 생성 Task의 예상 변경이 없으면 오케스트레이터가 완료 처리하지 않는다.
- 기술 QA 또는 Git 게시 대기 중에는 checkout 잠금과 ChangeSet을 보존한다. Milestone 사람 승인은 Task 게시 후 이루어지므로 checkout 잠금을 점유하지 않는다.

### 10.3 추가 인수 기준

| ID | 검증 | 기대 결과 |
| --- | --- | --- |
| GIT-AC-001 | Task 2개 순차 게시 | 같은 Project branch의 서로 다른 Task Commit 및 코드/MD 확인 |
| GIT-AC-002 | Push 실패 후 동일 요청 재시도 | 기존 SHA 재사용, 중복 Commit 없음 |
| GIT-AC-003 | QA 통과 뒤 코드 변경 | 게시 거부, 새 버전 기술 QA 필요 |
| GIT-AC-004 | 신규 파일만 생성 | Diff/변경 목록 및 Commit에 신규 파일 포함 |
| GIT-AC-005 | 경로 이탈 또는 다른 Task 파일 Stage | 거부, 해당 Task ChangeSet만 게시 |
