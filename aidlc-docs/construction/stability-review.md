# 안정성·완성도 개선과 AI-DLC 연결 근거

작성일: 2026-09-09. 이 문서는 구축(CONSTRUCTION) 완료 이후 진행한 안정성·사용성·보안 보완 작업을, **요구사항 → 설계 결정 → 구현 경로 → 검증**의 흐름으로 연결해 기록합니다. 2026-09-08의 최초 승인·검증 이력은 [aidlc-state.md](../aidlc-state.md)와 [audit.md](../audit.md)에 그대로 보존하며, 이 문서는 그 이후의 현재 상태 갱신을 별도로 다룹니다.

측정하지 않은 고객 인터뷰·정량 효과는 주장하지 않습니다. 아래 사례는 실제 개발 중 확인한 문제와 그에 대응한 실제 변경입니다.

## 요약

| # | 요구사항/문제 | 핵심 설계 결정 | 구현 | 검증 |
| --- | --- | --- | --- | --- |
| 1 | 팀 배정 후 첫 계획을 만들 경로가 없어 신규 사용자가 멈춤. 계획은 승인 전에 실행되면 안 됨 | READY 상태 전용 첫 계획 단계 + 사람 승인 게이트 | `PlanReviewPanel.tsx`, `DashboardView.tsx`, `orchestrator/service.approve_plan` | `PlanReviewPanel.test.tsx`, `test_flow.py`, screenshots/ 폴더 |
| 2 | 생성 파일이 아니라 백엔드 자체를 검증할 위험. QA 통과 없이 게시되면 안 됨 | 작업용 저장소(checkout) 경로를 권위 있는 실행 위치로 전달, 없으면 ERROR | `ports/git_port.py`, `git_interface/interface.py`, `worker.py`, `qa.py` | `test_qa_workspace.py`, `test_git_interface.py`, screenshots/ 폴더 |
| 3 | 작업 100%와 프로젝트 완료를 혼동. 임시 지표를 정식 성과로 오인할 위험 | 완료에 마일스톤 결과 승인 요구, 피드백 기본 접힘·완료 후 진입, 정식/테스트 구분 | `FeedbackSection.tsx`, `HeaderStrip.tsx`, `orchestrator/service.maybe_complete_project` | `FeedbackSection.test.tsx`, screenshots/ 폴더 |
| 4(보완) | 로컬 브라우저 외 출처의 변경 요청·오류 상세 노출 | 신뢰 Origin 외 쓰기 403, 500 응답에서 상세 제거·상관 ID 로깅 | `common/access.py`, `common/errors.py`, `config.py` | `test_access.py` |

## 사례 1 — 계획 승인 게이트와 신규 사용자의 첫 계획 진입

**요구사항·문제.** 계획은 사람이 최종 승인해야 실행됩니다([user-stories](../inception/user-stories/stories.md), [unit-of-work.md](../inception/application-design/unit-of-work.md)의 승인 흐름). 그런데 실제 화면을 확인하는 중, 팀 배정 후 `READY` 상태에서 첫 계획을 만들 진입점이 없어 신규 사용자가 더 진행할 수 없는 공백을 발견했습니다. 과거 문서의 대시보드 하단 입력은 현재 구현에서 제거되어 있어([unit-of-work.md](../inception/application-design/unit-of-work.md) 참고), 팀 배정 이후 전용 단계가 필요했습니다.

**설계 결정.** 프로젝트 생성·팀 구성은 프로젝트 마을과 팀 매칭에서 진행하고, 팀 배정이 끝난 `READY` 상태에서만 **첫 계획 만들기** 전용 단계를 노출합니다. 이 단계는 자동 다중 역할 생성이 아니라 사용자가 첫 작업의 목표·완료 조건과 담당 역할 하나를 정하는 최소한의 실제 진입 경로입니다. 등록된 계획은 기존 검토(`REVIEW`) → 검토 완료(`FINAL_APPROVAL_PENDING`) → 최종 실행 승인 흐름을 그대로 따릅니다.

**구현 경로.**
- `frontend/src/features/dashboard/PlanReviewPanel.tsx`: 계획이 없고 `status === "READY"`이면 첫 계획 입력 영역을 렌더링하고, 배정된 역할만 선택지로 제공하며, `api.postCommand`에 명시적 작업 1개와 첫 마일스톤을 전달합니다. 빈 입력·연결 끊김·요청 진행 중에는 생성 버튼이 비활성입니다.
- `frontend/src/features/dashboard/DashboardView.tsx`: `status === "READY"`에서 `PlanReviewPanel`을 노출합니다.
- 서버 승인 게이트: `backend/app/orchestrator/service.py`의 `approve_plan`은 계획 상태가 승인 가능한 값일 때만 승인하고, 승인 시점에 작업을 구성해 실행을 시작합니다. 승인 전에는 작업이 실행되지 않습니다.

