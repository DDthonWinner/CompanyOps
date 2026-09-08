"""Pydantic request models for orchestration (camelCase per 06)."""
from __future__ import annotations

from pydantic import BaseModel


class PlanStepIn(BaseModel):
    title: str
    roleCode: str = "BACKEND"
    milestoneTitle: str | None = None
    description: str | None = None
    priority: str = "MEDIUM"
    dependsOn: list[int] | None = None


class CommandIn(BaseModel):
    requestId: str
    instruction: str
    targetAgentIds: list[str] | None = None
    steps: list[PlanStepIn] | None = None


class FeedbackIn(BaseModel):
    requestId: str
    expectedVersion: int
    feedback: str = ""
    steps: list[PlanStepIn] | None = None


class VersionedIn(BaseModel):
    requestId: str
    expectedVersion: int


class ResolveDecisionIn(BaseModel):
    requestId: str
    expectedRevision: int | None = None
    answer: str


class MilestoneReviewIn(BaseModel):
    requestId: str
    expectedResultVersion: int
    reviewStatus: str
    additionalValidation: str = "UNANSWERED"
    feedback: str | None = None


class PublishIn(BaseModel):
    requestId: str
    artifactVersion: int | None = None
    qaRunId: str | None = None
