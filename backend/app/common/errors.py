"""Error envelope + typed exceptions (06 §4.3)."""
from __future__ import annotations

from typing import Any
import logging
from uuid import uuid4

log = logging.getLogger("companyops.errors")

from fastapi import Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    """Domain error carrying a stable code + HTTP status (06 §4.3)."""

    def __init__(self, code: str, message: str, status: int = 400, details: Any = None,
                 request_id: str | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.details = details or {}
        self.request_id = request_id

    def envelope(self) -> dict:
        return {
            "code": self.code,
            "message": self.message,
            "details": self.details,
            "requestId": self.request_id,
        }


# Convenience constructors -------------------------------------------------
def bad_request(message: str, code: str = "BAD_REQUEST", **kw) -> AppError:
    return AppError(code, message, 400, **kw)


def not_found(message: str, code: str = "NOT_FOUND", **kw) -> AppError:
    return AppError(code, message, 404, **kw)


def conflict(message: str, code: str = "CONFLICT", **kw) -> AppError:
    return AppError(code, message, 409, **kw)


def stale_version(message: str = "계획 버전이 변경되었습니다.", **kw) -> AppError:
    return AppError("STALE_VERSION", message, 409, **kw)


def external_error(message: str, code: str = "EXTERNAL_ERROR", **kw) -> AppError:
    return AppError(code, message, 502, **kw)


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(status_code=exc.status, content=exc.envelope())


async def unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = str(uuid4())
    log.error("Unhandled request %s: %s %s", request_id, request.method, request.url.path,
              exc_info=(type(exc), exc, exc.__traceback__))
    return JSONResponse(
        status_code=500,
        content={"code": "INTERNAL", "message": "요청을 처리하지 못했습니다. 잠시 후 다시 시도하세요.", "details": {}, "requestId": request_id},
    )
