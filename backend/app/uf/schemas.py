"""Pydantic request models for UF (camelCase per 06)."""
from __future__ import annotations

from pydantic import BaseModel


class CreateReportIn(BaseModel):
    projectId: str


class FeedbackIn(BaseModel):
    aspect: str = "AUTONOMY"
    severity: str = "LOW"
    observation: str = ""
    impact: str = ""
    suggestion: str = ""


class FeedbackUpdateIn(BaseModel):
    aspect: str | None = None
    severity: str | None = None
    observation: str | None = None
    impact: str | None = None
    suggestion: str | None = None
