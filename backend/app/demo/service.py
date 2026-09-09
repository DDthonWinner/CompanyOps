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
PM_INTERVAL_SECONDS = 0.1
DEVELOPMENT_WORK_TICKS = 5
# BACKEND (Core Banking, most tasks) and QA (runs last, alone) iterate a bit faster per task so
# their solo stretches stay short/proportionate — they still run alone, just not for as long.
SOLO_ROLE_WORK_TICKS = {"BACKEND": 4, "QA": 3}
ATTENTION_GRACE_SECONDS = 10
GRACE_POLL_SECONDS = 1
BRIEF_BLOCK_REASONS = {
    "FRONTEND": "API 응답 형식 확인 중",
    "BACKEND": "서비스 연동 조건 확인 중",
    "DATABASE": "스키마 호환성 확인 중",
    "QA": "테스트 환경 동기화 중",
}


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
    project = db.get(m.Project, pid)
    pm_role_ids = set(db.scalars(select(m.Role.id).where(m.Role.code == "PM")))
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
        if a.role_id in pm_role_ids:
            # PM never idles in the demo: even at 100% task completion it keeps coordinating.
            a.status = "WORKING"
            if not own:
                a.activity_summary = ("[DEMO] 최종 결과 정리 · 다음 사이클 준비" if project.status == "COMPLETED"
                                      else "[DEMO] 개발 진행 점검 · 의존성 조율 · QA 결과 확인")
        elif active and active.status == "BLOCKED":
            reason = next((w.removeprefix("DEMO_BLOCK:") for w in active.wait_reasons or []
                           if w.startswith("DEMO_BLOCK:")), None)
            if reason:
                a.activity_summary = f"[DEMO] {reason} · 잠시 후 자동 재개"
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


def _grace_elapsed(plan, key, force):
    """Attention Center grace: True once `key`'s 10s operator window has passed.

    On first sighting records a deadline (now + ATTENTION_GRACE_SECONDS) so the operator has
    time to act in the UI, and returns False until then. Deadlines live in the per-cycle plan
    JSON, so they reset every cycle alongside demoPacing. `force` (used only to fast-forward the
    demo, e.g. tests) means "advance now, don't wait", so it bypasses the window.
    """
    if force:
        return True
    scope = dict(plan.scope or {})
    grace = dict(scope.get("attentionGrace", {}))
    deadline = grace.get(key)
    now = datetime.now(timezone.utc)
    if deadline is None:
        grace[key] = (now + timedelta(seconds=ATTENTION_GRACE_SECONDS)).isoformat()
        plan.scope = {**scope, "attentionGrace": grace}
        return False
    return now >= datetime.fromisoformat(deadline)


def _execute(db, r, force=False):
    pid = r.project_id
    tasks = list(db.scalars(select(m.ProjectTask).where(m.ProjectTask.project_id == pid)
                           .order_by(m.ProjectTask.sort_order, m.ProjectTask.id)))
    codes = {x.id: x.code for x in db.scalars(select(m.Role))}
    plan = db.get(m.PlanVersion, db.get(m.Project, pid).active_plan_id)
    # Persist pacing in the existing plan JSON so restart does not repeat interruptions.
    pacing = {tid: dict(state) for tid, state in (plan.scope or {}).get("demoPacing", {}).items()}
    role_positions = {}
    intermittent = set()
    for t in tasks:
        code = codes[t.role_id]
        position = role_positions.get(code, 0)
        role_positions[code] = position + 1
        if code in BRIEF_BLOCK_REASONS and position % 3 == 1:
            intermittent.add(t.id)
    # A decision surfaces in the Attention Center for up to ATTENTION_GRACE_SECONDS. If the
    # operator resolves it in time via the normal API, it is already RESOLVED here and we skip;
    # otherwise the demo actor auto-resolves once the grace window elapses.
    decisions = list(db.scalars(select(m.Decision).where(m.Decision.project_id == pid)))
    for d in decisions:
        if d.status == "OPEN" and _grace_elapsed(plan, f"decision:{d.id}", force):
            orchestration.resolve_decision(db, d.id, {"answer": "[DEMO 자동 결정] 샘플 은행 데이터로 진행"})
    for t in tasks:
        if t.status == "BLOCKED" and any(w.startswith("DEMO_BLOCK:") for w in t.wait_reasons or []):
            t.wait_reasons = [w for w in t.wait_reasons if not w.startswith("DEMO_BLOCK:")]
        if t.status == "BLOCKED" and not t.wait_reasons:
            t.status = "RUNNING"
            _touch_task(db, t)
        elif t.status == "RUNNING":
            if codes[t.role_id] == "PM":
                _review_task(db, t)
            else:
                state = pacing.setdefault(t.id, {"workTicks": 0, "interrupted": False})
                state["workTicks"] += 1
                if t.id in intermittent and state["workTicks"] == 2 and not state["interrupted"]:
                    state["interrupted"] = True
                    t.status = "BLOCKED"
                    t.wait_reasons = [f"DEMO_BLOCK:{BRIEF_BLOCK_REASONS[codes[t.role_id]]}"]
                    _touch_task(db, t)
                elif state["workTicks"] >= SOLO_ROLE_WORK_TICKS.get(codes[t.role_id], DEVELOPMENT_WORK_TICKS):
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
                plan.scope = {**(plan.scope or {}), "demoPacing": pacing}
                return
            t.wait_reasons = []
            _touch_task(db, t)
    plan.scope = {**(plan.scope or {}), "demoPacing": pacing}
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


