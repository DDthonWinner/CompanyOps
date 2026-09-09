"""Snapshot assembler (06 §4.2 GET /snapshot). Full read model at current revision,
built in a single read transaction. camelCase JSON per 06 §1.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import progress
from .models import (
    Approval,
    Decision,
    MilestoneResult,
    PlanVersion,
    Project,
    ProjectAgent,
    ProjectTask,
    QARun,
    SprintMilestone,
    TaskPublish,
    TokenUsage,
)


def _agent(a: ProjectAgent, token_total: int | None = None) -> dict:
    return {
        "id": a.id, "roleId": a.role_id, "displayName": a.display_name,
        "displayColor": a.display_color, "iconKey": a.icon_key, "status": a.status,
        "isPrimaryPm": bool(a.is_primary_pm), "currentTaskId": a.current_task_id,
        "nextTaskId": a.next_task_id, "activitySummary": a.activity_summary,
        "llmModelId": a.llm_model_id, "tokenTotal": token_total,
        "agentProfileId": a.agent_profile_id,
    }


def _task(t: ProjectTask, token_total: int | None = None) -> dict:
    return {
        "id": t.id, "sprintMilestoneId": t.sprint_milestone_id,
        "assignedProjectAgentId": t.assigned_project_agent_id, "roleId": t.role_id,
        "title": t.title, "description": t.description, "status": t.status,
        "executionMode": t.execution_mode, "priority": t.priority, "sortOrder": t.sort_order,
        "dependencyTaskIds": t.dependency_task_ids, "waitReasons": t.wait_reasons,
        "approvedPlanId": t.approved_plan_id, "approvedPlanVersion": t.approved_plan_version,
        "revision": t.revision, "tokenTotal": token_total,
    }


def _token_aggregate(session: Session, project_id: str) -> dict:
    """Sum persisted TokenUsage rows (06 §3.1) by agent / task / role for the snapshot.
    Returns {} shape with collected=False when nothing has been measured yet."""
    rows = list(session.execute(
        select(TokenUsage).where(TokenUsage.project_id == project_id)
    ).scalars())
    by_agent: dict[str, int] = {}
    by_task: dict[str, int] = {}
    by_role: dict[str, int] = {}
    total_in = total_out = total_all = 0
    any_demo = False
    for r in rows:
        t = r.total_tokens if r.total_tokens is not None else (r.input_tokens or 0) + (r.output_tokens or 0)
        total_in += r.input_tokens or 0
        total_out += r.output_tokens or 0
        total_all += t
        if r.project_agent_id:
            by_agent[r.project_agent_id] = by_agent.get(r.project_agent_id, 0) + t
        if r.task_id:
            by_task[r.task_id] = by_task.get(r.task_id, 0) + t
        if r.role_code:
            by_role[r.role_code] = by_role.get(r.role_code, 0) + t
        if r.demo:
            any_demo = True
    return {
        "summary": {
            "collected": len(rows) > 0,
            "demo": any_demo,
            "totalInput": total_in, "totalOutput": total_out, "total": total_all,
            "byRole": by_role, "byAgent": by_agent,
        },
        "byAgent": by_agent, "byTask": by_task,
    }


def _milestone(session: Session, m: SprintMilestone) -> dict:
    prog = progress.milestone_progress(session, m.id)
    latest = session.execute(
        select(MilestoneResult).where(MilestoneResult.milestone_id == m.id)
        .order_by(MilestoneResult.version.desc())
    ).scalars().first()
    return {
        "id": m.id, "title": m.title, "roleId": m.role_id, "displayColor": m.display_color,
        "sortOrder": m.sort_order, "status": progress.milestone_status(session, m.id),
        **prog,
        "resultVersion": latest.version if latest else None,
        "reviewStatus": latest.review_status if latest else None,
        "additionalValidation": latest.additional_validation if latest else None,
    }


def build_snapshot(session: Session, project_id: str) -> dict:
    project = session.get(Project, project_id)
    if project is None:
        return {}
    agents = list(session.execute(
        select(ProjectAgent).where(ProjectAgent.project_id == project_id)
    ).scalars())
    tasks = list(session.execute(
        select(ProjectTask).where(ProjectTask.project_id == project_id)
        .order_by(ProjectTask.sort_order)
    ).scalars())
    milestones = list(session.execute(
        select(SprintMilestone).where(SprintMilestone.project_id == project_id)
        .order_by(SprintMilestone.sort_order)
    ).scalars())
    plans = list(session.execute(
        select(PlanVersion).where(PlanVersion.project_id == project_id)
        .order_by(PlanVersion.version)
    ).scalars())
    pending_approvals = list(session.execute(
        select(Decision).where(Decision.project_id == project_id, Decision.status == "OPEN")
    ).scalars())
    qa_runs = list(session.execute(
        select(QARun).where(QARun.project_id == project_id)
    ).scalars())
    publishes = list(session.execute(
        select(TaskPublish).join(ProjectTask, TaskPublish.task_id == ProjectTask.id)
        .where(ProjectTask.project_id == project_id)
    ).scalars())

    assigned = [a for a in agents if a.status != "REMOVED"]
    working = [a for a in agents if a.status == "WORKING"]
    tokens = _token_aggregate(session, project_id)
    tok_agent, tok_task = tokens["byAgent"], tokens["byTask"]

    return {
        "revision": project.revision,
        "project": {
            "id": project.id, "name": project.name, "description": project.description,
            "projectType": project.project_type, "budgetLevel": project.budget_level,
            "budgetAmount": project.budget_amount, "projectSize": project.project_size,
            "status": project.status, "maxAgentCount": project.max_agent_count,
            "assignedAgentCount": len(assigned), "workingAgentCount": len(working),
            "hasPrimaryPm": any(a.is_primary_pm and a.status != "REMOVED" for a in agents),
            "activePlanId": project.active_plan_id, "activePlanVersion": project.active_plan_version,
            "completedAt": project.completed_at,
            **progress.project_progress(session, project_id),
        },
        "agents": [_agent(a, tok_agent.get(a.id)) for a in agents],
        "tasks": [_task(t, tok_task.get(t.id)) for t in tasks],
        "milestones": [_milestone(session, m) for m in milestones],
        "tokenUsage": tokens["summary"],
        "plans": [
            {"id": p.id, "version": p.version, "status": p.status, "request": p.request,
             "steps": p.steps} for p in plans
        ],
        "pendingDecisions": [
            {"id": d.id, "reason": d.reason, "options": d.options,
             "scopeTaskIds": d.scope_task_ids} for d in pending_approvals
        ],
        "qaRuns": [
            {"id": q.id, "taskId": q.task_id, "runStatus": q.run_status,
             "technicalGate": q.technical_gate, "results": q.results, "demo": bool(q.demo)}
            for q in qa_runs
        ],
        "git": [
            {"taskId": p.task_id, "status": p.status, "commitSha": p.commit_sha,
             "branchUrl": p.branch_url} for p in publishes
        ],
    }
