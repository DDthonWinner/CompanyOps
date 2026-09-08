# System Tech-Stack Decisions — CompanyOps

> Stage: CONSTRUCTION / NFR Requirements · Scope: system-wide · Date: 2026-09-08
> Confirms the stack fixed by requirements §1.1 + build-time answers Q5–Q8. Versions are targets; exact pins finalized at Code Generation.

## Backend (`backend/`)
| Concern | Choice | Rationale |
|---|---|---|
| Language | **Python 3.11+** | Q7 |
| Env / deps | **venv + `requirements.txt`** | Q7; simple, no extra tooling |
| Web framework | **FastAPI** | requirements; async, typed, OpenAPI |
| ASGI server | **uvicorn** | standard FastAPI runtime |
| ORM | **SQLAlchemy 2.x** | Q7; over SQLite |
| DB | **SQLite** (file) | requirements; single stateful store (NFR-S3) |
| Validation/DTO | **Pydantic v2** | FastAPI-native; camelCase JSON via aliases |
| SSE | **sse-starlette** (or raw `StreamingResponse`) | Q8; `/events` snapshot-invalidation |
| Async worker | **asyncio task** (in-process) | D2; single sequential per-project writer |
| Git | **subprocess `git`** via GitInterface (U2) | `03`; arg arrays, no shell |
| LLM (real mode) | **`openai` SDK** (optional) | Q2; behind `EXECUTION_MODE=openai`; LangChain optional wrapper |
| Tests | **pytest** | NFR-S7; PBT off (Q11) |
| Migrations | SQLAlchemy `create_all` for MVP (Alembic optional later) | PoC simplicity |

## Frontend (`frontend/`)
| Concern | Choice | Rationale |
|---|---|---|
| Build / pkg mgr | **Vite + npm** | Q6 |
| Language | **React + TypeScript** | requirements |
| Styling | **Tailwind CSS** (Container Queries, Forms) | Design |
| Components | **shadcn/ui** (glassmorphism theme) | Design |
| State | **Zustand** (single snapshot store + UI slice) | D5 |
| 3D | **React Three Fiber + Three.js** (Orthographic isometric) | `05`, Design §8 |
| Charts (P2) | **Recharts** | `04`/Design |
| DnD (P2) | **dnd-kit** | `04`/Design |
| Icons | **Material Symbols Outlined** | Design |
| Fonts | **Space Grotesk / Inter / JetBrains Mono** | Design §6 |
| Tests | **Vitest + React Testing Library** | NFR-S7 |

## Repo / config
- **Monorepo** (D8): `backend/` + `frontend/` + top-level README/dev scripts.
- Config via env (`EXECUTION_MODE=demo|openai`, `OPENAI_API_KEY`, git remote/creds, DB path). `.env` git-ignored; never published to `TestOutput`.
- Local Storage: UI-only (selected tab, camera).
- **No CI/CD** (R-04a) — local dev scripts are the deployment path; version-pinned rollback (R-04b), direct/in-place deploy (R-04c).

## Notes
- SQLite JSON-ish arrays stored as TEXT (MVP); enums as CHECK constraints; UUIDs as TEXT; booleans as 0/1; datetimes ISO 8601 UTC.
- OpenAI adapter must have explicit timeouts and degrade to fixture mode on failure (NFR-S6).
