"""Durable, paced fixture replay with optional real Git publishing.

Ordinary production tasks never reopen. This explicit demo-only exception resets
execution records each cycle while retaining project/team/task/milestone identities.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
import sqlite3
import json

from sqlalchemy import delete, select, update

from ..common import models as m, platform
from ..common.errors import conflict
from ..common.util import new_uuid, utcnow_iso
from ..config import get_settings
from ..orchestrator import deps, qa, service as orchestration
from ..orchestrator.execution.base import TaskExecutionContext
from ..orchestrator.execution.fixture import FixtureExecutionProvider
from ..ports.git_port import LocalStubGit
from ..uf.models import Feedback, UtilizationMetric, UtilizationReport
from .publishing import git_port

ACTOR = "demo-replay"
# Approval phases pause this long so the operator can approve manually; after the
# grace window the scheduler auto-approves and advances (demo UX, not a business rule).
APPROVAL_GRACE_SECONDS = 10
APPROVAL_PHASES = ("PLAN_APPROVAL", "MILESTONE_REVIEW")


def replay_active(db, pid) -> bool:
    """True when a project is owned by demo replay (row exists, enabled or stopped)."""
    return db.get(m.DemoReplay, pid) is not None


def require_demo():
    s = get_settings()
    if s.execution_mode != "demo" or s.git_mode != "stub" or s.qa_test_cmd:
        raise conflict("Replay requires EXECUTION_MODE=demo, GIT_MODE=stub and empty QA_TEST_CMD.")
    if not isinstance(deps.git_port(), LocalStubGit):
        raise conflict("Replay requires LocalStubGit.")
    if s.demo_replay_git_mode not in ("stub", "real"):
        raise conflict("DEMO_REPLAY_GIT_MODE must be stub or real.")


def target(db):
    projects = [p for p in db.scalars(select(m.Project))
                if ''.join(p.name.lower().split()) == 'neobanksuperapp']
    if len(projects) != 1:
        raise conflict("Exactly one Neo Bank SuperApp / Neobank Super App project is required.")
    return projects[0]


def status(db):
    p = target(db)
    r = db.get(m.DemoReplay, p.id)
    return {"projectId": p.id, "projectName": p.name, "demo": True,
            "gitMode": get_settings().demo_replay_git_mode,
            "gitRemote": get_settings().git_remote,
            "enabled": bool(r and r.enabled), "phase": r.phase if r else "NOT_STARTED",
            "cycle": r.cycle if r else 0, "intervalSeconds": r.interval_seconds if r else None,
            "completionSeconds": r.completion_seconds if r else None,
            "nextTickAt": r.next_tick_at if r and r.enabled else None,
            "backupPath": r.backup_path if r else None, "error": r.error if r else None}


def _validate(db, pid):
    tasks = list(db.scalars(select(m.ProjectTask).where(m.ProjectTask.project_id == pid)))
    agents = list(db.scalars(select(m.ProjectAgent).where(
        m.ProjectAgent.project_id == pid, m.ProjectAgent.status != "REMOVED")))
    milestones = list(db.scalars(select(m.SprintMilestone).where(m.SprintMilestone.project_id == pid)))
    if not tasks or not agents or not milestones:
        raise conflict("The showcase needs existing tasks, milestones and assigned agents.")
    if sum(bool(a.is_primary_pm) for a in agents) != 1:
        raise conflict("The showcase requires exactly one primary PM.")
    mids = {x.id for x in milestones}
    tids = {t.id for t in tasks}
    roles = {a.role_id for a in agents}
    if any(t.sprint_milestone_id not in mids or t.role_id not in roles or
           not set(t.dependency_task_ids or []).issubset(tids) for t in tasks):
        raise conflict("Every task needs a local milestone, staffed role and local dependencies.")
    if mids != {t.sprint_milestone_id for t in tasks}:
        raise conflict("Empty milestones cannot be replayed.")
    orchestration._detect_cycle(tasks)
    return tasks, agents, milestones


def start(db, interval_seconds=3, completion_seconds=15):
    require_demo()
    p = target(db)
    _validate(db, p.id)
    r = db.get(m.DemoReplay, p.id)
    if r is None:
        # SQLite's online backup API also captures WAL pages consistently.
        settings = get_settings()
        folder = Path(settings.backup_dir)
        folder.mkdir(parents=True, exist_ok=True)
        path = folder / f"before-demo-replay-{new_uuid()}.db"
        with sqlite3.connect(settings.db_path) as src, sqlite3.connect(path) as dst:
            src.backup(dst)
        r = m.DemoReplay(project_id=p.id, backup_path=str(path.resolve()))
        db.add(r)
    r.enabled = 1
    r.error = None
    r.interval_seconds = interval_seconds
    r.completion_seconds = completion_seconds
    r.next_tick_at = utcnow_iso()
    db.flush()
    platform.touch(db, p.id, "demo.updated", p.id, {"demo": True, "action": "start"})
    return status(db)


def stop(db):
    p = target(db)
    r = db.get(m.DemoReplay, p.id)
    if r:
        r.enabled = 0
        platform.touch(db, p.id, "demo.updated", p.id, {"demo": True, "action": "stop"})
    return status(db)


def _clear_execution(db, pid):
    tids = select(m.ProjectTask.id).where(m.ProjectTask.project_id == pid)
    qids = select(m.QARun.id).where(m.QARun.project_id == pid)
    plans = select(m.PlanVersion.id).where(m.PlanVersion.project_id == pid)
    reports = select(UtilizationReport.id).where(UtilizationReport.project_id == pid)
    for cls in (Feedback, UtilizationMetric):
        db.execute(delete(cls).where(cls.report_id.in_(reports)))
    db.execute(update(UtilizationReport).where(UtilizationReport.project_id == pid)
               .values(previous_report_id=None))
    db.execute(delete(UtilizationReport).where(UtilizationReport.project_id == pid))
    db.execute(delete(m.TestResult).where(m.TestResult.qa_run_id.in_(qids)))
    for cls in (m.TaskPublish, m.ArtifactVersion, m.TaskAttempt):
        db.execute(delete(cls).where(cls.task_id.in_(tids)))
    db.execute(delete(m.PlanFeedback).where(m.PlanFeedback.plan_id.in_(plans)))
    for cls in (m.QARun, m.TokenUsage, m.MilestoneResult, m.Approval, m.Decision,
                m.PlanVersion, m.ActivityEvent):
        db.execute(delete(cls).where(cls.project_id == pid))


def _reset(db, r):
    tasks, agents, _ = _validate(db, r.project_id)
    _clear_execution(db, r.project_id)
    r.cycle += 1
    p = db.get(m.Project, r.project_id)
    p.status, p.completed_at = "READY", None
    plan = m.PlanVersion(project_id=p.id, version=r.cycle, status="REVIEW",
                         request=f"[DEMO] Neobank development replay #{r.cycle}",
                         scope={"gitMode": get_settings().demo_replay_git_mode},
                         steps=[{"title": t.title, "taskId": t.id} for t in tasks])
    db.add(plan)
    db.flush()
    p.active_plan_id, p.active_plan_version = plan.id, plan.version
    roster = {}
    for a in agents:
        roster.setdefault(a.role_id, []).append(a)
    for group in roster.values():
        group.sort(key=lambda a: a.id)
    for i, t in enumerate(sorted(tasks, key=lambda t: (t.sort_order, t.id))):
        t.status, t.execution_mode = "TODO", None
        t.approved_plan_id = t.approved_plan_version = t.current_attempt_id = None
        t.wait_reasons = []
        t.assigned_project_agent_id = roster[t.role_id][i % len(roster[t.role_id])].id
        _touch_task(db, t)
    r.phase = "PLAN_REVIEW"
    _agents(db, r.project_id)
    platform.touch(db, p.id, "project.updated", p.id, {"demo": True, "cycle": r.cycle})
    platform.touch(db, p.id, "plan.updated", plan.id)


def _touch_task(db, t):
    t.revision = (t.revision or 0) + 1
    t.updated_at = utcnow_iso()
    platform.touch(db, t.project_id, "task.updated", t.id, {"demo": True, "status": t.status})


def _agents(db, pid):
    db.flush()
    tasks = list(db.scalars(select(m.ProjectTask).where(m.ProjectTask.project_id == pid)
                           .order_by(m.ProjectTask.sort_order, m.ProjectTask.id)))
    for a in db.scalars(select(m.ProjectAgent).where(
            m.ProjectAgent.project_id == pid, m.ProjectAgent.status != "REMOVED")):
        own = [t for t in tasks if t.assigned_project_agent_id == a.id and t.status != "COMPLETED"]
        active = next((t for t in own if t.status in ("RUNNING", "REVIEW", "BLOCKED")), None)
        upcoming = next((t for t in own if t is not active), None)
        a.current_task_id = active.id if active else None
        a.next_task_id = upcoming.id if upcoming else None
        a.status = ({"RUNNING": "WORKING", "REVIEW": "WAITING", "BLOCKED": "BLOCKED"}[active.status]
                    if active else "WAITING" if own else "IDLE")
        a.activity_summary = "[DEMO] " + (f"{active.status}: {active.title}" if active else
                                         f"다음 작업 대기: {own[0].title}" if own else "담당 작업 완료")
        a.updated_at = utcnow_iso()
        platform.touch(db, pid, "agent.updated", a.id, {"demo": True})


def _fixture(db, t):
    role = db.get(m.Role, t.role_id)
    result = FixtureExecutionProvider().execute_task(TaskExecutionContext(
        project_id=t.project_id, task_id=t.id, task_title=t.title,
        role_code=role.code, description=t.description))
    if get_settings().demo_replay_git_mode == "real":
        plan = db.get(m.PlanVersion, t.approved_plan_id)
        prefix = f".companyops/demo/tasks/{t.id}"
        # Disjoint paths: concurrent tasks (including PM's common plan-note.md) cannot mix.
        result.changes = [{**change, "path": f"{prefix}/{change['path']}"} for change in result.changes]
        result.changes.append({"path": f"{prefix}/replay.json", "operation": "update",
                               "content": json.dumps({
                                   "demo": True, "execution": "fixture", "qa": "demo PASS",
                                   "projectId": t.project_id, "taskId": t.id, "title": t.title,
                                   "role": role.code, "planId": plan.id, "cycle": plan.version,
                               }, ensure_ascii=False, indent=2) + "\n"})
    return result


def _review_task(db, t):
    result = _fixture(db, t)
    applied = git_port().apply_file_changes(t.project_id, t.id, result.changes)
    artifact = m.ArtifactVersion(task_id=t.id, attempt_id=t.current_attempt_id, version=1,
                                 file_paths=applied.changed_files, content_hash=applied.content_hash,
                                 base_commit_sha=applied.base_commit_sha)
    db.add(artifact)
    db.flush()
    t.execution_mode = result.execution_mode
    t.status = "REVIEW"
    attempt = db.get(m.TaskAttempt, t.current_attempt_id)
    attempt.ended_at, attempt.artifact_version = utcnow_iso(), 1
    tm = result.token_metrics
    db.add(m.TokenUsage(project_id=t.project_id, task_id=t.id,
                        project_agent_id=t.assigned_project_agent_id,
                        role_code=db.get(m.Role, t.role_id).code, demo=1,
                        input_tokens=tm["input"], output_tokens=tm["output"], total_tokens=tm["total"]))
    run = qa.run_qa(db, t.project_id, t.id, artifact)
    platform.touch(db, t.project_id, "qa.updated", run.id, {"demo": True})
    platform.touch(db, t.project_id, "artifact.updated", artifact.id, {"demo": True})
    _touch_task(db, t)


def _execute(db, r):
    pid = r.project_id
    tasks = list(db.scalars(select(m.ProjectTask).where(m.ProjectTask.project_id == pid)
                           .order_by(m.ProjectTask.sort_order, m.ProjectTask.id)))
    # An explicit decision is visible for a full interval and auto-resolved by the demo actor.
    decisions = list(db.scalars(select(m.Decision).where(m.Decision.project_id == pid)))
    for d in decisions:
        if d.status == "OPEN":
            orchestration.resolve_decision(db, d.id, {"answer": "[DEMO 자동 결정] 샘플 은행 데이터로 진행"})
    for t in tasks:
        if t.status == "BLOCKED" and not t.wait_reasons:
            t.status = "RUNNING"
            _touch_task(db, t)
        elif t.status == "RUNNING":
            _review_task(db, t)
        elif t.status == "REVIEW":
            # Rehydrate changeset after restart; fixture + plan ID is deterministic.
            git_port().apply_file_changes(pid, t.id, _fixture(db, t).changes)
            result = orchestration.publish_task(db, t.id, {}, git=git_port())
            if t.status != "COMPLETED":
                # Commit the publish failure and any prior successful tasks in this tick.
                # A later start retries the same changeset/commit, without declaring success.
                r.enabled = 0
                r.error = f"Git publish {result['status']} for {t.title}: {result.get('error') or 'No changes published'}"
                t.wait_reasons = [f"GIT_PUBLISH:{result['status']}"]
                _touch_task(db, t)
                _agents(db, pid)
                return
            t.wait_reasons = []
            _touch_task(db, t)
    db.flush()
    milestones = list(db.scalars(select(m.SprintMilestone).where(m.SprintMilestone.project_id == pid)))
    for milestone in milestones:
        # Build only after pending publishes have been flushed (result hash includes every commit).
        mr = orchestration.maybe_build_milestone_result(db, milestone.id)
        if mr and mr.review_status == "PENDING":
            r.phase = "MILESTONE_REVIEW"
    done = {t.id for t in tasks if t.status == "COMPLETED"}
    busy = {t.assigned_project_agent_id for t in tasks if t.status in ("RUNNING", "REVIEW", "BLOCKED")}
    # PM preparation leads the demo; QA waits for all implementation roles.
    codes = {x.id: x.code for x in db.scalars(select(m.Role))}
    pm_done = all(t.id in done for t in tasks if codes[t.role_id] == "PM")
    impl_done = all(t.id in done for t in tasks if codes[t.role_id] not in ("PM", "QA"))
    for t in tasks:
        if t.status not in ("TODO", "WAITING"):
            continue
        code = codes[t.role_id]
        eligible = set(t.dependency_task_ids or []).issubset(done)
        # Only add role staging for the seed's dependency-free scenario.
        if not any(x.dependency_task_ids for x in tasks):
            eligible = eligible and (code == "PM" or pm_done) and (code != "QA" or impl_done)
        if not eligible:
            t.status, t.wait_reasons = "WAITING", ["DEPENDENCY:demo"]
        elif t.assigned_project_agent_id not in busy and r.phase != "MILESTONE_REVIEW":
            t.status, t.wait_reasons = "RUNNING", []
            attempt = m.TaskAttempt(task_id=t.id, sequence=1)
            db.add(attempt)
            db.flush()
            t.current_attempt_id = attempt.id
            busy.add(t.assigned_project_agent_id)
            if code == "BACKEND" and not decisions:
                decision = m.Decision(project_id=pid, scope_task_ids=[t.id],
                                      reason="[DEMO] 은행 연동용 테스트 데이터 선택 필요",
                                      options=["샘플 데이터로 진행"])
                db.add(decision)
                db.flush()
                decisions.append(decision)
                t.status, t.wait_reasons = "BLOCKED", [f"DECISION:{decision.id}"]
                platform.touch(db, pid, "decision.updated", decision.id, {"demo": True})
        _touch_task(db, t)
    if not any(t.status in ("RUNNING", "REVIEW", "BLOCKED") for t in tasks) and not all(
            t.status == "COMPLETED" for t in tasks) and r.phase != "MILESTONE_REVIEW":
        raise conflict("Replay stalled: no executable task. Check dependencies and assignments.")
    _agents(db, pid)


def tick(db, pid, *, force=False):
    r = db.get(m.DemoReplay, pid)
    if r is None or not r.enabled:
        return
    due = datetime.fromisoformat(r.next_tick_at.replace("Z", "+00:00"))
    if not force and due > datetime.now(timezone.utc):
        return
    require_demo()
    p = db.get(m.Project, pid)
    plan = db.get(m.PlanVersion, p.active_plan_id) if p.active_plan_id else None
    if plan and (plan.scope or {}).get("gitMode", "stub") != get_settings().demo_replay_git_mode:
        r.phase = "RESET"  # old stub QA/artifacts must never be used for real publish
    if r.phase in ("RESET", "COMPLETED"):
        _reset(db, r)
    elif r.phase == "PLAN_REVIEW":
        p = db.get(m.Project, pid)
        orchestration.review_complete(db, p.active_plan_id, {"expectedVersion": p.active_plan_version})
        r.phase = "PLAN_APPROVAL"
    elif r.phase == "PLAN_APPROVAL":
        _apply_plan_approval(db, r, actor=ACTOR)  # grace window elapsed → auto-approve
    elif r.phase == "EXECUTING":
        _execute(db, r)
    elif r.phase == "MILESTONE_REVIEW":
        for mr in db.scalars(select(m.MilestoneResult).where(
                m.MilestoneResult.project_id == pid, m.MilestoneResult.review_status == "PENDING")):
            orchestration.review_milestone_result(db, mr.milestone_id, {
                "expectedResultVersion": mr.version, "reviewStatus": "APPROVED",
                "additionalValidation": "NONE"})
        db.flush()
        # Service defaults to operator; distinguish all automated approvals explicitly.
        db.execute(update(m.Approval).where(m.Approval.project_id == pid).values(actor=ACTOR))
        p = db.get(m.Project, pid)
        r.phase = "COMPLETED" if p.status == "COMPLETED" else "EXECUTING"
        if r.phase == "COMPLETED":
            db.get(m.PlanVersion, p.active_plan_id).status = "COMPLETED"
        _agents(db, pid)
    else:
        raise conflict(f"Unknown replay phase: {r.phase}")
    if r.phase in APPROVAL_PHASES:
        delay = APPROVAL_GRACE_SECONDS  # pause for manual approval before auto-approving
    elif r.phase == "COMPLETED":
        delay = r.completion_seconds
    else:
        delay = r.interval_seconds
    r.next_tick_at = (datetime.now(timezone.utc) + timedelta(seconds=delay)).isoformat()
    platform.touch(db, pid, "demo.updated", pid,
                   {"demo": True, "phase": r.phase, "cycle": r.cycle, "actor": ACTOR})


def _apply_plan_approval(db, r, *, actor):
    """Approve the active plan without recomposing tasks (demo keeps stable task IDs).

    Shared by the paced scheduler (actor=demo-replay) and manual operator approval.
    """
    pid = r.project_id
    p = db.get(m.Project, pid)
    plan = db.get(m.PlanVersion, p.active_plan_id)
    db.add(m.Approval(project_id=pid, kind="PLAN_EXECUTION", target_id=plan.id,
                      target_version=plan.version, actor=actor))
    plan.status, p.status = "EXECUTING", "ACTIVE"
    git_port().initialize_project_repository(pid)
    for t in db.scalars(select(m.ProjectTask).where(m.ProjectTask.project_id == pid)):
        t.approved_plan_id, t.approved_plan_version = plan.id, plan.version
        _touch_task(db, t)
    r.phase = "EXECUTING"
    platform.touch(db, pid, "plan.updated", plan.id, {"demo": True, "actor": actor})


def _resume_soon(db, r):
    """After a manual approval, let the paced scheduler pick up the next phase promptly."""
    if r.enabled:
        r.next_tick_at = utcnow_iso()


def manual_approve_plan(db, pid, req):
    """Operator clicked the plan-approval button during the grace window."""
    r = db.get(m.DemoReplay, pid)
    p = db.get(m.Project, pid)
    plan = db.get(m.PlanVersion, p.active_plan_id) if p and p.active_plan_id else None
    if r is not None and r.phase == "PLAN_APPROVAL":
        _apply_plan_approval(db, r, actor="operator")
        _resume_soon(db, r)
        platform.touch(db, pid, "demo.updated", pid,
                       {"demo": True, "phase": r.phase, "cycle": r.cycle, "actor": "operator"})
    return orchestration.plan_dict(db.get(m.PlanVersion, p.active_plan_id)) if plan else {"status": "OK"}


def manual_review_milestone(db, pid, milestone_id, req):
    """Operator reviewed a milestone result during the grace window (demo-safe path)."""
    result = orchestration.review_milestone_result(db, milestone_id, req)
    r = db.get(m.DemoReplay, pid)
    if r is not None:
        db.flush()
        pending = db.scalars(select(m.MilestoneResult).where(
            m.MilestoneResult.project_id == pid,
            m.MilestoneResult.review_status == "PENDING")).first()
        if pending is None and r.phase == "MILESTONE_REVIEW":
            p = db.get(m.Project, pid)
            r.phase = "COMPLETED" if p.status == "COMPLETED" else "EXECUTING"
            if r.phase == "COMPLETED" and p.active_plan_id:
                db.get(m.PlanVersion, p.active_plan_id).status = "COMPLETED"
            _agents(db, pid)
        _resume_soon(db, r)
        platform.touch(db, pid, "demo.updated", pid,
                       {"demo": True, "phase": r.phase, "cycle": r.cycle, "actor": "operator"})
    return result
