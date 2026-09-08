"""Route helper: run a mutation in one transaction, then publish queued SSE events."""
from __future__ import annotations

from typing import Callable, TypeVar

from sqlalchemy.orm import Session

from . import platform
from .sse import broker
from ..db import unit_of_work

T = TypeVar("T")


def mutate(op: Callable[[Session], T]) -> T:
    """Run `op(session)` in a unit-of-work; publish SSE events after commit (06 §5)."""
    with unit_of_work() as session:
        result = op(session)
        events = platform.collect_events(session)
    for e in events:
        broker.publish(e["project_id"], e["revision"], e["type_"], e["entity_id"])
    return result


def read(op: Callable[[Session], T]) -> T:
    with unit_of_work() as session:
        return op(session)
