"""Generic table introspection + CRUD over the whole schema (Dev Admin).

Works off SQLAlchemy Core `Base.metadata`, so every mapped table is reachable
without per-table code and new tables show up automatically. TypeDecorators
(JSONList/JSONDict) are applied by Core, so JSON columns round-trip as
list/dict. Intended as a local/contest developer tool — there is NO auth.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy import Integer, Table, delete, func, insert, select, update
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from ..common.errors import bad_request, conflict, not_found
from ..db import Base, engine

# Import models so every table is registered on Base.metadata before use.
from ..common import models as _common_models  # noqa: F401
from ..uf import models as _uf_models  # noqa: F401


def _table(name: str) -> Table:
    table = Base.metadata.tables.get(name)
    if table is None:
        raise not_found(f"테이블을 찾을 수 없습니다: {name}", code="TABLE_NOT_FOUND")
    return table


def _pk_column(table: Table):
    cols = list(table.primary_key.columns)
    if len(cols) != 1:
        raise bad_request(
            f"단일 컬럼 PK만 편집할 수 있습니다: {table.name}", code="UNSUPPORTED_PK"
        )
    return cols[0]


def _column_meta(col) -> dict:
    fks = [f"{fk.column.table.name}.{fk.column.name}" for fk in col.foreign_keys]
    return {
        "name": col.name,
        "type": str(col.type),
        "primaryKey": col.primary_key,
        "nullable": col.nullable,
        "hasDefault": col.default is not None or col.server_default is not None,
        "foreignKey": fks[0] if fks else None,
    }


def list_tables() -> list[dict]:
    out: list[dict] = []
    with engine.connect() as conn:
        for table in Base.metadata.sorted_tables:
            count = conn.execute(select(func.count()).select_from(table)).scalar_one()
            out.append({
                "name": table.name,
                "rowCount": count,
                "primaryKey": [c.name for c in table.primary_key.columns],
                "columns": [_column_meta(c) for c in table.columns],
            })
    return out


def get_rows(name: str, limit: int, offset: int, order_by: str | None) -> dict:
    table = _table(name)
    stmt = select(table)
    if order_by:
        if order_by not in table.columns:
            raise bad_request(f"정렬 컬럼이 없습니다: {order_by}", code="BAD_ORDER_BY")
        stmt = stmt.order_by(table.columns[order_by])
    stmt = stmt.limit(limit).offset(offset)
    with engine.connect() as conn:
        total = conn.execute(select(func.count()).select_from(table)).scalar_one()
        rows = [dict(r._mapping) for r in conn.execute(stmt)]
    return {
        "table": name,
        "columns": [_column_meta(c) for c in table.columns],
        "primaryKey": [c.name for c in table.primary_key.columns],
        "rows": rows,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


def _clean_values(table: Table, data: dict) -> dict:
    """Keep only real columns; drop keys the caller doesn't own."""
    valid = {c.name for c in table.columns}
    return {k: v for k, v in data.items() if k in valid}


def _coerce_pk(col, value: str) -> Any:
    if isinstance(col.type, Integer):
        try:
            return int(value)
        except (TypeError, ValueError):
            raise bad_request(f"정수 PK가 아닙니다: {value}", code="BAD_PK")
    return value


def create_row(name: str, data: dict) -> dict:
    table = _table(name)
    values = _clean_values(table, data)
    if not values:
        raise bad_request("삽입할 값이 없습니다.", code="EMPTY_ROW")
    pk = _pk_column(table)
    try:
        with engine.begin() as conn:
            result = conn.execute(insert(table).values(**values))
            pk_val = values.get(pk.name)
            if pk_val is None and result.inserted_primary_key:
                pk_val = result.inserted_primary_key[0]
            row = conn.execute(select(table).where(pk == pk_val)).mappings().first()
    except IntegrityError as e:
        raise conflict(f"제약 위반: {e.orig}", code="INTEGRITY_ERROR")
    except SQLAlchemyError as e:
        raise bad_request(f"삽입 실패: {e}", code="INSERT_FAILED")
    return dict(row) if row else values


def update_row(name: str, pk_value: str, data: dict) -> dict:
    table = _table(name)
    pk = _pk_column(table)
    pk_val = _coerce_pk(pk, pk_value)
    values = _clean_values(table, data)
    values.pop(pk.name, None)  # never rewrite the primary key
    if not values:
        raise bad_request("수정할 값이 없습니다.", code="EMPTY_UPDATE")
    try:
        with engine.begin() as conn:
            res = conn.execute(update(table).where(pk == pk_val).values(**values))
            if res.rowcount == 0:
                raise not_found(f"행을 찾을 수 없습니다: {pk_value}", code="ROW_NOT_FOUND")
            row = conn.execute(select(table).where(pk == pk_val)).mappings().first()
    except IntegrityError as e:
        raise conflict(f"제약 위반: {e.orig}", code="INTEGRITY_ERROR")
    except SQLAlchemyError as e:
        raise bad_request(f"수정 실패: {e}", code="UPDATE_FAILED")
    return dict(row) if row else {}


def delete_row(name: str, pk_value: str) -> dict:
    table = _table(name)
    pk = _pk_column(table)
    pk_val = _coerce_pk(pk, pk_value)
    try:
        with engine.begin() as conn:
            res = conn.execute(delete(table).where(pk == pk_val))
            if res.rowcount == 0:
                raise not_found(f"행을 찾을 수 없습니다: {pk_value}", code="ROW_NOT_FOUND")
    except IntegrityError as e:
        raise conflict(f"외래키 참조로 삭제할 수 없습니다: {e.orig}", code="FK_CONSTRAINT")
    except SQLAlchemyError as e:
        raise bad_request(f"삭제 실패: {e}", code="DELETE_FAILED")
    return {"deleted": True, "table": name, "id": pk_value}
