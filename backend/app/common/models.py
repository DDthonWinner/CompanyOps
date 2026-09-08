"""SQLAlchemy models for U1 (backend-pm). Conventions per 06 §1:
DB snake_case, enums UPPER_SNAKE_CASE via CHECK, UUID as TEXT, BOOLEAN as INTEGER 0/1,
DATETIME as ISO 8601 TEXT, arrays/JSON as TEXT.
"""
from __future__ import annotations

from sqlalchemy import (
    CheckConstraint,
    Column,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)

from ..db import Base, JSONDict, JSONList
from .util import new_uuid, utcnow_iso


def _id():
    return Column(String, primary_key=True, default=new_uuid)


def _ts():
    return Column(String, nullable=False, default=utcnow_iso)


# --------------------------------------------------------------------------- PM
class Project(Base):
    __tablename__ = "projects"
    id = _id()
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=False, default="")
    project_type = Column(String(50))
    budget_level = Column(String, nullable=False)
    budget_amount = Column(Integer, nullable=False)
    project_size = Column(String, nullable=False)
    desired_agent_count = Column(Integer)
    recommended_agent_count = Column(Integer)
    max_agent_count = Column(Integer, nullable=False)
    status = Column(String, nullable=False, default="DRAFT")
    # 06 supplemental execution fields
    revision = Column(Integer, nullable=False, default=0)
    active_plan_id = Column(String)
    active_plan_version = Column(Integer)
    completed_at = Column(String)
    created_by = Column(String(100))
    created_at = _ts()
    updated_at = _ts()
    __table_args__ = (
        CheckConstraint("budget_level IN ('HIGH','MEDIUM','LOW')", name="ck_project_budget"),
        CheckConstraint("project_size IN ('SMALL','MEDIUM','LARGE')", name="ck_project_size"),
        CheckConstraint(
            "status IN ('DRAFT','AGENT_MATCHING','READY','ACTIVE','COMPLETED','ARCHIVED')",
            name="ck_project_status",
        ),
    )


class GitRepository(Base):
    __tablename__ = "git_repositories"
    id = _id()
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, unique=True)
    provider = Column(String, nullable=False, default="GITHUB")
    repository_url = Column(String, nullable=False)
    default_branch = Column(String(100), default="main")
    access_scope = Column(String, default="READ_WRITE")
    created_at = _ts()
    updated_at = _ts()


