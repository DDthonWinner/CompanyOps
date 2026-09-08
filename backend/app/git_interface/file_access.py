"""Path-safety + file changes (03 §5.5, §3.4, §10.1)."""
from __future__ import annotations

import os
from pathlib import Path

from .exceptions import PathSafetyError


def resolve_repository_path(workspace: Path, relative_path: str) -> Path:
    """Resolve a checkout-relative path; reject escape / .git / traversal (03 §5.5)."""
    workspace = workspace.resolve()
    target = (workspace / relative_path).resolve()
    if target == workspace or workspace not in target.parents:
        raise PathSafetyError(f"Repository 외부 경로입니다: {relative_path}")
    if ".git" in target.parts:
        raise PathSafetyError(".git 경로는 접근할 수 없습니다.")
    return target


def apply_changes(workspace: Path, changes: list[dict]) -> list[str]:
    """Apply create/update/delete to the checkout only (no commit). Returns changed paths."""
    changed: list[str] = []
    for change in changes:
        rel = change["path"]
        op = change.get("operation", "update")
        target = resolve_repository_path(workspace, rel)
        if op == "delete":
            if target.exists():
                target.unlink()
            changed.append(rel)
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(change.get("content", ""), encoding="utf-8")
        changed.append(rel)
    return changed


def read_file(workspace: Path, relative_path: str) -> tuple[str | None, bool]:
    target = resolve_repository_path(workspace, relative_path)
    if not target.exists():
        return None, False
    return target.read_text(encoding="utf-8"), True
