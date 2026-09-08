# CompanyOps

A tycoon-style operations app where an operator creates software **projects**, assigns a team of **AI agents**, drives a **plan → approve → execute → review** loop, and reviews an **AI-utilization score** when a project completes. Two views share one shell:

- **Tycoon Office** — a 2.5D isometric office (React Three Fiber) that mirrors live project state.
- **Dashboard** — a Human–AI control center: create projects, staff teams, review/approve plans and milestone results, watch QA/activity, and read AI-utilization feedback.

Built with the AWS **AI-DLC** methodology (process docs in `aidlc-docs/`).

## Monorepo layout
```
backend/       FastAPI + SQLite + in-process task worker + SSE     (Python 3.11+)
frontend/      React + TypeScript + Vite + Tailwind + Zustand + React Three Fiber
aidlc-docs/    AI-DLC process docs (requirements → design → construction)
requirements/  source product requirements
```

## Prerequisites
- **Python 3.11+** with the venv module. On Debian/Ubuntu you may need the matching venv package, e.g. `sudo apt install python3-venv` (or `python3.14-venv`).
- **Node.js 18+** and **npm**.
- **git** (only needed for `GIT_MODE=real`, i.e. real pushes).

---

## 1. Run the backend (terminal A)
```bash
cd backend
python3 -m venv venv
source venv/bin/activate                 # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                      # demo defaults are fine
python seed.py                            # seed roles, models, doc templates, starter agent profiles
uvicorn app.main:app --reload             # or: ./run.sh   (creates venv + seeds + serves)
```
- API: **http://127.0.0.1:8000** · interactive docs: **/docs** · health: **/health**
- On first run it creates `backend/data/companyops.db` (SQLite). Delete that file to reset all data (re-run `python seed.py` afterward).

## 2. Run the frontend (terminal B)
```bash
cd frontend
npm install
cp .env.example .env                      # VITE_API_BASE defaults to http://127.0.0.1:8000
npm run dev
```
Open **http://localhost:5173**.

---

## 3. Try the connected flow (demo mode)
Everything below works with the defaults (deterministic fixture AI, git publishing stubbed) — no API keys needed.

1. Open the app → **Dashboard** tab → click **+ 새 프로젝트 (New Project)**; give it a name, pick a Budget and Size, **create**. It becomes the active project.
2. In **팀 매칭 (Team Matching)** click **추천 받기 (Recommend)** → **배정 확정 (Assign)**. The project goes **READY** (PM is required and auto-included).
3. In the **command bar** (bottom), type an instruction (e.g. "Implement login API") and **보내기 (Send)** → a **Plan v1** appears in **Plan Review**.
4. In **Plan Review**: optionally **변경 요청 (Request Changes)**, then **검토 완료 (Review Complete)**, then **최종 실행 승인 (Final Execution Approval)**. Only final approval starts execution.
5. The in-process worker runs the task → technical QA → publish. Watch the **task board**, **Recent Commits**, and the **Tycoon Office** tab (the assigned agent’s desk/pawn reflects state) update live via SSE.
6. When the milestone’s tasks complete, an **Milestone 결과 승인 (Milestone Result Approval)** card appears in the **Attention Center** → **승인 (Approve)**. When all milestones are approved, the project becomes **COMPLETED**.
7. On completion, the **AI 활용 Feedback** section shows the auto-generated utilization report and **Score**.

Both tabs share one top bar (project picker, tabs, connection status) and stay in sync.

---

## 4. Configuration (`backend/.env`)
| Var | Default | Meaning |
|---|---|---|
| `EXECUTION_MODE` | `demo` | `demo` = deterministic fixture AI (shows "AI 서버 미연결 / 데모 데이터"); `openai` = real GPT |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | — / `gpt-4o-mini` | used only when `EXECUTION_MODE=openai` (falls back to fixture on error) |
| `GIT_MODE` | `stub` | `stub` = simulated publish (safe demos); `real` = real `git` clone/commit/**push** |
| `GIT_REMOTE` | `…/DDthonWinner/TestOutput` | target remote for `real` mode (branch `project/{projectId}`) |
| `DB_PATH` | `./data/companyops.db` | SQLite file |
| `QA_TEST_CMD` | (empty) | real test command run in the checkout; empty ⇒ labeled demo PASS |

**Real end-to-end** (optional): set `EXECUTION_MODE=openai` + `OPENAI_API_KEY`, and `GIT_MODE=real` with git credentials available in the server environment. Secrets stay in `.env` (git-ignored) and are never committed.

Frontend: `frontend/.env` → `VITE_API_BASE` (backend URL).

---

## 5. Run the tests
```bash
# Backend (25 tests): PM invariants, plan-first 409 guards, connected flow,
# real git against an offline file:// repo, UF scoring
cd backend && ./venv/bin/python -m pytest -q

# Frontend (19 tests): store revision guard, SSE backoff, attention derivation,
# plan-action version guards, UF gating
cd frontend && npm run test

# Frontend production build (typecheck + bundle)
cd frontend && npm run build
```

---

## 6. Troubleshooting
- **`ensurepip is not available` when creating the venv** → install your Python’s venv package (`sudo apt install python3-venv` / `python3.14-venv`) and recreate `backend/venv`.
- **Frontend can’t reach the API / CORS** → confirm the backend is on `:8000` and `frontend/.env`’s `VITE_API_BASE` matches.
- **Connection shows "연결 끊김"** → the backend isn’t running or the project isn’t selected; write actions are disabled while disconnected (by design).
- **Reset everything** → stop the backend, delete `backend/data/companyops.db`, re-run `python seed.py`.

## Status
All five units are implemented and tested (backend 25/25, frontend 19/19): `backend-pm`, `backend-git`, `backend-uf`, `frontend-tycoon`, `frontend-dashboard`. The Priority-1 connected flow works end-to-end. See `aidlc-docs/` for the full design and construction history.
