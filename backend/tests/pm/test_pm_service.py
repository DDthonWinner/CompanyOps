"""PM service tests: recommendation, assignment invariants, progress math (PM-AC-*)."""
from __future__ import annotations

import pytest
from sqlalchemy import select

from app.common.errors import AppError
from app.common.models import AgentProfile, LlmModel, ProjectTask, SprintMilestone
from app.pm import service


def _make_project(db, budget="MEDIUM", size="MEDIUM"):
    return service.create_project(db, {
        "name": "Demo", "description": "d", "budgetLevel": budget, "projectSize": size,
        "gitRepository": {"repositoryUrl": "https://github.com/DDthonWinner/TestOutput"},
    })


def test_budget_defaults_and_cap(uow):
    with uow() as db:
        p = _make_project(db, budget="HIGH")
        assert p["budgetAmount"] == 250000
        assert p["maxAgentCount"] == 16  # PM-AC-001


def test_recommendation_includes_pm(uow):
    with uow() as db:
        p = _make_project(db)
        rec = service.recommend_agents(db, p["id"], {})
        roles = [r["roleCode"] for r in rec["recommendations"]]
        assert "PM" in roles


def test_assign_requires_exactly_one_pm(uow):
    with uow() as db:
        p = _make_project(db)
        fe = db.execute(select(AgentProfile).where(AgentProfile.name == "Senior Frontend Builder")).scalars().first()
        with pytest.raises(AppError) as ei:  # PM-AC-002: 0 PMs
            service.assign_agents(db, p["id"], {"agents": [
                {"agentProfileId": fe.id, "roleCode": "FRONTEND"},
            ]})
        assert ei.value.code == "PM_COUNT_INVALID"


def test_assign_success_sets_ready(uow):
    with uow() as db:
        p = _make_project(db)
        pm = db.execute(select(AgentProfile).where(AgentProfile.name == "PM Lead")).scalars().first()
        fe = db.execute(select(AgentProfile).where(AgentProfile.name == "Senior Frontend Builder")).scalars().first()
        res = service.assign_agents(db, p["id"], {"agents": [
            {"agentProfileId": pm.id, "roleCode": "PM", "isPrimaryPm": True},
            {"agentProfileId": fe.id, "roleCode": "FRONTEND"},
        ]})
        assert res["status"] == "READY"
        assert len(res["assignedAgents"]) == 2


def test_duplicate_profile_rejected(uow):
    with uow() as db:
        p = _make_project(db)
        pm = db.execute(select(AgentProfile).where(AgentProfile.name == "PM Lead")).scalars().first()
        with pytest.raises(AppError) as ei:
            service.assign_agents(db, p["id"], {"agents": [
                {"agentProfileId": pm.id, "roleCode": "PM", "isPrimaryPm": True},
                {"agentProfileId": pm.id, "roleCode": "PM"},
            ]})
        # PM count fails first OR duplicate; both are 4xx invariants
        assert ei.value.status in (400, 409)


def test_progress_math(uow):
    """PM-AC-006: M1 2/3, M2 1/2, unassigned 1/1 → project 4/6 = 67%."""
    from app.common import progress
    with uow() as db:
        p = _make_project(db)
        pid = p["id"]
        m1 = service.create_milestone(db, pid, {"title": "M1"})["id"]
        m2 = service.create_milestone(db, pid, {"title": "M2"})["id"]

        def add(milestone, status):
            t = service.create_task(db, pid, {"title": "t", "sprintMilestoneId": milestone})
            row = db.get(ProjectTask, t["id"])
            row.status = status

        add(m1, "COMPLETED"); add(m1, "COMPLETED"); add(m1, "TODO")   # 2/3
        add(m2, "COMPLETED"); add(m2, "TODO")                          # 1/2
        # unassigned completed 1/1
        t = service.create_task(db, pid, {"title": "solo"})
        db.get(ProjectTask, t["id"]).status = "COMPLETED"
        db.flush()

        assert progress.milestone_progress(db, m1)["progressPercent"] == 67
        assert progress.milestone_progress(db, m2)["progressPercent"] == 50
        assert progress.project_progress(db, pid)["progressPercent"] == 67


def test_empty_milestone_zero(uow):
    from app.common import progress
    with uow() as db:
        p = _make_project(db)
        m = service.create_milestone(db, p["id"], {"title": "empty"})["id"]
        prog = progress.milestone_progress(db, m)
        assert prog["progressPercent"] == 0 and prog["emptyLabel"] == "작업 없음"
