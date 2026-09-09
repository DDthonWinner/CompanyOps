"""GitInterface — real subprocess git implementing U1's GitPort (03, 06 §2.2)."""
from __future__ import annotations

from pathlib import Path

from ..common.util import stable_hash
from ..ports.git_port import ApplyResult, PublishResult
from . import file_access, workspace
from .git_command import run_git, run_git_raw
from .models import ChangeSetView


class GitInterface:
    def __init__(self, remote: str, checkout_root: str, timeout: float = 120.0,
                 author_name: str = "CompanyOps Agent", author_email: str = "agent@companyops.local"):
        self.remote = remote.rstrip("/")
        self.checkout_root = checkout_root
        self.timeout = timeout
        self.author_name = author_name
        self.author_email = author_email
        self._changesets: dict[str, dict] = {}

    # ---- helpers ----
    def _path(self, project_id: str) -> Path:
        path = workspace.checkout_path(self.checkout_root, project_id)
        if not (path / ".git").exists():
            self.initialize_project_repository(project_id)
        return path

    def _branch_url(self, branch: str) -> str:
        base = self.remote[:-4] if self.remote.endswith(".git") else self.remote
        return f"{base}/tree/{branch}"

    # ---- GitPort ----
    def initialize_project_repository(self, project_id: str) -> dict:
        path, branch, base = workspace.initialize(self.checkout_root, self.remote, project_id, self.timeout)
        run_git(["config", "user.email", self.author_email], cwd=path, timeout=self.timeout)
        run_git(["config", "user.name", self.author_name], cwd=path, timeout=self.timeout)
        return {"projectId": project_id, "checkoutPath": str(path), "branch": branch, "baseCommitSha": base}

    def apply_file_changes(self, project_id: str, task_id: str, changes: list[dict]) -> ApplyResult:
        path = self._path(project_id)
        base = run_git(["rev-parse", "HEAD"], cwd=path, timeout=self.timeout, check=False).strip() or None
        changed = file_access.apply_changes(path, changes)
        content_hash = stable_hash(changes)
        self._changesets[task_id] = {"paths": changed, "content_hash": content_hash, "base": base}
        return ApplyResult(task_id=task_id, applied=True, changed_files=changed,
                           content_hash=content_hash, base_commit_sha=base, checkout_path=str(path.resolve()))

    def get_task_changes(self, project_id: str, task_id: str) -> ChangeSetView:
        path = self._path(project_id)
        status = run_git(["status", "--porcelain"], cwd=path, timeout=self.timeout)
        changed = [line[3:] for line in status.splitlines() if line.strip()]
        diffstat = run_git(["diff", "--stat"], cwd=path, timeout=self.timeout, check=False)
        diff = run_git(["diff"], cwd=path, timeout=self.timeout, check=False)
        cs = self._changesets.get(task_id, {})
        return ChangeSetView(taskId=task_id, hasChanges=bool(changed), changedFiles=changed,
                             diffStat=diffstat, diff=diff, contentHash=cs.get("content_hash"))

    def sync_milestone_repository(self, project_id: str, milestone_id: str | None = None):
        path = self._path(project_id)
        head = workspace.sync(path, workspace.branch_name(project_id), self.timeout)
        return {"projectId": project_id, "milestoneId": milestone_id, "synced": True, "headCommitSha": head}

    def publish_task_changes(self, project_id: str, milestone_id, task_id, task_title, commit_type) -> PublishResult:
        path = self._path(project_id)
        branch = workspace.branch_name(project_id)
        cs = self._changesets.get(task_id)
        if not cs or not cs["paths"]:
            return PublishResult(task_id=task_id, status="NO_CHANGES", published=False)

        # Never accidentally include another task/operator's pre-staged files.
        already_staged = set(filter(None, run_git(
            ["diff", "--cached", "--name-only", "-z"], cwd=path, timeout=self.timeout).split("\0")))
        if already_staged - set(cs["paths"]):
            return PublishResult(task_id=task_id, status="FAILED", published=False,
                                 error="Unrelated staged files exist; refusing mixed-task commit.")
        run_git(["add", "--", *cs["paths"]], cwd=path, timeout=self.timeout)
        staged = run_git(["diff", "--cached", "--name-only"], cwd=path, timeout=self.timeout, check=False).strip()

        if staged:
            msg = (f"{commit_type}({task_id}): {task_title}\n\n"
                   f"CompanyOps-Task: {task_id}\nCompanyOps-Change: {cs['content_hash']}")
            run_git(["commit", "-m", msg], cwd=path, timeout=self.timeout)
            sha = run_git(["rev-parse", "HEAD"], cwd=path, timeout=self.timeout).strip()
        else:
            # Survives process restart / DB rollback after commit or successful push.
            sha = run_git(["log", "-1", "--format=%H", "--fixed-strings", "--all-match",
                           f"--grep=CompanyOps-Task: {task_id}",
                           f"--grep=CompanyOps-Change: {cs['content_hash']}"],
                          cwd=path, timeout=self.timeout, check=False).strip()
            if not sha:
                return PublishResult(task_id=task_id, status="NO_CHANGES", published=False)

        # Fetch + detect divergence before pushing (no rebase/force).
        run_git_raw(["fetch", "origin"], cwd=path, timeout=self.timeout)
        push = run_git_raw(["push", "-u", "origin", branch], cwd=path, timeout=self.timeout)
        if push.returncode == 0:
            return PublishResult(
                task_id=task_id, status="PUSHED", published=True, commit_sha=sha,
                branch=branch, branch_url=self._branch_url(branch), changed_files=cs["paths"],
            )
        err = (push.stderr or push.stdout or "").strip()
        if "non-fast-forward" in err or "rejected" in err or "fetch first" in err:
            return PublishResult(task_id=task_id, status="SYNC_REQUIRED", published=False,
                                 commit_sha=sha, branch=branch, error=err)
        # auth/network failure — keep local commit + SHA (idempotent retry re-pushes)
        return PublishResult(task_id=task_id, status="COMMITTED_LOCAL", published=False,
                             commit_sha=sha, branch=branch, error=err)
