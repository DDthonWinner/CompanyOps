# DDthonWinner — CompanyOps

AI 개발 팀을 배정해 프로젝트를 운영하고, 그 과정을 타이쿤 게임처럼 관찰·평가하는 서비스.

## 문제

프로젝트에 AI 에이전트를 붙여 개발을 맡길 때, 지금은 무엇이 진행 중이고 무엇을 결정해야 하는지 한눈에 파악하기 어렵다. 계획 승인, 기술 QA 결과, GitHub 반영 여부가 여러 도구에 흩어져 있어 관리자가 흐름을 놓치기 쉽고, AI를 얼마나 잘 활용했는지 사후에 평가할 방법도 마땅치 않다.

## 해결 방법

CompanyOps는 하나의 프로젝트를 **Tycoon Office**(등각투영 2.5D 오피스 뷰)와 **Dashboard**(상태·계획 피드백·승인 뷰) 두 탭으로 관찰하게 한다. 사용자는 프로젝트를 만들고 AI 개발 팀(Agent)을 배정한 뒤, 필요한 결정·계획 피드백·승인만 제공한다.

- Task는 승인된 Plan대로 실행되어 기술 QA를 통과하고 GitHub Push에 성공하면 완료 처리된다.
- 작업 결과는 `project/{projectId}` branch와 Task별 Commit으로 실제 GitHub에서 확인한다. (타이쿤 캐릭터의 움직임만으로 완료를 판정하지 않는다.)
- 프로젝트 완료 후 Autonomy·Resource Efficiency·Area Distribution 등 AI 활용 지표를 집계해 Score와 Feedback을 제공하고, 이전 프로젝트와 비교한다.

기존 개발 대시보드가 로그·상태 나열에 그친다면, CompanyOps는 게임화된 관찰 뷰 + 명시적 승인 게이트 + AI 활용 사후 평가를 하나의 흐름으로 묶은 점이 다르다.

## 실행 방법

> 모노레포 구성(`backend/` + `frontend/`)을 기준으로 합니다. 현재는 요구사항·설계 단계이며 아래는 확정된 기술 스택 기준의 실행 예시입니다.

```bash
# 백엔드 (Python 3.11+ / FastAPI / SQLite)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# 프론트엔드 (Vite + React + TypeScript)
cd frontend
npm install
npm run dev
```

### 환경변수 / 사전 준비

- `LLM_MODE`: `demo`(기본, 픽스처 기반) 또는 `real`
- `OPENAI_API_KEY`: `LLM_MODE=real`일 때 필요 (OpenAI GPT)
- GitHub 연동: 결과는 고정 저장소 `https://github.com/DDthonWinner/TestOutput`로 push하므로, 해당 저장소에 대한 push 권한(토큰)이 필요합니다.

## 사용한 AI 도구

- **AWS AI-DLC**: 이 서비스를 만드는 개발 워크플로우로 사용. Inception 단계에서 요구사항 분석, 검증 질문(requirement-verification-questions), Resiliency Questionnaire를 통해 요구사항을 확정.
- **Claude Code**: AI-DLC 룰 기반의 문서 생성·요구사항 정리·검토 진행.
- 서비스 런타임에서는 OpenAI GPT를 실제 LLM 어댑터로 사용(기본은 demo/fixture 모드).

## 팀

| 이름 | 역할 |
| --- | --- |
| 심대보 | 01 프로젝트·Agent Profile 관리 (Project/Profile CRUD, 배정·정원, Task/Milestone) |
| 유지수 | 02 AI 활용 Feedback (활용 지표 집계, Score, Feedback, 프로젝트 간 비교) |
| 송하윤 | 03 GitHub Interface (checkout, ChangeSet, Diff, Commit, Push) |
| 김대혁 | 04 Dashboard (상태 관찰, 계획 피드백, Decision/승인, QA·AI 활용 결과) |
| 임재욱 | 05 Tycoon View (오피스·좌석·캐릭터·HUD·씬) |