def _next_delay(db, r):
    if r.phase == "COMPLETED":
        return r.completion_seconds
    if r.phase in ("PLAN_REVIEW", "PLAN_APPROVAL"):
        return PM_INTERVAL_SECONDS
    # While an approval/decision is awaiting the operator, poll fast so a manual action in the
    # Attention Center is reflected almost immediately (and the grace deadline is enforced promptly).
    if r.phase == "MILESTONE_REVIEW":
        return GRACE_POLL_SECONDS
    if db.scalars(select(m.Decision.id).where(
            m.Decision.project_id == r.project_id, m.Decision.status == "OPEN")).first():
        return GRACE_POLL_SECONDS
    rows = list(db.execute(select(m.ProjectTask.status, m.Role.code)
                          .join(m.Role, m.ProjectTask.role_id == m.Role.id)
                          .where(m.ProjectTask.project_id == r.project_id)))
    development_started = any(code != "PM" and status not in ("TODO", "WAITING") for status, code in rows)
    pm_pending = any(code == "PM" and status != "COMPLETED" for status, code in rows)
    if not development_started and pm_pending:
        return PM_INTERVAL_SECONDS
    return r.interval_seconds


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
        p = db.get(m.Project, pid)
        plan = db.get(m.PlanVersion, p.active_plan_id)
        # Existing task IDs must remain stable; approve the existing plan without composing new tasks.
        db.add(m.Approval(project_id=pid, kind="PLAN_EXECUTION", target_id=plan.id,
                          target_version=plan.version, actor=ACTOR))
        plan.status, p.status = "EXECUTING", "ACTIVE"
        git_port().initialize_project_repository(pid)
        for t in db.scalars(select(m.ProjectTask).where(m.ProjectTask.project_id == pid)):
            t.approved_plan_id, t.approved_plan_version = plan.id, plan.version
            _touch_task(db, t)
        r.phase = "EXECUTING"
        platform.touch(db, pid, "plan.updated", plan.id, {"demo": True, "actor": ACTOR})
    elif r.phase == "EXECUTING":
        _execute(db, r, force=force)
    elif r.phase == "MILESTONE_REVIEW":
        p = db.get(m.Project, pid)
        plan = db.get(m.PlanVersion, p.active_plan_id) if p.active_plan_id else None
        pending = list(db.scalars(select(m.MilestoneResult).where(
            m.MilestoneResult.project_id == pid, m.MilestoneResult.review_status == "PENDING")))
        # Hold up to ATTENTION_GRACE_SECONDS so the operator can approve/return in the Attention
        # Center (review_milestone_result is the normal API). Stamp every deadline first (list,
        # not generator) so all pending results share one window; auto-approve once it elapses.
        elapsed = [_grace_elapsed(plan, f"mr:{mr.id}", force) for mr in pending] if plan is not None else []
        if pending and plan is not None and not all(elapsed):
            _agents(db, pid)  # keep the board live while waiting for the operator
        else:
            for mr in pending:
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
    db.flush()
    delay = _next_delay(db, r)
    r.next_tick_at = (datetime.now(timezone.utc) + timedelta(seconds=delay)).isoformat()
    platform.touch(db, pid, "demo.updated", pid,
                   {"demo": True, "phase": r.phase, "cycle": r.cycle, "actor": ACTOR})
