# CompanyOps

A tycoon-style operations app where an operator creates projects, assigns an AI development team, drives a plan → approve → execute → review loop, and reviews AI-utilization outcomes. Two views share one shell: **Tycoon Office** (2.5D isometric) and **Dashboard** (Human–AI control center).

Built with the AWS **AI-DLC** methodology (see `aidlc-docs/`).

## Monorepo layout
```
backend/    FastAPI + SQLite + in-process task worker + SSE   (Python 3.11+)
frontend/   React + TypeScript + Vite + Tailwind + shadcn/ui + Zustand + R3F   (added in later units)
aidlc-docs/ AI-DLC process docs (requirements, design, construction)
requirements/ source product requirements
```

## Backend — quick start
```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # defaults are fine for demo mode
python seed.py                # seed roles/models/templates/starter profiles
./run.sh                      # or: uvicorn app.main:app --reload
```
API defaults to `http://127.0.0.1:8000`. Interactive docs at `/docs`. Health at `/health`.

### Execution modes
- `EXECUTION_MODE=demo` (default) — deterministic fixture provider; screens show "AI 서버 미연결 / 데모 데이터".
- `EXECUTION_MODE=openai` — real GPT via `OPENAI_API_KEY` (falls back to fixture on error).

Git publishing targets the fixed remote `https://github.com/DDthonWinner/TestOutput` (branch `project/{projectId}`); the real GitInterface lands in the `backend-git` unit — U1 uses a local stub.

## Status
Unit **U1 `backend-pm`** (PM + orchestration + platform + execution provider) is the first implemented unit. Frontend and the Git/UF units follow.
