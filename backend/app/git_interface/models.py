"""U2 result dataclasses. ApplyResult/PublishResult are reused from the GitPort contract."""
from __future__ import annotations

from dataclasses import dataclass, field

# Re-export the port dataclasses so callers can import from one place.
from ..ports.git_port import ApplyResult, PublishResult  # noqa: F401


@dataclass
class InitResult:
    projectId: str
    checkoutPath: str
    branch: str
    baseCommitSha: str | None


@dataclass
class SyncResult:
    projectId: str
    milestoneId: str | None
    synced: bool
    headCommitSha: str | None


@dataclass
class ChangeSetView:
    taskId: str
    hasChanges: bool
    changedFiles: list[str] = field(default_factory=list)
    diffStat: str = ""
    diff: str = ""
    contentHash: str | None = None
