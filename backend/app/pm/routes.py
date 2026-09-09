"""PM HTTP routes (01 §5, 06 §4.1). Reads/queries and management mutations.
Execution-state transitions are NOT here (orchestrator owns them)."""
from __future__ import annotations

from fastapi import APIRouter, Query
from sqlalchemy import select

from ..common.models import LlmModel, Role, RoleDocumentTemplate
from ..common.txn import mutate, read
from . import schemas as s
from . import service

router = APIRouter(prefix="/api", tags=["pm"])


# ---- metadata ----
@router.get("/roles")
def list_roles():
    return read(lambda db: [
        {"id": r.id, "code": r.code, "name": r.name,
         "isRequiredForProject": bool(r.is_required_for_project)}
        for r in db.execute(select(Role)).scalars()
    ])


@router.get("/llm-models")
def list_llm_models():
    return read(lambda db: [
        {"id": m.id, "provider": m.provider, "modelName": m.model_name,
         "displayName": m.display_name, "grade": m.grade, "isActive": bool(m.is_active)}
        for m in db.execute(select(LlmModel)).scalars()
    ])


@router.get("/role-document-templates")
def list_role_document_templates(roleCode: str | None = Query(None)):
    def op(db):
        stmt = select(RoleDocumentTemplate)
        if roleCode:
            role = db.execute(select(Role).where(Role.code == roleCode)).scalars().first()
            if role:
                stmt = stmt.where(RoleDocumentTemplate.role_id == role.id)
        return [
            {"id": t.id, "roleId": t.role_id, "fileName": t.file_name,
             "isRequired": bool(t.is_required)} for t in db.execute(stmt).scalars()
        ]
    return read(op)


# ---- projects ----
@router.post("/projects")
def create_project(body: s.CreateProjectIn):
    return mutate(lambda db: service.create_project(db, body.model_dump()))


@router.get("/projects")
def list_projects(status: str | None = None, keyword: str | None = None):
    return read(lambda db: service.list_projects(db, status=status, keyword=keyword))


@router.get("/projects/{project_id}")
def get_project(project_id: str):
    return read(lambda db: service.get_project(db, project_id))


@router.patch("/projects/{project_id}")
def update_project(project_id: str, body: s.UpdateProjectIn):
    return mutate(lambda db: service.update_project(db, project_id, body.model_dump(exclude_none=True)))


@router.post("/projects/{project_id}/archive")
def archive_project(project_id: str):
    return mutate(lambda db: service.archive_project(db, project_id))


# ---- agent profiles ----
@router.post("/agent-profiles")
def create_profile(body: s.CreateProfileIn):
    return mutate(lambda db: service.create_agent_profile(db, body.model_dump()))


@router.get("/agent-profiles")
def list_profiles(roleCode: str | None = None, isActive: bool | None = None):
    return read(lambda db: service.list_agent_profiles(db, role_code=roleCode, is_active=isActive))


@router.patch("/agent-profiles/{profile_id}")
def update_profile(profile_id: str, body: s.UpdateProfileIn):
    return mutate(lambda db: service.update_agent_profile(db, profile_id, body.model_dump(exclude_none=True)))


@router.post("/agent-profiles/{profile_id}/deactivate")
def deactivate_profile(profile_id: str):
    return mutate(lambda db: service.deactivate_agent_profile(db, profile_id))


# ---- matching / assignment ----
@router.post("/projects/{project_id}/agent-recommendations")
def recommend(project_id: str, body: s.RecommendIn):
    return mutate(lambda db: service.recommend_agents(db, project_id, body.model_dump(exclude_none=True)))


@router.post("/projects/{project_id}/agents")
def assign(project_id: str, body: s.AssignIn):
    return mutate(lambda db: service.assign_agents(db, project_id, body.model_dump()))


@router.post("/projects/{project_id}/agents/hire")
def hire(project_id: str, body: s.HireIn):
    return mutate(lambda db: service.hire_one_agent(db, project_id, body.model_dump(exclude_none=True)))


@router.get("/projects/{project_id}/agents")
def list_agents(project_id: str):
    return read(lambda db: service.list_project_agents(db, project_id))


@router.patch("/projects/{project_id}/agents/{agent_id}")
def replace_agent(project_id: str, agent_id: str, body: s.ReplaceAgentIn):
    return mutate(lambda db: service.replace_project_agent(db, project_id, agent_id, body.model_dump(exclude_none=True)))


@router.delete("/projects/{project_id}/agents/{agent_id}")
def remove_agent(project_id: str, agent_id: str):
    return mutate(lambda db: service.remove_project_agent(db, project_id, agent_id))


# ---- milestones ----
@router.post("/projects/{project_id}/sprint-milestones")
def create_milestone(project_id: str, body: s.CreateMilestoneIn):
    return mutate(lambda db: service.create_milestone(db, project_id, body.model_dump()))


@router.get("/projects/{project_id}/sprint-milestones")
def list_milestones(project_id: str):
    return read(lambda db: service.list_milestones(db, project_id))


@router.patch("/projects/{project_id}/sprint-milestones/{milestone_id}")
def update_milestone(project_id: str, milestone_id: str, body: s.UpdateMilestoneIn):
    return mutate(lambda db: service.update_milestone(db, project_id, milestone_id, body.model_dump(exclude_none=True)))


@router.post("/projects/{project_id}/sprint-milestones/{milestone_id}/agents")
def link_agent_milestone(project_id: str, milestone_id: str, body: s.LinkAgentMilestoneIn):
    return mutate(lambda db: service.link_agent_milestone(db, project_id, milestone_id, body.model_dump()))


# ---- tasks ----
@router.post("/projects/{project_id}/tasks")
def create_task(project_id: str, body: s.CreateTaskIn):
    return mutate(lambda db: service.create_task(db, project_id, body.model_dump()))


@router.get("/projects/{project_id}/tasks")
def list_tasks(project_id: str, sprintMilestoneId: str | None = None, status: str | None = None):
    return read(lambda db: service.list_tasks(db, project_id, sprintMilestoneId=sprintMilestoneId, status=status))


@router.patch("/projects/{project_id}/tasks/{task_id}")
def update_task(project_id: str, task_id: str, body: s.UpdateTaskIn):
    return mutate(lambda db: service.update_task(db, project_id, task_id, body.model_dump(exclude_none=True)))


@router.patch("/projects/{project_id}/tasks/{task_id}/milestone")
def move_task(project_id: str, task_id: str, body: s.MoveTaskIn):
    return mutate(lambda db: service.move_task_milestone(db, project_id, task_id, body.model_dump()))
