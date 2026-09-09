# CompanyOps Backend (U1 `backend-pm`)

FastAPI + SQLite + in-process task worker + SSE. Implements PM management, plan-first
orchestration, technical QA, publish coordination, milestone results, project completion,
and the execution provider (fixture default / OpenAI).

## Setup & run
```bash
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python seed.py            # roles, models, doc templates, starter profiles
uvicorn app.main:app --reload    # or ./run.sh
```
Docs: `http://127.0.0.1:8000/docs` · Health: `/health`

## Environment (.env)
| Var | Default | Meaning |
|---|---|---|
| `EXECUTION_MODE` | `demo` | `demo` (fixture) or `openai` (real GPT, falls back to fixture) |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | — / `gpt-4o-mini` | real-mode credentials |
| `DB_PATH` | `./data/companyops.db` | SQLite file |
| `BACKUP_DIR` | `./backups` | periodic backup target |
| `QA_TEST_CMD` | (empty) | real test command; empty ⇒ labeled demo PASS |
| `GIT_MODE` | `stub` | `stub` (deterministic demo) or `real` (subprocess git + real push) |
| `GIT_REMOTE` | `.../TestOutput` | git output target (used in `real` mode) |
| `CHECKOUT_ROOT` | `./checkouts` | per-project working copies (`real` mode) |

### Git modes
- `GIT_MODE=stub` (default) — `LocalStubGit`; deterministic, no real git, safe for demos.
- `GIT_MODE=real` — the U2 `GitInterface` (subprocess git) is injected at startup: real clone of `GIT_REMOTE`, per-project branch `project/{projectId}`, real commit + push. Requires git credentials in the server environment; missing credentials surface as a `FAILED`/`COMMITTED_LOCAL` publish (never a crash).

## Key endpoints (06 §4)
- PM: `POST/GET /api/projects`, `GET/PATCH /api/projects/{id}`, `/agent-profiles`, `/roles`, `/llm-models`, project-scoped `/agents`, `/sprint-milestones`, `/tasks`, `/agent-recommendations`.
- Orchestration (project-scoped): `GET /snapshot`, `GET /events` (SSE), `POST /commands`, `POST /plans/{id}/{feedback|review-complete|approve}`, `POST /decisions/{id}/resolve`, `GET /qa-runs/{id}`, `GET/POST /sprint-milestones/{id}/result[/reviews]`, `POST /tasks/{id}/publish`, `GET /tasks/{id}/artifacts`, `GET /activity`.
- UF (global): `POST/GET /api/utilization`, `GET /api/utilization/{reportId}[/metrics|/feedbacks]`, `POST /api/utilization/{reportId}/feedbacks`, `PUT /api/feedbacks/{feedbackId}`. Report auto-generated on project COMPLETED (UF_MVP_V1); post-completion only.

## Invariants honored
Multi-axis state kept separate; `round(100×COMPLETED/non-cancelled)` progress; Task COMPLETED = approved plan version + technical gate PASSED + push success + `executionMode`; milestone-result versioning + human review; idempotency (`requestId`) + optimistic concurrency (409); SSE snapshot-invalidation (heartbeat 15s).

## Cross-unit ports (stubs in U1)
- `app/ports/git_port.py` — `LocalStubGit` (real GitInterface = U2).
- `app/ports/utilization_port.py` — `NoopUtilization` (real UF = U3).
Swap via `app/orchestrator/deps.set_git_port(...)` / `set_utilization_port(...)`.

## Tests
`pytest` (executed in the Build & Test stage). Covers recommendation/assignment invariants, progress math, plan-version guards + 409, idempotency, and the full connected flow through project completion.


## Five-role connected demo

Run `venv/bin/python seed_flow_demo.py` from `backend`, then refresh the project picker
at `http://localhost:5173` and select **데모 · 5역할 전체 개발 흐름**.

- PM / Frontend / Backend / Database / QA: one assigned agent each.
- 12 tasks with explicit agent IDs and dependencies; PM preparation is 2/12 complete.
- In **결정 필요**, enter `샘플 데이터로 진행` and click **결정 전달** to release the
  remaining tasks: implementation → QA → PM report. Finish with **Milestone 결과 승인**.
- Fixture approval is recorded with actor `seed-flow-demo-v1`, not a human reviewer.
  Tokens, QA and generated artifacts are demo data. No remote git/model operations.
- Requires demo execution, stub git and no QA shell command. Existing projects are
  preserved; rerunning reuses the demo, and `--new` creates a separate run.
- Fixture tasks can finish quickly; the worker does not simulate long-running AI calls.

Validation: `venv/bin/python -m pytest tests/orchestrator/test_flow_demo.py -q` uses
an isolated test database and checks the decision-to-milestone-approval lifecycle.

