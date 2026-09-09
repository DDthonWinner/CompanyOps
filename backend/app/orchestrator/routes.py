"""Orchestration HTTP + SSE routes (06 §4.2, §5). Project-scoped."""
from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter
from sqlalchemy import select
from sse_starlette.sse import EventSourceResponse

from ..common import snapshot as snapshot_mod
from ..common.errors import not_found
from ..common.models import ArtifactVersion, QARun
from ..common.platform import ActivityService, write_locks
from ..common.sse import broker
from ..common.txn import mutate, read
from ..config import get_settings
from . import schemas as s
from . import service, worker

router = APIRouter(prefix="/api", tags=["orchestrator"])


# ---- snapshot / events ----
@router.get("/projects/{project_id}/snapshot")
def get_snapshot(project_id: str):
    snap = read(lambda db: snapshot_mod.build_snapshot(db, project_id))
    if not snap:
        raise not_found("프로젝트를 찾을 수 없습니다.")
    return snap


@router.get("/projects/{project_id}/events")
async def sse_events(project_id: str):
    settings = get_settings()
    queue = broker.subscribe(project_id)

    async def gen():
        try:
            while True:
                event = await queue.get()
                yield {"event": "project.updated", "data": json.dumps(event)}
        except asyncio.CancelledError:  # pragma: no cover
            raise
        finally:
            broker.unsubscribe(project_id, queue)

    return EventSourceResponse(gen(), ping=settings.heartbeat_seconds)


# ---- commands / plans ----
@router.post("/projects/{project_id}/commands")
def post_command(project_id: str, body: s.CommandIn):
    return mutate(lambda db: service.create_plan(db, project_id, body.model_dump()))


@router.post("/projects/{project_id}/plans/{plan_id}/feedback")
def plan_feedback(project_id: str, plan_id: str, body: s.FeedbackIn):
    return mutate(lambda db: service.apply_plan_feedback(db, plan_id, body.model_dump()))


@router.post("/projects/{project_id}/plans/{plan_id}/review-complete")
def plan_review_complete(project_id: str, plan_id: str, body: s.VersionedIn):
    return mutate(lambda db: service.review_complete(db, plan_id, body.model_dump()))


@router.post("/projects/{project_id}/plans/{plan_id}/approve")
async def plan_approve(project_id: str, plan_id: str, body: s.VersionedIn):
    from ..demo import service as demo_service
    if read(lambda db: demo_service.replay_active(db, project_id)):
        # Paced-replay projects: approve via the demo-safe path under the project write-lock.
        async with write_locks.lock_for(project_id):
            return mutate(lambda db: demo_service.manual_approve_plan(db, project_id, body.model_dump()))
    result = mutate(lambda db: service.approve_plan(db, plan_id, body.model_dump()))
    worker.enqueue_project(project_id)  # kick the worker after commit
    return result


# ---- decisions ----
@router.post("/projects/{project_id}/decisions/{decision_id}/resolve")
def resolve_decision(project_id: str, decision_id: str, body: s.ResolveDecisionIn):
    result = mutate(lambda db: service.resolve_decision(db, decision_id, body.model_dump()))
    worker.enqueue_project(project_id)  # unblocked tasks may now be executable
    return result


# ---- QA / artifacts ----
@router.get("/projects/{project_id}/qa-runs/{run_id}")
def get_qa_run(project_id: str, run_id: str):
    def op(db):
        q = db.get(QARun, run_id)
        if q is None:
            raise not_found("QA Run을 찾을 수 없습니다.")
        return {"id": q.id, "taskId": q.task_id, "runStatus": q.run_status,
                "technicalGate": q.technical_gate, "results": q.results,
                "evidence": q.evidence, "demo": bool(q.demo)}
    return read(op)


@router.get("/projects/{project_id}/tasks/{task_id}/artifacts")
def get_task_artifacts(project_id: str, task_id: str):
    def op(db):
        arts = db.execute(
            select(ArtifactVersion).where(ArtifactVersion.task_id == task_id)
            .order_by(ArtifactVersion.version)
        ).scalars()
        return [{"id": a.id, "version": a.version, "generationStatus": a.generation_status,
                 "filePaths": a.file_paths, "contentHash": a.content_hash} for a in arts]
    return read(op)


# ---- milestone result ----
@router.get("/projects/{project_id}/sprint-milestones/{milestone_id}/result")
def get_milestone_result(project_id: str, milestone_id: str):
    return read(lambda db: service.get_milestone_result(db, milestone_id))


@router.post("/projects/{project_id}/sprint-milestones/{milestone_id}/result/reviews")
async def review_milestone_result(project_id: str, milestone_id: str, body: s.MilestoneReviewIn):
    from ..demo import service as demo_service
    if read(lambda db: demo_service.replay_active(db, project_id)):
        async with write_locks.lock_for(project_id):
            return mutate(lambda db: demo_service.manual_review_milestone(
                db, project_id, milestone_id, body.model_dump()))
    return mutate(lambda db: service.review_milestone_result(db, milestone_id, body.model_dump()))


# ---- publish ----
@router.post("/projects/{project_id}/tasks/{task_id}/publish")
def publish_task(project_id: str, task_id: str, body: s.PublishIn):
    return mutate(lambda db: service.publish_task(db, task_id, body.model_dump()))


# ---- activity ----
@router.get("/projects/{project_id}/activity")
def get_activity(project_id: str, cursor: int = 0, limit: int = 50):
    def op(db):
        events = ActivityService.read(db, project_id, cursor=cursor, limit=limit)
        return [{"id": e.id, "revision": e.revision, "type": e.type,
                 "entityId": e.entity_id, "payload": e.payload, "occurredAt": e.occurred_at}
                for e in events]
    return read(op)
