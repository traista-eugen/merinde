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
