"""Pydantic request models for PM (camelCase field names match 06 JSON convention)."""
from __future__ import annotations

from pydantic import BaseModel


class GitRepoIn(BaseModel):
    provider: str = "GITHUB"
    repositoryUrl: str | None = None
    defaultBranch: str = "main"
    accessScope: str = "READ_WRITE"


class CreateProjectIn(BaseModel):
    name: str
    description: str = ""
    projectType: str | None = None
    budgetLevel: str
    projectSize: str
    maxAgentCount: int | None = None
    desiredAgentCount: int | None = None
    gitRepository: GitRepoIn | None = None


class UpdateProjectIn(BaseModel):
    description: str | None = None
    projectType: str | None = None
    desiredAgentCount: int | None = None
    maxAgentCount: int | None = None


class CreateProfileIn(BaseModel):
    name: str
    roleCode: str
    defaultLlmModelId: str
    skillLevel: str = "MID"
    description: str | None = None
    defaultMdTemplate: str | None = None
    defaultColor: str | None = None
    defaultIconKey: str | None = None


class UpdateProfileIn(BaseModel):
    name: str | None = None
    description: str | None = None
    skillLevel: str | None = None
    defaultLlmModelId: str | None = None
    defaultMdTemplate: str | None = None
    defaultColor: str | None = None
    defaultIconKey: str | None = None


class RecommendIn(BaseModel):
    desiredAgentCount: int | None = None
    requiredRoleCodes: list[str] | None = None
    allowModelUpgrade: bool = True


class AssignAgentIn(BaseModel):
    agentProfileId: str
    roleCode: str
    llmModelId: str | None = None
    displayName: str | None = None
    displayColor: str | None = None
    iconKey: str | None = None
    isPrimaryPm: bool = False
    reason: str | None = None


class AssignIn(BaseModel):
    agents: list[AssignAgentIn]


class ReplaceAgentIn(BaseModel):
    displayName: str | None = None
    displayColor: str | None = None
    iconKey: str | None = None
    llmModelId: str | None = None
    status: str | None = None


class CreateMilestoneIn(BaseModel):
    title: str
    roleCode: str | None = None
    displayColor: str | None = None
    sortOrder: int = 0


class UpdateMilestoneIn(BaseModel):
    title: str | None = None
    displayColor: str | None = None
    sortOrder: int | None = None


class LinkAgentMilestoneIn(BaseModel):
    projectAgentId: str
    responsibilityType: str = "OWNER"


class CreateTaskIn(BaseModel):
    sprintMilestoneId: str | None = None
    assignedProjectAgentId: str | None = None
    roleCode: str | None = None
    title: str
    description: str | None = None
    priority: str = "MEDIUM"
    sortOrder: int = 0
    dependencyTaskIds: list[str] | None = None
    requirementIds: list[str] | None = None


class UpdateTaskIn(BaseModel):
    title: str | None = None
    description: str | None = None
    priority: str | None = None
    sortOrder: int | None = None
    assignedProjectAgentId: str | None = None


class MoveTaskIn(BaseModel):
    sprintMilestoneId: str | None = None
    sortOrder: int | None = None
