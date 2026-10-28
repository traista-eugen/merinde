# 0004: Supabase as the backend

- **Status:** proposed
- **Date:** 2026-10-28

## Context

Households need accounts, shared data that updates live for every member, photo storage (receipts, labels), and a server that holds the AI key. Two native apps need good SDKs. The deadline leaves no time to build a custom server.

## Options considered

1. **Supabase:** Postgres, Auth, Realtime, Storage, Edge Functions (TypeScript). Swift and Kotlin SDKs.
2. **Firebase:** Firestore, Auth, Storage, Cloud Functions. Mature native SDKs with a built-in offline cache.
3. **Custom server** (e.g. Node or Python with Postgres).

## Decision

Option 1 (proposed):

- The data is relational: products, shops, receipts and their lines, recipes with variants and versions.
- Price comparison and spending reports are plain SQL queries.
- Row Level Security keeps every row private to its household.

## Consequences

- The offline shopping list needs a small local cache in each app; Firebase would give this for free.
- Edge functions are written in TypeScript (Deno).
- Hosted free tier is enough for the hackathon and family use.
