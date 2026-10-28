# Brainstorm

Raw ideas. Anything goes here; nothing is committed to until it moves into [requirements.md](requirements.md).

Status tags: `new` → `exploring` → `mvp` / `later` / `dropped`

## The core loop

Every idea fits one loop, shared by the whole household: the pantry feeds the plan, the plan drives shopping, and shopping and cooking update the pantry.

```mermaid
flowchart LR
    Pantry[Pantry] -->|"expiring first"| Plan[Meal plan]
    Plan -->|"missing items"| List[Shopping list]
    Prices[Expenses and prices] -->|"cheapest shop"| List
    List -->|"tick off in store"| Pantry
    Receipt[Scan receipt] -->|"items"| Pantry
    Receipt -->|"shop and prices"| Prices
    Plan --> Cook[Cook recipe]
    Cook -->|"subtract ingredients"| Pantry
```

## Ideas by area

### Households and accounts

- `mvp` Sign up, create a household, invite family members with a link or code.
- `mvp` Pantry, meal plan, shopping list and expenses belong to the household and update live for everyone.
- `mvp` Per-member dietary needs and allergies that every recipe and plan respects.
- `new` Delete your account and data (Apple requires it for apps with sign-up; GDPR expects it).
- `new` AI usage limits per household, to protect credits once other households join.

### Recipes

- `mvp` Generate a recipe from a prompt ("quick dinner, high protein, uses spinach").
- `mvp` Refine in place: ask for a change and the same recipe updates. No growing chat.
- `mvp` Variants: when an ingredient is missing or you want a change, create a variant ("no eggs", "chicken instead of tofu") next to the original and switch between them.
- `mvp` Version history per variant: see what changed, undo a change.
- `mvp` Recipes prefer pantry ingredients, flag anything missing, and offer a variant that avoids it.
- `mvp` Scale servings.
- `mvp` Save favourites.
- `new` Cooking mode: step by step, timers, screen stays on.
- `new` Import a recipe from a link or a cookbook photo.
- `new` Animate the logo's steam as the "writing your recipe" indicator instead of a spinner.
- `new` A generated photo for each recipe (Muse Image, $0.01 each; see [ai-models.md](ai-models.md)).

### Pantry (stock)

- `mvp` Quick add by typing or speaking a list ("6 eggs, half a bag of rice, spinach"); the LLM turns it into items.
- `mvp` Quantity and expiry date per item; expiry estimated from the product type when unknown.
- `mvp` Cooking a recipe subtracts its ingredients from stock.
- `mvp` Quick corrections ("out of milk", "threw away the yoghurt"), recording whether food was used or thrown away.
- `mvp` Rough mode for staples (have / low / out) instead of exact amounts for salt, oil, spices.
- `mvp` Food waste stats: what was thrown away and what it cost.
- `mvp` Expiry reminders: a push notification before food goes off.
- `new` Fridge photo quick-add: photograph a shelf, or sweep the camera, and the AI lists the items. Photos, not video, for now ([ai-models.md](ai-models.md#stock-scan-photos-not-video-for-now)).
- `new` Leftovers: cooked extras go back into the pantry with a short expiry.

### Meal planning

- `mvp` Plan meals and groceries for the next n days (you choose n), using items that expire soonest first.
- `mvp` Turn the plan into a shopping list for whatever is missing.

### Shopping list

- `mvp` Generated from the meal plan minus the pantry; items can also be added by hand.
- `mvp` Shared and live: tick items off in the store, big tap targets, one-handed.
- `mvp` Ticking an item adds it to the pantry, so restocking needs no extra input.
- `mvp` See who ticked what.
- `mvp` Suggest the cheapest shop for the current list, based on price history.
- `mvp` Split suggestion: "buy these at shop A and those at shop B" when that's cheaper overall.
- `mvp` Works offline (poor signal in stores).
- `new` Grouped by aisle (dairy, vegetables, bakery).

### Scanning

- `mvp` Receipt: extract the shop, date, items, quantities and prices. Items go into the pantry; prices go into expenses and price history.
- `mvp` Barcode: product name and nutrition (e.g. from Open Food Facts).
- `mvp` Expiry date from a photo of the label.
- `mvp` Receipt discounts and loyalty-card prices (Kaufland Card, Lidl Plus) taken into account.

### Expenses and prices

- `mvp` Spending per shop, week and month.
- `mvp` Price history per product and shop, to spot price increases.
- `mvp` Compare the same product across shops.
- `mvp` Pool anonymous price data across all households, so comparisons work even for shops you haven't visited ([0005](decisions/0005-pooled-price-data.md)).
- `mvp` Unit prices per kg or litre, so different pack sizes compare fairly.
- `new` Monthly grocery budget with alerts.

### Nutrition

- `mvp` Nutrition per product from barcode data.
- `mvp` Nutrition per recipe and per day, calculated from ingredients.

### Hackathon

- `mvp` Demo household with sample data, so the demo and the judges see a full app straight away.

## Hard parts to solve early

- **Matching names and units:** the recipe says "2 cloves garlic", the receipt says "GARL 250G", the pantry says "garlic". Stock deduction, shopping lists and price comparison all depend on mapping these to the same product.
- **Comparing shops:** different shops print the same product differently on receipts, so price comparison only works if matching is good.
- **Stock drift:** people won't log everything, so quantities slowly go wrong. Corrections have to be effortless.
- **Expiry dates:** standard barcodes don't contain them, so they come from a photo of the label or an estimate.
- **Allergies:** a safety issue, so AI output must be checked against allergy lists in code, not only in the prompt.
- **Receipt formats** differ by store and country.
- **Deadline:** 34 user stories on a native iOS app by 4 Nov.

## Open questions

- Voice input in Romanian: Muse Voice Transcribe doesn't support it. Does Apple's on-device speech recognition handle Romanian well enough, or should we send audio to Muse Spark 1.2?

## Decided

- Everything marked `mvp` above is in the hackathon MVP; see [roadmap.md](roadmap.md).
- Households from day one, and open to other users.
- Mobile only, native. iOS first for the hackathon, Android after ([0002](decisions/0002-native-mobile-apps.md)).
- Meta Muse models first, swappable later ([0003](decisions/0003-meta-muse-models.md)).
- Supabase backend, hosted in the EU ([0004](decisions/0004-backend.md)).
- Romania first (RON), then Europe (EUR).
- Prices pooled anonymously across all households ([0005](decisions/0005-pooled-price-data.md)).
- Meal planning covers the next n days, chosen by the user.
- Hackathon: indie track.
- App in English and Romanian, following the phone; AI output in the same language ([0006](decisions/0006-app-languages.md)).
- Navigation: five tabs, Plan first, no scan tab ([0007](decisions/0007-navigation.md), [design](design/README.md)).
- Open Food Facts is the first barcode lookup: it knew 23 of 25 products from Romanian shops (92%). If one is missing or lacks kcal, fat, carbs or protein (7 of 25), the app reads a nutrition-label photo with Muse Spark ([#24 results](https://github.com/traista-eugen/merinde/issues/24#issuecomment-6478192420)).
