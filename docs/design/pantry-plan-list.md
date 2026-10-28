# Pantry, plan and list screens

_Approved by the user 2026-10-28. Stories: [#8](https://github.com/traista-eugen/merinde/issues/8)–[#15](https://github.com/traista-eugen/merinde/issues/15). Build days: 31 Oct – 1 Nov. AI states follow [design-system.md](design-system.md#ai-action-states)._

## Pantry (tab root)

| | |
|-|-|
| Title | "Pantry", large serif; `.searchable` |
| Toolbar | Household button, `+` → Add food |
| Sections | Always sorted by expiry ([#9](https://github.com/traista-eugen/merinde/issues/9)): **Use soon** (expired or ≤ 2 days, header in Saffron), **This week**, **Later**, **Out** (quantity 0, collapsed) |
| Row | Name (Headline), quantity (Meta, Figures: "6", "500 g", "about half"), expiry pill on the right |
| Expiry pill | Expired → Beet "Expired"; ≤ 2 days → Saffron "Today", "Tomorrow", "2 days"; later → neutral "5 days", "12 Nov". Estimated dates start with `~` and VoiceOver says "estimated" |
| Swipe | Trailing: Used up (Beet), Edit. Leading: Add to list |
| Tap | Item |
| Empty | `ContentUnavailableView`: refrigerator, "Nothing here yet", "Type or say what you have, or scan a receipt after shopping.", Add food |

## Add food (sheet, medium → large)

| | |
|-|-|
| Field | Multi-line, focused, placeholder "6 eggs, half a bag of rice, spinach…" |
| Mic | Tap to dictate (on-device `SFSpeechRecognizer`); while listening: `mic.fill` in accent, a level meter, live text in the field, "Listening… tap to stop" |
| Scan row | Three buttons above the action: Barcode, Receipt, Expiry date (each opens its system scanner) |
| Action | "Read items" (`.borderedProminent`) → Review items |

## Review items (pushed inside the sheet)

| | |
|-|-|
| Working | Skeleton rows; "Reading your list…"; Stop |
| Row | Name (matched product), quantity + unit (tap to edit), expiry ("~4 days", tap for a date picker, or "Read from label") |
| Unsure match | Saffron note "New product" or "Did you mean garlic?" with the choices inline |
| Action | "Add 3 items" → sheet closes, toast "Added 3 items · Undo" |
| Failed | "Couldn't read that. Your text is still here." Try again. Back keeps the text |

## Item (pushed)

| | |
|-|-|
| Header | Name (Title serif), product category |
| Quantity | Value + unit with a stepper |
| Expiry | Date; "Estimated from the product type" when estimated; "Read date from label" button ([#18](https://github.com/traista-eugen/merinde/issues/18)) |
| Came from | "Ticked on the list by Ioana · Mon" / "Receipt, Lidl · Sun" / "Typed by you" |
| Product | Nutrition per 100 g (if known), Price history → Product page |
| Actions | Used up, Delete (confirm) |

## Cooked it (sheet, medium)

From the recipe page ([recipes.md](recipes.md#cooked-it-sheet-medium)). Servings stepper; one row per ingredient with "−500 g → out" and a toggle to skip; "Subtract from pantry"; toast "Subtracted 6 items · Undo". Items that reach zero move to **Out** ([#10](https://github.com/traista-eugen/merinde/issues/10)).

## Plan (tab root)

| | |
|-|-|
| Title | "Plan", large serif; under it "Tomorrow · Thu 30 Oct" |
| Use soon strip | Horizontal chips of pantry items expiring within 2 days ("Spinach · tomorrow"); tap → Item |
| Meals | Chips to choose which meals to plan: Breakfast, Lunch, Dinner (remembered) |
| Empty | Text "Plan tomorrow from what you have. Food that expires first gets used first." + "Plan tomorrow" (`.borderedProminent`) |
| Working | Skeleton meal cards; "Using spinach, yogurt and dill first"; Stop |
| Ready | One card per meal: meal label, cover tile, recipe name (Name serif), "uses spinach, dill" (Saffron `clock`), pantry pill ("Have all", "2 missing"). Card actions: tap → Recipe (that variant); Swap menu: Plan this meal again, Pick a saved recipe |
| Expiring summary | Line above the meals: "Uses 3 of the 4 items expiring soon" ([#11](https://github.com/traista-eugen/merinde/issues/11)) |
| Missing card | "6 missing ingredients", first names, "Add to list" → "On the list ✓" ([#12](https://github.com/traista-eugen/merinde/issues/12)); items already on the list are merged |
| Toolbar | Household button; More: Plan again, Clear plan |
| Failed | Card in place of the meals: "Couldn't plan tomorrow. Nothing changed." Try again |

## List (tab root)

| | |
|-|-|
| Title | "List", large serif |
| Toolbar | Household button; More: Clear ticked, Share as text |
| Add field | Top of the list: "Add items…" with mic; uses the same parser as the pantry ([#13](https://github.com/traista-eugen/merinde/issues/13)) |
| Cheapest shop card | "Cheapest for this list: **Lidl** ≈ 84 RON", "5 of 6 items have prices" → Compare shops ([#15](https://github.com/traista-eugen/merinde/issues/15)). Hidden when fewer than 2 shops have prices |
| Sections | By aisle: Produce, Dairy, Bakery, Meat & fish, Pantry staples, Other |
| Row | ≥ 60 pt; tick circle (28 pt) on the leading edge; name (Headline), quantity (Meta); the whole row ticks |
| Tick | Haptic, strike-through, moves to **In the cart** (collapsed, count); adds to the pantry with an estimated expiry ([#14](https://github.com/traista-eugen/merinde/issues/14)); first time only, toast "Ticked items go to the pantry · Undo" |
| Untick | Back to its aisle; removed from the pantry |
| Live | Changes from others animate in; a new row shows "Ioana added" for a few seconds |
| Done shopping | Prominent button pinned above the tab bar once something is ticked → Done shopping sheet |
| Empty | "The list is empty", "Plan tomorrow to fill it, or add items above." |

## Compare shops (sheet, medium)

- One row per shop: name, estimated total (Figures), "5 of 6 priced"; cheapest gets a Herb "Cheapest" pill.
- Footnote: "From receipts scanned by Merinde households in the last 60 days. Items without a price aren't counted."

## Done shopping (sheet, medium)

- "6 items went to the pantry." "Scan the receipt to record what you paid."
- Scan receipt (`.borderedProminent`) → receipt scanner; Not now. Ticked items are cleared from the list either way.
