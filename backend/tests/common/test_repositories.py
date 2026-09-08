"""Repository / persistence & constraint tests."""
from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.common.models import GitRepository, Project, Role
from app.pm import service


def test_seed_roles_present(session):
    codes = {r.code for r in session.execute(select(Role)).scalars()}
    assert {"PM", "FRONTEND", "BACKEND", "QA"}.issubset(codes)


def test_create_project_persists(uow):
    with uow() as db:
        p = service.create_project(db, {
            "name": "Persisted", "budgetLevel": "LOW", "projectSize": "SMALL",
            "gitRepository": {"repositoryUrl": "https://github.com/DDthonWinner/TestOutput"},
        })
        pid = p["id"]
    with uow() as db:
        row = db.get(Project, pid)
        assert row is not None and row.status == "AGENT_MATCHING"
        repo = db.execute(select(GitRepository).where(GitRepository.project_id == pid)).scalars().first()
        assert repo is not None and repo.project_id == pid


def test_one_git_repo_per_project(session):
    # git_repositories.project_id is UNIQUE
    from app.common.models import GitRepository as GR
    from app.common.util import new_uuid

    p = Project(name="x", description="", budget_level="LOW", budget_amount=120000,
                project_size="SMALL", max_agent_count=8, status="DRAFT")
    session.add(p)
    session.flush()
    session.add(GR(project_id=p.id, repository_url="u"))
    session.flush()
    session.add(GR(project_id=p.id, repository_url="u2"))
    with pytest.raises(IntegrityError):
        session.flush()
    session.rollback()
