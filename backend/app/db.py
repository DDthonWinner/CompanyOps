"""Database engine, session, and unit-of-work (SQLAlchemy 2.x + SQLite)."""
from __future__ import annotations

import json
import os
from contextlib import contextmanager
from typing import Any, Iterator

from sqlalchemy import String, TypeDecorator, create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings


class Base(DeclarativeBase):
    pass


class JSONList(TypeDecorator):
    """Store a Python list as a JSON TEXT column (06 §3.1: arrays as JSON TEXT for MVP)."""

    impl = String
    cache_ok = True

    def process_bind_param(self, value: Any, dialect: Any) -> str:
        return json.dumps(value or [])

    def process_result_value(self, value: Any, dialect: Any) -> list:
        if value is None or value == "":
            return []
        return json.loads(value)


class JSONDict(TypeDecorator):
    """Store a Python dict as a JSON TEXT column."""

    impl = String
    cache_ok = True

    def process_bind_param(self, value: Any, dialect: Any) -> str:
        return json.dumps(value or {})

    def process_result_value(self, value: Any, dialect: Any) -> dict:
        if value is None or value == "":
            return {}
        return json.loads(value)


_settings = get_settings()

# Ensure the SQLite directory exists.
_db_dir = os.path.dirname(_settings.db_path)
if _db_dir:
    os.makedirs(_db_dir, exist_ok=True)

engine: Engine = create_engine(
    _settings.database_url,
    connect_args={"check_same_thread": False},
    future=True,
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):  # pragma: no cover
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)


def init_db() -> None:
    """Create all tables (MVP; Alembic optional later)."""
    from . import common  # noqa: F401  ensure models are imported/registered
    from .common import models  # noqa: F401
    from .uf import models as uf_models  # noqa: F401  register UF tables (U3)

    Base.metadata.create_all(bind=engine)
    _run_light_migrations()


def _run_light_migrations() -> None:
    """Additive-only column backfills for DBs created before a column was added.
    create_all never ALTERs existing tables; SQLite supports ADD COLUMN safely."""
    from sqlalchemy import inspect, text

    insp = inspect(engine)
    if "feedbacks" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("feedbacks")}
        if "source" not in cols:
            with engine.begin() as conn:
                conn.execute(text(
                    "ALTER TABLE feedbacks ADD COLUMN source VARCHAR NOT NULL DEFAULT 'USER'"
                ))


@contextmanager
def unit_of_work() -> Iterator[Session]:
    """Transaction boundary: commit on success, rollback on error (NFR-S6)."""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_session() -> Iterator[Session]:
    """FastAPI dependency."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
