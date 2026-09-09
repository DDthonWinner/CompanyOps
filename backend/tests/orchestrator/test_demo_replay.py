"""Replay must expose intermediate states and satisfy the real completion gates."""
from dataclasses import replace
import sqlite3

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.common import models as m
from app.common.errors import AppError
from app.common.snapshot import build_snapshot
from app.common.txn import mutate, read
from app.config import get_settings
from app.db import unit_of_work
from app.demo import service as replay
from app.main import app
from app.orchestrator import deps, worker
from app.ports.git_port import LocalStubGit
from app.uf.adapter import UtilizationAdapter
from seed_demo import seed_demo


@pytest.fixture
def showcase(monkeypatch, tmp_path):
    monkeypatch.setattr(replay, 'get_settings', lambda: replace(get_settings(), backup_dir=str(tmp_path)))
    git = [LocalStubGit()]
    monkeypatch.setattr(deps, 'git_port', lambda: git[0])
    monkeypatch.setattr(deps, 'utilization_port', lambda: UtilizationAdapter())
    seed_demo()
    return git


def test_full_replay_two_cycles_restart_pause_and_isolation(showcase):
    with unit_of_work() as db:
        other = m.Project(name='Untouched', budget_level='LOW', budget_amount=120000,
                          project_size='SMALL', max_agent_count=8, status='READY', revision=17)
        db.add(other)
        db.flush()
        other_id = other.id
        pid = replay.target(db).id
        before = build_snapshot(db, pid)
    initial = mutate(lambda db: replay.start(db, 1, 2))
    with sqlite3.connect(initial['backupPath']) as saved:
        assert saved.execute('select count(*) from project_tasks').fetchone()[0] == len(before['tasks'])
    mutate(lambda db: replay.tick(db, pid, force=True))
    first = read(lambda db: build_snapshot(db, pid))
    assert first['project']['progressPercent'] == 0
    assert {t['id'] for t in first['tasks']} == {t['id'] for t in before['tasks']}
    assert {a['id'] for a in first['agents']} == {a['id'] for a in before['agents']}
    seen = set()
    completed = 0
    count_at_completion = None
    for _ in range(250):
        mutate(lambda db: replay.tick(db, pid, force=True))
        snap = read(lambda db: build_snapshot(db, pid))
        seen.update(t['status'] for t in snap['tasks'])
        assert read(lambda db: worker._next_executable(db, pid)) is None
        if 'RUNNING' in {t['status'] for t in snap['tasks']}:
            showcase[0] = LocalStubGit()
            worker.recover_incomplete()
            assert read(lambda db: build_snapshot(db, pid))['tasks'] == snap['tasks']
        if snap['project']['status'] == 'COMPLETED':
            completed += 1
            assert snap['project']['progressPercent'] == 100
            assert all(x['reviewStatus'] == 'APPROVED' for x in snap['milestones'])
            assert all(x['technicalGate'] == 'PASSED' and x['demo'] for x in snap['qaRuns'])
            assert len(snap['git']) == len(snap['tasks'])
            assert snap['tokenUsage']['demo']
            assert all(a['status'] == ('WORKING' if a['isPrimaryPm'] else 'IDLE')
                       and a['currentTaskId'] is None for a in snap['agents'])
            with unit_of_work() as db:
                approvals = list(db.scalars(select(m.Approval).where(m.Approval.project_id == pid)))
                assert len(approvals) == 1 + len(snap['milestones'])
                assert all(a.actor == 'demo-replay' for a in approvals)
                assert db.get(m.PlanVersion, snap['project']['activePlanId']).status == 'COMPLETED'
                count = db.scalar(select(func.count()).select_from(m.TaskAttempt))
                if count_at_completion is not None:
                    assert count == count_at_completion
                count_at_completion = count
            if completed == 2:
                break
    assert completed == 2
    assert {'WAITING', 'BLOCKED', 'RUNNING', 'REVIEW', 'COMPLETED'} <= seen
    mutate(replay.stop)
    paused = read(lambda db: build_snapshot(db, pid))
    mutate(lambda db: replay.tick(db, pid, force=True))
    assert read(lambda db: build_snapshot(db, pid)) == paused
    resumed = mutate(lambda db: replay.start(db, 1, 2))
    assert resumed['backupPath'] == initial['backupPath']
    mutate(lambda db: replay.tick(db, pid, force=True))
    assert read(lambda db: build_snapshot(db, pid))['project']['progressPercent'] == 0
    with unit_of_work() as db:
        assert db.get(m.Project, other_id).revision == 17
        assert db.get(m.Project, other_id).status == 'READY'
    client = TestClient(app)
    assert client.patch(f'/api/projects/{pid}', json={'name': 'Changed'}).status_code == 409
    assert client.get('/api/demo/replay').json()['cycle'] == 3
    assert client.post('/api/demo/replay/start', json={'intervalSeconds': 0}).status_code == 422


