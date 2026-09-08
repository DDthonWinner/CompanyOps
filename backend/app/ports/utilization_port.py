"""UtilizationPort — U1's boundary to UF (real impl is unit U3 backend-uf).

On Project COMPLETED, the orchestrator's CompletionService requests a utilization report
once. U1 ships a no-op stub; U3 injects the real UFService.
"""
from __future__ import annotations

from typing import Protocol


class UtilizationPort(Protocol):
    def request_report(self, project_id: str) -> None: ...


class NoopUtilization:
    """Records nothing; real aggregation lands in U3."""

    def __init__(self) -> None:
        self.requested: list[str] = []

    def request_report(self, project_id: str) -> None:
        self.requested.append(project_id)
