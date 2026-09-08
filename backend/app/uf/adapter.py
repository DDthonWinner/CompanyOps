"""UtilizationAdapter implements U1's UtilizationPort (BU-15). Wired via deps at startup."""
from __future__ import annotations

from typing import Any

from ..db import unit_of_work
from . import service


class UtilizationAdapter:
    def request_report(self, project_id: str, session: Any | None = None) -> None:
        if session is not None:
            # Same transaction as project completion (sees uncommitted COMPLETED).
            service.create_report(session, project_id)
        else:
            # Manual/standalone trigger — own transaction.
            with unit_of_work() as s:
                service.create_report(s, project_id)
