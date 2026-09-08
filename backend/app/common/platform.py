"""Cross-cutting platform services: revision, activity, command receipts, write-lock.

All operate within a caller-provided Session so that state change + revision bump +
activity append happen in ONE transaction (06 §4.3 / §5).
"""
from __future__ import annotations

import asyncio
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .errors import conflict
from .models import ActivityEvent, CommandReceipt, Project
from .util import stable_hash


class RevisionService:
    """Per-project monotonic revision (06 §3.2)."""

    @staticmethod
    def bump(session: Session, project_id: str) -> int:
        project = session.get(Project, project_id)
        if project is None:
            return 0
        project.revision = (project.revision or 0) + 1
        return project.revision

    @staticmethod
    def current(session: Session, project_id: str) -> int:
        project = session.get(Project, project_id)
        return project.revision if project else 0


class ActivityService:
    @staticmethod
    def append(session: Session, project_id: str, type_: str, entity_id: str | None,
               payload: dict | None = None) -> ActivityEvent:
        revision = RevisionService.current(session, project_id)
        evt = ActivityEvent(
            project_id=project_id, revision=revision, type=type_,
            entity_id=entity_id, payload=payload or {},
        )
        session.add(evt)
        return evt

    @staticmethod
    def read(session: Session, project_id: str, cursor: int = 0, limit: int = 50) -> list[ActivityEvent]:
        stmt = (
            select(ActivityEvent)
            .where(ActivityEvent.project_id == project_id, ActivityEvent.revision > cursor)
            .order_by(ActivityEvent.revision.asc())
            .limit(limit)
        )
        return list(session.execute(stmt).scalars())


class CommandReceiptStore:
    """Idempotency by requestId (06 §4.3): NEW / REPLAY / CONFLICT(409)."""

    NEW = "NEW"
    REPLAY = "REPLAY"

    @classmethod
    def begin(cls, session: Session, request_id: str, operation: str, payload: Any) -> tuple[str, dict | None]:
        payload_hash = stable_hash(payload)
        existing = session.get(CommandReceipt, request_id)
        if existing is None:
            session.add(CommandReceipt(
                request_id=request_id, payload_hash=payload_hash,
                operation=operation, accepted=1, result={},
            ))
            return cls.NEW, None
        if existing.payload_hash != payload_hash:
            raise conflict(
                "동일한 requestId로 다른 요청이 접수되었습니다.",
                code="IDEMPOTENCY_CONFLICT", request_id=request_id,
            )
        return cls.REPLAY, existing.result or {}

    @staticmethod
    def complete(session: Session, request_id: str, result: dict) -> None:
        receipt = session.get(CommandReceipt, request_id)
        if receipt is not None:
            receipt.result = result


def touch(session: Session, project_id: str, type_: str, entity_id: str | None = None,
          payload: dict | None = None) -> int:
    """Bump revision + append activity + queue an SSE event (published after commit).

    One transaction: state change (by caller) + revision bump + activity append (06 §5).
    """
    revision = RevisionService.bump(session, project_id)
    ActivityService.append(session, project_id, type_, entity_id, payload)
    session.info.setdefault("events", []).append(
        {"project_id": project_id, "revision": revision, "type_": type_, "entity_id": entity_id}
    )
    return revision


def collect_events(session: Session) -> list[dict]:
    """Snapshot the queued SSE events (call inside the tx, publish after commit)."""
    return list(session.info.get("events", []))


class WriteLockManager:
    """Per-project in-process write-lock held across change→QA→publish (03, 00 §5.2)."""

    def __init__(self) -> None:
        self._locks: dict[str, asyncio.Lock] = {}

    def lock_for(self, project_id: str) -> asyncio.Lock:
        if project_id not in self._locks:
            self._locks[project_id] = asyncio.Lock()
        return self._locks[project_id]


write_locks = WriteLockManager()
