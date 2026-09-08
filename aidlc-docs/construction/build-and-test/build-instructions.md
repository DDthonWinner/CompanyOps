# Build Instructions — CompanyOps (U1 backend-pm)

> Stage: CONSTRUCTION / Build and Test · Date: 2026-09-08
> Scope: unit **U1 backend-pm** (the first built unit). Frontend (U4/U5) and Git/UF (U2/U3) build steps are added when those units are generated.

## Prerequisites
- **Build tool**: Python venv + pip (no compiler needed; all deps ship wheels for cp314).
- **Runtime**: Python **3.14** (verified; 3.11+ supported). `python3.14-venv` package required for `python3 -m venv`.
- **Dependencies**: see `backend/requirements.txt`.
- **Environment variables**: copy `backend/.env.example` → `backend/.env` (demo defaults work as-is). Real mode needs `EXECUTION_MODE=openai` + `OPENAI_API_KEY`.
- **System**: any Linux/macOS; ~200MB for venv; SQLite (bundled with Python).

## Build steps
### 1. Install dependencies
```bash
cd backend
python3 -m venv venv
./venv/bin/python -m pip install --upgrade pip
./venv/bin/pip install -r requirements.txt
```
### 2. Configure environment + seed
```bash
cp .env.example .env
./venv/bin/python seed.py    # roles, llm_models, doc templates, starter profiles
```
### 3. Run
```bash
./venv/bin/uvicorn app.main:app --reload   # or ./run.sh
```
### 4. Verify build success
- **Expected**: server logs `CompanyOps backend started (execution_mode=demo).` and `Task worker started.`
- **Artifacts**: `backend/venv/`, `backend/data/companyops.db` (created on first run), OpenAPI at `/docs`, health at `/health`.
- **Acceptable warnings**: none expected on Python 3.14.

## Verified environment (this run)
- Python 3.14.4; installed: FastAPI 0.141.1, SQLAlchemy 2.0.52, pydantic 2.13.5, sse-starlette 3.4.11, uvicorn 0.52.4, openai 3.8.0, pytest 9.1.1. `pip install` exit 0.

## Troubleshooting
- **`ensurepip is not available` on venv create** → install `python3.14-venv` (`apt install python3.14-venv`), recreate venv.
- **Dependency build errors** → ensure pip is upgraded (`pip install --upgrade pip`) so cp314 wheels are selected.
- **Port in use** → set `PORT` in `.env`.
