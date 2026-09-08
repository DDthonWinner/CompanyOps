"""Subprocess git wrapper (03 §5.4). Arg arrays only, no shell, env credentials."""
from __future__ import annotations

import os
import subprocess
from pathlib import Path

from .exceptions import GitError


def _env() -> dict:
    env = dict(os.environ)
    # Never hang waiting for interactive credential prompts (missing creds → error).
    env.setdefault("GIT_TERMINAL_PROMPT", "0")
    return env


def run_git(args: list[str], cwd: Path | str, timeout: float = 120.0, check: bool = True) -> str:
    """Run `git <args>` in cwd; return stdout. Raises GitError on failure when check=True."""
    try:
        proc = subprocess.run(
            ["git", *args], cwd=str(cwd), capture_output=True, text=True,
            timeout=timeout, check=False, env=_env(),
        )
    except FileNotFoundError as exc:  # git not installed
        raise GitError(f"git not available: {exc}") from exc
    except subprocess.TimeoutExpired as exc:
        raise GitError(f"git timeout: {' '.join(args)}") from exc
    if check and proc.returncode != 0:
        raise GitError(f"git {' '.join(args)} failed: {proc.stderr.strip() or proc.stdout.strip()}")
    return proc.stdout


def run_git_raw(args: list[str], cwd: Path | str, timeout: float = 120.0) -> subprocess.CompletedProcess:
    """Run git without raising; caller inspects returncode/stderr (used for push)."""
    return subprocess.run(
        ["git", *args], cwd=str(cwd), capture_output=True, text=True,
        timeout=timeout, check=False, env=_env(),
    )