class Role(Base):
    __tablename__ = "roles"
    id = _id()
    code = Column(String(50), nullable=False, unique=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    is_required_for_project = Column(Integer, nullable=False, default=0)
    created_at = _ts()
    updated_at = _ts()


class LlmModel(Base):
    __tablename__ = "llm_models"
    id = _id()
    provider = Column(String(50), nullable=False)
    model_name = Column(String(100), nullable=False)
    display_name = Column(String(100), nullable=False)
    grade = Column(String, nullable=False)
    is_active = Column(Integer, nullable=False, default=1)
    created_at = _ts()
    updated_at = _ts()
    __table_args__ = (
        UniqueConstraint("provider", "model_name", name="ux_llm_provider_model"),
        CheckConstraint("grade IN ('BASIC','STANDARD','ADVANCED')", name="ck_llm_grade"),
    )


class AgentProfile(Base):
    __tablename__ = "agent_profiles"
    id = _id()
    name = Column(String(100), nullable=False)
    role_id = Column(String, ForeignKey("roles.id"), nullable=False)
    default_llm_model_id = Column(String, ForeignKey("llm_models.id"), nullable=False)
    skill_level = Column(String, nullable=False)
    description = Column(Text)
    default_md_template = Column(String(255))
    default_color = Column(String(20))
    default_icon_key = Column(String(50))
    is_active = Column(Integer, nullable=False, default=1)
    created_at = _ts()
    updated_at = _ts()
    __table_args__ = (
        CheckConstraint("skill_level IN ('JUNIOR','MID','SENIOR')", name="ck_profile_skill"),
    )


class ProjectAgent(Base):
    __tablename__ = "project_agents"
    id = _id()
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    agent_profile_id = Column(String, ForeignKey("agent_profiles.id"), nullable=False)
    role_id = Column(String, ForeignKey("roles.id"), nullable=False)
    llm_model_id = Column(String, ForeignKey("llm_models.id"), nullable=False)
    display_name = Column(String(100), nullable=False)
    display_color = Column(String(20), nullable=False)
    icon_key = Column(String(50), nullable=False)
    assignment_reason = Column(Text)
    status = Column(String, nullable=False, default="ASSIGNED")
    is_primary_pm = Column(Integer, nullable=False, default=0)
    # 06 supplemental
    current_task_id = Column(String)
    next_task_id = Column(String)
    activity_summary = Column(Text)
    created_at = _ts()
    updated_at = _ts()
    __table_args__ = (
        UniqueConstraint("project_id", "agent_profile_id", name="ux_project_profile"),
        CheckConstraint(
            "status IN ('ASSIGNED','IDLE','WORKING','WAITING','BLOCKED','REMOVED')",
            name="ck_agent_status",
        ),
    )


class RoleDocumentTemplate(Base):
    __tablename__ = "role_document_templates"
    id = _id()
    role_id = Column(String, ForeignKey("roles.id"), nullable=False)
    file_name = Column(String(100), nullable=False)
    description = Column(Text)
    is_required = Column(Integer, nullable=False, default=0)
    created_at = _ts()
    updated_at = _ts()


class ProjectAgentDocument(Base):
    __tablename__ = "project_agent_documents"
    id = _id()
    project_agent_id = Column(String, ForeignKey("project_agents.id"), nullable=False)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    role_document_template_id = Column(String, ForeignKey("role_document_templates.id"))
    file_path = Column(String(255), nullable=False)
    document_type = Column(String(50))
    status = Column(String, nullable=False, default="PLANNED")
    created_at = _ts()
    updated_at = _ts()
    __table_args__ = (
        UniqueConstraint("project_id", "file_path", name="ux_project_docpath"),
    )


class SprintMilestone(Base):
    __tablename__ = "sprint_milestones"
    id = _id()
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    title = Column(String(150), nullable=False)
    role_id = Column(String, ForeignKey("roles.id"))
    display_color = Column(String(20))
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = _ts()
    updated_at = _ts()
    # status/progress are DERIVED (not stored) — see progress.py


class ProjectAgentMilestone(Base):
    __tablename__ = "project_agent_milestones"
    id = _id()
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    project_agent_id = Column(String, ForeignKey("project_agents.id"), nullable=False)
    sprint_milestone_id = Column(String, ForeignKey("sprint_milestones.id"), nullable=False)
    responsibility_type = Column(String, nullable=False, default="OWNER")
    created_at = _ts()
    updated_at = _ts()
    __table_args__ = (
        UniqueConstraint(
            "project_agent_id", "sprint_milestone_id", "responsibility_type",
            name="ux_agent_milestone_resp",
        ),
        CheckConstraint(
            "responsibility_type IN ('OWNER','CONTRIBUTOR','REVIEWER')", name="ck_resp_type"
        ),
    )


class ProjectTask(Base):
    __tablename__ = "project_tasks"
    id = _id()
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    sprint_milestone_id = Column(String, ForeignKey("sprint_milestones.id"))
    assigned_project_agent_id = Column(String, ForeignKey("project_agents.id"))
    role_id = Column(String, ForeignKey("roles.id"))
    title = Column(String(150), nullable=False)
    description = Column(Text)
    status = Column(String, nullable=False, default="TODO")
    execution_mode = Column(String)  # AI_AGENT / HUMAN / MIXED / null
    priority = Column(String, nullable=False, default="MEDIUM")
    sort_order = Column(Integer, nullable=False, default=0)
    # 06 supplemental
    requirement_ids = Column(JSONList, default=list)
    dependency_task_ids = Column(JSONList, default=list)
    approved_plan_id = Column(String)
    approved_plan_version = Column(Integer)
    current_attempt_id = Column(String)
    wait_reasons = Column(JSONList, default=list)
    revision = Column(Integer, nullable=False, default=0)
    created_at = _ts()
    updated_at = _ts()
    __table_args__ = (
        CheckConstraint(
            "status IN ('TODO','RUNNING','WAITING','BLOCKED','REVIEW','COMPLETED','FAILED','CANCELLED')",
            name="ck_task_status",
        ),
        CheckConstraint(
            "execution_mode IS NULL OR execution_mode IN ('AI_AGENT','HUMAN','MIXED')",
            name="ck_task_execmode",
        ),
        CheckConstraint(
            "priority IN ('LOW','MEDIUM','HIGH','CRITICAL')", name="ck_task_priority"
        ),
    )


# ------------------------------------------------------------------ Orchestration
class PlanVersion(Base):
    __tablename__ = "plan_versions"
    id = _id()
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    version = Column(Integer, nullable=False, default=1)
    request = Column(Text)
    steps = Column(JSONList, default=list)
    agents = Column(JSONList, default=list)
    scope = Column(JSONDict, default=dict)
    dependencies = Column(JSONList, default=list)
    validation = Column(JSONDict, default=dict)
    impact = Column(JSONDict, default=dict)
    status = Column(String, nullable=False, default="REVIEW")
    created_at = _ts()
    updated_at = _ts()
    __table_args__ = (
        CheckConstraint(
            "status IN ('REVIEW','FINAL_APPROVAL_PENDING','APPROVED_WAITING','EXECUTING','COMPLETED','SUPERSEDED')",
            name="ck_plan_status",
        ),
    )


class PlanFeedback(Base):
    __tablename__ = "plan_feedback"
    id = _id()
    plan_id = Column(String, ForeignKey("plan_versions.id"), nullable=False)
    plan_version = Column(Integer, nullable=False)
    text = Column(Text, nullable=False, default="")
    created_at = _ts()


class Decision(Base):
    __tablename__ = "decisions"
    id = _id()
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    scope_task_ids = Column(JSONList, default=list)
    reason = Column(Text)
    options = Column(JSONList, default=list)
    selected_answer = Column(Text)
    status = Column(String, nullable=False, default="OPEN")
    resolved_at = Column(String)
    created_at = _ts()
    __table_args__ = (
        CheckConstraint("status IN ('OPEN','RESOLVED')", name="ck_decision_status"),
    )


class Approval(Base):
    __tablename__ = "approvals"
    id = _id()
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    kind = Column(String, nullable=False)
    target_id = Column(String, nullable=False)
    target_version = Column(Integer, nullable=False)
    status = Column(String, nullable=False, default="APPROVED")
    actor = Column(String, default="operator")
    request_id = Column(String)
    created_at = _ts()
    __table_args__ = (
        CheckConstraint(
            "kind IN ('PLAN_EXECUTION','MILESTONE_RESULT')", name="ck_approval_kind"
        ),
    )


class TaskAttempt(Base):
    __tablename__ = "task_attempts"
    id = _id()
    task_id = Column(String, ForeignKey("project_tasks.id"), nullable=False)
    sequence = Column(Integer, nullable=False, default=1)
    artifact_version = Column(Integer)
    started_at = _ts()
    ended_at = Column(String)
    failure_reason = Column(Text)


class ArtifactVersion(Base):
    __tablename__ = "artifact_versions"
    id = _id()
    task_id = Column(String, ForeignKey("project_tasks.id"), nullable=False)
    attempt_id = Column(String, ForeignKey("task_attempts.id"))
    version = Column(Integer, nullable=False, default=1)
    generation_status = Column(String, nullable=False, default="GENERATED")
    file_paths = Column(JSONList, default=list)
    base_commit_sha = Column(String)
    content_hash = Column(String)
    created_at = _ts()
    __table_args__ = (
        CheckConstraint(
            "generation_status IN ('GENERATING','GENERATED','FAILED')",
            name="ck_artifact_genstatus",
        ),
    )


class QARun(Base):
    __tablename__ = "qa_runs"
    id = _id()
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    task_id = Column(String, ForeignKey("project_tasks.id"))
    target_artifact_version = Column(Integer)
    target_hash = Column(String)
    scope = Column(Text)
    results = Column(JSONDict, default=dict)  # {total,passed,failed,skipped}
    evidence = Column(Text)
    run_status = Column(String, nullable=False, default="QUEUED")
    technical_gate = Column(String, nullable=False, default="PENDING")
    report_artifact_id = Column(String)
    demo = Column(Integer, nullable=False, default=0)
    started_at = _ts()
    ended_at = Column(String)
    __table_args__ = (
        CheckConstraint(
            "run_status IN ('QUEUED','RUNNING','COMPLETED','ERROR')", name="ck_qa_runstatus"
        ),
        CheckConstraint(
            "technical_gate IN ('PENDING','PASSED','FAILED','ERROR')", name="ck_qa_gate"
        ),
    )


class TestResult(Base):
    __tablename__ = "test_results"
    id = _id()
    qa_run_id = Column(String, ForeignKey("qa_runs.id"), nullable=False)
    name = Column(String(150), nullable=False)
    result = Column(String, nullable=False, default="PASS")
    evidence = Column(Text)
    __table_args__ = (
        CheckConstraint("result IN ('PASS','FAIL','SKIPPED')", name="ck_testresult"),
    )


class MilestoneResult(Base):
    __tablename__ = "milestone_results"
    id = _id()
    milestone_id = Column(String, ForeignKey("sprint_milestones.id"), nullable=False)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    version = Column(Integer, nullable=False, default=1)
    result_hash = Column(String, nullable=False)
    snapshot = Column(JSONDict, default=dict)  # task/artifact/qa/commit lists
    review_status = Column(String, nullable=False, default="PENDING")
    additional_validation = Column(String, nullable=False, default="UNANSWERED")
    created_at = _ts()
    __table_args__ = (
        CheckConstraint(
            "review_status IN ('NOT_REQUIRED','PENDING','APPROVED','REVISION_REQUESTED','REJECTED')",
            name="ck_mr_review",
        ),
        CheckConstraint(
            "additional_validation IN ('UNANSWERED','NONE','REQUESTED')", name="ck_mr_addval"
        ),
    )


class TaskPublish(Base):
    __tablename__ = "task_publishes"
    id = _id()
    task_id = Column(String, ForeignKey("project_tasks.id"), nullable=False)
    attempt_id = Column(String)
    artifact_version = Column(Integer)
    request_id = Column(String)
    status = Column(String, nullable=False, default="NOT_STARTED")
    commit_sha = Column(String)
    branch_url = Column(String)
    error = Column(Text)
    created_at = _ts()
    __table_args__ = (
        CheckConstraint(
            "status IN ('NOT_STARTED','NO_CHANGES','COMMITTED_LOCAL','PUSHED','FAILED','SYNC_REQUIRED')",
            name="ck_publish_status",
        ),
    )


class TokenUsage(Base):
    """Per model-call token record (06 §3.1). Written by the worker at execution time;
    aggregated read-only into the snapshot (project / agent / task / role)."""

    __tablename__ = "token_usage"
    id = _id()
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    task_id = Column(String, ForeignKey("project_tasks.id"))
    project_agent_id = Column(String, ForeignKey("project_agents.id"))
    role_code = Column(String)
    stage = Column(String, nullable=False, default="EXECUTION")
    input_tokens = Column(Integer)
    output_tokens = Column(Integer)
    total_tokens = Column(Integer)
    demo = Column(Integer, nullable=False, default=0)
    measured_at = _ts()


# ------------------------------------------------------------------ Platform
class ActivityEvent(Base):
    __tablename__ = "activity_events"
    id = _id()
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    revision = Column(Integer, nullable=False)
    type = Column(String, nullable=False)
    entity_id = Column(String)
    payload = Column(JSONDict, default=dict)
    occurred_at = _ts()


class CommandReceipt(Base):
    __tablename__ = "command_receipts"
    request_id = Column(String, primary_key=True)
    payload_hash = Column(String, nullable=False)
    operation = Column(String, nullable=False)
    accepted = Column(Integer, nullable=False, default=1)
    result = Column(JSONDict, default=dict)
    error = Column(Text)
    created_at = _ts()
