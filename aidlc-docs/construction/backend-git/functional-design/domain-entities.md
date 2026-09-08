# U2 backend-git — Domain Entities

> Stage: CONSTRUCTION / Functional Design · Unit: backend-git · Date: 2026-09-08
> U2 owns filesystem checkouts + in-memory ChangeSets; it does not add new DB tables. It reads repo config from PM (`git_repositories`) and writes publish outcomes via U1's `TaskPublish` (owned by U1).

## Filesystem / runtime entities
| Entity | Fields | Persistence |
|---|---|---|
| **Checkout** | projectId, path (`CHECKOUT_ROOT/{projectId}`), branch (`project/{projectId}`), baseCommitSha, headCommitSha | filesystem (not DB) |
| **ChangeSet** | taskId, attemptId, paths[], contentHash, baseCommitSha | in-memory per task (until publish) |

## Dataclasses (returned across the GitPort boundary)
| Type | Fields |
|---|---|
| `InitResult` | projectId, checkoutPath, branch, baseCommitSha |
| `SyncResult` | projectId, milestoneId, synced, headCommitSha |
| `ApplyResult` | taskId, applied, changedFiles[], contentHash, baseCommitSha |
| `ChangeSetView` | taskId, hasChanges, changedFiles[], diffStat, diff, contentHash |
| `PublishResult` | taskId, status, published, commitSha, branch, branchUrl, changedFiles[], error |

## Relationship to persisted state (owned by U1)
- Reads **GitRepository** (repository_url, default_branch) for the project.
- On publish, U1's PublishCoordinator writes a **TaskPublish** row using the `PublishResult` (status/commitSha/branchUrl/error) and, on PUSHED, flips the Task to COMPLETED.
- **ArtifactVersion.content_hash** (U1) must equal the ChangeSet contentHash validated by QA before publish (BG-7).

## Notes
- Checkouts and `.env`/credentials are git-ignored and never published to `TestOutput`.
- No schema migration for U2; it is a filesystem/subprocess adapter behind `GitPort`.
