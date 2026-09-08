"""UF-owned SQLAlchemy models (06 §3.1). Conventions per 06 §1."""
from __future__ import annotations

from sqlalchemy import CheckConstraint, Column, ForeignKey, Integer, String, Text

from ..db import Base
from ..common.util import new_uuid, utcnow_iso


def _id():
    return Column(String, primary_key=True, default=new_uuid)


class UtilizationReport(Base):
    __tablename__ = "utilization_reports"
    id = _id()
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)  # one per project
    status = Column(String, nullable=False, default="COMPLETED")
    score = Column(Integer)  # nullable = N/A
    score_version = Column(String, nullable=False, default="UF_MVP_V1")
    previous_report_id = Column(String, ForeignKey("utilization_reports.id"))
    source_revision = Column(Integer)
    created_at = Column(String, nullable=False, default=utcnow_iso)


class UtilizationMetric(Base):
    __tablename__ = "utilization_metrics"
    id = _id()
    report_id = Column(String, ForeignKey("utilization_reports.id"), nullable=False)
    aspect = Column(String, nullable=False)
    metric_key = Column(String, nullable=False)
    value = Column(String)  # numeric-as-text or "미수집"
    unit = Column(String)
    role_code = Column(String)
    collection_status = Column(String, nullable=False, default="COLLECTED")
    measured_at = Column(String, nullable=False, default=utcnow_iso)
    __table_args__ = (
        CheckConstraint(
            "aspect IN ('AUTONOMY','RESOURCE_EFFICIENCY','AREA_DISTRIBUTION')",
            name="ck_metric_aspect",
        ),
        CheckConstraint(
            "collection_status IN ('COLLECTED','UNCOLLECTED')", name="ck_metric_collection"
        ),
    )


class Feedback(Base):
    __tablename__ = "feedbacks"
    id = _id()
    report_id = Column(String, ForeignKey("utilization_reports.id"), nullable=False)
    aspect = Column(String, nullable=False)
    severity = Column(String, nullable=False, default="LOW")
    observation = Column(Text, nullable=False, default="")
    impact = Column(Text, nullable=False, default="")
    suggestion = Column(Text, nullable=False, default="")
    created_at = Column(String, nullable=False, default=utcnow_iso)
    updated_at = Column(String, nullable=False, default=utcnow_iso)
    __table_args__ = (
        CheckConstraint(
            "aspect IN ('AUTONOMY','RESOURCE_EFFICIENCY','AREA_DISTRIBUTION')",
            name="ck_feedback_aspect",
        ),
        CheckConstraint("severity IN ('HIGH','MEDIUM','LOW')", name="ck_feedback_severity"),
    )
