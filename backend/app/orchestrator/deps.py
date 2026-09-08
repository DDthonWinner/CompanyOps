"""Injectable cross-unit dependencies. U1 defaults to stubs; U2/U3 replace at wiring time."""
from __future__ import annotations

from ..config import get_settings
from ..ports.git_port import GitPort, LocalStubGit
from ..ports.utilization_port import NoopUtilization, UtilizationPort

_git: GitPort = LocalStubGit(get_settings().git_remote)
_utilization: UtilizationPort = NoopUtilization()


def git_port() -> GitPort:
    return _git


def utilization_port() -> UtilizationPort:
    return _utilization


def set_git_port(port: GitPort) -> None:  # used by U2
    global _git
    _git = port


def set_utilization_port(port: UtilizationPort) -> None:  # used by U3
    global _utilization
    _utilization = port
