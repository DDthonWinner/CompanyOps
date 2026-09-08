"""Provider selection + graceful degradation to fixture on OpenAI failure (NFR-S6)."""
from __future__ import annotations

import logging

from ...config import Settings, get_settings
from .base import ExecutionProvider, ExecutionResult, TaskExecutionContext
from .fixture import FixtureExecutionProvider

log = logging.getLogger("companyops.execution")


class FallbackProvider(ExecutionProvider):
    """Try the real provider; on any error, degrade to fixture and record the mode used."""

    name = "openai+fallback"

    def __init__(self, primary: ExecutionProvider, fallback: ExecutionProvider):
        self.primary = primary
        self.fallback = fallback

    def execute_task(self, ctx: TaskExecutionContext) -> ExecutionResult:
        try:
            return self.primary.execute_task(ctx)
        except Exception as exc:  # noqa: BLE001 — degrade, don't crash the worker
            log.warning("OpenAI execution failed (%s); falling back to fixture.", exc)
            return self.fallback.execute_task(ctx)


def select_provider(settings: Settings | None = None) -> ExecutionProvider:
    settings = settings or get_settings()
    fixture = FixtureExecutionProvider()
    if settings.use_openai:
        try:
            from .openai_provider import OpenAIExecutionProvider

            primary = OpenAIExecutionProvider(
                settings.openai_api_key, settings.openai_model, settings.openai_timeout_seconds
            )
            return FallbackProvider(primary, fixture)
        except Exception as exc:  # pragma: no cover — missing SDK/key
            log.warning("OpenAI provider unavailable (%s); using fixture.", exc)
    return fixture
