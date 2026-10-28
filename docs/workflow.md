# Workflow

## Where things live

| What | Where |
|------|-------|
| Ideas, open questions | [brainstorm.md](brainstorm.md) |
| What we're building (MVP) | [requirements.md](requirements.md) |
| Work items and their status | GitHub Issues |
| Big-picture timeline | [roadmap.md](roadmap.md) + GitHub milestones |
| Why we chose X | [decisions/](decisions/) |

## From idea to shipped

1. Capture it in `brainstorm.md`.
2. When it's in scope, write it as a user story in `requirements.md`.
3. Open an issue with the **Feature** template, set a milestone, and add the issue number back in `requirements.md`.
4. Branch as `<issue-number>-short-name`, e.g. `12-user-login`.
5. Open a PR containing `Closes #12`; merging it closes the issue.

## Building in parallel

There are no GitHub Actions. Every check runs on our own machines and reports to GitHub as a **commit status** on the PR's latest commit. A new push has no statuses yet, so every push needs fresh checks and a fresh review.

| Status | Runs on | What it checks |
|--------|---------|----------------|
| `local/ios` | the Mac | `xcodebuild` build and tests on the iOS simulator |
| `local/backend` | the Windows PC | migrations and database tests (local Supabase in Docker), edge function tests |
| `local/review` | the Windows PC | independent Claude code review; `success` only when no findings are open |

A PR needs `local/review` plus the status for each part it touches: `ios/` needs `local/ios`, and `supabase/` needs `local/backend`.

### The loop

1. **Build:** one session per issue (or per area), on its own branch and worktree. iOS sessions run on the Mac over SSH; backend sessions run on the Windows PC.
2. **Test:** the builder runs its checks, posts its status with `scripts/status.sh`, and opens the PR with `Closes #n`. Builders never merge.
3. **Review:** a separate reviewer session reviews the PR, posts findings as PR comments, and sets `local/review`.
4. **Fix:** the builder addresses the comments, re-runs its checks and pushes. The new commit has no statuses, so it gets reviewed again. Repeat until clean.
5. **Merge:** the coordinating session squash-merges only when every required status on the latest commit is `success` and no findings are open.

### Posting a status

```bash
scripts/status.sh local/backend success "migrations and 42 tests passed"
```

It posts to the checked-out commit, which must already be pushed.

### Keeping parallel branches apart

- **Xcode:** use folder-synced groups (Xcode 16) so adding files doesn't edit `project.pbxproj`.
- **Database:** one new timestamped migration per change; never edit a merged migration.
- **Folders:** each area keeps to its own folders, e.g. `ios/Merinde/Features/Recipes/` and `supabase/functions/recipe-*`.
- **Shared code** (design system, shared models) changes in its own small PR, merged first.

## Labels

| Label | Use for |
|-------|---------|
| `feature` | New user-facing capability |
| `bug` | Something broken |
| `task` | Setup, tooling, refactoring, chores |
| `docs` | Documentation-only work |
| `priority: high` / `priority: low` | Unlabelled means normal priority |
| `area: …` | Added once the architecture is decided |

## Decisions

Any choice that would be hard to reverse or that someone might later ask "why?" about gets a short record: copy [decisions/0000-template.md](decisions/0000-template.md) to the next number.
