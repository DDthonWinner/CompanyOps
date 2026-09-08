"""Small shared helpers: ids, timestamps, hashing, case conversion."""
from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any


def new_uuid() -> str:
    return str(uuid.uuid4())


def utcnow_iso() -> str:
    """ISO 8601 UTC timestamp (06 §1)."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def stable_hash(payload: Any) -> str:
    """Deterministic hash of a JSON-serializable payload (sorted keys)."""
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def to_camel(s: str) -> str:
    parts = s.split("_")
    return parts[0] + "".join(p.title() for p in parts[1:])
