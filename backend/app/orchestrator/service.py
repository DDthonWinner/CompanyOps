"""Orchestration service: plan-first lifecycle, composition, publish coordination,
milestone results, completion, decisions. Rules per 06 §2/§4, 00 §5 (see business-rules.md).
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..common import platform, progress
from ..common.errors import bad_request, conflict, not_found, stale_version
from ..common.models import (
    Approval,
    ArtifactVersion,
    Decision,
    MilestoneResult,
    PlanFeedback,
    PlanVersion,
    Project,
    ProjectTask,
    QARun,
    SprintMilestone,
    TaskPublish,
)
from ..common.util import stable_hash, utcnow_iso
from . import deps


# ------------------------------------------------------------------ plan lifecycle
def plan_dict(p: PlanVersion) -> dict:
    return {
        "id": p.id, "projectId": p.project_id, "version": p.version, "status": p.status,
        "request": p.request, "steps": p.steps, "agents": p.agents, "scope": p.scope,
        "impact": p.impact,
    }


def create_plan(session: Session, project_id: str, req: dict) -> dict:
    project = session.get(Project, project_id)
    if project is None:
        raise not_found("프로젝트를 찾을 수 없습니다.")
    request_id = req["requestId"]
    decision, prior = platform.CommandReceiptStore.begin(session, request_id, "create_plan", req)
    if decision == platform.CommandReceiptStore.REPLAY and prior:
        return prior
    steps = req.get("steps") or [
        {"title": req.get("instruction", "Implement change"), "roleCode": "BACKEND"}
    ]
    plan = PlanVersion(
        project_id=project_id, version=1, request=req.get("instruction"),
        steps=steps, agents=req.get("targetAgentIds") or [], status="REVIEW",
    )
    session.add(plan)
    session.flush()
    platform.touch(session, project_id, "plan.updated", plan.id)
    result = plan_dict(plan)
    platform.CommandReceiptStore.complete(session, request_id, result)
    return result


def _require_plan(session: Session, plan_id: str, expected_version: int) -> PlanVersion:
    plan = session.get(PlanVersion, plan_id)
    if plan is None:
        raise not_found("계획을 찾을 수 없습니다.")
    if expected_version is not None and plan.version != expected_version:
        raise stale_version()
    return plan


def apply_plan_feedback(session: Session, plan_id: str, req: dict) -> dict:
    request_id = req["requestId"]
    decision, prior = platform.CommandReceiptStore.begin(session, request_id, "plan_feedback", req)
    if decision == platform.CommandReceiptStore.REPLAY and prior:
        return prior
    plan = _require_plan(session, plan_id, req.get("expectedVersion"))
    session.add(PlanFeedback(plan_id=plan.id, plan_version=plan.version, text=req.get("feedback", "")))
    plan.version += 1  # supersede → new version back in REVIEW
    plan.status = "REVIEW"
    if req.get("steps"):
        plan.steps = req["steps"]
    plan.updated_at = utcnow_iso()
    platform.touch(session, plan.project_id, "plan.updated", plan.id)
    result = plan_dict(plan)
    platform.CommandReceiptStore.complete(session, request_id, result)
    return result


def review_complete(session: Session, plan_id: str, req: dict) -> dict:
    plan = _require_plan(session, plan_id, req.get("expectedVersion"))
    plan.status = "FINAL_APPROVAL_PENDING"
    plan.updated_at = utcnow_iso()
    platform.touch(session, plan.project_id, "plan.updated", plan.id)
    return plan_dict(plan)


def approve_plan(session: Session, plan_id: str, req: dict) -> dict:
    request_id = req["requestId"]
    decision, prior = platform.CommandReceiptStore.begin(session, request_id, "plan_approve", req)
    if decision == platform.CommandReceiptStore.REPLAY and prior:
        return prior
    plan = _require_plan(session, plan_id, req.get("expectedVersion"))
    if plan.status not in ("FINAL_APPROVAL_PENDING", "REVIEW"):
        raise conflict("이 계획 버전은 승인할 수 없는 상태입니다.", code="PLAN_NOT_APPROVABLE")
    session.add(Approval(
        project_id=plan.project_id, kind="PLAN_EXECUTION", target_id=plan.id,
        target_version=plan.version, status="APPROVED", request_id=request_id,
    ))
    plan.status = "APPROVED_WAITING"
    project = session.get(Project, plan.project_id)
    project.active_plan_id = plan.id
    project.active_plan_version = plan.version
    _compose_tasks(session, project, plan)
    # prepare repo + go ACTIVE
    try:
        deps.git_port().initialize_project_repository(project.id)
        project.status = "ACTIVE"
        plan.status = "EXECUTING"
    except Exception as exc:  # noqa: BLE001 — stay READY with reason
        project.status = "READY"
        plan.impact = {**(plan.impact or {}), "prepError": str(exc)}
    platform.touch(session, project.id, "plan.updated", plan.id)
    platform.touch(session, project.id, "project.updated", project.id)
    result = plan_dict(plan)
    platform.CommandReceiptStore.complete(session, request_id, result)
    return result


def _compose_tasks(session: Session, project: Project, plan: PlanVersion) -> None:
    """Approved plan steps → milestone-grouped tasks (Q4). Reject self/cycle deps."""
    from ..common.models import Role

    created: list[ProjectTask] = []
    milestone_cache: dict[str, str] = {}
    for idx, step in enumerate(plan.steps or []):
        role_code = step.get("roleCode", "BACKEND")
        milestone_title = step.get("milestoneTitle") or f"{role_code} Milestone"
        if milestone_title not in milestone_cache:
            role = session.execute(select(Role).where(Role.code == role_code)).scalars().first()
            m = SprintMilestone(
                project_id=project.id, title=milestone_title,
                role_id=role.id if role else None, sort_order=len(milestone_cache),
            )
            session.add(m)
            session.flush()
            milestone_cache[milestone_title] = m.id
            platform.touch(session, project.id, "milestone.updated", m.id)
        role = session.execute(select(Role).where(Role.code == role_code)).scalars().first()
        t = ProjectTask(
            project_id=project.id, sprint_milestone_id=milestone_cache[milestone_title],
            role_id=role.id if role else None, title=step.get("title", f"Step {idx+1}"),
            description=step.get("description"), status="TODO",
            priority=step.get("priority", "MEDIUM"), sort_order=idx,
            approved_plan_id=plan.id, approved_plan_version=plan.version,
        )
        session.add(t)
        session.flush()
        created.append(t)
        platform.touch(session, project.id, "task.updated", t.id)
    # wire dependencies by step index (dependsOn: [indices])
    for idx, step in enumerate(plan.steps or []):
        deps_idx = step.get("dependsOn") or []
        for d in deps_idx:
            if d == idx:
                raise bad_request("Task 자기 참조 의존은 허용되지 않습니다.", code="SELF_DEPENDENCY")
            if 0 <= d < len(created):
                dep_id = created[d].id
                created[idx].dependency_task_ids = list(created[idx].dependency_task_ids or []) + [dep_id]
    _detect_cycle(created)


def _detect_cycle(tasks: list[ProjectTask]) -> None:
    graph = {t.id: list(t.dependency_task_ids or []) for t in tasks}
    WHITE, GRAY, BLACK = 0, 1, 2
    color = {n: WHITE for n in graph}

    def visit(n: str) -> None:
        color[n] = GRAY
        for m in graph.get(n, []):
            if color.get(m) == GRAY:
                raise bad_request("순환 의존이 감지되었습니다.", code="DEPENDENCY_CYCLE")
            if color.get(m) == WHITE:
                visit(m)
        color[n] = BLACK

    for n in graph:
        if color[n] == WHITE:
            visit(n)


# ------------------------------------------------------------------ decisions
def resolve_decision(session: Session, decision_id: str, req: dict) -> dict:
    d = session.get(Decision, decision_id)
    if d is None:
        raise not_found("Decision을 찾을 수 없습니다.")
    d.selected_answer = req.get("answer")
    d.status = "RESOLVED"
    d.resolved_at = utcnow_iso()
    # clear DECISION wait reason on scope tasks
    for task_id in d.scope_task_ids or []:
        t = session.get(ProjectTask, task_id)
        if t:
            t.wait_reasons = [w for w in (t.wait_reasons or []) if not str(w).startswith("DECISION")]
    platform.touch(session, d.project_id, "decision.updated", d.id)
    return {"id": d.id, "status": d.status, "selectedAnswer": d.selected_answer}


# ------------------------------------------------------------------ publish coordination
def publish_task(session: Session, task_id: str, req: dict, *, git=None) -> dict:
    """Validate preconditions server-side, publish via GitPort, flip COMPLETED on push."""
    request_id = req.get("requestId")
    if request_id:
        decision, prior = platform.CommandReceiptStore.begin(session, request_id, "publish", req)
        if decision == platform.CommandReceiptStore.REPLAY and prior:
            return prior
    t = session.get(ProjectTask, task_id)
    if t is None:
        raise not_found("Task를 찾을 수 없습니다.")
    qa = session.execute(
        select(QARun).where(QARun.task_id == task_id).order_by(QARun.started_at.desc())
    ).scalars().first()
    artifact = session.execute(
        select(ArtifactVersion).where(ArtifactVersion.task_id == task_id)
        .order_by(ArtifactVersion.version.desc())
    ).scalars().first()
    # Preconditions (06 §2.2, BR-M5)
    if qa is None or qa.technical_gate != "PASSED":
        raise conflict("기술 QA Gate가 PASSED가 아닙니다.", code="GATE_NOT_PASSED")
    if artifact is None or (qa.target_hash and artifact.content_hash != qa.target_hash):
        raise conflict("QA 검증 hash와 현재 Artifact가 일치하지 않습니다.", code="HASH_MISMATCH")

    milestone = session.get(SprintMilestone, t.sprint_milestone_id) if t.sprint_milestone_id else None
    res = (git if git is not None else deps.git_port()).publish_task_changes(
        t.project_id, t.sprint_milestone_id, t.id, t.title, "feat"
    )
    pub = TaskPublish(
        task_id=t.id, artifact_version=artifact.version, request_id=request_id,
        status=res.status, commit_sha=res.commit_sha, branch_url=res.branch_url,
        error=res.error,
    )
    session.add(pub)
    if res.status == "PUSHED" and t.execution_mode is not None:
        t.status = "COMPLETED"
        t.updated_at = utcnow_iso()
        platform.touch(session, t.project_id, "task.updated", t.id)
        if milestone:
            platform.touch(session, t.project_id, "milestone.updated", milestone.id)
            session.flush()  # milestone result must include this final publish/commit
            maybe_build_milestone_result(session, milestone.id)
    platform.touch(session, t.project_id, "git.updated", t.id)
    result = {"taskId": t.id, "status": res.status, "commitSha": res.commit_sha,
              "branchUrl": res.branch_url, "taskStatus": t.status, "error": res.error}
    if request_id:
        platform.CommandReceiptStore.complete(session, request_id, result)
    return result


# ------------------------------------------------------------------ milestone results
def maybe_build_milestone_result(session: Session, milestone_id: str) -> MilestoneResult | None:
    tasks = list(session.execute(
        select(ProjectTask).where(ProjectTask.sprint_milestone_id == milestone_id)
    ).scalars())
    considered = [t for t in tasks if t.status != "CANCELLED"]
    if not considered or not all(t.status == "COMPLETED" for t in considered):
        return None
    m = session.get(SprintMilestone, milestone_id)
    task_ids = sorted(t.id for t in considered)
    commits = [
        p.commit_sha for p in session.execute(
            select(TaskPublish).where(TaskPublish.task_id.in_(task_ids), TaskPublish.status == "PUSHED")
        ).scalars()
    ]
    result_hash = stable_hash({"tasks": task_ids, "commits": sorted(c for c in commits if c)})
    latest = session.execute(
        select(MilestoneResult).where(MilestoneResult.milestone_id == milestone_id)
        .order_by(MilestoneResult.version.desc())
    ).scalars().first()
    if latest and latest.result_hash == result_hash:
        return latest  # unchanged composition
    version = (latest.version + 1) if latest else 1
    mr = MilestoneResult(
        milestone_id=milestone_id, project_id=m.project_id, version=version,
        result_hash=result_hash, snapshot={"taskIds": task_ids, "commits": commits},
        review_status="PENDING", additional_validation="UNANSWERED",
    )
    session.add(mr)
    session.flush()
    platform.touch(session, m.project_id, "milestone-result.updated", mr.id)
    return mr


def get_milestone_result(session: Session, milestone_id: str) -> dict:
    mr = session.execute(
        select(MilestoneResult).where(MilestoneResult.milestone_id == milestone_id)
        .order_by(MilestoneResult.version.desc())
    ).scalars().first()
    if mr is None:
        raise not_found("Milestone 결과가 아직 없습니다.")
    return {
        "id": mr.id, "milestoneId": mr.milestone_id, "version": mr.version,
        "resultHash": mr.result_hash, "reviewStatus": mr.review_status,
        "additionalValidation": mr.additional_validation, "snapshot": mr.snapshot,
    }


def review_milestone_result(session: Session, milestone_id: str, req: dict) -> dict:
    request_id = req.get("requestId")
    if request_id:
        decision, prior = platform.CommandReceiptStore.begin(session, request_id, "mr_review", req)
        if decision == platform.CommandReceiptStore.REPLAY and prior:
            return prior
    mr = session.execute(
        select(MilestoneResult).where(MilestoneResult.milestone_id == milestone_id)
        .order_by(MilestoneResult.version.desc())
    ).scalars().first()
    if mr is None:
        raise not_found("Milestone 결과가 없습니다.")
    if req.get("expectedResultVersion") is not None and mr.version != req["expectedResultVersion"]:
        raise stale_version("Milestone 결과 버전이 변경되었습니다.")
    review_status = req["reviewStatus"]
    additional = req.get("additionalValidation", "UNANSWERED")

    # gate must be PASSED to approve (BR-Q5)
    if review_status == "APPROVED":
        if not _gate_passed_for_milestone(session, milestone_id):
            raise conflict("기술 Gate 미통과로 승인할 수 없습니다.", code="GATE_NOT_PASSED")
        if additional != "NONE":
            raise bad_request("승인 시 additionalValidation은 NONE이어야 합니다.", code="ADDITIONAL_VALIDATION_REQUIRED")
        mr.review_status = "APPROVED"
        mr.additional_validation = "NONE"
        session.add(Approval(
            project_id=mr.project_id, kind="MILESTONE_RESULT", target_id=mr.id,
            target_version=mr.version, status="APPROVED", request_id=request_id,
        ))
    else:
        mr.review_status = review_status  # REVISION_REQUESTED / REJECTED
        mr.additional_validation = additional
    platform.touch(session, mr.project_id, "milestone-result.updated", mr.id)
    completed = maybe_complete_project(session, mr.project_id)
    result = {"id": mr.id, "reviewStatus": mr.review_status,
              "additionalValidation": mr.additional_validation,
              "projectCompleted": completed}
    if request_id:
        platform.CommandReceiptStore.complete(session, request_id, result)
    return result


def _gate_passed_for_milestone(session: Session, milestone_id: str) -> bool:
    task_ids = [t.id for t in session.execute(
        select(ProjectTask).where(ProjectTask.sprint_milestone_id == milestone_id)
    ).scalars()]
    if not task_ids:
        return False
    for tid in task_ids:
        qa = session.execute(
            select(QARun).where(QARun.task_id == tid).order_by(QARun.started_at.desc())
        ).scalars().first()
        if qa is None or qa.technical_gate != "PASSED":
            return False
    return True


# ------------------------------------------------------------------ completion
def maybe_complete_project(session: Session, project_id: str) -> bool:
    project = session.get(Project, project_id)
    if project is None or project.status == "COMPLETED":
        return project.status == "COMPLETED" if project else False
    tasks = list(session.execute(
        select(ProjectTask).where(ProjectTask.project_id == project_id)
    ).scalars())
    non_cancelled = [t for t in tasks if t.status != "CANCELLED"]
    if not non_cancelled:
        return False
    if any(t.sprint_milestone_id is None for t in non_cancelled):
        return False  # unassigned task
    if not all(t.status == "COMPLETED" for t in non_cancelled):
        return False
    milestones = list(session.execute(
        select(SprintMilestone).where(SprintMilestone.project_id == project_id)
    ).scalars())
    for m in milestones:
        m_tasks = [t for t in non_cancelled if t.sprint_milestone_id == m.id]
        if not m_tasks:
            return False  # empty milestone
        mr = session.execute(
            select(MilestoneResult).where(MilestoneResult.milestone_id == m.id)
            .order_by(MilestoneResult.version.desc())
        ).scalars().first()
        if mr is None or mr.review_status != "APPROVED":
            return False
    project.status = "COMPLETED"
    project.completed_at = utcnow_iso()
    platform.touch(session, project_id, "project.updated", project_id)
    # Trigger UF report in the SAME transaction (UF sees the uncommitted COMPLETED status).
    # Isolate UF failures in a savepoint so they never roll back project completion.
    try:
        with session.begin_nested():
            deps.utilization_port().request_report(project_id, session=session)
    except Exception:  # noqa: BLE001
        pass
    return True
