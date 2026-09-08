"""UtilizationPort — U1's boundary to UF (real impl is unit U3 backend-uf).

On Project COMPLETED, the orchestrator's CompletionService requests a utilization report
once, passing its session so UF sees the (uncommitted) COMPLETED status in the same
transaction. U1 ships a no-op stub; U3 injects the real UFService adapter.
"""
from __future__ import annotations

from typing import Any, Protocol


class UtilizationPort(Protocol):
    def request_report(self, project_id: str, session: Any | None = None) -> None: ...


class NoopUtilization:
    """Records nothing; real aggregation lands in U3."""

    def __init__(self) -> None:
        self.requested: list[str] = []

    def request_report(self, project_id: str, session: Any | None = None) -> None:
        self.requested.append(project_id)