**검증.**
- `frontend/src/features/dashboard/__tests__/PlanReviewPanel.test.tsx`: `registers an explicit assigned-role task without approving it`(배정된 역할로 작업 등록, 자동 승인하지 않음), `FINAL_APPROVAL_PENDING shows final approval with version guard`(버전 가드 포함 최종 승인).
- `backend/tests/orchestrator/test_flow.py`: `test_plan_version_guard_and_approval`(오래된 버전 거부, 검토 완료→승인→작업 구성).
- 화면 증거: [screenshots/](../../screenshots/) 폴더(첫 계획·계획 승인 화면 포함).

## 사례 2 — 생성 파일 검증 → 게시 → 완료의 실제 경로

**요구사항·문제.** 기술 검증(QA) 게이트를 통과한 결과만 게시하고 완료로 처리합니다([backend-git 설계](backend-git/functional-design/business-rules.md), 통합 계약). 개발 중, 실제 테스트 명령을 지정했을 때 검증 대상이 **프로젝트의 생성 파일**이 아니라 백엔드 프로세스의 현재 폴더가 될 수 있는 위험을 확인했습니다. 잘못된 폴더에서 검증하면 실제로는 검증되지 않은 결과가 통과할 수 있습니다.

**설계 결정.** 파일을 실제 적용한 작업용 저장소(checkout)의 절대 경로를 권위 있는 실행 위치로 정의하고, QA는 반드시 그 경로에서 실행합니다. 경로가 없거나(메모리 기반 게시), 상대 경로이거나, 폴더가 존재하지 않으면 대신 실행하지 않고 `ERROR`로 처리합니다. 데이터를 위한 기존 예제 QA(외부 미연결) 통과 표시는 그대로 유지하되, 실제 명령 실행과 명확히 구분합니다.

**구현 경로.**
- `backend/app/ports/git_port.py`: `ApplyResult.checkout_path: str | None` 추가. 메모리 기반 제공자는 `None`.
- `backend/app/git_interface/interface.py`: 파일을 실제 적용한 작업용 저장소의 절대 경로를 반환.
- `backend/app/orchestrator/worker.py`: 그 경로를 `qa.run_qa(..., checkout_path=...)`로 전달.
- `backend/app/orchestrator/qa.py`: `_run_real(cmd, checkout_path)`가 `subprocess.run(cwd=checkout_path)`로 실행하고, 경로가 없거나 절대 경로가 아니거나 폴더가 아니면 `ERROR`를 반환. 실제 명령의 성공·실패도 `TestResult`로 저장.

**검증.**
- `backend/tests/orchestrator/test_qa_workspace.py`: `test_real_qa_refuses_missing_or_relative_workspace`(없는 경로·상대 경로 거부), `test_real_qa_reports_missing_executable`(없는 실행 파일 처리).
- `backend/tests/git_interface/test_git_interface.py`: `test_worker_checks_generated_project_before_publishing`(제어된 실행 제공자가 `generated.py`·`validate.py`를 생성 → 실제 파이썬으로 생성물 검증 → 실제 로컬 bare Git에 게시. 정상 값은 통과·게시·완료, 잘못된 값은 QA 실패·게시 없음. 프로세스 현재 폴더에 다른 `validate.py`를 두어 잘못된 폴더 검증이 통과할 수 없게 함), `test_connected_flow_with_real_git`.
- 이 테스트들은 외부 모델을 호출하지 않는 통합 테스트입니다.
- 화면 증거: [screenshots/](../../screenshots/) 폴더(개발 흐름·결과 승인 화면 포함).

## 사례 3 — 프로젝트 완료와 AI 활용 평가의 분리

**요구사항·문제.** 작업 진행률 100%와 프로젝트 완료는 다릅니다. 완료에는 마일스톤 결과 승인이 필요하고, AI 활용 피드백은 완료 이후에 확인합니다([backend-uf 설계](backend-uf/functional-design/business-rules.md)). 진행 중 지표를 정식 성과로 오인하지 않도록 정식 보고서와 임시 확인을 구분해야 합니다.

**설계 결정.** 프로젝트 완료는 모든 대상 작업 완료와 마일스톤 결과 승인을 함께 요구합니다. 피드백 영역은 기본으로 접혀 있고, 완료 상태의 상단 카드 버튼으로 진입·펼침합니다. 진행 중 **테스트 중** 토글은 임시 지표를 정식 리포트로 저장하지 않고 미리 보는 용도임을 화면에 명시합니다.

