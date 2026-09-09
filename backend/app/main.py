"""FastAPI application entrypoint for CompanyOps backend (U1)."""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .admin import routes as admin_routes
from .common.errors import AppError, app_error_handler, unhandled_handler
from .config import get_settings
from .db import init_db
from .demo import routes as demo_routes
from .orchestrator import routes as orch_routes
from .orchestrator import worker
from .pm import routes as pm_routes
from .uf import routes as uf_routes

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("companyops")


def _wire_git_port() -> None:
    """Inject the real GitInterface (U2) when GIT_MODE=real; else keep LocalStubGit."""
    settings = get_settings()
    if settings.git_mode != "real":
        return
    try:
        from .git_interface.interface import GitInterface
        from .orchestrator import deps

        deps.set_git_port(GitInterface(
            settings.git_remote, settings.checkout_root, settings.git_subprocess_timeout_seconds
        ))
        log.info("GitInterface (real) wired → %s", settings.git_remote)
    except Exception as exc:  # noqa: BLE001 — never block startup on git wiring
        log.warning("Failed to wire real GitInterface (%s); using stub.", exc)


def _wire_utilization_port() -> None:
    """Inject the real UF adapter (U3) so project completion auto-generates a report."""
    try:
        from .orchestrator import deps
        from .uf.adapter import UtilizationAdapter

        deps.set_utilization_port(UtilizationAdapter())
        log.info("UtilizationAdapter (UF) wired.")
    except Exception as exc:  # noqa: BLE001
        log.warning("Failed to wire UtilizationAdapter (%s); using no-op stub.", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    _wire_git_port()
    _wire_utilization_port()
    worker.recover_incomplete()  # RUNNING → BLOCKED after restart (06 §5.2)
    task = asyncio.create_task(worker.worker_loop())
    replay_task = asyncio.create_task(demo_routes.scheduler_loop())
    log.info("CompanyOps backend started (execution_mode=%s, git_mode=%s).",
             get_settings().execution_mode, get_settings().git_mode)
    try:
        yield
    finally:
        task.cancel()
        replay_task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
        try:
            await replay_task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="CompanyOps API", version="0.1.0", lifespan=lifespan)

# CORS: single-user local dev; frontend on Vite dev server.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(Exception, unhandled_handler)

app.include_router(pm_routes.router)
app.include_router(orch_routes.router)
app.include_router(uf_routes.router)
app.include_router(demo_routes.router)


@app.middleware("http")
async def protect_replay_project(request, call_next):
    # Paused replays remain reserved: ordinary APIs must not invalidate the cursor.
    from .common.models import DemoReplay
    from .common.txn import read
    from fastapi.responses import JSONResponse

    parts = request.url.path.strip("/").split("/")
    if request.method in {"POST", "PUT", "PATCH", "DELETE"} and len(parts) >= 3 and parts[:2] == ["api", "projects"]:
        if read(lambda db: db.get(DemoReplay, parts[2]) is not None):
            return JSONResponse(status_code=409, content={
                "code": "DEMO_REPLAY_MANAGED", "message": "This project is controlled by demo replay.",
                "details": {}, "requestId": None})
    return await call_next(request)


@app.get("/health", tags=["platform"])
def health():
    """Shallow health (RESILIENCY-06). Deep DB check optional."""
    settings = get_settings()
    return {
        "status": "ok",
        "executionMode": settings.execution_mode,
        "demo": not settings.use_openai,
    }
