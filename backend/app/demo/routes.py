"""Server-owned scheduling: scripts send control commands, never write SQLite directly."""
import asyncio
import logging

from fastapi import APIRouter
from pydantic import BaseModel, Field
from sqlalchemy import select

from ..common.models import DemoReplay
from ..common.platform import write_locks, touch
from ..common.txn import mutate, mutate_async, read
from . import service

router = APIRouter(prefix="/api/demo/replay", tags=["demo replay"])
log = logging.getLogger("companyops.demo")


class StartIn(BaseModel):
    intervalSeconds: int = Field(default=3, ge=1, le=300)
    completionSeconds: int = Field(default=15, ge=1, le=3600)


@router.get("")
def get_status():
    return read(service.status)


@router.post("/start")
async def start(body: StartIn):
    pid = read(lambda db: service.target(db).id)
    async with write_locks.lock_for(pid):
        return mutate(lambda db: service.start(db, body.intervalSeconds, body.completionSeconds))


@router.post("/stop")
async def stop():
    pid = read(lambda db: service.target(db).id)
    async with write_locks.lock_for(pid):
        return mutate(service.stop)


def _fail(db, pid, error):
    r = db.get(DemoReplay, pid)
    if r:
        r.enabled, r.error = 0, error
        touch(db, pid, "demo.updated", pid, {"demo": True, "error": error})


async def scheduler_loop():
    while True:
        ids = read(lambda db: list(db.scalars(select(DemoReplay.project_id).where(DemoReplay.enabled == 1))))
        for pid in ids:
            async with write_locks.lock_for(pid):
                try:
                    # Git clone/push may block; keep health/snapshot/SSE responsive.
                    await mutate_async(lambda db: service.tick(db, pid))
                except Exception as exc:
                    log.exception("Replay stopped for %s", pid)
                    mutate(lambda db: _fail(db, pid, str(exc)))
        await asyncio.sleep(0.5)
