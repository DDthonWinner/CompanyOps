"""Pytest fixtures: isolated temp DB + seeded master data per test."""
from __future__ import annotations

import os
import tempfile

# Must be set BEFORE importing app modules (engine is created at import time).
os.environ.setdefault("DB_PATH", os.path.join(tempfile.gettempdir(), "companyops_test.db"))
os.environ.setdefault("EXECUTION_MODE", "demo")

import pytest  # noqa: E402

from app.db import Base, SessionLocal, engine, unit_of_work  # noqa: E402
from seed import seed  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    seed()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def session():
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()


@pytest.fixture
def uow():
    return unit_of_work
