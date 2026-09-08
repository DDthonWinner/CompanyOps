"""Periodic SQLite backup (NFR-S3 / RESILIENCY-12). Simple timestamped file copy + retention."""
from __future__ import annotations

import os
import shutil
from datetime import datetime, timezone

from ..config import get_settings


def make_backup(retention: int = 10) -> str | None:
    settings = get_settings()
    src = settings.db_path
    if not os.path.exists(src):
        return None
    os.makedirs(settings.backup_dir, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    dst = os.path.join(settings.backup_dir, f"companyops-{stamp}.db")
    shutil.copy2(src, dst)
    _prune(settings.backup_dir, retention)
    return dst


def _prune(backup_dir: str, retention: int) -> None:
    files = sorted(
        (os.path.join(backup_dir, f) for f in os.listdir(backup_dir) if f.endswith(".db")),
        key=os.path.getmtime,
        reverse=True,
    )
    for old in files[retention:]:
        try:
            os.remove(old)
        except OSError:  # pragma: no cover
            pass
