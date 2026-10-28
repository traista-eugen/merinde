# Design

UI and UX for the Merinde iOS app. Tracked in [#27](https://github.com/traista-eugen/merinde/issues/27).

**Mockups:** [Merinde iOS design](https://claude.ai/artifact/JEBd6chJmEkSp5KMfzvdJz) (canvas with one artboard per screen; each has a light/dark switch under Tweaks). Private until shared from the canvas's Share menu.

## Direction

- **Logo:** Steam m, a paprika bowl whose steam draws an m ([brand.md](brand.md)).
- **Warm cookbook:** cream paper, deep paprika accent, New York serif titles over SF Pro.
- **Recipe covers:** every recipe has a cover colour, shown as a tile in lists and a full-colour header on the recipe page.
- **Standard iOS components** everywhere else; Liquid Glass comes free on iOS 26.
- **English and Romanian**, following the phone ([0006](../decisions/0006-app-languages.md)).

## Docs

| Doc | What | Status |
|-----|------|--------|
| [navigation.md](navigation.md) | Tabs, screen map, where scanning and settings live, first run, welcome video | Approved 28 Oct |
| [flows.md](flows.md) | The four key flows, step by step | Draft |
| [recipes.md](recipes.md) | Recipe list, new recipe, recipe page, change bar, history | Approved 28 Oct |
| [pantry-plan-list.md](pantry-plan-list.md) | Pantry, add food, review, item, cooked it, plan, list, compare shops, done shopping | Draft, awaiting review |
| [scanning-spending.md](scanning-spending.md) | Receipt review, barcode, expiry label, spending, price history | Not yet written |
| [brand.md](brand.md) | Logo (Steam m), app icon layers, lockups; SVGs in [brand/](brand/) | Approved 28 Oct |
| [design-system.md](design-system.md) | Colour, type, spacing, components, AI states, language, accessibility | Approved 28 Oct |

## Build order

| Day | Screens | Mockup page |
|-----|---------|-------------|
| 29 Oct (skeleton) | Tabs, Welcome, Household setup, Household sheet | 1 · Navigation & recipes |
| 30 Oct | Recipe list, New recipe, Recipe, change bar, History | 1 · Navigation & recipes |
| 31 Oct – 1 Nov | Pantry, Add food, Cooked it, Plan, List | 2 · Pantry, plan & list |
| 2–3 Nov | Receipt review, barcode, expiry label, Spending, price history | 3 (coming) |

## For the iOS build

- Colours: asset catalog colour sets named exactly as in [design-system.md](design-system.md#colour), plus `Cover1`–`Cover6`.
- Serif large titles app-wide via `UINavigationBarAppearance`; serif elsewhere via `.fontDesign(.serif)`.
- Tab order Plan, Recipes, List, Pantry, Spending ([0007](../decisions/0007-navigation.md)); default to Recipes until Plan exists.
- Every AI call: the shared [AI action states](design-system.md#ai-action-states); never block the screen.
- Backend asks: AI functions take `locale`; `recipe-generate` returns a `cover` (1–6).
