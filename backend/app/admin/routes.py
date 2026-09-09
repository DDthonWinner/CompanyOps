"""Dev Admin HTTP routes: generic CRUD over every table. Local/contest tool, no auth."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Query

from . import service

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/tables")
def list_tables():
    return {"tables": service.list_tables()}


@router.get("/tables/{name}")
def get_rows(
    name: str,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    orderBy: str | None = Query(None),
):
    return service.get_rows(name, limit, offset, orderBy)


@router.post("/tables/{name}")
def create_row(name: str, body: dict[str, Any] = Body(...)):
    return service.create_row(name, body)


@router.patch("/tables/{name}/{pk}")
def update_row(name: str, pk: str, body: dict[str, Any] = Body(...)):
    return service.update_row(name, pk, body)


@router.delete("/tables/{name}/{pk}")
def delete_row(name: str, pk: str, cascade: bool = Query(False)):
    return service.delete_row(name, pk, cascade)
