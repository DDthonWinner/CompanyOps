"""Task-isolated real publishing, using the existing GitInterface implementation."""
from functools import lru_cache
from pathlib import Path

from ..config import get_settings
from ..git_interface.interface import GitInterface
from ..orchestrator import deps


@lru_cache(maxsize=4)
def _real(remote, root, timeout):
    return GitInterface(remote, str(Path(root) / "demo-replay"), timeout)


def git_port():
    settings = get_settings()
    if settings.demo_replay_git_mode == "real":
        return _real(settings.git_remote, settings.checkout_root, settings.git_subprocess_timeout_seconds)
    return deps.git_port()
