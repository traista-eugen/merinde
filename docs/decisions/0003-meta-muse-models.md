# 0003: Meta Muse models first, behind a swappable backend layer

- **Status:** accepted
- **Date:** 2026-10-28

## Context

The app is built for the Meta Global AI Developer Hackathon, which is built around Meta's models. We may want to try other providers later. AI handles text (recipes, plans, parsing lists) and images (receipts, expiry labels).

## Options considered

1. Call the Meta Model API directly from each app.
2. Call it only from the backend, through one small module that wraps the provider.

## Decision

Option 2, with the Meta Model API:

- Base URL `https://api.meta.ai/v1`, OpenAI-SDK compatible, API key kept server-side only.
- Model `muse-spark-1.2` for both text and image tasks (check the [models page](https://ai.developer.meta.com/docs/models/) for newer versions).
- **Not** the `-contributor` tier: it's cheaper, but Meta may train on prompts and outputs, and we send family receipts and pantry data.
- Every AI call returns JSON checked against a schema before it's saved.

## Consequences

- No API key in the apps; both platforms get identical AI behaviour.
- Switching provider means changing the wrapper and retuning prompts, not touching the apps.
- The Meta Model API is in preview, so models and limits may change. Hackathon credits cover early usage.
