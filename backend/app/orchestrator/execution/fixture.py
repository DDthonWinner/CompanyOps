"""Deterministic fixture provider (Q2). No external calls; reproducible per taskId.
Screens surface "AI 서버 미연결 / 데모 데이터" when demo=True.
"""
from __future__ import annotations

import hashlib

from .base import ExecutionProvider, ExecutionResult, TaskExecutionContext

_ROLE_FILE = {
    "PM": ("docs/pm/plan-note.md", "md"),
    "FRONTEND": ("src/frontend/{slug}.tsx", "tsx"),
    "BACKEND": ("src/backend/{slug}.py", "py"),
    "DATABASE": ("src/db/{slug}.sql", "sql"),
    "QA": ("tests/{slug}_test.py", "py"),
    "DEVOPS": ("ops/{slug}.yml", "yml"),
    "DESIGN": ("design/{slug}.md", "md"),
}


def _slug(title: str) -> str:
    s = "".join(c.lower() if c.isalnum() else "-" for c in title).strip("-")
    return (s or "task")[:40]


class FixtureExecutionProvider(ExecutionProvider):
    name = "fixture"

    def execute_task(self, ctx: TaskExecutionContext) -> ExecutionResult:
        slug = _slug(ctx.task_title)
        path_tmpl, ext = _ROLE_FILE.get(ctx.role_code, ("src/{slug}.txt", "txt"))
        code_path = path_tmpl.format(slug=slug)
        stub = (
            f"// [DEMO DATA / AI 서버 미연결] deterministic stub for task {ctx.task_id}\n"
            f"// role={ctx.role_code} title={ctx.task_title}\n"
        )
        result_md = (
            f"# Task Result — {ctx.task_title}\n\n"
            f"- Task: `{ctx.task_id}`\n- Role: {ctx.role_code}\n- Mode: demo (fixture)\n\n"
            f"{ctx.description or 'No description.'}\n"
        )
        changes = [
            {"path": code_path, "operation": "create", "content": stub},
            {"path": f".ai-dlc/tasks/{ctx.task_id}.md", "operation": "create", "content": result_md},
        ]
        # deterministic simulated token metrics
        seed = int(hashlib.sha256(ctx.task_id.encode()).hexdigest()[:8], 16)
        inp = 400 + seed % 600
        out = 200 + seed % 400
        return ExecutionResult(
            changes=changes,
            artifact_summary=f"Generated {len(changes)} files ({ctx.role_code}).",
            token_metrics={"input": inp, "output": out, "total": inp + out},
            execution_mode="AI_AGENT", demo=True,
        )
