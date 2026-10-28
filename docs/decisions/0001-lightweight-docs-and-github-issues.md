# 0001: Lightweight markdown docs and GitHub Issues for planning

- **Status:** accepted
- **Date:** 2026-10-28

## Context

We're starting a new app from scratch. We need somewhere to brainstorm, capture requirements and decisions, and track work, without slowing down the early, exploratory phase.

## Options considered

1. **GitHub Spec Kit:** a structured spec → plan → tasks workflow for each feature.
2. **Lightweight markdown docs in the repo, with GitHub Issues and milestones for tracking.**

## Decision

Option 2. Docs live in `docs/`, work items live in GitHub Issues, and milestones mirror [roadmap.md](../roadmap.md).

## Consequences

- Low ceremony; easy to change direction while the idea is still forming.
- Docs only stay useful if they're updated alongside decisions (see the working agreements in `CLAUDE.md`).
- Spec Kit can still be adopted later for larger features if we want more structure.
