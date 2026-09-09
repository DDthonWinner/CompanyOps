"""In-process async task worker (D2, 00 §5.2). Sequential per-project writes under the
write-lock. Triggered by enqueue_project() after plan approval; processes all currently
executable tasks, running execute → apply → QA → publish for each.
"""
from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select

from ..common import platform
from ..common.models import ArtifactVersion, DemoReplay, Project, ProjectAgent, ProjectTask, Role, TaskAttempt, TokenUsage
from ..common.sse import broker
from ..common.util import utcnow_iso
from ..db import unit_of_work
from . import deps, qa, service
from .execution.base import TaskExecutionContext
from .execution.selector import select_provider

log = logging.getLogger("companyops.worker")

_queue: "asyncio.Queue[str]" = asyncio.Queue()
_provider = None


def enqueue_project(project_id: str) -> None:
    _queue.put_nowait(project_id)


def _publish_events(events: list[dict]) -> None:
    for e in events:
        broker.publish(e["project_id"], e["revision"], e["type_"], e["entity_id"])


def _next_executable(session, project_id: str) -> ProjectTask | None:
    if session.get(DemoReplay, project_id) is not None:
        return None  # paced simulator owns this project, including while stopped
    project = session.get(Project, project_id)
    if project is None or project.status != "ACTIVE":
        return None
    tasks = list(session.execute(
        select(ProjectTask).where(ProjectTask.project_id == project_id)
        .order_by(ProjectTask.sort_order)
    ).scalars())
    done_ids = {t.id for t in tasks if t.status == "COMPLETED"}
    for t in tasks:
        if t.status != "TODO":
            continue
        if t.wait_reasons:
            continue
        if t.approved_plan_id is None:
            continue
        deps_ids = t.dependency_task_ids or []
        if all(d in done_ids for d in deps_ids):
            return t
    return None


def _run_one_task(project_id: str) -> bool:
    """Run a single executable task end-to-end. Returns True if a task was processed."""
    global _provider
    if _provider is None:
        _provider = select_provider()

    with unit_of_work() as session:
        task = _next_executable(session, project_id)
        if task is None:
            return False
        role = session.get(Role, task.role_id) if task.role_id else None
        role_code = role.code if role else "BACKEND"

        task.status = "RUNNING"
        attempt = TaskAttempt(task_id=task.id, sequence=1)
        session.add(attempt)
        session.flush()
        task.current_attempt_id = attempt.id
        platform.touch(session, project_id, "task.updated", task.id)

        ctx = TaskExecutionContext(
            project_id=project_id, task_id=task.id, task_title=task.title,
            role_code=role_code, description=task.description,
        )
        result = _provider.execute_task(ctx)
        apply_res = deps.git_port().apply_file_changes(project_id, task.id, result.changes)
        artifact = ArtifactVersion(
            task_id=task.id, attempt_id=attempt.id, version=1, generation_status="GENERATED",
            file_paths=apply_res.changed_files, base_commit_sha=apply_res.base_commit_sha,
            content_hash=apply_res.content_hash,
        )
        session.add(artifact)
        session.flush()
        attempt.artifact_version = artifact.version
        attempt.ended_at = utcnow_iso()
        task.execution_mode = result.execution_mode
        task.status = "REVIEW"
        # Persist token usage (06 §3.1) so the snapshot can aggregate per project/agent/task/role.
        tm = result.token_metrics or {}
        _in, _out, _total = tm.get("input"), tm.get("output"), tm.get("total")
        if _total is None and (_in is not None or _out is not None):
            _total = (_in or 0) + (_out or 0)
        if _in is not None or _out is not None or _total is not None:
            # Tasks are role-assigned; resolve the acting agent from the role so per-agent
            # token aggregation (snapshot byAgent) is populated.
            agent_id = task.assigned_project_agent_id
            if agent_id is None and task.role_id:
                pa = session.execute(
                    select(ProjectAgent).where(
                        ProjectAgent.project_id == project_id,
                        ProjectAgent.role_id == task.role_id,
                        ProjectAgent.status != "REMOVED",
                    )
                ).scalars().first()
                agent_id = pa.id if pa else None
            session.add(TokenUsage(
                project_id=project_id, task_id=task.id,
                project_agent_id=agent_id, role_code=role_code,
                stage="EXECUTION", input_tokens=_in, output_tokens=_out,
                total_tokens=_total, demo=1 if result.demo else 0,
            ))
        platform.touch(session, project_id, "artifact.updated", artifact.id,
                       payload={"tokens": result.token_metrics, "demo": result.demo})
        platform.touch(session, project_id, "task.updated", task.id)

        # technical QA
        qa_run = qa.run_qa(session, project_id, task.id, artifact, checkout_path=apply_res.checkout_path)
        platform.touch(session, project_id, "qa.updated", qa_run.id)

        if qa_run.technical_gate == "PASSED":
            service.publish_task(session, task.id, {})  # validates + publishes + COMPLETED
        else:
            log.info("QA gate not passed for task %s; leaving in REVIEW.", task.id)

        events = platform.collect_events(session)
    _publish_events(events)
    return True


async def _process_project(project_id: str) -> None:
    lock = platform.write_locks.lock_for(project_id)
    async with lock:
        # Run sequentially until no more executable tasks.
        while await asyncio.to_thread(_run_one_task, project_id):
            await asyncio.sleep(0)  # yield


def recover_incomplete() -> None:
    """On startup, RUNNING tasks/QA runs → BLOCKED/ERROR (no auto re-run; 06 §5.2)."""
    from ..common.models import QARun

    with unit_of_work() as session:
        for t in session.execute(select(ProjectTask).where(ProjectTask.status == "RUNNING")).scalars():
            if session.get(DemoReplay, t.project_id) is not None:
                continue  # deterministic replay resumes its durable phase
            t.status = "BLOCKED"
            t.wait_reasons = list(t.wait_reasons or []) + ["ADDITIONAL_VALIDATION:restart-recovery"]
        for q in session.execute(select(QARun).where(QARun.run_status == "RUNNING")).scalars():
            q.run_status = "ERROR"


async def worker_loop() -> None:  # pragma: no cover - background task
    log.info("Task worker started.")
    while True:
        project_id = await _queue.get()
        try:
            await _process_project(project_id)
        except Exception as exc:  # noqa: BLE001
            log.exception("Worker error for project %s: %s", project_id, exc)
        finally:
            _queue.task_done()
