# U2 backend-git — Business Rules

> Stage: CONSTRUCTION / Functional Design · Unit: backend-git · Date: 2026-09-08
> Adopted from `03` §7/§10 + `06` §2.2/§7. Rule IDs prefixed BG-.

## Path safety (03 §5.5, §10.1)
- BG-1: Only checkout-relative paths allowed; reject absolute paths, `..` traversal, symlink escape, and any path containing `.git`.
- BG-2: Staging uses the explicit ChangeSet path list with a `--` boundary; never `git add .`.
- BG-3: `read_repository_file` never reads `.git` internals.

## Execution (03 §5.4)
- BG-4: All git via `subprocess.run(["git", ...], cwd=checkout, timeout=…, check=True)` — arg arrays, `shell=False`.
- BG-5: Credentials come from the server environment; never accepted as method input, never logged, never committed.
- BG-6: Every command uses the project checkout as `cwd`.

## Publish preconditions & integrity (06 §2.2, 03 §10.1)
- BG-7: `publish_task_changes` re-validates server-side: approvedPlanVersion == task.planVersion, technical gate PASSED, current ChangeSet hash == QA-validated hash. Client `approved=true` is never trusted.
- BG-8: Code + result MD are committed together in one Task commit.
- BG-9: If the checkout content changes after QA, it is a new artifact version → re-QA before publish.

## Idempotency & retry (03 §10.2, 06 §10)
- BG-10: Publish states: NO_CHANGES / COMMITTED_LOCAL / PUSHED / FAILED / SYNC_REQUIRED.
- BG-11: Push failure keeps the local commit + SHA; same-requestId retry pushes the existing commit (no duplicate). If the SHA already exists on the remote, recover as PUSHED.
- BG-12: `initialize_project_repository` re-call reuses the existing checkout/branch; never overwrites.
- BG-13: Empty ChangeSet → NO_CHANGES; a code/doc-generating task with no expected changes is not completed by the orchestrator.

## Prohibited (03 §7, §8.2)
- BG-14: No force-push, no auto-merge, no PR creation, no automatic conflict resolution, no direct writes to the default branch.
- BG-15: Remote divergence → SYNC_REQUIRED (caller re-syncs + re-QA); never auto-rebase/force.

## Locking (03 §1, 00 §5.2)
- BG-16: Per-project write-lock (owned by U1) is held across change→QA→publish; U2 operations run under it. Milestone human approval happens after publish and does not hold the lock.

## Error mapping (03 §7)
| Situation | Result |
|---|---|
| Clone failure | init failure (FAILED) |
| No checkout | request rejected |
| Pull conflict | sync failure + conflict files |
| Path outside repo / `.git` | PathSafetyError → rejected |
| No changed files | NO_CHANGES |
| Commit failure | keep changes, return failure |
| Push auth/network failure | COMMITTED_LOCAL + SHA + error |
| Remote divergence | SYNC_REQUIRED |
| Missing credentials (real mode) | FAILED with clear message (worker not crashed) |

## Mode (Q5)
- BG-17: `GIT_MODE=stub` (default) uses `LocalStubGit`; `real` injects the real GitInterface. UF Score/Comment never gate or influence publishing (06 §2.2).