def test_due_time_and_invalid_configuration(showcase, monkeypatch):
    initial = mutate(replay.start)
    pid = initial['projectId']
    mutate(lambda db: replay.tick(db, pid))
    snap = read(lambda db: build_snapshot(db, pid))
    mutate(lambda db: replay.tick(db, pid))
    assert read(lambda db: build_snapshot(db, pid)) == snap
    monkeypatch.setattr(replay, 'get_settings', lambda: replace(get_settings(), git_mode='real'))
    with pytest.raises(AppError):
        mutate(replay.start)
    assert read(lambda db: build_snapshot(db, pid)) == snap


def test_fast_pm_keeps_working_and_development_has_durable_brief_blocks(showcase):
    from datetime import datetime, timezone

    pid = mutate(lambda db: replay.start(db, 3, 15))['projectId']
    mutate(lambda db: replay.tick(db, pid, force=True))
    with unit_of_work() as db:
        r = db.get(m.DemoReplay, pid)
        assert replay._next_delay(db, r) == replay.PM_INTERVAL_SECONDS
        assert (datetime.fromisoformat(r.next_tick_at) - datetime.now(timezone.utc)).total_seconds() <= replay.PM_INTERVAL_SECONDS
        role = db.scalar(select(m.Role).where(m.Role.code == 'FRONTEND'))
        task_id = list(db.scalars(select(m.ProjectTask).where(
            m.ProjectTask.project_id == pid, m.ProjectTask.role_id == role.id)
            .order_by(m.ProjectTask.sort_order, m.ProjectTask.id)))[1].id
    for _ in range(80):
        mutate(lambda db: replay.tick(db, pid, force=True))
        snap = read(lambda db: build_snapshot(db, pid))
        if next(t for t in snap['tasks'] if t['id'] == task_id)['status'] == 'RUNNING':
            break
    else:
        pytest.fail('Development never started')
    pm = next(a for a in snap['agents'] if a['isPrimaryPm'])
    pm_tasks = [t for t in snap['tasks'] if t['roleId'] == pm['roleId']]
    assert all(t['status'] == 'COMPLETED' for t in pm_tasks)
    assert pm['status'] == 'WORKING' and pm['currentTaskId'] is None
    assert '조율' in pm['activitySummary']

    def task():
        return read(lambda db: db.get(m.ProjectTask, task_id))
    mutate(lambda db: replay.tick(db, pid, force=True))
    assert task().status == 'RUNNING'  # previously it would already be in REVIEW
    mutate(lambda db: replay.tick(db, pid, force=True))
    assert task().status == 'BLOCKED'
    assert task().wait_reasons == ['DEMO_BLOCK:API 응답 형식 확인 중']
    with unit_of_work() as db:
        plan = db.get(m.PlanVersion, db.get(m.Project, pid).active_plan_id)
        assert plan.scope['demoPacing'][task_id] == {'workTicks': 2, 'interrupted': True}
    showcase[0] = LocalStubGit()  # drop process-local publisher state
    worker.recover_incomplete()
    mutate(lambda db: replay.tick(db, pid, force=True))
    assert task().status == 'RUNNING' and task().wait_reasons == []  # resumed; workTicks stays 2
    # Development is durable: it keeps working for several ticks before reaching review.
    for _ in range(replay.DEVELOPMENT_WORK_TICKS):
        mutate(lambda db: replay.tick(db, pid, force=True))
        if task().status == 'REVIEW':
            break
    else:
        pytest.fail('Development never reached review')
    assert task().status == 'REVIEW'
    mutate(lambda db: replay.tick(db, pid, force=True))
    assert task().status == 'COMPLETED'
    with unit_of_work() as db:
        assert db.scalar(select(func.count()).select_from(m.TaskAttempt).where(m.TaskAttempt.task_id == task_id)) == 1
        assert db.scalar(select(func.count()).select_from(m.TokenUsage).where(m.TokenUsage.task_id == task_id)) == 1
