"""Offline real-Git replay: per-task commits, repeat cycles, and failed push recovery."""
from dataclasses import replace
import subprocess

from sqlalchemy import delete, select

from app.common import models as m
from app.common.txn import mutate, read
from app.config import get_settings
from app.db import unit_of_work
from app.demo import service as replay
from app.git_interface.interface import GitInterface
from app.ports.git_port import PublishResult, LocalStubGit
from app.orchestrator import deps
from seed_demo import seed_demo


def git(*args):
    return subprocess.run(['git', *map(str, args)], capture_output=True, text=True, check=True).stdout.strip()


def test_two_cycles_real_commits_and_retry_after_failed_push(monkeypatch, tmp_path):
    remote = tmp_path / 'remote.git'
    git('init', '--bare', '-b', 'main', remote)
    root = str(tmp_path / 'checkouts')
    settings = replace(get_settings(), demo_replay_git_mode='real', backup_dir=str(tmp_path))
    monkeypatch.setattr(replay, 'get_settings', lambda: settings)
    monkeypatch.setattr(deps, 'git_port', lambda: LocalStubGit())
    current = [GitInterface(str(remote), root)]
    monkeypatch.setattr(replay, 'git_port', lambda: current[0])
    seed_demo()
    with unit_of_work() as db:
        pid = replay.target(db).id
        kept = {}
        for task in db.scalars(select(m.ProjectTask).where(m.ProjectTask.project_id == pid)):
            kept.setdefault(task.role_id, task.id)
        db.execute(delete(m.ProjectTask).where(m.ProjectTask.project_id == pid, m.ProjectTask.id.not_in(kept.values())))
    mutate(replay.start)
    branch = f'project/{pid}'
    completed, failed_once = 0, False
    for _ in range(100):
        current[0] = GitInterface(str(remote), root)
        if not failed_once:
            tasks = read(lambda db: list(db.scalars(select(m.ProjectTask).where(m.ProjectTask.project_id == pid))))
            if any(t.status == 'REVIEW' for t in tasks):
                real_publish = current[0].publish_task_changes
                def fail_after_commit(*args):
                    result = real_publish(*args)
                    return PublishResult(task_id=args[2], status='COMMITTED_LOCAL', published=False,
                                         commit_sha=result.commit_sha, error='simulated lost push acknowledgement')
                current[0].publish_task_changes = fail_after_commit
                mutate(lambda db: replay.tick(db, pid, force=True))
                state = read(replay.status)
                assert state['enabled'] is False and 'COMMITTED_LOCAL' in state['error']
                count = git('--git-dir', remote, 'rev-list', '--count', branch)
                current[0] = GitInterface(str(remote), root)
                mutate(replay.start)
                mutate(lambda db: replay.tick(db, pid, force=True))
                assert git('--git-dir', remote, 'rev-list', '--count', branch) == count
                failed_once = True
                continue
        mutate(lambda db: replay.tick(db, pid, force=True))
        with unit_of_work() as db:
            if db.get(m.Project, pid).status == 'COMPLETED':
                completed += 1
                pubs = list(db.scalars(select(m.TaskPublish).join(m.ProjectTask, m.TaskPublish.task_id == m.ProjectTask.id)
                                      .where(m.ProjectTask.project_id == pid, m.TaskPublish.status == 'PUSHED')))
                assert len(pubs) == 5
                assert all(len(p.commit_sha) == 40 for p in pubs)
                assert int(git('--git-dir', remote, 'rev-list', '--count', branch)) == 5 * completed
                for pub in pubs:
                    paths = git('--git-dir', remote, 'diff-tree', '--root', '--no-commit-id', '--name-only', '-r', pub.commit_sha).splitlines()
                    assert paths and all(p.startswith(f'.companyops/demo/tasks/{pub.task_id}/') for p in paths)
                if completed == 2:
                    break
    assert completed == 2 and failed_once
    assert not git('--git-dir', remote, 'show-ref', '--heads').endswith('refs/heads/main')
