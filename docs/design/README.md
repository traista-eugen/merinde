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
| [navigation.md](navigation.md) | Tabs, screen map, where scanning and settings live, first run, demo household, welcome video | Approved 28 Oct; expanded-MVP changes awaiting review |
| [flows.md](flows.md) | The four key flows, step by step | Approved with the screens |
| [recipes.md](recipes.md) | Recipe list, new recipe, recipe page, change bar, history | Approved 28 Oct; expanded-MVP changes awaiting review |
| [pantry-plan-list.md](pantry-plan-list.md) | Pantry, update pantry, review changes, item, cooked it, reminders, plan for 1–7 days, list, compare shops, done shopping | Approved 28 Oct; expanded-MVP changes awaiting review |
| [scanning-spending.md](scanning-spending.md) | Receipt review, fix match, barcode, expiry label, spending, product price history | Approved 28 Oct; expanded-MVP changes awaiting review |
| [brand.md](brand.md) | Logo (Steam m), app icon layers, lockups; SVGs in [brand/](brand/) | Approved 28 Oct |
| [design-system.md](design-system.md) | Colour, type, spacing, components, AI states, language, accessibility | Approved 28 Oct |

## Build order

| Day | Screens | Mockup page |
|-----|---------|-------------|
| 29 Oct (skeleton) | Tabs, Welcome (with demo link), Household setup, Household sheet, member diets and allergies | 1 · Navigation & recipes |
| 30 Oct | Recipe list (favourites filter), New recipe (who's eating), Recipe (servings, favourite, allergy card, nutrition strip), change bar, History | 1 · Navigation & recipes |
| 31 Oct | Pantry (swipe corrections, staples), Update pantry, Review changes, Item, Cooked it, reminders | 2 · Pantry, plan & list |
| 1 Nov | Plan for 1–7 days (setup, working, ready with day totals), List (offline, who ticked), Compare shops, Done shopping | 2 · Pantry, plan & list |
| 2 Nov | Receipt reading and review (discounts, pack size), Fix match | 3 · Scanning & spending |
| 3 Nov | Split shop, barcode, expiry label, Spending, Product (unit prices), Food waste | 2 and 3 |
| 4 Nov | Demo household badge and sheet | 1 · Navigation & recipes |

## Expanded MVP coverage

Stories added on 28 Oct and where they're designed.

| Story | Where | Artboards |
|-------|-------|-----------|
| [#11](https://github.com/traista-eugen/merinde/issues/11) Plan 1–7 days | Plan tab | PlanEmpty, PlanWorking, PlanReady |
| [#28](https://github.com/traista-eugen/merinde/issues/28) Diets and allergies | Household → member; allergy card on recipes; who's eating in New recipe and Plan | MemberDiets, RecipeAllergy, NewRecipe, PlanEmpty |
| [#29](https://github.com/traista-eugen/merinde/issues/29) Who ticked | List rows | ShoppingList |
| [#30](https://github.com/traista-eugen/merinde/issues/30) Servings | Recipe | RecipeDetail, RecipeAllergy |
| [#31](https://github.com/traista-eugen/merinde/issues/31) Favourites | Recipe toolbar, list filter, plan setup | RecipesList, RecipeDetail, PlanEmpty |
| [#32](https://github.com/traista-eugen/merinde/issues/32) Quick corrections | Pantry swipe; Update pantry by text or voice | Pantry, AddFood, PantryCorrections |
| [#33](https://github.com/traista-eugen/merinde/issues/33) Staples | Pantry Staples section | Pantry |
| [#34](https://github.com/traista-eugen/merinde/issues/34) Food waste | Spending → Food waste | Spending, FoodWaste |
| [#35](https://github.com/traista-eugen/merinde/issues/35) Split shop | List card, Compare shops | ShoppingList, CompareShops |
| [#36](https://github.com/traista-eugen/merinde/issues/36) Offline list | List banner, sync icon | ShoppingList |
| [#37](https://github.com/traista-eugen/merinde/issues/37) Nutrition | Recipe strip, plan day totals | RecipeAllergy, PlanReady |
| [#39](https://github.com/traista-eugen/merinde/issues/39) Expiry reminders | Notification, Use soon, settings | ExpiryNotification, UseSoon, ReminderSettings |
| [#40](https://github.com/traista-eugen/merinde/issues/40) Unit prices | Compare shops, Product | CompareShops, ProductPrices |
| [#41](https://github.com/traista-eugen/merinde/issues/41) Receipt discounts | Receipt review | ReceiptReview |
| [#42](https://github.com/traista-eugen/merinde/issues/42) Demo household | Welcome link, DEMO badge and sheet | Welcome, DemoMode |

## For the iOS build

- Colours: asset catalog colour sets named exactly as in [design-system.md](design-system.md#colour), plus `Cover1`–`Cover6`.
- Serif large titles app-wide via `UINavigationBarAppearance`; serif elsewhere via `.fontDesign(.serif)`.
- Tab order Plan, Recipes, List, Pantry, Spending ([0007](../decisions/0007-navigation.md)); default to Recipes until Plan exists.
- Every AI call: the shared [AI action states](design-system.md#ai-action-states); never block the screen.
- Backend asks: AI functions take `locale`; `recipe-generate` returns a `cover` (1–6).
