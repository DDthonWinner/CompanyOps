"""UF HTTP routes (02 §9.2). Global paths; UF never owns /api/projects/*."""
from __future__ import annotations

from fastapi import APIRouter, Query

from ..common.txn import mutate, read
from . import schemas as s
from . import service

router = APIRouter(prefix="/api", tags=["uf"])


@router.post("/utilization")
def create_report(body: s.CreateReportIn):
    # 409 if project not COMPLETED; idempotent (returns existing).
    return mutate(lambda db: service.create_report(db, body.projectId))


@router.get("/utilization")
def list_reports(projectId: str = Query(...)):
    return read(lambda db: {"items": service.list_reports(db, projectId)})


# TEMP UF_TEST_PREVIEW: read-only test generation for unfinished projects.
@router.post("/utilization/preview")
def preview_report(body: s.CreateReportIn):
    return read(lambda db: service.preview_report(db, body.projectId))


@router.get("/utilization/{report_id}")
def get_report(report_id: str):
    return read(lambda db: service.get_report(db, report_id))


@router.get("/utilization/{report_id}/metrics")
def get_metrics(report_id: str):
    return read(lambda db: service.get_metrics(db, report_id))


@router.get("/utilization/{report_id}/feedbacks")
def list_feedbacks(report_id: str):
    return read(lambda db: service.list_feedbacks(db, report_id))


@router.post("/utilization/{report_id}/feedbacks")
def create_feedback(report_id: str, body: s.FeedbackIn):
    return mutate(lambda db: service.create_feedback(db, report_id, body.model_dump()))


@router.put("/feedbacks/{feedback_id}")
def update_feedback(feedback_id: str, body: s.FeedbackUpdateIn):
    return mutate(lambda db: service.update_feedback(db, feedback_id, body.model_dump(exclude_none=True)))
