# 0006: App in English and Romanian, following the phone

- **Status:** accepted
- **Date:** 2026-10-28

## Context

The first users are a Romanian family; the hackathon judges read English. Language affects every screen, every AI prompt and the demo video. It was an open question in [brainstorm.md](../brainstorm.md).

## Options considered

1. English only for the MVP.
2. Romanian only.
3. Both, following the phone's language.

## Decision

Option 3.

- One String Catalog (`Localizable.xcstrings`), English as the development language, Romanian added.
- The app follows the phone's language; the Household sheet links to the app's page in Settings to change it.
- AI output (recipes, plans, parsed items) comes back in the app language: the app sends its locale with every AI call.
- Product and shop names from receipts keep the receipt's text.
- Demo video in English.

## Consequences

- Every string goes through the catalog from day one; a Romanian translation pass is needed before the demo (4 Nov).
- Layouts must allow ~30% longer Romanian text and Romanian plurals ("1 zi", "2 zile", "20 de zile").
- Each AI edge function takes a `locale` input.
