"""U2 GitInterface tests — real subprocess git against an offline file:// bare repo.
Covers GIT-AC-001/002/004/005 + a connected orchestrator flow with the real GitInterface.
"""
from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

import pytest
from sqlalchemy import select

from app.git_interface.exceptions import PathSafetyError
from app.git_interface.interface import GitInterface


@pytest.fixture
def bare_remote(tmp_path):
    remote = tmp_path / "remote.git"
    remote.mkdir()
    subprocess.run(["git", "init", "--bare", "-b", "main", str(remote)], check=True,
                   capture_output=True, text=True)
    return f"file://{remote}"


@pytest.fixture
def gi(bare_remote, tmp_path):
    return GitInterface(remote=bare_remote, checkout_root=str(tmp_path / "checkouts"), timeout=60)


def test_init_clone_and_branch(gi):
    r = gi.initialize_project_repository("P1")
    assert r["branch"] == "project/P1"
    assert Path(r["checkoutPath"], ".git").exists()


def test_apply_commit_push(gi):
    """GIT-AC-001: apply → publish → real commit on the project branch of the remote."""
    gi.initialize_project_repository("P1")
    changes = [{"path": "src/app.py", "operation": "create", "content": "print('hi')\n"},
               {"path": ".ai-dlc/tasks/T1.md", "operation": "create", "content": "# T1\n"}]
    ar = gi.apply_file_changes("P1", "T1", changes)
    assert ar.applied and set(ar.changed_files) == {"src/app.py", ".ai-dlc/tasks/T1.md"}
    pr = gi.publish_task_changes("P1", None, "T1", "Implement", "feat")
    assert pr.status == "PUSHED" and pr.published and pr.commit_sha
    assert pr.branch == "project/P1"


def test_new_file_in_changeset(gi):
    """GIT-AC-004: brand-new files appear in the changeset/diff and commit."""
    gi.initialize_project_repository("P2")
    gi.apply_file_changes("P2", "T1", [{"path": "brand_new.txt", "operation": "create", "content": "x"}])
    cs = gi.get_task_changes("P2", "T1")
    assert cs.hasChanges and "brand_new.txt" in cs.changedFiles


def test_idempotent_republish_no_new_commit(gi):
    """GIT-AC-002: re-publishing the same task pushes the existing commit (no new one)."""
    gi.initialize_project_repository("P3")
    gi.apply_file_changes("P3", "T1", [{"path": "a.txt", "operation": "create", "content": "a"}])
    first = gi.publish_task_changes("P3", None, "T1", "t", "feat")
    second = gi.publish_task_changes("P3", None, "T1", "t", "feat")
    assert first.commit_sha == second.commit_sha  # same SHA, no duplicate commit


def test_path_safety_rejects_escape(gi):
    gi.initialize_project_repository("P4")
    with pytest.raises(PathSafetyError):
        gi.apply_file_changes("P4", "T1", [{"path": "../escape.txt", "operation": "create", "content": "x"}])
    with pytest.raises(PathSafetyError):
        gi.apply_file_changes("P4", "T2", [{"path": ".git/config", "operation": "update", "content": "x"}])


def test_no_changes(gi):
    gi.initialize_project_repository("P5")
    pr = gi.publish_task_changes("P5", None, "T-none", "t", "feat")
    assert pr.status == "NO_CHANGES" and not pr.published


def test_connected_flow_with_real_git(uow, bare_remote, tmp_path):
    """ORCH-4/5 with the real GitInterface injected: task publishes a REAL commit (not stub)."""
    from app.common.models import AgentProfile, ProjectTask
    from app.orchestrator import deps, service, worker
    from app.pm import service as pm
    from app.ports.git_port import LocalStubGit

    real = GitInterface(remote=bare_remote, checkout_root=str(tmp_path / "co"), timeout=60)
    deps.set_git_port(real)
    try:
        with uow() as db:
            p = pm.create_project(db, {"name": "RG", "budgetLevel": "MEDIUM", "projectSize": "SMALL",
                                       "gitRepository": {"repositoryUrl": bare_remote}})
            pid = p["id"]
            pm_prof = db.execute(select(AgentProfile).where(AgentProfile.name == "PM Lead")).scalars().first()
            be = db.execute(select(AgentProfile).where(AgentProfile.name == "Backend Engineer")).scalars().first()
            pm.assign_agents(db, pid, {"agents": [
                {"agentProfileId": pm_prof.id, "roleCode": "PM", "isPrimaryPm": True},
                {"agentProfileId": be.id, "roleCode": "BACKEND"},
            ]})
            plan = service.create_plan(db, pid, {"requestId": "c1", "instruction": "Build",
                "steps": [{"title": "Impl", "roleCode": "BACKEND", "milestoneTitle": "M1"}]})
            service.review_complete(db, plan["id"], {"requestId": "rc", "expectedVersion": 1})
            service.approve_plan(db, plan["id"], {"requestId": "ap", "expectedVersion": 1})

        assert worker._run_one_task(pid) is True

        with uow() as db:
            t = db.execute(select(ProjectTask).where(ProjectTask.project_id == pid)).scalars().first()
            assert t.status == "COMPLETED"
            from app.common.models import TaskPublish
            pub = db.execute(select(TaskPublish).where(TaskPublish.task_id == t.id)).scalars().first()
            assert pub.status == "PUSHED"
            assert pub.commit_sha and not pub.commit_sha.startswith("stub")  # a real git SHA
    finally:
        deps.set_git_port(LocalStubGit())  # restore for other tests
        worker._provider = worker._provider  # no-op; keep provider
