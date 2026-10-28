# 0005: Pool price data across all households

- **Status:** accepted
- **Date:** 2026-10-28

## Context

Suggesting the cheapest shop needs prices from many shops. One household's receipts only cover the shops it already visits, so comparisons would be thin. The app is open to other households, starting in Romania (RON) and expanding across Europe (EUR).

## Options considered

1. Use only your own household's receipts.
2. Pool prices from all households' receipts, anonymously.

## Decision

Option 2. Each receipt line also produces an anonymous price observation: product, shop, unit price, currency, date. Nothing in it links back to a household or person.

- **Shared:** the product catalogue, shops, price observations, and learned receipt aliases (e.g. at a given chain, "GARL 250G" = garlic).
- **Private to the household:** receipts and their photos, pantry, meal plans, shopping lists, recipes, spending totals.

## Consequences

- Price comparison works from day one for any shop someone has scanned, and gets better as more households join.
- Ingredient matching improves for everyone: one correction teaches the alias to all households.
- Products and shops become a global catalogue instead of per-household data, which is harder to change later.
- Prices are only compared within the same currency and country.
- GDPR: a privacy notice must explain the pooling before other households sign up. Receipt parsing must drop personal data that receipts can contain (card digits, loyalty-card numbers, names).
