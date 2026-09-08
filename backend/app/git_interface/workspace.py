"""Checkout lifecycle: clone + branch (idempotent), ff-only sync (03 §3.1–3.2)."""
from __future__ import annotations

import os
from pathlib import Path

from .git_command import run_git, run_git_raw


def checkout_path(checkout_root: str, project_id: str) -> Path:
    return Path(checkout_root).resolve() / project_id


def _is_git_repo(path: Path) -> bool:
    return (path / ".git").exists()


def branch_name(project_id: str) -> str:
    return f"project/{project_id}"


def initialize(checkout_root: str, remote: str, project_id: str, timeout: float) -> tuple[Path, str, str | None]:
    """Clone (if needed) + ensure the project branch. Idempotent — reuses existing checkout."""
    path = checkout_path(checkout_root, project_id)
    branch = branch_name(project_id)
    if _is_git_repo(path):
        # reuse existing checkout; ensure on the project branch
        _ensure_branch(path, branch, timeout)
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        run_git(["clone", remote, str(path)], cwd=path.parent, timeout=timeout)
        _ensure_branch(path, branch, timeout)
    # HEAD may be unborn on a freshly-cloned empty repo → don't raise.
    base = run_git(["rev-parse", "HEAD"], cwd=path, timeout=timeout, check=False).strip() or None
    return path, branch, base


def _ensure_branch(path: Path, branch: str, timeout: float) -> None:
    # `branch --show-current` is safe on an unborn branch (freshly cloned empty repo).
    current = run_git(["branch", "--show-current"], cwd=path, timeout=timeout, check=False).strip()
    if current == branch:
        return
    # local branch exists?
    existing = run_git(["branch", "--list", branch], cwd=path, timeout=timeout).strip()
    if existing:
        run_git(["switch", branch], cwd=path, timeout=timeout)
    else:
        # try remote-tracking, else create new
        fetch = run_git_raw(["ls-remote", "--heads", "origin", branch], cwd=path, timeout=timeout)
        if fetch.returncode == 0 and fetch.stdout.strip():
            run_git(["fetch", "origin", branch], cwd=path, timeout=timeout)
            run_git(["switch", "-c", branch, f"origin/{branch}"], cwd=path, timeout=timeout)
        else:
            run_git(["switch", "-c", branch], cwd=path, timeout=timeout)


def sync(path: Path, branch: str, timeout: float) -> str | None:
    """ff-only pull of the project branch if it exists on the remote (03 §3.2)."""
    run_git_raw(["fetch", "origin"], cwd=path, timeout=timeout)
    ls = run_git_raw(["ls-remote", "--heads", "origin", branch], cwd=path, timeout=timeout)
    if ls.returncode == 0 and ls.stdout.strip():
        run_git_raw(["pull", "--ff-only", "origin", branch], cwd=path, timeout=timeout)
    head = run_git(["rev-parse", "HEAD"], cwd=path, timeout=timeout).strip()
    return head or None
