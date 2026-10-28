# 0004: Supabase as the backend

- **Status:** accepted
- **Date:** 2026-10-28

## Context

Households need accounts, shared data that updates live for every member, photo storage (receipts, labels), and a server that holds the AI key. Two native apps need good SDKs. The deadline leaves no time to build a custom server.

## Options considered

1. **Supabase:** Postgres, Auth, Realtime, Storage, Edge Functions (TypeScript). Swift and Kotlin SDKs.
2. **Firebase:** Firestore, Auth, Storage, Cloud Functions. Mature native SDKs with a built-in offline cache.
3. **Custom server** (e.g. Node or Python with Postgres).

## Decision

Option 1, hosted in the EU (Frankfurt), the closest region to Romania and keeps data in the EU for GDPR:

- The data is relational: products, shops, receipts and their lines, recipes with variants and versions.
- Price comparison and spending reports are plain SQL queries.
- Row Level Security keeps every row private to its household.

## Consequences

- The offline shopping list needs a small local cache in each app; Firebase would give this for free.
- Edge functions are written in TypeScript (Deno).
- **Cost:** the free plan covers the hackathon and family use (500 MB database, about 1 GB storage), but it pauses after 7 days without use and has no backups. Move to Pro ($25/month) once other households depend on the app.
- Receipt photos are the main storage cost: shrink them before upload.
