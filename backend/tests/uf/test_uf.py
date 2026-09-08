"""U3 UF tests: gating, idempotency, UF_MVP_V1 score, feedback, e2e completion auto-report."""
from __future__ import annotations

import pytest
from sqlalchemy import select

from app.common.errors import AppError
from app.common.models import AgentProfile, MilestoneResult, Project, ProjectTask, SprintMilestone
from app.orchestrator import deps, service as orch, worker
from app.pm import service as pm
from app.ports.utilization_port import NoopUtilization
from app.uf import service as uf
from app.uf.adapter import UtilizationAdapter


def _drive_to_completed(uow) -> str:
    """Create → staff → plan → approve → execute → approve milestone → COMPLETED."""
    with uow() as db:
        p = pm.create_project(db, {"name": "UF", "budgetLevel": "MEDIUM", "projectSize": "SMALL",
                                   "gitRepository": {"repositoryUrl": "https://github.com/DDthonWinner/TestOutput"}})
        pid = p["id"]
        pm_prof = db.execute(select(AgentProfile).where(AgentProfile.name == "PM Lead")).scalars().first()
        be = db.execute(select(AgentProfile).where(AgentProfile.name == "Backend Engineer")).scalars().first()
        pm.assign_agents(db, pid, {"agents": [
            {"agentProfileId": pm_prof.id, "roleCode": "PM", "isPrimaryPm": True},
            {"agentProfileId": be.id, "roleCode": "BACKEND"},
        ]})
        plan = orch.create_plan(db, pid, {"requestId": "c1", "instruction": "Build",
            "steps": [{"title": "Impl", "roleCode": "BACKEND", "milestoneTitle": "M1"}]})
        orch.review_complete(db, plan["id"], {"requestId": "rc", "expectedVersion": 1})
        orch.approve_plan(db, plan["id"], {"requestId": "ap", "expectedVersion": 1})

    assert worker._run_one_task(pid) is True

    with uow() as db:
        m = db.execute(select(SprintMilestone).where(SprintMilestone.project_id == pid)).scalars().first()
        mr = db.execute(select(MilestoneResult).where(MilestoneResult.milestone_id == m.id)).scalars().first()
        orch.review_milestone_result(db, m.id, {
            "requestId": "mr1", "expectedResultVersion": mr.version,
            "reviewStatus": "APPROVED", "additionalValidation": "NONE",
        })
        assert db.get(Project, pid).status == "COMPLETED"
    return pid


def test_create_report_rejects_active_project(uow):
    with uow() as db:
        p = pm.create_project(db, {"name": "A", "budgetLevel": "LOW", "projectSize": "SMALL",
                                   "gitRepository": {"repositoryUrl": "u"}})
        with pytest.raises(AppError) as ei:
            uf.create_report(db, p["id"])
        assert ei.value.code == "PROJECT_NOT_COMPLETED" and ei.value.status == 409


def test_report_score_and_idempotent(uow):
    # Ensure completion does NOT auto-create (use no-op) so we exercise create_report directly.
    deps.set_utilization_port(NoopUtilization())
    pid = _drive_to_completed(uow)
    with uow() as db:
        r1 = uf.create_report(db, pid)
        # 1 AI_AGENT completed task, core area BACKEND → Autonomy 100, Area 100, Resource N/A
        assert r1["utilizationScore"] == 100
        # per-aspect breakdown accompanies the final score
        assert r1["aspectScores"]["AUTONOMY"] == 100
        assert r1["aspectScores"]["AREA_DISTRIBUTION"] == 100
        assert r1["aspectScores"]["RESOURCE_EFFICIENCY"] is None  # no previous report → N/A
        assert "aspectScore" not in r1["metrics"]  # kept out of the flat metrics map
        assert r1["metrics"]["aiCompletedTaskCount"] == "1"
        assert r1["metrics"]["estimatedCost"] == "미수집"
        r2 = uf.create_report(db, pid)
        assert r1["reportId"] == r2["reportId"]  # idempotent


def test_feedback_post_completion(uow):
    deps.set_utilization_port(NoopUtilization())
    pid = _drive_to_completed(uow)
    with uow() as db:
        report = uf.create_report(db, pid)
        fb = uf.create_feedback(db, report["reportId"], {
            "aspect": "RESOURCE_EFFICIENCY", "severity": "MEDIUM",
            "observation": "Backend tokens high", "impact": "cost", "suggestion": "split tasks",
        })
        assert fb["aspect"] == "RESOURCE_EFFICIENCY"
        assert fb["source"] == "USER"
        fbs = uf.list_feedbacks(db, report["reportId"])
        # rule-based SYSTEM drafts + the one USER comment just added
        assert sum(1 for f in fbs if f["source"] == "USER") == 1
        assert sum(1 for f in fbs if f["source"] == "SYSTEM") >= 1


def test_report_auto_generates_rule_based_feedback(uow):
    """create_report persists grounded SYSTEM feedback per aspect (00 §4.2 extension)."""
    deps.set_utilization_port(NoopUtilization())
    pid = _drive_to_completed(uow)
    with uow() as db:
        report = uf.create_report(db, pid)
        system = [f for f in uf.list_feedbacks(db, report["reportId"]) if f["source"] == "SYSTEM"]
        aspects = {f["aspect"] for f in system}
        assert aspects == {"AUTONOMY", "AREA_DISTRIBUTION", "RESOURCE_EFFICIENCY"}
        for f in system:
            assert f["observation"] and f["suggestion"]  # grounded, non-empty
        # idempotent: re-create does not duplicate feedback
        uf.create_report(db, pid)
        again = [f for f in uf.list_feedbacks(db, report["reportId"]) if f["source"] == "SYSTEM"]
        assert len(again) == len(system)


def test_generate_thresholds():
    """Pure generator: severity + aspect coverage from scores/metrics."""
    from app.uf import feedback_gen

    metrics = {"aiCompletedTaskCount": "0", "eligibleTaskCount": "4", "mixedTaskCount": "0",
               "coreAreasCompleted": "2", "coreAreasWithAi": "1",
               "totalTokens": "미수집", "aiEquivalentTasks": "0"}
    fbs = feedback_gen.generate(
        {"AUTONOMY": 0, "AREA_DISTRIBUTION": 50, "RESOURCE_EFFICIENCY": None}, metrics)
    by = {f["aspect"]: f for f in fbs}
    assert by["AUTONOMY"]["severity"] == "HIGH"          # score < 50
    assert by["AREA_DISTRIBUTION"]["severity"] == "MEDIUM"
    assert "미수집" in by["RESOURCE_EFFICIENCY"]["observation"]


def test_completion_auto_generates_report(uow):
    """e2e: with the real UtilizationAdapter wired, completion creates the report in-txn."""
    deps.set_utilization_port(UtilizationAdapter())
    try:
        pid = _drive_to_completed(uow)
        with uow() as db:
            reports = uf.list_reports(db, pid)
            assert len(reports) == 1
            assert reports[0]["scoreVersion"] == "UF_MVP_V1"
    finally:
        deps.set_utilization_port(NoopUtilization())
