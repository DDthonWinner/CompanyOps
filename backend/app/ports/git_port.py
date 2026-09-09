"""GitPort — U1's boundary to the GitInterface (real impl is unit U2 backend-git).

U1 ships a LocalStubGit that simulates apply/diff/publish so the orchestration flow is
buildable and testable now. The real GitInterface (subprocess git, real push to
DDthonWinner/TestOutput) is injected in U2 without changing U1 call sites.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

from ..common.util import stable_hash


@dataclass
class ApplyResult:
    task_id: str
    applied: bool
    changed_files: list[str] = field(default_factory=list)
    content_hash: str | None = None
    base_commit_sha: str | None = None
    checkout_path: str | None = None  # authoritative workspace; absent for in-memory providers


@dataclass
class PublishResult:
    task_id: str
    status: str            # NO_CHANGES / COMMITTED_LOCAL / PUSHED / FAILED / SYNC_REQUIRED
    published: bool
    commit_sha: str | None = None
    branch: str | None = None
    branch_url: str | None = None
    changed_files: list[str] = field(default_factory=list)
    error: str | None = None


class GitPort(Protocol):
    def initialize_project_repository(self, project_id: str) -> dict: ...
    def apply_file_changes(self, project_id: str, task_id: str, changes: list[dict]) -> ApplyResult: ...
    def publish_task_changes(self, project_id: str, milestone_id: str | None, task_id: str,
                             task_title: str, commit_type: str) -> PublishResult: ...


class LocalStubGit:
    """Deterministic in-memory stub (no real git). Replaced by U2's GitInterface."""

    def __init__(self, remote: str = "https://github.com/DDthonWinner/TestOutput"):
        self.remote = remote
        self._changes: dict[str, list[dict]] = {}
        self._counter = 0

    def initialize_project_repository(self, project_id: str) -> dict:
        return {
            "projectId": project_id,
            "checkoutPath": f"checkouts/{project_id}",
            "branch": f"project/{project_id}",
            "baseCommitSha": "stub-base",
        }

    def apply_file_changes(self, project_id: str, task_id: str, changes: list[dict]) -> ApplyResult:
        self._changes[task_id] = changes
        paths = [c["path"] for c in changes]
        return ApplyResult(
            task_id=task_id, applied=True, changed_files=paths,
            content_hash=stable_hash(changes), base_commit_sha="stub-base",
        )

    def publish_task_changes(self, project_id, milestone_id, task_id, task_title, commit_type) -> PublishResult:
        changes = self._changes.get(task_id, [])
        if not changes:
            return PublishResult(task_id=task_id, status="NO_CHANGES", published=False)
        self._counter += 1
        sha = f"stub{self._counter:06d}"
        branch = f"project/{project_id}"
        return PublishResult(
            task_id=task_id, status="PUSHED", published=True, commit_sha=sha,
            branch=branch, branch_url=f"{self.remote}/tree/{branch}",
            changed_files=[c["path"] for c in changes],
        )
