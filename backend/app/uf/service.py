"""UFService: report aggregation, UF_MVP_V1 scoring, comparison, feedback (02, 06 §3.3).
Read-only vs work state (BU-4). All mutations run in a caller-provided Session.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..common.errors import bad_request, conflict, not_found
from ..common.models import Project
from ..common.util import utcnow_iso
from . import feedback_gen
from . import repository as repo
from .models import Feedback, UtilizationMetric, UtilizationReport


# --------------------------------------------------------------------------- report
def create_report(session: Session, project_id: str) -> dict:
    project = session.get(Project, project_id)
    if project is None:
        raise not_found("프로젝트를 찾을 수 없습니다.")
    if project.status != "COMPLETED":
        raise conflict("프로젝트가 완료되지 않았습니다.", code="PROJECT_NOT_COMPLETED")

    existing = session.execute(
        select(UtilizationReport).where(UtilizationReport.project_id == project_id)
    ).scalars().first()
    if existing:
        return report_dict(session, existing)  # idempotent, one per project

    metrics, aspect_values = _aggregate(session, project_id)
    previous = _select_previous(session, project)
    report = UtilizationReport(
        project_id=project_id, status="COMPLETED", score_version="UF_MVP_V1",
        source_revision=project.revision, previous_report_id=previous.id if previous else None,
    )
    session.add(report)
    session.flush()

    # Resource Efficiency needs the previous report's tokens-per-ai-task
    resource = _resource_efficiency(session, aspect_values, previous)
    aspect_values["RESOURCE_EFFICIENCY"] = resource

    for m in metrics:
        m.report_id = report.id
        session.add(m)

    report.score = _overall_score(aspect_values)

    # Rule-based feedback drafts grounded in the aggregated metrics (02 §6).
    metrics_map = {m.metric_key: m.value for m in metrics}
    for fb in feedback_gen.generate(aspect_values, metrics_map):
        session.add(Feedback(report_id=report.id, source="SYSTEM", **fb))

    session.flush()  # autoflush is off; make metrics queryable for serialization
    return report_dict(session, report)


def _aggregate(session: Session, project_id: str) -> tuple[list[UtilizationMetric], dict]:
    role_of = repo.role_code_map(session)
    tasks = repo.eligible_tasks(session, project_id)
    eligible = len(tasks)
    ai_completed = [t for t in tasks if t.status == "COMPLETED" and t.execution_mode == "AI_AGENT"]
    mixed = [t for t in tasks if t.status == "COMPLETED" and t.execution_mode == "MIXED"]
    ratio = (len(ai_completed) / eligible) if eligible else 0.0

    # area distribution over core areas
    core_completed = set()
    core_ai = set()
    for t in tasks:
        code = role_of.get(t.role_id or "")
        if code in repo.CORE_AREAS and t.status == "COMPLETED":
            core_completed.add(code)
            if t.execution_mode in ("AI_AGENT", "MIXED"):
                core_ai.add(code)

    tokens = repo.token_totals(session, project_id)
    ai_equiv = len(ai_completed) * 1.0 + len(mixed) * 0.5

    autonomy = (100.0 * len(ai_completed) / eligible) if eligible else None
    area = (100.0 * len(core_ai) / len(core_completed)) if core_completed else None

    metrics: list[UtilizationMetric] = [
        UtilizationMetric(aspect="AUTONOMY", metric_key="aiCompletedTaskCount", value=str(len(ai_completed))),
        UtilizationMetric(aspect="AUTONOMY", metric_key="eligibleTaskCount", value=str(eligible)),
        UtilizationMetric(aspect="AUTONOMY", metric_key="aiCompletedTaskRatio", value=f"{ratio:.4f}"),
        UtilizationMetric(aspect="AUTONOMY", metric_key="mixedTaskCount", value=str(len(mixed))),
        UtilizationMetric(aspect="AREA_DISTRIBUTION", metric_key="coreAreasCompleted", value=str(len(core_completed))),
        UtilizationMetric(aspect="AREA_DISTRIBUTION", metric_key="coreAreasWithAi", value=str(len(core_ai))),
        UtilizationMetric(aspect="RESOURCE_EFFICIENCY", metric_key="totalTokens",
                          value=str(tokens["total"]) if tokens["collected"] else "미수집",
                          collection_status="COLLECTED" if tokens["collected"] else "UNCOLLECTED"),
        UtilizationMetric(aspect="RESOURCE_EFFICIENCY", metric_key="aiEquivalentTasks", value=f"{ai_equiv:.2f}"),
        UtilizationMetric(aspect="RESOURCE_EFFICIENCY", metric_key="estimatedCost", value="미수집",
                          collection_status="UNCOLLECTED"),
        UtilizationMetric(aspect="AUTONOMY", metric_key="resolvedDecisions",
                          value=str(repo.resolved_decision_count(session, project_id))),
        UtilizationMetric(aspect="AUTONOMY", metric_key="planFeedbacks",
                          value=str(repo.plan_feedback_count(session, project_id))),
        UtilizationMetric(aspect="AUTONOMY", metric_key="revisionRequests",
                          value=str(repo.revision_request_count(session, project_id))),
    ]
    aspect_values = {
        "AUTONOMY": round(autonomy) if autonomy is not None else None,
        "AREA_DISTRIBUTION": round(area) if area is not None else None,
        # RESOURCE_EFFICIENCY computed after previous is known
        "_tokens_total": tokens["total"] if tokens["collected"] else None,
        "_ai_equiv": ai_equiv,
    }
    return metrics, aspect_values


def _tokens_per_ai_task(report: UtilizationReport, session: Session) -> float | None:
    metrics = session.execute(
        select(UtilizationMetric).where(UtilizationMetric.report_id == report.id)
    ).scalars()
    total = None
    equiv = None
    for m in metrics:
        if m.metric_key == "totalTokens" and m.collection_status == "COLLECTED":
            total = float(m.value)
        elif m.metric_key == "aiEquivalentTasks":
            equiv = float(m.value)
    if total is None or not equiv:
        return None
    return total / equiv


def _resource_efficiency(session: Session, aspect_values: dict, previous: UtilizationReport | None):
    cur_total = aspect_values.get("_tokens_total")
    equiv = aspect_values.get("_ai_equiv") or 0
    if cur_total is None or equiv <= 0:
        return None
    cur_per = cur_total / equiv
    if previous is None or cur_per <= 0:
        return None
    prev_per = _tokens_per_ai_task(previous, session)
    if not prev_per:
        return None
    return round(min(100.0, 100.0 * prev_per / cur_per))


def _overall_score(aspect_values: dict) -> int | None:
    valid = [
        v for k, v in aspect_values.items()
        if k in ("AUTONOMY", "AREA_DISTRIBUTION", "RESOURCE_EFFICIENCY") and v is not None
    ]
    if not valid:
        return None
    return round(sum(valid) / len(valid))


def _select_previous(session: Session, project: Project) -> UtilizationReport | None:
    reports = list(session.execute(select(UtilizationReport)).scalars())
    if not reports:
        return None
    # same-type first, completed earlier
    candidates = []
    for r in reports:
        if r.project_id == project.id:
            continue
        p = session.get(Project, r.project_id)
        if p is None or p.status != "COMPLETED":
            continue
        same_type = p.project_type == project.project_type
        earlier = (p.completed_at or "") < (project.completed_at or "")
        candidates.append((same_type, earlier, p.completed_at or "", r))
    if not candidates:
        return None
    same = [c for c in candidates if c[0] and c[1]]
    pool = same or candidates
    pool.sort(key=lambda c: c[2], reverse=True)
    return pool[0][3]


# --------------------------------------------------------------------------- reads
def report_dict(session: Session, r: UtilizationReport) -> dict:
    metrics = session.execute(
        select(UtilizationMetric).where(UtilizationMetric.report_id == r.id)
    ).scalars()
    return {
        "reportId": r.id, "projectId": r.project_id, "status": r.status,
        "utilizationScore": r.score, "scoreVersion": r.score_version,
        "previousReportId": r.previous_report_id,
        "metrics": {m.metric_key: m.value for m in metrics},
    }


def list_reports(session: Session, project_id: str) -> list[dict]:
    reports = session.execute(
        select(UtilizationReport).where(UtilizationReport.project_id == project_id)
    ).scalars()
    return [report_dict(session, r) for r in reports]


def get_report(session: Session, report_id: str) -> dict:
    r = session.get(UtilizationReport, report_id)
    if r is None:
        raise not_found("리포트를 찾을 수 없습니다.")
    return report_dict(session, r)


def get_metrics(session: Session, report_id: str) -> list[dict]:
    metrics = session.execute(
        select(UtilizationMetric).where(UtilizationMetric.report_id == report_id)
    ).scalars()
    return [
        {"aspect": m.aspect, "metricKey": m.metric_key, "value": m.value, "unit": m.unit,
         "roleCode": m.role_code, "collectionStatus": m.collection_status}
        for m in metrics
    ]


# --------------------------------------------------------------------------- feedback
def _require_completed_report(session: Session, report_id: str) -> UtilizationReport:
    r = session.get(UtilizationReport, report_id)
    if r is None:
        raise not_found("리포트를 찾을 수 없습니다.")
    project = session.get(Project, r.project_id)
    if project is None or project.status != "COMPLETED":
        raise conflict("완료된 프로젝트의 리포트에만 Feedback을 남길 수 있습니다.", code="PROJECT_NOT_COMPLETED")
    return r


def list_feedbacks(session: Session, report_id: str) -> list[dict]:
    fbs = session.execute(select(Feedback).where(Feedback.report_id == report_id)).scalars()
    return [feedback_dict(f) for f in fbs]


def create_feedback(session: Session, report_id: str, data: dict) -> dict:
    _require_completed_report(session, report_id)
    f = Feedback(
        report_id=report_id, aspect=data.get("aspect", "AUTONOMY"),
        severity=data.get("severity", "LOW"), observation=data.get("observation", ""),
        impact=data.get("impact", ""), suggestion=data.get("suggestion", ""),
        source="USER",
    )
    session.add(f)
    session.flush()
    return feedback_dict(f)


def update_feedback(session: Session, feedback_id: str, data: dict) -> dict:
    f = session.get(Feedback, feedback_id)
    if f is None:
        raise not_found("Feedback을 찾을 수 없습니다.")
    _require_completed_report(session, f.report_id)
    for k in ("aspect", "severity", "observation", "impact", "suggestion"):
        if k in data and data[k] is not None:
            setattr(f, k, data[k])
    f.updated_at = utcnow_iso()
    return feedback_dict(f)


def feedback_dict(f: Feedback) -> dict:
    return {
        "feedbackId": f.id, "reportId": f.report_id, "aspect": f.aspect, "severity": f.severity,
        "observation": f.observation, "impact": f.impact, "suggestion": f.suggestion,
        "source": f.source,
    }
