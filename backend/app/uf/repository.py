"""Read-only source-data helpers for UF aggregation (06 §3.3). Never mutates work state."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..common.models import (
    ActivityEvent,
    Decision,
    MilestoneResult,
    PlanFeedback,
    PlanVersion,
    ProjectTask,
    Role,
)

CORE_AREAS = ["PM", "FRONTEND", "BACKEND", "QA"]


def role_code_map(session: Session) -> dict[str, str]:
    return {r.id: r.code for r in session.execute(select(Role)).scalars()}


def eligible_tasks(session: Session, project_id: str) -> list[ProjectTask]:
    tasks = list(session.execute(
        select(ProjectTask).where(ProjectTask.project_id == project_id)
    ).scalars())
    return [t for t in tasks if t.status != "CANCELLED"]


def resolved_decision_count(session: Session, project_id: str) -> int:
    return len(list(session.execute(
        select(Decision).where(Decision.project_id == project_id, Decision.status == "RESOLVED")
    ).scalars()))


def plan_feedback_count(session: Session, project_id: str) -> int:
    plan_ids = [p.id for p in session.execute(
        select(PlanVersion).where(PlanVersion.project_id == project_id)
    ).scalars()]
    if not plan_ids:
        return 0
    return len(list(session.execute(
        select(PlanFeedback).where(PlanFeedback.plan_id.in_(plan_ids))
    ).scalars()))


def revision_request_count(session: Session, project_id: str) -> int:
    results = list(session.execute(
        select(MilestoneResult).where(MilestoneResult.project_id == project_id)
    ).scalars())
    # latest per milestone
    latest: dict[str, MilestoneResult] = {}
    for r in results:
        cur = latest.get(r.milestone_id)
        if cur is None or r.version > cur.version:
            latest[r.milestone_id] = r
    return sum(1 for r in latest.values() if r.review_status == "REVISION_REQUESTED")


def token_totals(session: Session, project_id: str) -> dict:
    """Sum token metrics emitted by U1 on 'artifact.updated' activity events (06 §3.3)."""
    events = session.execute(
        select(ActivityEvent).where(
            ActivityEvent.project_id == project_id, ActivityEvent.type == "artifact.updated"
        )
    ).scalars()
    total_in = total_out = total = 0
    collected = False
    for e in events:
        tokens = (e.payload or {}).get("tokens") or {}
        if not tokens:
            continue
        collected = True
        total_in += int(tokens.get("input") or 0)
        total_out += int(tokens.get("output") or 0)
        total += int(tokens.get("total") or 0)
    return {"input": total_in, "output": total_out, "total": total, "collected": collected}
