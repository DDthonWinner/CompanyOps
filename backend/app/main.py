"""FastAPI application entrypoint for CompanyOps backend (U1)."""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .common.errors import AppError, app_error_handler, unhandled_handler
from .config import get_settings
from .db import init_db
from .orchestrator import routes as orch_routes
from .orchestrator import worker
from .pm import routes as pm_routes

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("companyops")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    worker.recover_incomplete()  # RUNNING → BLOCKED after restart (06 §5.2)
    task = asyncio.create_task(worker.worker_loop())
    log.info("CompanyOps backend started (execution_mode=%s).", get_settings().execution_mode)
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
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


@app.get("/health", tags=["platform"])
def health():
    """Shallow health (RESILIENCY-06). Deep DB check optional."""
    settings = get_settings()
    return {
        "status": "ok",
        "executionMode": settings.execution_mode,
        "demo": not settings.use_openai,
    }
