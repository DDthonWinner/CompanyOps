"""Connected-flow tests (ORCH-1..7): command→plan→approve→execute→QA→publish→
milestone review→project completion. Runs the worker synchronously via _run_one_task.
"""
from __future__ import annotations

import pytest
from sqlalchemy import select

from app.common.errors import AppError
from app.common.models import AgentProfile, MilestoneResult, Project, ProjectTask, SprintMilestone
from app.orchestrator import service, worker
from app.pm import service as pm


def _ready_project(db):
    p = pm.create_project(db, {
        "name": "Flow", "description": "d", "budgetLevel": "MEDIUM", "projectSize": "SMALL",
        "gitRepository": {"repositoryUrl": "https://github.com/DDthonWinner/TestOutput"},
    })
    pm_prof = db.execute(select(AgentProfile).where(AgentProfile.name == "PM Lead")).scalars().first()
    be = db.execute(select(AgentProfile).where(AgentProfile.name == "Backend Engineer")).scalars().first()
    pm.assign_agents(db, p["id"], {"agents": [
        {"agentProfileId": pm_prof.id, "roleCode": "PM", "isPrimaryPm": True},
        {"agentProfileId": be.id, "roleCode": "BACKEND"},
    ]})
    return p["id"]


def test_plan_version_guard_and_approval(uow):
    with uow() as db:
        pid = _ready_project(db)
        plan = service.create_plan(db, pid, {
            "requestId": "req-1", "instruction": "Build API",
            "steps": [{"title": "Impl endpoint", "roleCode": "BACKEND"}],
        })
        assert plan["version"] == 1 and plan["status"] == "REVIEW"
        # stale expectedVersion → 409 (MASTER-AC-003)
        with pytest.raises(AppError) as ei:
            service.apply_plan_feedback(db, plan["id"], {"requestId": "rf", "expectedVersion": 99, "feedback": "x"})
        assert ei.value.code == "STALE_VERSION"
        # feedback → v2 REVIEW
        v2 = service.apply_plan_feedback(db, plan["id"], {"requestId": "rf2", "expectedVersion": 1, "feedback": "tweak"})
        assert v2["version"] == 2 and v2["status"] == "REVIEW"
        service.review_complete(db, plan["id"], {"requestId": "rc", "expectedVersion": 2})
        approved = service.approve_plan(db, plan["id"], {"requestId": "ap", "expectedVersion": 2})
        assert approved["status"] in ("EXECUTING", "APPROVED_WAITING")
        # project composed + ACTIVE, tasks created
        tasks = list(db.execute(select(ProjectTask).where(ProjectTask.project_id == pid)).scalars())
        assert len(tasks) == 1 and tasks[0].approved_plan_version == 2


def test_idempotent_command_replay(uow):
    with uow() as db:
        pid = _ready_project(db)
        a = service.create_plan(db, pid, {"requestId": "same", "instruction": "X"})
        b = service.create_plan(db, pid, {"requestId": "same", "instruction": "X"})
        assert a["id"] == b["id"]  # replay, no duplicate


def test_full_connected_flow(uow):
    with uow() as db:
        pid = _ready_project(db)
        plan = service.create_plan(db, pid, {
            "requestId": "c1", "instruction": "Build feature",
            "steps": [{"title": "Implement", "roleCode": "BACKEND", "milestoneTitle": "M1"}],
        })
        service.review_complete(db, plan["id"], {"requestId": "rc", "expectedVersion": 1})
        service.approve_plan(db, plan["id"], {"requestId": "ap", "expectedVersion": 1})

    # worker runs the task end-to-end (execute → QA demo PASS → publish → COMPLETED)
    assert worker._run_one_task(pid) is True

    with uow() as db:
        tasks = list(db.execute(select(ProjectTask).where(ProjectTask.project_id == pid)).scalars())
        assert all(t.status == "COMPLETED" for t in tasks)  # MASTER-AC-004
        assert all(t.execution_mode == "AI_AGENT" for t in tasks)
        m = db.execute(select(SprintMilestone).where(SprintMilestone.project_id == pid)).scalars().first()
        mr = db.execute(
            select(MilestoneResult).where(MilestoneResult.milestone_id == m.id)
        ).scalars().first()
        assert mr is not None and mr.review_status == "PENDING"  # MASTER-AC-005

        # approve milestone result → project COMPLETED (MASTER-AC-006/012)
        res = service.review_milestone_result(db, m.id, {
            "requestId": "mr1", "expectedResultVersion": mr.version,
            "reviewStatus": "APPROVED", "additionalValidation": "NONE",
        })
        assert res["projectCompleted"] is True
        assert db.get(Project, pid).status == "COMPLETED"


def test_no_more_tasks_returns_false(uow):
    with uow() as db:
        pid = _ready_project(db)
    assert worker._run_one_task(pid) is False  # nothing approved yet