**구현 경로.**
- `backend/app/orchestrator/service.py`의 `maybe_complete_project`: 비취소 작업이 모두 완료이고 마일스톤 결과가 승인됐을 때만 완료 처리.
- `frontend/src/features/dashboard/HeaderStrip.tsx`: `COMPLETED` 상태에서 AI Feedback 생성 진입 버튼 노출.
- `frontend/src/features/dashboard/FeedbackSection.tsx`: 기본 접힘, 정식 생성/조회와 테스트 미리보기(`testMode`) 구분, 유효 관점 점수 평균과 `N/A` 표시.

**검증.**
- `frontend/src/features/dashboard/__tests__/FeedbackSection.test.tsx`: 완료 전 비활성, 생성/조회, 테스트 모드 미리보기, 실패 후 재시도.
- 화면 증거: [screenshots/](../../screenshots/) 폴더(완료 후 피드백 화면 포함).

## 사례 4(보완) — 로컬 브라우저 접근 경계와 오류 처리

**문제.** 로컬 개발 서버라도 신뢰하지 않는 화면(Origin)에서 보낸 변경 요청이 CORS 응답 숨김만으로는 실제 부작용을 막지 못합니다. 전역 500 응답이 예외 문자열을 노출하면 정보가 새어 나갈 수 있습니다.

**설계 결정과 구현.**
- `backend/app/common/access.py`: 신뢰 Origin 외에서 온 변경 메서드 요청을 실제 API 도달 전에 403으로 차단하고, `CORS_ORIGINS`는 명시적 출처만 허용하며 와일드카드·`null`을 거부합니다. Origin 없는 로컬 CLI 요청은 허용합니다.
- `backend/app/config.py`, `backend/.env.example`: `CORS_ORIGINS` 기본값 `http://localhost:5173,http://127.0.0.1:5173`.
- `backend/app/common/errors.py`: 전역 500은 일반 문구와 UUID 요청 식별자만 반환하고, 상세와 예외는 같은 식별자로 서버 로그에 기록합니다.

**한계.** 이는 로컬 사용 범위의 접근 경계이며 **사용자 인증 시스템이 아닙니다.** 외부 공개 배포용 보호라고 주장하지 않으며 서버 기본 주소 `127.0.0.1`을 유지합니다.

**검증.** `backend/tests/common/test_access.py`: `test_untrusted_simple_post_cannot_mutate`, `test_trusted_browser_and_local_cli_remain_usable`, `test_wildcard_is_rejected`, `test_unhandled_error_hides_details_but_logs_correlation`.

## 팀 재배정 시 PM 중복 방지(보완)

프로젝트 마을은 생성 시 PM을 자동 배정하는데, 이후 추천 팀을 다시 배정하면 같은 PM이 중복될 수 있었습니다. `backend/app/pm/service.py`에서 기존 프로필 배정을 재사용하고, 정원·단일 PM·역할 일치를 검증하며, 일괄 배정을 `DRAFT/AGENT_MATCHING/READY` 상태로 제한했습니다. 검증: `backend/tests/pm/test_pm_service.py`의 `test_recommending_after_auto_pm_does_not_duplicate_the_team` 외. 현재 일괄 배정은 기존 팀을 제거하지 않는 추가 방식이며, 파괴적인 전체 팀 교체는 이번 범위에 포함하지 않았습니다.

## 재현성(초안)

- `.github/workflows/verify.yml`: 백엔드 pytest·의존성 검사, 프론트엔드 테스트·빌드 작업 정의(읽기 전용 저장소 권한).
- `backend/constraints-linux-py314.txt`: 현재 로컬 Linux/Python 3.14 환경의 고정 패키지. 플랫폼별 패키지가 있어 모든 환경에 동일 적용을 보장하는 범용 락파일로 표현하지 않습니다. 기존 `requirements.txt` 설치 안내는 그대로 유효합니다.
- 새 환경에서의 설치·GitHub Actions 실제 실행은 아직 검증하지 않았습니다.

## 검증 상태(2026-09-09 실행 기준)

- 백엔드 전체 `pytest`: 49개 통과.
- 프론트엔드 타입 검사(`tsc --noEmit`): 통과.
- 프론트엔드 전체 `vitest`: 55개 통과, 3개 실패. 실패 3개(`GlobalExecutiveBar.test.tsx`, `ScrollWorld.test.tsx`, `flow.test.tsx`)는 이번 안정성 개선과 무관하며, 병합된 마을 뷰 네비게이션 개편에서 컴포넌트 대비 테스트가 갱신되지 않아 발생합니다(개선 전 베이스 커밋에서도 동일하게 실패 확인). 해당 화면을 작업한 담당자가 테스트를 갱신하는 것이 적절합니다.
- UI 전체 흐름은 실행 중인 로컬 서버에서 예제 실행 설정으로 확인했습니다([screenshots/](../../screenshots/) 폴더). 예제 모델·모의 게시 화면이며 실제 모델·원격 게시 성과로 설명하지 않습니다.
