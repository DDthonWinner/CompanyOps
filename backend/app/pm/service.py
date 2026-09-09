"""PM service: projects, profiles, agents, milestones, tasks, recommendation.
Business rules per 01 §7 / 00 §7 (see business-rules.md). All mutations run inside a
caller-provided Session and call platform.touch() to bump revision + queue SSE.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..common import platform, progress
from ..common.errors import bad_request, conflict, not_found
from ..common.models import (
    AgentProfile,
    GitRepository,
    LlmModel,
    Project,
    ProjectAgent,
    ProjectAgentDocument,
    ProjectAgentMilestone,
    ProjectTask,
    Role,
    RoleDocumentTemplate,
    SprintMilestone,
)
from ..common.util import utcnow_iso
from ..config import get_settings
from . import recommendation as rec

_HEX = None  # validated lightly below


# --------------------------------------------------------------------------- helpers
def _role_by_code(session: Session, code: str) -> Role:
    role = session.execute(select(Role).where(Role.code == code)).scalars().first()
    if role is None:
        raise bad_request(f"알 수 없는 역할 코드: {code}", code="UNKNOWN_ROLE")
    return role


def _require_project(session: Session, project_id: str) -> Project:
    p = session.get(Project, project_id)
    if p is None:
        raise not_found(f"프로젝트를 찾을 수 없습니다: {project_id}")
    return p


def _valid_hex(color: str) -> bool:
    return isinstance(color, str) and len(color) == 7 and color[0] == "#"


def project_dict(session: Session, p: Project) -> dict:
    repo = session.execute(
        select(GitRepository).where(GitRepository.project_id == p.id)
    ).scalars().first()
    agents = list(session.execute(
        select(ProjectAgent).where(ProjectAgent.project_id == p.id)
    ).scalars())
    assigned = [a for a in agents if a.status != "REMOVED"]
    return {
        "id": p.id, "name": p.name, "description": p.description, "projectType": p.project_type,
        "budgetLevel": p.budget_level, "budgetAmount": p.budget_amount,
        "projectSize": p.project_size, "desiredAgentCount": p.desired_agent_count,
        "recommendedAgentCount": p.recommended_agent_count, "maxAgentCount": p.max_agent_count,
        "status": p.status, "assignedAgentCount": len(assigned),
        "hasPrimaryPm": any(a.is_primary_pm and a.status != "REMOVED" for a in agents),
        "revision": p.revision, "completedAt": p.completed_at,
        "repositoryUrl": repo.repository_url if repo else None,
        "createdAt": p.created_at, "updatedAt": p.updated_at,
    }


def agent_dict(a: ProjectAgent) -> dict:
    return {
        "id": a.id, "projectId": a.project_id, "agentProfileId": a.agent_profile_id,
        "roleId": a.role_id, "llmModelId": a.llm_model_id, "displayName": a.display_name,
        "displayColor": a.display_color, "iconKey": a.icon_key, "status": a.status,
        "isPrimaryPm": bool(a.is_primary_pm), "assignmentReason": a.assignment_reason,
    }


# --------------------------------------------------------------------------- projects
def create_project(session: Session, data: dict) -> dict:
    name = (data.get("name") or "").strip()
    if not name:
        raise bad_request("프로젝트명은 비어 있을 수 없습니다.", code="INVALID_NAME")
    budget_level = data.get("budgetLevel")
    if budget_level not in rec.BUDGET_TABLE:
        raise bad_request("budgetLevel은 HIGH/MEDIUM/LOW 중 하나여야 합니다.", code="INVALID_BUDGET")
    size = data.get("projectSize")
    if size not in ("SMALL", "MEDIUM", "LARGE"):
        raise bad_request("projectSize는 SMALL/MEDIUM/LARGE 중 하나여야 합니다.", code="INVALID_SIZE")

    amount, default_cap = rec.budget_defaults(budget_level)
    max_cap = data.get("maxAgentCount") or default_cap
    if max_cap > default_cap:
        raise bad_request(
            f"maxAgentCount는 예산 단계 기본 최대치({default_cap})를 초과할 수 없습니다.",
            code="CAP_EXCEEDS_BUDGET",
        )
    if max_cap < 1:
        raise bad_request("maxAgentCount는 1 이상이어야 합니다.", code="INVALID_CAP")

    desired = data.get("desiredAgentCount")
    if desired is not None and desired > max_cap:
        raise bad_request("desiredAgentCount가 maxAgentCount를 초과합니다.", code="DESIRED_EXCEEDS_CAP")
    recommended, _roles = rec.recommended_size(size, budget_level)
    recommended = min(recommended, max_cap)

    p = Project(
        name=name, description=data.get("description", ""), project_type=data.get("projectType"),
        budget_level=budget_level, budget_amount=amount, project_size=size,
        desired_agent_count=desired, recommended_agent_count=recommended,
        max_agent_count=max_cap, status="AGENT_MATCHING",
    )
    session.add(p)
    session.flush()

    git = (data.get("gitRepository") or {})
    session.add(GitRepository(
        project_id=p.id, provider=git.get("provider", "GITHUB"),
        repository_url=git.get("repositoryUrl") or get_settings().git_remote,
        default_branch=git.get("defaultBranch", "main"),
        access_scope=git.get("accessScope", "READ_WRITE"),
    ))
    platform.touch(session, p.id, "project.updated", p.id)
    return project_dict(session, p)


def list_projects(session: Session, status: str | None = None, keyword: str | None = None) -> dict:
    stmt = select(Project)
    if status:
        stmt = stmt.where(Project.status == status)
    if keyword:
        stmt = stmt.where(Project.name.contains(keyword))
    items = list(session.execute(stmt.order_by(Project.created_at.desc())).scalars())
    return {"items": [project_dict(session, p) for p in items], "total": len(items)}


def get_project(session: Session, project_id: str) -> dict:
    p = _require_project(session, project_id)
    detail = project_dict(session, p)
    detail["agents"] = list_project_agents(session, project_id)
    detail["milestones"] = list_milestones(session, project_id)
    return detail


def update_project(session: Session, project_id: str, patch: dict) -> dict:
    p = _require_project(session, project_id)
    if "maxAgentCount" in patch and patch["maxAgentCount"] is not None:
        new_cap = patch["maxAgentCount"]
        assigned = session.execute(
            select(ProjectAgent).where(
                ProjectAgent.project_id == project_id, ProjectAgent.status != "REMOVED"
            )
        ).scalars().all()
        if new_cap < len(assigned):
            raise conflict("현재 배정 수보다 낮은 정원으로 변경할 수 없습니다.", code="CAP_BELOW_ASSIGNED")
        _, default_cap = rec.budget_defaults(p.budget_level)
        if new_cap > default_cap:
            raise bad_request("예산 단계 기본 최대치를 초과할 수 없습니다.", code="CAP_EXCEEDS_BUDGET")
        p.max_agent_count = new_cap
    for field, col in (("description", "description"), ("projectType", "project_type"),
                       ("desiredAgentCount", "desired_agent_count")):
        if field in patch and patch[field] is not None:
            setattr(p, col, patch[field])
    p.updated_at = utcnow_iso()
    platform.touch(session, p.id, "project.updated", p.id)
    return project_dict(session, p)


def archive_project(session: Session, project_id: str) -> dict:
    p = _require_project(session, project_id)
    p.status = "ARCHIVED"
    p.updated_at = utcnow_iso()
    platform.touch(session, p.id, "project.updated", p.id)
    return project_dict(session, p)


# --------------------------------------------------------------------------- profiles
def create_agent_profile(session: Session, data: dict) -> dict:
    role = _role_by_code(session, data["roleCode"])
    model = session.get(LlmModel, data["defaultLlmModelId"])
    if model is None or not model.is_active:
        raise bad_request("유효하지 않거나 비활성 LLM 모델입니다.", code="INVALID_MODEL")
    prof = AgentProfile(
        name=data["name"], role_id=role.id, default_llm_model_id=model.id,
        skill_level=data.get("skillLevel", "MID"), description=data.get("description"),
        default_md_template=data.get("defaultMdTemplate"),
        default_color=data.get("defaultColor"), default_icon_key=data.get("defaultIconKey"),
        is_active=1,
    )
    session.add(prof)
    session.flush()
    return profile_dict(session, prof)


def profile_dict(session: Session, prof: AgentProfile) -> dict:
    role = session.get(Role, prof.role_id)
    model = session.get(LlmModel, prof.default_llm_model_id)
    return {
        "id": prof.id, "name": prof.name,
        "role": {"code": role.code, "name": role.name} if role else None,
        "skillLevel": prof.skill_level,
        "defaultLlmModel": {"id": model.id, "displayName": model.display_name} if model else None,
        "defaultColor": prof.default_color, "defaultIconKey": prof.default_icon_key,
        "isActive": bool(prof.is_active),
    }


def list_agent_profiles(session: Session, role_code: str | None = None, is_active: bool | None = None) -> list[dict]:
    stmt = select(AgentProfile)
    if role_code:
        role = _role_by_code(session, role_code)
        stmt = stmt.where(AgentProfile.role_id == role.id)
    if is_active is not None:
        stmt = stmt.where(AgentProfile.is_active == (1 if is_active else 0))
    return [profile_dict(session, p) for p in session.execute(stmt).scalars()]


def update_agent_profile(session: Session, profile_id: str, patch: dict) -> dict:
    prof = session.get(AgentProfile, profile_id)
    if prof is None:
        raise not_found("Agent Profile을 찾을 수 없습니다.")
    for field, col in (("name", "name"), ("description", "description"),
                       ("skillLevel", "skill_level"), ("defaultMdTemplate", "default_md_template"),
                       ("defaultColor", "default_color"), ("defaultIconKey", "default_icon_key")):
        if field in patch and patch[field] is not None:
            setattr(prof, col, patch[field])
    if patch.get("defaultLlmModelId"):
        model = session.get(LlmModel, patch["defaultLlmModelId"])
        if model is None or not model.is_active:
            raise bad_request("유효하지 않거나 비활성 LLM 모델입니다.", code="INVALID_MODEL")
        prof.default_llm_model_id = model.id
    prof.updated_at = utcnow_iso()
    return profile_dict(session, prof)


def deactivate_agent_profile(session: Session, profile_id: str) -> dict:
    prof = session.get(AgentProfile, profile_id)
    if prof is None:
        raise not_found("Agent Profile을 찾을 수 없습니다.")
    prof.is_active = 0
    prof.updated_at = utcnow_iso()
    return profile_dict(session, prof)


# --------------------------------------------------------------------------- recommendation
def _best_profile(session: Session, role_code: str, budget_level: str) -> AgentProfile | None:
    role = _role_by_code(session, role_code)
    profiles = list(session.execute(
        select(AgentProfile).where(
            AgentProfile.role_id == role.id, AgentProfile.is_active == 1
        )
    ).scalars())
    if not profiles:
        return None
    pref = rec.PREFERENCE[budget_level]

    def rank(p: AgentProfile) -> tuple[int, int]:
        model = session.get(LlmModel, p.default_llm_model_id)
        skill_rank = pref["skill"].index(p.skill_level) if p.skill_level in pref["skill"] else 9
        grade_rank = pref["grade"].index(model.grade) if model and model.grade in pref["grade"] else 9
        return (skill_rank, grade_rank)

    return sorted(profiles, key=rank)[0]


def recommend_agents(session: Session, project_id: str, req: dict) -> dict:
    p = _require_project(session, project_id)
    desired = req.get("desiredAgentCount") or p.desired_agent_count
    count, base_roles = rec.recommended_size(p.project_size, p.budget_level)
    if desired:
        count = min(desired, p.max_agent_count)
    roles = (req.get("requiredRoleCodes") or base_roles)[:max(count, 1)]
    if "PM" not in roles:
        roles = ["PM"] + [r for r in roles if r != "PM"]
        roles = roles[:max(count, 1)]

    recommendations = []
    for role_code in roles:
        prof = _best_profile(session, role_code, p.budget_level)
        if role_code == "PM" and prof is None:
            raise conflict("활성 PM Agent Profile이 없어 추천할 수 없습니다.", code="NO_ACTIVE_PM_PROFILE")
        if prof is None:
            continue
        model = session.get(LlmModel, prof.default_llm_model_id)
        recommendations.append({
            "roleCode": role_code, "agentProfileId": prof.id,
            "llmModelId": model.id if model else None,
            "displayName": prof.name, "displayColor": prof.default_color or rec.ROLE_COLOR.get(role_code, "#4F46E5"),
            "iconKey": prof.default_icon_key or rec.ROLE_ICON.get(role_code, "cog"),
            "reason": f"{role_code} 역할 추천 ({p.project_size}/{p.budget_level}).",
        })
    p.recommended_agent_count = len(recommendations)
    return {"projectId": project_id, "recommendedAgentCount": len(recommendations),
            "recommendations": recommendations}


# --------------------------------------------------------------------------- assignment
def assign_agents(session: Session, project_id: str, req: dict) -> dict:
    p = _require_project(session, project_id)
    agents = req.get("agents") or []
    pm_count = sum(1 for a in agents if a.get("roleCode") == "PM" or a.get("isPrimaryPm"))
    if pm_count != 1:
        raise bad_request("PM Agent는 정확히 1명이어야 합니다.", code="PM_COUNT_INVALID")
    if len(agents) > p.max_agent_count:
        raise conflict(f"정원({p.max_agent_count})을 초과했습니다.", code="CAP_EXCEEDED")

    seen_profiles: set[str] = set()
    created: list[ProjectAgent] = []
    for a in agents:
        profile = session.get(AgentProfile, a["agentProfileId"])
        if profile is None or not profile.is_active:
            raise bad_request("유효하지 않거나 비활성 Agent Profile입니다.", code="INVALID_PROFILE")
        if profile.id in seen_profiles:
            raise conflict("동일 프로젝트에 중복 Profile 배정은 허용되지 않습니다.", code="DUPLICATE_PROFILE")
        seen_profiles.add(profile.id)
        model = session.get(LlmModel, a.get("llmModelId") or profile.default_llm_model_id)
        if model is None or not model.is_active:
            raise bad_request("유효하지 않거나 비활성 LLM 모델입니다.", code="INVALID_MODEL")
        role = _role_by_code(session, a["roleCode"])
        color = a.get("displayColor") or profile.default_color or rec.ROLE_COLOR.get(role.code, "#4F46E5")
        if not _valid_hex(color):
            raise bad_request("displayColor는 #RRGGBB 형식이어야 합니다.", code="INVALID_COLOR")
        display_name = (a.get("displayName") or profile.name).strip()
        if not display_name:
            raise bad_request("displayName은 비어 있을 수 없습니다.", code="INVALID_DISPLAY_NAME")
        is_pm = bool(a.get("isPrimaryPm") or role.code == "PM")
        pa = ProjectAgent(
            project_id=project_id, agent_profile_id=profile.id, role_id=role.id,
            llm_model_id=model.id, display_name=display_name, display_color=color,
            icon_key=a.get("iconKey") or profile.default_icon_key or rec.ROLE_ICON.get(role.code, "cog"),
            assignment_reason=a.get("reason"), status="ASSIGNED", is_primary_pm=1 if is_pm else 0,
        )
        session.add(pa)
        session.flush()
        created.append(pa)
        # role document templates → planned docs
        templates = session.execute(
            select(RoleDocumentTemplate).where(RoleDocumentTemplate.role_id == role.id)
        ).scalars()
        for t in templates:
            session.add(ProjectAgentDocument(
                project_agent_id=pa.id, project_id=project_id,
                role_document_template_id=t.id, file_path=f"docs/{role.code.lower()}/{t.file_name}",
                status="PLANNED",
            ))

    p.status = "READY"
    p.updated_at = utcnow_iso()
    platform.touch(session, project_id, "project.updated", project_id)
    for pa in created:
        platform.touch(session, project_id, "agent.updated", pa.id)
    return {"projectId": project_id, "status": "READY",
            "assignedAgents": [agent_dict(a) for a in created]}


_DESK_ROLE_CODES = ["FRONTEND", "BACKEND", "DATABASE", "QA"]


def hire_one_agent(session: Session, project_id: str, req: dict | None = None) -> dict:
    """Hire one agent (Tycoon Office 'Agent 고용하기').

    With `agentProfileId` the chosen profile is deployed to the chosen desk/model;
    with an empty request it auto-picks the least-staffed desk (creating a fresh
    profile so it can always add someone)."""
    req = req or {}
    p = _require_project(session, project_id)
    existing = list(session.execute(
        select(ProjectAgent).where(ProjectAgent.project_id == project_id)
    ).scalars())
    active = [a for a in existing if a.status != "REMOVED"]
    if len(active) >= p.max_agent_count:
        raise conflict(f"정원({p.max_agent_count})에 도달했습니다.", code="CAP_REACHED")
    used = {a.agent_profile_id for a in existing}

    if req.get("agentProfileId"):
        profile = session.get(AgentProfile, req["agentProfileId"])
        if profile is None or not profile.is_active:
            raise bad_request("유효하지 않거나 비활성 Agent Profile입니다.", code="INVALID_PROFILE")
        if profile.id in used:
            raise conflict("이미 배정된 Agent Profile입니다.", code="DUPLICATE_PROFILE")
        role = _role_by_code(session, req["roleCode"]) if req.get("roleCode") else session.get(Role, profile.role_id)
        model = session.get(LlmModel, req.get("llmModelId") or profile.default_llm_model_id)
        if model is None or not model.is_active:
            raise bad_request("유효하지 않거나 비활성 LLM 모델입니다.", code="INVALID_MODEL")
        color = req.get("displayColor") or profile.default_color or rec.ROLE_COLOR.get(role.code, "#4F46E5")
        if not _valid_hex(color):
            raise bad_request("displayColor는 #RRGGBB 형식이어야 합니다.", code="INVALID_COLOR")
        display_name = (req.get("displayName") or profile.name).strip()
        if not display_name:
            raise bad_request("displayName은 비어 있을 수 없습니다.", code="INVALID_DISPLAY_NAME")
        icon = profile.default_icon_key or rec.ROLE_ICON.get(role.code, "cog")
        profile_id = profile.id
        model_id = model.id
    else:
        # Auto-pick: least-staffed desk, with a freshly-created profile.
        role_by_id = {r.id: r for r in session.execute(select(Role)).scalars()}
        counts = {code: 0 for code in _DESK_ROLE_CODES}
        for a in active:
            code = role_by_id[a.role_id].code if a.role_id in role_by_id else None
            if code in counts:
                counts[code] += 1
        target_code = min(_DESK_ROLE_CODES, key=lambda c: counts[c])
        role = _role_by_code(session, target_code)
        model = session.execute(select(LlmModel).where(LlmModel.is_active == 1)).scalars().first()
        if model is None:
            raise conflict("사용 가능한 LLM 모델이 없습니다.", code="NO_MODEL")
        seq = len(existing) + 1
        color = rec.ROLE_COLOR.get(target_code, "#4F46E5")
        icon = rec.ROLE_ICON.get(target_code, "cog")
        fresh = AgentProfile(
            name=f"{target_code.title()} Recruit #{seq}", role_id=role.id,
            default_llm_model_id=model.id, skill_level="MID",
            default_color=color, default_icon_key=icon, is_active=1,
        )
        session.add(fresh)
        session.flush()
        profile_id = fresh.id
        model_id = model.id
        display_name = f"Recruit {target_code.title()} #{seq}"

    pa = ProjectAgent(
        project_id=project_id, agent_profile_id=profile_id, role_id=role.id,
        llm_model_id=model_id, display_name=display_name,
        display_color=color, icon_key=icon, status="ASSIGNED", is_primary_pm=0,
        assignment_reason="Hired from Tycoon Office",
    )
    session.add(pa)
    session.flush()
    p.updated_at = utcnow_iso()
    platform.touch(session, project_id, "agent.updated", pa.id)
    return {"projectId": project_id, "agent": agent_dict(pa)}


def list_project_agents(session: Session, project_id: str) -> list[dict]:
    agents = session.execute(
        select(ProjectAgent).where(ProjectAgent.project_id == project_id)
    ).scalars()
    return [agent_dict(a) for a in agents]


def replace_project_agent(session: Session, project_id: str, agent_id: str, patch: dict) -> dict:
    pa = session.get(ProjectAgent, agent_id)
    if pa is None or pa.project_id != project_id:
        raise not_found("Project Agent를 찾을 수 없습니다.")
    for field, col in (("displayName", "display_name"), ("displayColor", "display_color"),
                       ("iconKey", "icon_key"), ("status", "status")):
        if field in patch and patch[field] is not None:
            setattr(pa, col, patch[field])
    if patch.get("llmModelId"):
        model = session.get(LlmModel, patch["llmModelId"])
        if model is None or not model.is_active:
            raise bad_request("유효하지 않거나 비활성 LLM 모델입니다.", code="INVALID_MODEL")
        pa.llm_model_id = model.id
    pa.updated_at = utcnow_iso()
    platform.touch(session, project_id, "agent.updated", pa.id)
    return agent_dict(pa)


def remove_project_agent(session: Session, project_id: str, agent_id: str) -> dict:
    pa = session.get(ProjectAgent, agent_id)
    if pa is None or pa.project_id != project_id:
        raise not_found("Project Agent를 찾을 수 없습니다.")
    if pa.is_primary_pm:
        raise bad_request("PM Agent는 제거할 수 없습니다. 교체 API를 사용하세요.", code="CANNOT_REMOVE_PM")
    pa.status = "REMOVED"
    pa.updated_at = utcnow_iso()
    platform.touch(session, project_id, "agent.updated", pa.id)
    return agent_dict(pa)


# --------------------------------------------------------------------------- milestones
def milestone_dict(session: Session, m: SprintMilestone) -> dict:
    prog = progress.milestone_progress(session, m.id)
    return {
        "id": m.id, "projectId": m.project_id, "title": m.title, "roleId": m.role_id,
        "displayColor": m.display_color, "sortOrder": m.sort_order,
        "status": progress.milestone_status(session, m.id), **prog,
    }


def create_milestone(session: Session, project_id: str, data: dict) -> dict:
    _require_project(session, project_id)
    title = (data.get("title") or "").strip()
    if not title:
        raise bad_request("Milestone 제목은 비어 있을 수 없습니다.", code="INVALID_TITLE")
    role_id = None
    if data.get("roleCode"):
        role_id = _role_by_code(session, data["roleCode"]).id
    m = SprintMilestone(
        project_id=project_id, title=title, role_id=role_id,
        display_color=data.get("displayColor"), sort_order=data.get("sortOrder", 0),
    )
    session.add(m)
    session.flush()
    platform.touch(session, project_id, "milestone.updated", m.id)
    return milestone_dict(session, m)


def list_milestones(session: Session, project_id: str) -> list[dict]:
    ms = session.execute(
        select(SprintMilestone).where(SprintMilestone.project_id == project_id)
        .order_by(SprintMilestone.sort_order)
    ).scalars()
    return [milestone_dict(session, m) for m in ms]


def update_milestone(session: Session, project_id: str, milestone_id: str, patch: dict) -> dict:
    m = session.get(SprintMilestone, milestone_id)
    if m is None or m.project_id != project_id:
        raise not_found("Milestone을 찾을 수 없습니다.")
    for banned in ("status", "progressCurrent", "progressTotal", "progressPercent"):
        if banned in patch:
            raise bad_request("status/진행률은 읽기 전용입니다.", code="READ_ONLY_FIELD")
    for field, col in (("title", "title"), ("displayColor", "display_color"),
                       ("sortOrder", "sort_order")):
        if field in patch and patch[field] is not None:
            setattr(m, col, patch[field])
    m.updated_at = utcnow_iso()
    platform.touch(session, project_id, "milestone.updated", m.id)
    return milestone_dict(session, m)


def link_agent_milestone(session: Session, project_id: str, milestone_id: str, req: dict) -> dict:
    m = session.get(SprintMilestone, milestone_id)
    if m is None or m.project_id != project_id:
        raise not_found("Milestone을 찾을 수 없습니다.")
    pa = session.get(ProjectAgent, req["projectAgentId"])
    if pa is None or pa.project_id != project_id:
        raise not_found("Project Agent를 찾을 수 없습니다.")
    link = ProjectAgentMilestone(
        project_id=project_id, project_agent_id=pa.id, sprint_milestone_id=m.id,
        responsibility_type=req.get("responsibilityType", "OWNER"),
    )
    session.add(link)
    session.flush()
    return {"id": link.id, "milestoneId": m.id, "projectAgentId": pa.id,
            "responsibilityType": link.responsibility_type}


# --------------------------------------------------------------------------- tasks
def task_dict(t: ProjectTask) -> dict:
    return {
        "id": t.id, "projectId": t.project_id, "sprintMilestoneId": t.sprint_milestone_id,
        "assignedProjectAgentId": t.assigned_project_agent_id, "roleId": t.role_id,
        "title": t.title, "description": t.description, "status": t.status,
        "executionMode": t.execution_mode, "priority": t.priority, "sortOrder": t.sort_order,
        "dependencyTaskIds": t.dependency_task_ids, "waitReasons": t.wait_reasons,
        "approvedPlanId": t.approved_plan_id, "approvedPlanVersion": t.approved_plan_version,
        "revision": t.revision,
    }


def create_task(session: Session, project_id: str, data: dict) -> dict:
    _require_project(session, project_id)
    title = (data.get("title") or "").strip()
    if not title:
        raise bad_request("Task 제목은 비어 있을 수 없습니다.", code="INVALID_TITLE")
    milestone_id = data.get("sprintMilestoneId")
    if milestone_id:
        m = session.get(SprintMilestone, milestone_id)
        if m is None or m.project_id != project_id:
            raise not_found("Milestone을 찾을 수 없습니다.")
    agent_id = data.get("assignedProjectAgentId")
    if agent_id:
        pa = session.get(ProjectAgent, agent_id)
        if pa is None or pa.project_id != project_id:
            raise bad_request("다른 프로젝트의 Agent는 담당자로 지정할 수 없습니다.", code="CROSS_PROJECT_AGENT")
    role_id = _role_by_code(session, data["roleCode"]).id if data.get("roleCode") else None
    deps = data.get("dependencyTaskIds") or []
    t = ProjectTask(
        project_id=project_id, sprint_milestone_id=milestone_id,
        assigned_project_agent_id=agent_id, role_id=role_id, title=title,
        description=data.get("description"), status="TODO",
        priority=data.get("priority", "MEDIUM"), sort_order=data.get("sortOrder", 0),
        dependency_task_ids=deps, requirement_ids=data.get("requirementIds") or [],
    )
    session.add(t)
    session.flush()
    platform.touch(session, project_id, "task.updated", t.id)
    if milestone_id:
        platform.touch(session, project_id, "milestone.updated", milestone_id)
    return task_dict(t)


def list_tasks(session: Session, project_id: str, **filters) -> list[dict]:
    stmt = select(ProjectTask).where(ProjectTask.project_id == project_id)
    if filters.get("sprintMilestoneId"):
        stmt = stmt.where(ProjectTask.sprint_milestone_id == filters["sprintMilestoneId"])
    if filters.get("status"):
        stmt = stmt.where(ProjectTask.status == filters["status"])
    return [task_dict(t) for t in session.execute(stmt.order_by(ProjectTask.sort_order)).scalars()]


def update_task(session: Session, project_id: str, task_id: str, patch: dict) -> dict:
    t = session.get(ProjectTask, task_id)
    if t is None or t.project_id != project_id:
        raise not_found("Task를 찾을 수 없습니다.")
    if "status" in patch:
        raise bad_request("실행 상태 전이는 오케스트레이터가 담당합니다.", code="STATUS_NOT_EDITABLE")
    for field, col in (("title", "title"), ("description", "description"),
                       ("priority", "priority"), ("sortOrder", "sort_order"),
                       ("assignedProjectAgentId", "assigned_project_agent_id")):
        if field in patch and patch[field] is not None:
            setattr(t, col, patch[field])
    t.revision = (t.revision or 0) + 1
    t.updated_at = utcnow_iso()
    platform.touch(session, project_id, "task.updated", t.id)
    return task_dict(t)


def move_task_milestone(session: Session, project_id: str, task_id: str, req: dict) -> dict:
    t = session.get(ProjectTask, task_id)
    if t is None or t.project_id != project_id:
        raise not_found("Task를 찾을 수 없습니다.")
    old_milestone = t.sprint_milestone_id
    target = req.get("sprintMilestoneId")
    if target:
        m = session.get(SprintMilestone, target)
        if m is None or m.project_id != project_id:
            raise not_found("대상 Milestone을 찾을 수 없습니다.")
    t.sprint_milestone_id = target
    if req.get("sortOrder") is not None:
        t.sort_order = req["sortOrder"]
    t.updated_at = utcnow_iso()
    platform.touch(session, project_id, "task.updated", t.id)
    if old_milestone:
        platform.touch(session, project_id, "milestone.updated", old_milestone)
    if target:
        platform.touch(session, project_id, "milestone.updated", target)
    return task_dict(t)
