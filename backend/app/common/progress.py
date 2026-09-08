"""Read-only progress & milestone-status derivation (00 §7, 01 §4.2.9, 06 §3.2)."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import ProjectTask, SprintMilestone

_NON_CANCELLED = ("TODO", "RUNNING", "WAITING", "BLOCKED", "REVIEW", "COMPLETED", "FAILED")


def _progress(tasks: list[ProjectTask]) -> dict:
    considered = [t for t in tasks if t.status != "CANCELLED"]
    total = len(considered)
    current = sum(1 for t in considered if t.status == "COMPLETED")
    percent = round(100 * current / total) if total > 0 else 0
    label = None if total > 0 else "작업 없음"
    return {"progressCurrent": current, "progressTotal": total, "progressPercent": percent, "emptyLabel": label}


def milestone_progress(session: Session, milestone_id: str) -> dict:
    tasks = list(session.execute(
        select(ProjectTask).where(ProjectTask.sprint_milestone_id == milestone_id)
    ).scalars())
    return _progress(tasks)


def milestone_status(session: Session, milestone_id: str) -> str:
    tasks = list(session.execute(
        select(ProjectTask).where(ProjectTask.sprint_milestone_id == milestone_id)
    ).scalars())
    considered = [t for t in tasks if t.status != "CANCELLED"]
    if not considered or all(t.status == "TODO" for t in considered):
        return "PLANNED"
    if all(t.status == "COMPLETED" for t in considered):
        return "DONE"
    incomplete = [t for t in considered if t.status != "COMPLETED"]
    if any(t.status in ("BLOCKED", "FAILED") for t in incomplete):
        return "BLOCKED"
    return "IN_PROGRESS"


def project_progress(session: Session, project_id: str) -> dict:
    """Includes milestone-less tasks; never averages milestone percentages (06 §3.2)."""
    tasks = list(session.execute(
        select(ProjectTask).where(ProjectTask.project_id == project_id)
    ).scalars())
    return _progress(tasks)
