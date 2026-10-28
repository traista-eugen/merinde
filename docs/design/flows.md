# Key flows

_Approved by the user 2026-10-28. Screens are specced in [recipes.md](recipes.md), [pantry-plan-list.md](pantry-plan-list.md) and [scanning-spending.md](scanning-spending.md)._

## 1. Write a recipe, refine it in place, make a variant

Stories [#3](https://github.com/traista-eugen/merinde/issues/3)–[#7](https://github.com/traista-eugen/merinde/issues/7).

| # | Where | User | App |
|---|-------|------|-----|
| 1 | Recipes | Taps `+` | New recipe sheet, field focused |
| 2 | New recipe | Types or dictates "something with the spinach and the telemea, for 4", taps Write recipe | Sheet closes; Recipe pushes in its working state; `recipe-generate` runs with the pantry |
| 3 | Recipe (writing) | Waits, or leaves | Skeleton and "Using 23 pantry items, 3 expire soon". Result saved as Original, version 1. A toast offers "Open" if they left |
| 4 | Recipe | Reads; sees "1 missing, 1 not enough" | Each ingredient shows have / not enough / missing |
| 5 | Change bar | Types "make it in a pan, no oven", taps Update | `recipe-edit`; "Updating Original…"; the recipe stays readable |
| 6 | Recipe | — | Version 2 saved; changed lines highlighted; bar shows "Version 2 · Cooked in a pan instead of the oven", Undo |
| 7 | Change bar | Types "no eggs", taps New variant | Chip "No eggs…" with spinner; `recipe-variant`; switches to it when done |

- **One tap from the pantry card:** "Variant without them" sends a pre-written request ("without phyllo sheets and sour cream") straight to step 7. "Add to list" adds the missing items.
- **Undo** restores version 1 as version 3; history is never lost.

## 2. Plan the next days, shop, restock

Stories [#11](https://github.com/traista-eugen/merinde/issues/11)–[#15](https://github.com/traista-eugen/merinde/issues/15), [#29](https://github.com/traista-eugen/merinde/issues/29), [#35](https://github.com/traista-eugen/merinde/issues/35), [#36](https://github.com/traista-eugen/merinde/issues/36).

| # | Where | User | App |
|---|-------|------|-----|
| 1 | Plan | Sets 3 days, picks meals per day, taps Plan 6 meals | `meal-plan` with everyone's diets; skeleton cards; "Planning 3 days… spinach, dill and chicken first" |
| 2 | Plan | Reviews the days; plans one meal or a whole day again | Swap sheet: Plan again, or pick a saved recipe (favourites first) |
| 3 | Plan | Taps "Add to list" on "11 missing for 3 days" | Merged into the list, no duplicates; toast "Added 11 items · Undo" |
| 4 | List (in the store) | Reads the cheapest-shop card | "Lidl ≈ 84 RON · split Kaufland + Lidl saves 6 RON" |
| 5 | List | Ticks items with a thumb, even with no signal | Item moves to "In the cart" with their initials, haptic, added to the pantry with an estimated expiry. Offline ticks sync later |
| 6 | List | Unticks by mistake | Removed from the pantry again |
| 7 | List | Taps Done shopping | Sheet: "6 items went to the pantry. Scan the receipt to record what you paid." Scan receipt / Not now |
| 8 | Pantry | — | New items show with estimated dates (`~`) |


## 3. Scan a receipt, review matches, save

Story [#16](https://github.com/traista-eugen/merinde/issues/16).

| # | Where | User | App |
|---|-------|------|-----|
| 1 | List → Done shopping (or Spending `+`, Pantry → Add food) | Taps Scan receipt | System document camera; auto-captures; retake allowed; saved as JPEG (the API takes no HEIC) |
| 2 | Review receipt | Waits | `receipt-parse`; lines appear as skeletons; known aliases match instantly |
| 3 | Review receipt | Checks shop, date, total | Lines needing a look come first ("Check these · 3"), then matched lines |
| 4 | Review receipt | Taps a line marked Check, picks the right product | Saved as an alias for that chain, for every household |
| 5 | Review receipt | Turns off non-food lines (bags) | Excluded from the pantry, still counted in spending |
| 6 | Review receipt | Sees "Already added from the list · 5" | Not added to the pantry twice |
| 7 | Review receipt | Taps Save | Pantry updated, spending recorded, anonymous prices created; toast "Saved · 187,40 RON at Lidl" |

## 4. Quick-add to the pantry by text or voice

Story [#8](https://github.com/traista-eugen/merinde/issues/8).

| # | Where | User | App |
|---|-------|------|-----|
| 1 | Pantry | Taps `+` | Add food sheet: field focused, mic, and Barcode / Receipt / Expiry date buttons |
| 2 | Add food | Types "6 eggs, half a bag of rice, spinach", or taps the mic and speaks | Live transcript fills the field (on-device speech) |
| 3 | Add food | Taps Read items | `pantry-parse`; skeleton rows |
| 4 | Review items | Checks "Eggs · 6 · ~3 weeks", "Rice · 500 g · ~1 year", "Spinach · 1 bag · ~4 days" | Edits a quantity or date inline; "Read date from label" per row |
| 5 | Review items | Taps Add 3 items | Saved; the pantry re-sorts by expiry; toast with Undo |