## Neobank 자동 반복 시연

기존 **Neobank Super App** 프로젝트의 팀/태스크/마일스톤을 그대로 사용합니다.
이름의 공백과 대소문자는 무시하므로 `Neo Bank SuperApp`도 인식합니다.
대상이 없거나 같은 이름이 여러 개면 시작을 거부합니다. 새 프로젝트를 생성하지 않습니다.

백엔드를 새 코드로 시작(또는 재시작)한 뒤, 다른 터미널에서 실행하세요.

```bash
cd backend
venv/bin/python demo_replay.py start --interval 3 --hold 15
venv/bin/python demo_replay.py status
venv/bin/python demo_replay.py stop
```

- 화면에서 **Neobank Super App**을 선택하면 기존 SSE/snapshot을 통해 자동 갱신됩니다.
- `--interval`: 각 단계 유지 시간(초, 기본 3). `--hold`: 완료 화면 유지 시간(초, 기본 15).
- 다른 서버 주소는 `--url http://127.0.0.1:8000`으로 지정합니다.
- 최초 시작은 0%로 초기화하고, `stop` 후 `start`는 멈춘 단계에서 계속합니다.
- 스케줄은 서버가 실행합니다. CLI 종료와 관계없이 반복하며, 백엔드를 재시작해도
  저장된 활성 스케줄을 이어갑니다. 처음에는 자동으로 켜지지 않습니다.
- `EXECUTION_MODE=demo`, `GIT_MODE=stub`, 빈 `QA_TEST_CMD`가 필수입니다.
  실제 LLM 호출, 셸 QA 실행, Git push는 발생하지 않습니다.

흐름: 계획 검토 → 데모 자동 승인 → PM 준비 → 역할별 병렬 개발 →
은행 샘플 데이터 결정 요청/자동 해결 → 태스크별 QA/모의 publish →
마일스톤 결과 대기/자동 승인 → QA 역할 작업 → 프로젝트 COMPLETED/활용도 보고서 →
완료 화면 유지 → 0%부터 반복. 각 에이전트는 WORKING/WAITING/BLOCKED/IDLE,
현재/다음 작업, 활동 설명이 함께 갱신됩니다. 역할 내에는 에이전트당 한 작업씩 실행합니다.
기존 태스크 의존성이 있으면 그 의존성을 우선하며, 의존성이 없는 seed에만 PM/개발/QA
순서를 적용합니다. 자동 승인의 actor는 `demo-replay`, QA/토큰은 demo로 기록합니다.

**데이터 범위와 백업**

- 최초 등록 전에 SQLite online backup으로 `BACKUP_DIR/before-demo-replay-<uuid>.db`를
  저장합니다. 정확한 파일 경로는 `status`의 `backupPath`에서 확인합니다.
- 프로젝트·에이전트·태스크·마일스톤 ID, 이름과 외형은 유지합니다. 태스크 담당자는 역할별로
  재배분됩니다. 매 회차 대상 프로젝트의 계획/실행/QA/publish/승인/결정/토큰/활동/활용도
  기록을 비우므로 반복해도 실행 이력이 계속 쌓이지 않습니다. revision은 계속 증가합니다.
- 다른 프로젝트의 데이터는 변경하지 않습니다. `stop`은 **시연 정지**이며 원본 복원이 아닙니다.
- 등록한 프로젝트는 정지 중에도 일반 워커 및 프로젝트 변경 API에서 제외됩니다(409).
  시연 도중 화면의 승인 버튼을 누를 필요가 없습니다. 일반 편집으로 돌아가려면 서버를
  종료하고 최초 백업을 복원하세요. 백업은 **DB 전체**이므로 이후 다른 프로젝트의 변경도
  되돌아간다는 점을 고려해 현재 DB를 별도 보관한 뒤 복원해야 합니다.
- 단일 백엔드 프로세스(`uvicorn --workers 1`, 기본값)로 실행하세요. 다중 프로세스 배포용
  분산 스케줄러는 아닙니다. 오류가 발생하면 해당 스케줄만 정지하고 `status.error`에 기록합니다.

HTTP 제어: `GET /api/demo/replay`, `POST /api/demo/replay/start`
(`{"intervalSeconds":3,"completionSeconds":15}`), `POST /api/demo/replay/stop`.

검증: `venv/bin/python -m pytest tests/orchestrator/test_demo_replay.py -q`.
격리된 DB에서 연속 두 회차 완료, QA/승인 조건, 0% 재시작, 정지/재개,
백엔드 재시작 시 상태 보존, 백업, 다른 프로젝트 격리 및 변경 API 차단을 확인합니다.
