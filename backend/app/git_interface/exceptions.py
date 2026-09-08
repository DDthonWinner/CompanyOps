"""GitInterface exceptions (03 §7)."""
from __future__ import annotations


class GitError(Exception):
    """Generic git operation failure."""


class PathSafetyError(GitError):
    """Path escaped the checkout or touched .git (03 §5.5)."""


class SyncRequired(GitError):
    """Remote diverged; publish aborted (no force-push)."""
