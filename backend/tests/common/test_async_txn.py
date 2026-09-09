import asyncio
import threading

import pytest

from app.common import platform
from app.common.models import Project
from app.common.sse import broker
from app.common.txn import mutate, mutate_async, read


def test_blocking_mutation_keeps_loop_responsive_and_finishes_before_cancel():
    pid = mutate(lambda db: _project(db))

    async def exercise():
        entered, release = threading.Event(), threading.Event()
        queue = broker.subscribe(pid)
        def op(db):
            entered.set()
            assert release.wait(3)
            db.get(Project, pid).description = 'committed'
            platform.touch(db, pid, 'project.updated', pid)
        task = asyncio.create_task(mutate_async(op))
        try:
            assert await asyncio.to_thread(entered.wait, 3)
            # The event loop can still service reads/cancellation during blocking Git work.
            assert queue.empty()
            assert read(lambda db: db.get(Project, pid).description) != 'committed'
            task.cancel()
            await asyncio.sleep(0)
            assert not task.done()
            release.set()
            with pytest.raises(asyncio.CancelledError):
                await task
            assert read(lambda db: db.get(Project, pid).description) == 'committed'
            assert queue.get_nowait()['projectId'] == pid
        finally:
            release.set()
            broker.unsubscribe(pid, queue)
    asyncio.run(exercise())


def _project(db):
    p = Project(name='Async', budget_level='LOW', budget_amount=120000,
                project_size='SMALL', max_agent_count=8)
    db.add(p)
    db.flush()
    return p.id
