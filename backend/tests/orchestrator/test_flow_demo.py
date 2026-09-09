"""The demo data must execute through the existing gates, not just look complete."""
from sqlalchemy import select
from app.common.models import Project, ProjectTask, SprintMilestone
from app.common.snapshot import build_snapshot
from app.common.util import new_uuid
from app.db import unit_of_work
from app.orchestrator import deps, service, worker
from app.orchestrator.execution.fixture import FixtureExecutionProvider
from app.ports.git_port import LocalStubGit
from seed_flow_demo import create_demo, TASKS


def test_five_role_demo_runs_from_decision_to_milestone_approval(monkeypatch):
    git = LocalStubGit()
    monkeypatch.setattr(deps, 'git_port', lambda: git)
    monkeypatch.setattr(deps, 'set_git_port', lambda port: None)
    monkeypatch.setattr(worker, '_provider', FixtureExecutionProvider())
    demo = create_demo()
    assert create_demo()['projectId'] == demo['projectId']
    pid = demo['projectId']
    with unit_of_work() as db:
        snapshot = build_snapshot(db, pid)
        assert len(snapshot['agents']) == 5
        assert len(snapshot['tasks']) == len(TASKS)
        assert snapshot['project']['progressCurrent'] == 2
        assert snapshot['tokenUsage']['demo'] is True
        assert all(t['assignedProjectAgentId'] for t in snapshot['tasks'])
        assert worker._next_executable(db, pid) is None
        service.resolve_decision(db, demo['decisionId'], {'answer': '샘플 데이터로 진행'})
    completed = 0
    while worker._run_one_task(pid):
        completed += 1
        assert completed <= len(TASKS)
    assert completed == 10
    with unit_of_work() as db:
        snapshot = build_snapshot(db, pid)
        assert snapshot['project']['progressPercent'] == 100
        assert snapshot['project']['status'] == 'ACTIVE'
        assert all(t['status'] == 'COMPLETED' for t in snapshot['tasks'])
        milestone = db.execute(select(SprintMilestone).where(SprintMilestone.project_id == pid)).scalar_one()
        # The worker may leave its last pending rows unflushed when composing the result;
        # a fresh transaction must still find a reviewable milestone result.
        result = service.get_milestone_result(db, milestone.id)
        assert result['reviewStatus'] == 'PENDING'
        service.review_milestone_result(db, milestone.id, {
            'requestId': new_uuid(), 'expectedResultVersion': result['version'],
            'reviewStatus': 'APPROVED', 'additionalValidation': 'NONE',
        })
        assert db.get(Project, pid).status == 'COMPLETED'
