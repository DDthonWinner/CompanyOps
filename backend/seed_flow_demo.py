"""Add a runnable five-role demo. Existing projects are preserved; --new creates another run."""
from __future__ import annotations
import argparse
import json
from sqlalchemy import select
from app.common import platform
from app.common.models import Approval, Decision, Project, ProjectAgent, ProjectTask, Role
from app.common.snapshot import build_snapshot
from app.common.util import new_uuid
from app.config import get_settings
from app.db import unit_of_work
from app.orchestrator import deps, service, worker
from app.orchestrator.execution.fixture import FixtureExecutionProvider
from app.pm import service as pm
from app.ports.git_port import LocalStubGit
from seed import seed

NAME = "데모 · 5역할 전체 개발 흐름"
OWNER = "seed-flow-demo-v1"
ROLES = ["PM", "FRONTEND", "BACKEND", "DATABASE", "QA"]
MILESTONE = "회원·상품 서비스 · 전체 흐름 검증"
# Zero-based dependencies: PM → FE/BE/DB → QA → PM; no cyclic Task dependencies.
TASKS = [
    ("PM", "요구사항 분석 및 역할별 작업 분배", []),
    ("PM", "API·데이터 계약과 검증 기준 확정", [0]),
    ("DATABASE", "회원·상품 스키마 및 초기 데이터 작성", [1]),
    ("FRONTEND", "로그인·상품 목록 화면 구현", [1]),
    ("BACKEND", "JWT 인증·상품 조회 API 구현", [2]),
    ("DATABASE", "조회 인덱스·마이그레이션 검증", [2]),
    ("FRONTEND", "API 연동·로딩·오류 화면 처리", [3, 4]),
    ("BACKEND", "입력 검증·권한·예외 응답 보완", [4, 5]),
    ("QA", "FE·BE·DB 통합 시나리오 검증", [5, 6, 7]),
    ("QA", "인증·상품 회귀 검증 및 결과 보고", [8]),
    ("PM", "QA 결과 취합·피드백 및 인수 체크리스트 작성", [9]),
    ("PM", "Milestone 결과 정리·후속 계획 제안", [10]),
]


def create_demo(*, new: bool = False) -> dict:
    settings = get_settings()
    if settings.execution_mode != "demo" or settings.git_mode != "stub" or settings.qa_test_cmd:
        raise RuntimeError("Requires EXECUTION_MODE=demo, GIT_MODE=stub, and empty QA_TEST_CMD.")
    seed()
    with unit_of_work() as db:
        existing = db.execute(select(Project).where(Project.created_by == OWNER).order_by(Project.created_at.desc())).scalars().first()
        if existing and not new:
            return {"projectId": existing.id, "name": existing.name, "reused": True}
    # Explicit fixtures: seed preparation never calls a model or remote git.
    previous_git, previous_provider = deps.git_port(), worker._provider
    deps.set_git_port(LocalStubGit())
    worker._provider = FixtureExecutionProvider()
    try:
        with unit_of_work() as db:
            project = pm.create_project(db, {
                "name": NAME,
                "description": "[데모 데이터] PM/FE/BE/Database/QA 각 1명. PM 계획 2건 완료 후 샘플 결정 대기. 결정 전달 → 의존성 실행 → QA/Git stub → Milestone 결과 승인. 실제 AI 호출·원격 게시 없음.",
                "projectType": "WEB_APP", "budgetLevel": "MEDIUM", "projectSize": "MEDIUM", "desiredAgentCount": 5,
            })
            pid = project["id"]
            db.get(Project, pid).created_by = OWNER
            recommended = pm.recommend_agents(db, pid, {"desiredAgentCount": 5, "requiredRoleCodes": ROLES})
            assignments = recommended["recommendations"]
            if {a["roleCode"] for a in assignments} != set(ROLES):
                raise RuntimeError("All five active role profiles are required.")
            pm.assign_agents(db, pid, {"agents": assignments})
            plan = service.create_plan(db, pid, {
                "requestId": new_uuid(),
                "instruction": "[데모] 회원·상품 서비스를 PM→FE/BE/DB→QA→PM 순으로 구현하고 결과를 검토합니다.",
                "steps": [{"roleCode": role, "title": title, "dependsOn": depends, "milestoneTitle": MILESTONE,
                           "priority": "HIGH" if role == "QA" else "MEDIUM",
                           "description": "데모 fixture 실행. 실제 제품 코드나 검증 결과가 아닙니다."}
                          for role, title, depends in TASKS],
            })
            service.review_complete(db, plan["id"], {"expectedVersion": 1})
            service.approve_plan(db, plan["id"], {"requestId": new_uuid(), "expectedVersion": 1})
            db.flush()
            for approval in db.execute(select(Approval).where(Approval.project_id == pid)).scalars():
                approval.actor = OWNER  # Fixture approval, not a human review.
            codes = {r.id: r.code for r in db.execute(select(Role)).scalars()}
            agents = {codes[a.role_id]: a for a in db.execute(select(ProjectAgent).where(ProjectAgent.project_id == pid)).scalars()}
            tasks = list(db.execute(select(ProjectTask).where(ProjectTask.project_id == pid).order_by(ProjectTask.sort_order)).scalars())
            for task in tasks:
                task.assigned_project_agent_id = agents[codes[task.role_id]].id
            decision = Decision(project_id=pid,
                reason="[데모 시작] 인증은 JWT, 데이터는 샘플 회원·상품으로 진행합니다. ‘샘플 데이터로 진행’이라고 입력하고 결정 전달을 누르면 FE·BE·DB 구현 → QA → PM 결과 정리가 실행됩니다.",
                options=["샘플 데이터로 진행"], scope_task_ids=[t.id for t in tasks[2:]])
            db.add(decision)
            db.flush()
            # The current worker selects TODO tasks once their wait reasons are cleared.
            for task in tasks[2:]:
                task.wait_reasons = [f"DECISION:{decision.id}"]
            platform.touch(db, pid, "decision.updated", decision.id)
            platform.touch(db, pid, "project.updated", pid, payload={"demo": True, "roles": ROLES})
        # Complete PM preparation through the existing worker using local fixtures.
        for _ in range(2):
            if not worker._run_one_task(pid):
                raise RuntimeError("Demo planning setup did not complete.")
        with unit_of_work() as db:
            snapshot = build_snapshot(db, pid)
            assert snapshot["project"]["progressCurrent"] == 2
            assert snapshot["project"]["progressTotal"] == len(TASKS)
            assert len(snapshot["agents"]) == len(ROLES)
        return {"projectId": pid, "name": NAME, "decisionId": decision.id,
                "agents": len(ROLES), "tasks": len(TASKS), "completed": 2, "reused": False}
    finally:
        deps.set_git_port(previous_git)
        worker._provider = previous_provider


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--new", action="store_true", help="Create another independent run")
    print(json.dumps(create_demo(new=parser.parse_args().new), ensure_ascii=False, indent=2))
