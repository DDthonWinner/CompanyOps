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
)


def _agent(a: ProjectAgent) -> dict:
    return {
        "id": a.id, "roleId": a.role_id, "displayName": a.display_name,
        "displayColor": a.display_color, "iconKey": a.icon_key, "status": a.status,
        "isPrimaryPm": bool(a.is_primary_pm), "currentTaskId": a.current_task_id,
        "nextTaskId": a.next_task_id, "activitySummary": a.activity_summary,
        "llmModelId": a.llm_model_id,
    }


def _task(t: ProjectTask) -> dict:
    return {
        "id": t.id, "sprintMilestoneId": t.sprint_milestone_id,
        "assignedProjectAgentId": t.assigned_project_agent_id, "roleId": t.role_id,
        "title": t.title, "description": t.description, "status": t.status,
        "executionMode": t.execution_mode, "priority": t.priority, "sortOrder": t.sort_order,
        "dependencyTaskIds": t.dependency_task_ids, "waitReasons": t.wait_reasons,
        "approvedPlanId": t.approved_plan_id, "approvedPlanVersion": t.approved_plan_version,
        "revision": t.revision,
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
        "agents": [_agent(a) for a in agents],
        "tasks": [_task(t) for t in tasks],
        "milestones": [_milestone(session, m) for m in milestones],
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
