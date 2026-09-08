# U2 backend-git — Business Logic Model

> Stage: CONSTRUCTION / Functional Design · Unit: backend-git · Date: 2026-09-08
> Adopts `03` verbatim; conforms to U1 `GitPort`. Technology-aware (subprocess git) but no infra concerns.

## Module layout (03 §5.1)
```
git_interface/
├── interface.py      # GitInterface (public methods; implements GitPort)
├── workspace.py      # checkout path resolution, clone/branch, lock cooperation
├── file_access.py    # resolve_repository_path, read/apply changes, changeset
├── git_command.py    # run_git(args, cwd) subprocess wrapper
├── models.py         # ChangeSet, InitResult, SyncResult, PublishResult dataclasses
└── exceptions.py     # GitError, PathSafetyError, SyncRequired
```

## Command wrapper (03 §5.4)
```
run_git(args: list[str], cwd: Path) -> str:
    subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True,
                   timeout=GIT_SUBPROCESS_TIMEOUT, check=True).stdout
# arg arrays only; shell=False; credentials from server env
```

## Flows
### initialize_project_repository(project_id) → {checkoutPath, branch, baseCommitSha}
```
path = CHECKOUT_ROOT/{project_id}
if path exists with a valid repo: reuse (idempotent; do not overwrite)
else: git clone {GIT_REMOTE} {path}
if branch project/{project_id} exists (local/remote): switch to it
else: git switch -c project/{project_id}
return path, branch, current HEAD sha
```

### sync_milestone_repository(project_id, milestone_id) → {synced, headCommitSha}
```
git fetch origin
if remote project/{id} exists: git pull --ff-only origin project/{id}
else: reflect default branch latest
return head sha  # if content changed, caller re-runs QA on new artifact version
```

### read_repository_file(project_id, path) → {content, exists}
```
target = resolve_repository_path(checkout, path)   # safe
return file content or exists=False
```

### apply_file_changes(project_id, task_id, changes[]) → ApplyResult   (GitPort)
```
for change in changes:  # {path, operation: create|update|delete, content}
    target = resolve_repository_path(checkout, change.path)
    create/update: write content ; delete: remove
record ChangeSet[task_id] = {paths, contentHash=stable_hash(changes), baseCommitSha}
return ApplyResult(applied, changed_files, content_hash, base_commit_sha)
# checkout-only; no commit yet (03 §3.4)
```

### get_task_changes(project_id, task_id) → ChangeSet
```
git status --porcelain   # includes untracked + deleted (03 §10.1)
git diff --stat ; git diff
return changed_files (incl. new/deleted), diffStat, diff, contentHash
```

### publish_task_changes(project_id, milestone_id, task_id, task_title, commit_type,
                          artifact_version, qa_run_id, approved_plan_version, request_id) → PublishResult   (GitPort)
```
changes = ChangeSet[task_id]
if not changes: return NO_CHANGES
git add -- {changeset paths}                      # scoped staging (03 §10.1)
git commit -m "{commit_type}({task_id}): {task_title}"
git fetch origin
if remote project/{id} diverged from local base: return SYNC_REQUIRED   # no rebase/force
try: git push [-u] origin project/{id}
     return PUSHED(sha, branchUrl)
except push-auth/network error:
     return COMMITTED_LOCAL(sha, error)            # keep SHA; idempotent retry re-pushes
```
Idempotency (03 §10.2, 06 §10): same requestId retry pushes the **existing** commit (no new commit); if the SHA already exists on the remote, treat as PUSHED.

## GitPort conformance
`interface.py` exposes exactly the U1 `GitPort` surface (`initialize_project_repository`, `apply_file_changes`→ApplyResult, `publish_task_changes`→PublishResult). U1's PublishCoordinator already validates gate/hash/plan-version before calling publish; U2 re-checks and performs the real git work.

## Wiring (Q5)
`GIT_MODE=stub` (default) keeps `LocalStubGit`; `GIT_MODE=real` → `app.main` calls `deps.set_git_port(GitInterface(remote, checkout_root, timeout))` at startup. Missing credentials in real mode → publish returns `FAILED` with a clear message (never crashes the worker).
