"""Execution provider abstraction (D3, ORCH-7)."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol


@dataclass
class TaskExecutionContext:
    project_id: str
    task_id: str
    task_title: str
    role_code: str
    description: str | None = None


@dataclass
class ExecutionResult:
    changes: list[dict]                      # [{path, operation, content}]
    artifact_summary: str
    token_metrics: dict = field(default_factory=dict)  # {input,output,total} or {} if uncollected
    execution_mode: str = "AI_AGENT"         # AI_AGENT / HUMAN / MIXED
    demo: bool = True


class ExecutionProvider(Protocol):
    name: str

    def execute_task(self, ctx: TaskExecutionContext) -> ExecutionResult: ...
