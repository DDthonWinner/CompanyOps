"""Local browser access boundary; not a substitute for user authentication."""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse


def configure_browser_access(app: FastAPI, origins: tuple[str, ...]) -> None:
    if not origins or any(origin == "*" or origin == "null" for origin in origins):
        raise ValueError("CORS_ORIGINS must contain explicit trusted origins")

    @app.middleware("http")
    async def reject_untrusted_writes(request: Request, call_next):
        origin = request.headers.get("origin")
        # CORS alone only hides responses; simple cross-origin POSTs can still mutate data.
        if request.method not in {"GET", "HEAD", "OPTIONS"} and origin is not None and origin not in origins:
            return JSONResponse(status_code=403, content={
                "code": "UNTRUSTED_ORIGIN", "message": "허용되지 않은 화면에서 보낸 요청입니다.",
                "details": {}, "requestId": None,
            })
        return await call_next(request)

    app.add_middleware(CORSMiddleware, allow_origins=list(origins), allow_credentials=False,
                       allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
                       allow_headers=["Content-Type", "X-Request-ID"])
