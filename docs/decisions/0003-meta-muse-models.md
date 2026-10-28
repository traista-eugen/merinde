# 0003: Meta Muse models first, behind a swappable backend layer

- **Status:** accepted
- **Date:** 2026-10-28
- **Updated:** 2026-10-28: `muse-spark-1.2` → `muse-spark-1.3`, see [ai-models.md](../ai-models.md)

## Context

The app is built for the Meta Global AI Developer Hackathon, which is built around Meta's models. We may want to try other providers later. AI handles text (recipes, plans, parsing lists) and images (receipts, expiry labels).

## Options considered

1. Call the Meta Model API directly from each app.
2. Call it only from the backend, through one small module that wraps the provider.

## Decision

Option 2, with the Meta Model API:

- Base URL `https://api.meta.ai/v1`, OpenAI-SDK compatible, API key kept server-side only.
- Model `muse-spark-1.3` for all text and image-reading tasks: Meta's recommended version, same price as 1.2 ($1.25 in / $4.25 out per 1M tokens). Use `muse-spark-1.2` only if we send audio, which 1.3 doesn't fully support yet. Check the [models page](https://dev.meta.ai/docs/models) for newer versions.
- `muse-image-1.0` if we generate recipe photos ($0.01 each). Muse Wonder, Muse Voice Transcribe, SAM 3.1 and the open-weight models aren't used for now; see [ai-models.md](../ai-models.md).
- **Not** the `-contributor` tier: it's 12–20× cheaper, but Meta may train on prompts and outputs, and we send family receipts and pantry data.
- Every AI call uses structured output (`json_schema`) and is checked against the schema before it's saved.
- The model ID is set per function in backend config, so upgrading a model doesn't touch prompts or the apps.

## Consequences

- No API key in the apps; both platforms get identical AI behaviour.
- Switching provider means changing the wrapper and retuning prompts, not touching the apps.
- The Meta Model API is in preview, so models and limits may change. Hackathon credits cover early usage: roughly $0.004–0.05 per call, about $5 per family per month ([ai-models.md](../ai-models.md)).
