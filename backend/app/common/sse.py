"""In-process SSE broker (06 §5). Snapshot-invalidation model: events carry only
{revision,type,entityId}; clients re-read /snapshot.
"""
from __future__ import annotations

import asyncio
from collections import defaultdict


class SSEBroker:
    def __init__(self) -> None:
        self._subscribers: dict[str, set[asyncio.Queue]] = defaultdict(set)

    def subscribe(self, project_id: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._subscribers[project_id].add(q)
        return q

    def unsubscribe(self, project_id: str, q: asyncio.Queue) -> None:
        self._subscribers[project_id].discard(q)

    def publish(self, project_id: str, revision: int, type_: str, entity_id: str | None) -> None:
        event = {"projectId": project_id, "revision": revision, "type": type_, "entityId": entity_id}
        for q in list(self._subscribers.get(project_id, ())):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:  # pragma: no cover
                pass


broker = SSEBroker()
