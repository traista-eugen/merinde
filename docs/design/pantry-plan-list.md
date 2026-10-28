# Pantry, plan and list screens

_Approved by the user 2026-10-28. Stories: [#8](https://github.com/traista-eugen/merinde/issues/8)–[#15](https://github.com/traista-eugen/merinde/issues/15), [#29](https://github.com/traista-eugen/merinde/issues/29), [#32](https://github.com/traista-eugen/merinde/issues/32), [#33](https://github.com/traista-eugen/merinde/issues/33), [#35](https://github.com/traista-eugen/merinde/issues/35), [#36](https://github.com/traista-eugen/merinde/issues/36), [#37](https://github.com/traista-eugen/merinde/issues/37), [#39](https://github.com/traista-eugen/merinde/issues/39), [#40](https://github.com/traista-eugen/merinde/issues/40). Build days: 31 Oct – 1 Nov. AI states follow [design-system.md](design-system.md#ai-action-states)._

## Pantry (tab root)

| | |
|-|-|
| Title | "Pantry", large serif; `.searchable` |
| Toolbar | Household button, `+` → Update pantry |
| Sections | Always sorted by expiry ([#9](https://github.com/traista-eugen/merinde/issues/9)): **Use soon** (expired or ≤ 2 days, header in Saffron), **This week**, **Later**, **Staples**, **Out** (quantity 0, collapsed) |
| Row | Name (Headline), quantity (Meta, Figures: "6", "500 g", "about half"), expiry pill on the right |
| Expiry pill | Expired → Beet "Expired"; ≤ 2 days → Saffron "Today", "Tomorrow", "2 days"; later → neutral "5 days", "12 Nov". Estimated dates start with `~` and VoiceOver says "estimated" |
| Swipe ([#32](https://github.com/traista-eugen/merinde/issues/32)) | Leading: Used up (Herb). Trailing: Thrown away (Beet), Amount (sets a new quantity). Every change is saved with its reason: bought, cooked, used, thrown away |
| Staples ([#33](https://github.com/traista-eugen/merinde/issues/33)) | Items in rough mode show a three-part control instead of a quantity: Have (Herb) / Low (Saffron) / Out (Beet). Section header button "Add 2 to list" puts low and out staples on the list. Cooking never subtracts from them |
| Tap | Item |
| Empty | `ContentUnavailableView`: refrigerator, "Nothing here yet", "Type or say what you have, or scan a receipt after shopping.", Update pantry |

## Add food (sheet, medium → large)

Renamed **Update pantry**: one field for adding and correcting ([#8](https://github.com/traista-eugen/merinde/issues/8), [#32](https://github.com/traista-eugen/merinde/issues/32)).

| | |
|-|-|
| Field | Multi-line, focused, placeholder "6 eggs, out of milk, threw away the yogurt…" |
| Mic | Tap to dictate (on-device `SFSpeechRecognizer`); while listening: `mic.fill` in accent, a level meter, live text in the field, "Listening… tap to stop" |
| Scan row | Three buttons above the action: Barcode, Receipt, Expiry date (each opens its system scanner) |
| Action | "Read items" (`.borderedProminent`) → Review changes |

## Review items (pushed inside the sheet)

Title "Review changes".

| | |
|-|-|
| Working | Skeleton rows; "Reading your list…"; Stop |
| Row | Name (matched product), detail line, and a tag that says what will happen: **Add 6** (accent), **New amount**, **Used up** (Herb), **Thrown away** (Beet, with its value: "3,49 RON wasted"). Tap the tag to change it |
| Added items | Quantity + unit and expiry ("~4 days") are editable; "Read from label" per row |
| Unsure match | Saffron "Which one?" with the choices inline |
| Action | "Apply 4 changes" → sheet closes, toast "4 changes · Undo" |
| Failed | "Couldn't read that. Your text is still here." Try again. Back keeps the text |

## Item (pushed)

| | |
|-|-|
| Header | Name (Title serif), product category |
| Quantity | Value + unit with a stepper; or Have / Low / Out for staples |
| Track roughly | Toggle: switches the item to have / low / out ([#33](https://github.com/traista-eugen/merinde/issues/33)) |
| Expiry | Date; "Estimated from the product type" when estimated; "Read date from label" button ([#18](https://github.com/traista-eugen/merinde/issues/18)) |
| History | Latest changes with reasons: "Ticked on the list by Ioana · Mon", "Cooked: −200 g · Tue", "Thrown away · Wed" |
| Product | Nutrition per 100 g (if known), Price history → Product page |
| Actions | Used up, Thrown away, Delete (confirm) |

## Cooked it (sheet, medium)

From the recipe page ([recipes.md](recipes.md#cooked-it-sheet-medium)). Servings stepper (starts at the recipe's current servings); one row per ingredient with "−500 g → out" and a check to skip; staples are listed as skipped; "Subtract from pantry"; toast "Subtracted 6 items · Undo". Items that reach zero move to **Out** ([#10](https://github.com/traista-eugen/merinde/issues/10), [#30](https://github.com/traista-eugen/merinde/issues/30)).

## Use soon (pushed, from a reminder)

Opened by the expiry notification ([#39](https://github.com/traista-eugen/merinde/issues/39)).

| | |
|-|-|
| Title | "Use soon", large serif; "Pick what to cook with." |
| Rows | Items expiring next, each with a check (on by default) and its expiry pill. Expired items are unchecked and offer "Thrown away" |
| Actions | "Plan a meal with these 3" (opens Plan setup with them required), "Write a recipe with these" (New recipe, prefilled) |

## Reminders

| | |
|-|-|
| Expiry notification | Title "Use soon: spinach and dill"; body "Spinach expires tomorrow, dill on Friday. Tap to plan a meal with them." Actions: Plan a meal, Remind me tomorrow. Tap → Use soon |
| Evening nudge | Only when nothing is planned for tomorrow: "Nothing planned for tomorrow" / "Plan the next few days? 4 things in the pantry expire this week." Tap → Plan |
| Settings | Household sheet → You → Expiry reminders: on/off, When (the day before, 2 days before), Time (18:00); Evening nudge on/off and time (20:00). Per member |
| Sending | A scheduled backend job sends one notification a day per member; needs the Apple Developer Program ([#25](https://github.com/traista-eugen/merinde/issues/25)) |

## Plan (tab root)

Plans the next 1–7 days ([#11](https://github.com/traista-eugen/merinde/issues/11)).

| | |
|-|-|
| Title | "Plan", large serif; under it the range "Thu 30 Oct – Sat 1 Nov · 6 meals", or "Nothing planned yet" |
| Use soon strip | Chips of pantry items expiring within the planned days; tap → Item |
| Setup (no plan) | Card: **Days** stepper (1–7, default 3, shows the date range); **meals grid**, one row per day with Breakfast / Lunch / Dinner toggles (remembered); **Who's eating** (member initials, all on); **Prefer favourites** toggle ([#31](https://github.com/traista-eugen/merinde/issues/31)). Button "Plan 6 meals" |
| Working | Skeleton meal cards per day; status line from real data: "Planning 3 days… spinach, dill and chicken first. Nothing with nuts for Mihai."; Stop |
| Ready | Summary "Uses all 4 items expiring this week"; missing card "11 missing for 3 days" + Add to list ([#12](https://github.com/traista-eugen/merinde/issues/12)), merged with what's already on the list; then one section per day |
| Day section | Day name (Name serif), day totals "~1,850 kcal · 86 g protein" ([#37](https://github.com/traista-eugen/merinde/issues/37)), "Plan this day again" button; meal rows: cover tile, meal label, recipe name, "uses spinach, dill" (Saffron), pantry pill |
| Meal row | Tap → Recipe (that variant). Swipe or long press: Plan this meal again, Pick a saved recipe, Remove |
| Diets | Plans respect everyone eating; allergens are checked in code before the plan is shown ([#28](https://github.com/traista-eugen/merinde/issues/28)) |
| Toolbar | Household button; More: Change days, Plan again, Clear plan |
| Failed | Card in place of the days: "Couldn't plan the next days. Nothing changed." Try again |

## List (tab root)

| | |
|-|-|
| Title | "List", large serif |
| Toolbar | Household button; More: Clear ticked, Share as text |
| Add field | Top of the list: "Add items…" with mic; same parser as the pantry ([#13](https://github.com/traista-eugen/merinde/issues/13)) |
| Offline ([#36](https://github.com/traista-eugen/merinde/issues/36)) | Saffron banner under the field: "Offline. Ticks are saved on this phone and sync when you're back online." The list opens from the local cache; ticks made offline show a sync icon until sent; conflicts resolve per item, last change wins |
| Cheapest shop card | "Lidl ≈ 84 RON", "Cheapest · split Kaufland + Lidl saves 6 RON" when a split passes the threshold → Compare shops ([#15](https://github.com/traista-eugen/merinde/issues/15), [#35](https://github.com/traista-eugen/merinde/issues/35)). Hidden when fewer than 2 shops have prices |
| Sections | By aisle: Produce, Dairy, Bakery, Meat & fish, Pantry staples, Other |
| Row | ≥ 60 pt; tick circle (28 pt) on the leading edge; name (Headline), quantity (Meta); the whole row ticks |
| Tick | Haptic, strike-through, moves to **In the cart**; adds to the pantry with an estimated expiry ([#14](https://github.com/traista-eugen/merinde/issues/14)); first time only, toast "Ticked items go to the pantry · Undo" |
| Who ticked ([#29](https://github.com/traista-eugen/merinde/issues/29)) | Ticked rows show the member's initials and name ("Ioana", "You"); others' ticks appear live |
| Untick | Back to its aisle; removed from the pantry |
| Live | Changes from others animate in; a new row shows "Ioana added" for a few seconds |
| Done shopping | Prominent button pinned above the tab bar once something is ticked → Done shopping sheet |
| Empty | "The list is empty", "Plan the next days to fill it, or add items above." |

## Compare shops (sheet, medium)

- All totals use unit prices (per kg, litre or piece), so pack sizes compare fairly ([#40](https://github.com/traista-eugen/merinde/issues/40)).
- **Split card** (Herb-tinted, only when it saves ≥ 5 RON and ≥ 5%): "Split and save 6,10 RON", total "78,10 RON instead of 84,20 at Lidl alone", then one line per shop with its items and subtotal ([#35](https://github.com/traista-eugen/merinde/issues/35)).
- **One shop:** a row per shop with estimated total and "5 of 6 priced"; the cheapest gets a Herb "Cheapest" pill.
- Footnote: "From receipts scanned by Merinde households in the last 60 days."

## Done shopping (sheet, medium)

- "6 items went to the pantry." "Scan the receipt to record what you paid."
- Scan receipt (`.borderedProminent`) → receipt scanner; Not now. Ticked items are cleared from the list either way.
