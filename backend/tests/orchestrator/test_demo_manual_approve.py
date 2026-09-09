"""Operator can approve during a paced replay; unapproved approvals auto-fire after grace."""
from __future__ import annotations
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from fastapi.testclient import TestClient
from app.common.models import AgentProfile, DemoReplay, PlanVersion, Project
from app.demo import service as demo
from app.orchestrator import service
from app.pm import service as pm
from app.main import app


def _project(db):
    p = pm.create_project(db, {"name": "R", "description": "d", "budgetLevel": "MEDIUM",
        "projectSize": "SMALL", "gitRepository": {"repositoryUrl": "https://github.com/DDthonWinner/TestOutput"}})
    pm_prof = db.execute(select(AgentProfile).where(AgentProfile.name == "PM Lead")).scalars().first()
    be = db.execute(select(AgentProfile).where(AgentProfile.name == "Backend Engineer")).scalars().first()
    pm.assign_agents(db, p["id"], {"agents": [
        {"agentProfileId": pm_prof.id, "roleCode": "PM", "isPrimaryPm": True},
        {"agentProfileId": be.id, "roleCode": "BACKEND"}]})
    return p["id"]


def _past():
    return (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()


def test_manual_plan_approve_during_replay(uow):
    with uow() as db:
        pid = _project(db)
        plan = service.create_plan(db, pid, {"requestId": "c1", "instruction": "X",
            "steps": [{"title": "Impl", "roleCode": "BACKEND", "milestoneTitle": "M1"}]})
        service.review_complete(db, plan["id"], {"requestId": "rc", "expectedVersion": 1})
        p = db.get(Project, pid)
        p.active_plan_id, p.active_plan_version = plan["id"], plan["version"]
        db.add(DemoReplay(project_id=pid, backup_path="/tmp/x.db", enabled=1,
                          phase="PLAN_APPROVAL", next_tick_at=(datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()))
        plan_id = plan["id"]

    with TestClient(app) as client:
        # approval endpoint passes the middleware and approves via demo-safe path
        r = client.post(f"/api/projects/{pid}/plans/{plan_id}/approve",
                        json={"requestId": "ap", "expectedVersion": 1})
        print("MANUAL APPROVE:", r.status_code, r.text[:200])
        assert r.status_code == 200, r.text
        # a non-approval write is still blocked
        b = client.post(f"/api/projects/{pid}/commands", json={"requestId": "x", "instruction": "y"})
        print("BLOCKED WRITE:", b.status_code, b.text[:120])
        assert b.status_code == 409 and "DEMO_REPLAY_MANAGED" in b.text

    with uow() as db:
        p = db.get(Project, pid)
        r = db.get(DemoReplay, pid)
        assert p.status == "ACTIVE"
        assert db.get(PlanVersion, p.active_plan_id).status == "EXECUTING"
        assert r.phase == "EXECUTING"


def test_plan_approval_holds_for_operator_grace(uow):
    """PLAN_APPROVAL must not auto-approve until the 10s operator grace elapses."""
    with uow() as db:
        pid = _project(db)
        plan = service.create_plan(db, pid, {"requestId": "c1", "instruction": "X",
            "steps": [{"title": "Impl", "roleCode": "BACKEND", "milestoneTitle": "M1"}]})
        service.review_complete(db, plan["id"], {"requestId": "rc", "expectedVersion": 1})
        p = db.get(Project, pid)
        p.active_plan_id, p.active_plan_version = plan["id"], plan["version"]
        db.add(DemoReplay(project_id=pid, backup_path="/tmp/x.db", enabled=1,
                          phase="PLAN_APPROVAL", interval_seconds=3, completion_seconds=15,
                          next_tick_at=_past()))
        db.flush()
        # First tick opens the grace window; plan stays awaiting approval (button visible).
        demo.tick(db, pid, force=False)
        assert db.get(DemoReplay, pid).phase == "PLAN_APPROVAL"
        assert db.get(PlanVersion, plan["id"]).status == "FINAL_APPROVAL_PENDING"
        # Expire the deadline → next tick auto-approves and advances.
        pl = db.get(PlanVersion, plan["id"])
        scope = dict(pl.scope or {})
        scope["attentionGrace"] = {"plan_approval": _past()}
        pl.scope = scope
        db.get(DemoReplay, pid).next_tick_at = _past()
        db.flush()
        demo.tick(db, pid, force=False)
        assert db.get(DemoReplay, pid).phase == "EXECUTING"
        assert db.get(PlanVersion, plan["id"]).status == "EXECUTING"


def test_manual_milestone_review_during_replay(uow):
    from app.common.models import MilestoneResult, SprintMilestone
    from app.orchestrator import worker
    with uow() as db:
        pid = _project(db)
        plan = service.create_plan(db, pid, {"requestId": "c1", "instruction": "X",
            "steps": [{"title": "Impl", "roleCode": "BACKEND", "milestoneTitle": "M1"}]})
        service.review_complete(db, plan["id"], {"requestId": "rc", "expectedVersion": 1})
        service.approve_plan(db, plan["id"], {"requestId": "ap", "expectedVersion": 1})
    assert worker._run_one_task(pid) is True
    with uow() as db:
        m = db.execute(select(SprintMilestone).where(SprintMilestone.project_id == pid)).scalars().first()
        mr = db.execute(select(MilestoneResult).where(MilestoneResult.milestone_id == m.id)).scalars().first()
        mid, mver = m.id, mr.version
        db.add(DemoReplay(project_id=pid, backup_path="/tmp/x.db", enabled=1, phase="MILESTONE_REVIEW",
                          next_tick_at=(datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()))

    # Milestone HTTP plumbing mirrors the plan route (validated above); exercise the
    # demo-safe review logic + phase advance directly to avoid a second event loop.
    with uow() as db:
        result = demo.manual_review_milestone(db, pid, mid, {
            "requestId": "mr", "expectedResultVersion": mver,
            "reviewStatus": "APPROVED", "additionalValidation": "NONE"})
        assert result["reviewStatus"] == "APPROVED"
        rr = db.get(DemoReplay, pid)
        assert rr.phase in ("COMPLETED", "EXECUTING")
        print("PHASE AFTER:", rr.phase)
