import asyncio
import logging

import httpx
import pytest
from fastapi import FastAPI
from app.common.access import configure_browser_access
from app.common.errors import unhandled_handler


@pytest.fixture
def local_app():
    app = FastAPI()
    app.state.writes = 0
    configure_browser_access(app, ("http://localhost:5173",))
    @app.post("/change")
    async def change():
        app.state.writes += 1
        return {"ok": True}
    return app


def request(app, method, path, **kwargs):
    async def run():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app, raise_app_exceptions=False),
                                     base_url="http://testserver") as client:
            return await client.request(method, path, **kwargs)
    return asyncio.run(run())


def test_untrusted_simple_post_cannot_mutate(local_app):
    for origin in ("https://untrusted.example", "null"):
        response = request(local_app, "POST", "/change", content="x",
                           headers={"Origin": origin, "Content-Type": "text/plain"})
        assert response.status_code == 403
    assert local_app.state.writes == 0


def test_trusted_browser_and_local_cli_remain_usable(local_app):
    response = request(local_app, "POST", "/change", headers={"Origin": "http://localhost:5173"})
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert request(local_app, "POST", "/change").status_code == 200
    assert local_app.state.writes == 2
    preflight = request(local_app, "OPTIONS", "/change", headers={"Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"})
    assert preflight.status_code == 200


def test_wildcard_is_rejected():
    with pytest.raises(ValueError):
        configure_browser_access(FastAPI(), ("*",))


def test_unhandled_error_hides_details_but_logs_correlation(caplog):
    app = FastAPI()
    app.add_exception_handler(Exception, unhandled_handler)
    @app.get("/fail")
    async def fail():
        raise RuntimeError("private/internal/path")
    with caplog.at_level(logging.ERROR):
        response = request(app, "GET", "/fail")
    assert response.status_code == 500
    assert "private/internal/path" not in response.text
    assert response.json()["requestId"] in caplog.text
    assert "private/internal/path" in caplog.text
