# Functional Design Plan — U2 `backend-git`

> Stage: CONSTRUCTION / Functional Design (Planning) · Unit: backend-git · Date: 2026-09-08
> Scope: GitInterface (real subprocess git) + publish integration. Stories GIT-1, GIT-2 (+ ORCH-4/5).
> Inputs: unit-of-work.md, `03` (GitHub Interface), `06` §2.2/§7, system NFR. Implements the `GitPort` protocol U1 defined so it drops in behind `deps.set_git_port(...)`.

## Methodology & Approach
`03` fixes the GitInterface method set, subprocess rules, path-safety, and error handling; `06` §2.2/§10 fix publish preconditions + idempotency. This stage **adopts those verbatim** and resolves only the small integration gaps below.

## Functional Design Decisions (recommended defaults — override any `[Answer]:`)

### Q1 — Interface conformance
**Recommended**: Implement `03` §5.2 methods (`initialize_project_repository`, `sync_milestone_repository`, `read_repository_file`, `apply_file_changes`, `get_task_changes`, `publish_task_changes`) AND satisfy U1's `GitPort` protocol (`apply_file_changes`→ApplyResult, `publish_task_changes`→PublishResult, `initialize_project_repository`→dict) so it replaces `LocalStubGit` with no U1 changes.
[Answer]: Implement 03 methods + conform to U1 GitPort (recommended)

### Q2 — Real git execution
**Recommended**: `subprocess.run(["git", ...], cwd=checkout, timeout=GIT_SUBPROCESS_TIMEOUT, check=True)` — arg arrays, **no shell**; per-project checkout at `CHECKOUT_ROOT/{projectId}`; branch `project/{projectId}`; credentials from server env only. Real clone + real push to `GIT_REMOTE`.
[Answer]: subprocess git, per-project checkout, real push (recommended)

### Q3 — Publish preconditions & idempotency (06 §2.2/§10)
**Recommended**: `publish_task_changes` receives artifactVersion/qaRunId/approvedPlanVersion/requestId and re-validates server-side (gate PASSED, hash match) — never trusts client `approved`. Push failure → `COMMITTED_LOCAL` (keep SHA); same requestId retry re-pushes existing commit (no dup). Remote divergence → `SYNC_REQUIRED` (no force-push/auto-merge). No changes → `NO_CHANGES`.
[Answer]: Server-validated, idempotent, SYNC_REQUIRED on divergence, no force-push (recommended)

### Q4 — Path safety (03 §5.5)
**Recommended**: `resolve_repository_path` — checkout-relative only; reject absolute/traversal/symlink-escape and any `.git` access; stage only the task's ChangeSet paths with `--` boundary. `get_task_changes` includes untracked + deleted files.
[Answer]: Path-safety + ChangeSet-scoped staging (recommended)

### Q5 — Wiring / mode
**Recommended**: New env `GIT_MODE=stub|real` (default `stub` for reliable demos, consistent with Q1's demo-default philosophy). When `real`, `app.main` calls `deps.set_git_port(GitInterface(...))` at startup. Real mode requires git credentials in the environment; missing creds → publish returns `FAILED` with a clear error (never crashes the worker).
[Answer]: GIT_MODE flag (default stub), inject real GitInterface when real (recommended)

## Mandatory Functional Design Artifacts (generation checklist)
- [x] `construction/backend-git/functional-design/business-logic-model.md` — clone/sync/read/apply/diff/publish flows + git command sequences
- [x] `construction/backend-git/functional-design/business-rules.md` — path-safety, idempotency, no-force-push, precondition validation, error mapping
- [x] `construction/backend-git/functional-design/domain-entities.md` — checkout/ChangeSet model + relation to TaskPublish (owned by U1)
- [x] (No frontend-components.md — backend-only)
- [x] Validate against 03 + 06 §2.2/§7

## Approval
Approve this plan (defaults) to generate U2 functional-design artifacts, or edit any `[Answer]:`.
