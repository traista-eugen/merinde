# Design system

_Approved by the user 2026-10-28. Direction agreed with the user: warm cookbook, paprika accent, Apple-native components._

Every token maps to something SwiftUI already has: asset-catalog colours, built-in `Font` text styles, standard controls. Custom views only where no standard one exists (marked **custom**).

## Principles

- **The recipe is a page, not a chat.** Paper background, serif titles, generous margins.
- **Standard first.** System navigation, lists, sheets, buttons, scanners. Identity comes from colour, serif titles and copy, not custom chrome.
- **Status is never colour alone.** Every status has an SF Symbol and a text label.
- **AI never blocks.** Work happens in place; you can keep scrolling or leave (see [AI action states](#ai-action-states)).
- **One thumb in the store.** List rows are tall, ticks are on the leading edge, primary actions sit low.

## Colour

Asset catalog colour sets with Any and Dark appearances. With asset symbol generation on (Xcode default), use them as `Color.paper`, `.foregroundStyle(.inkSecondary)`.

| Asset | Use | Light | Dark |
|-------|-----|-------|------|
| `AccentColor` | Tint: buttons, links, selected tab, step numbers | `#C23B1E` | `#E9653F` |
| `Paper` | Screen background | `#F7EEDF` | `#1A1410` |
| `Card` | Rows, cards, sheet content | `#FFFBF5` | `#28201A` |
| `Fill` | Chips, fields, skeletons, sunken areas | `#EFE3CF` | `#3A2F26` |
| `Ink` | Primary text | `#2B211B` | `#F4EEE6` |
| `InkSecondary` | Secondary text, icons | `#6E5F52` | `#B3A899` |
| `InkTertiary` | Placeholders, disabled | `#9C8D7E` | `#7A7066` |
| `Separator` | Hairlines | `#E6D8C3` | `#3D3229` |
| `Herb` | Have, fresh, success | `#3D7548` | `#7DBE89` |
| `Saffron` | Not enough, expires within 2 days | `#94600A` | `#E5AE4A` |
| `Beet` | Missing, expired, destructive | `#A3264F` | `#EE7BA3` |
| `Highlight` | Background of text changed by the AI | `#F6D58E` | `#5A4310` |

- Text colours pass 4.5:1 on `Paper` and `Card` in both modes. White labels on `AccentColor` buttons are 17 pt semibold (large text, ≥ 3:1 in dark).
- Tinted backgrounds (pills, status cards) mix the status colour into `Card`: 14% for pills, 10% for cards (the recipe's "1 missing" card is Beet-tinted, the "Updated" line Herb-tinted).
- Paprika is for actions and brand only; warnings use `Saffron` and `Beet`, so "tap me" never looks like "something's wrong".

### Recipe covers

Each recipe gets a cover colour, like a cookbook spine: picked by the AI from the dish's main ingredient, else by hashing the recipe id. Same values in light and dark; white text on top (bold serif initial ≥ 20 pt, so large-text contrast applies).

| Asset | Value | Typical dish |
|-------|-------|--------------|
| `Cover1` | `#C23B1E` paprika | Soups, stews, tomato |
| `Cover2` | `#3B7344` herb | Greens, salads, pies with spinach |
| `Cover3` | `#A86F0A` saffron | Beans, grains, baking |
| `Cover4` | `#A3264F` beet | Desserts, fruit, jam |
| `Cover5` | `#6A3D7A` plum | Fish, special occasions |
| `Cover6` | `#7A5230` walnut | Mushrooms, meat, roasts |

- List rows: 46 pt rounded tile (radius 12) with the dish's initial.
- Recipe page: a 268 pt cover header in the colour, title in white Display serif, a large faint initial (13% white) as the only ornament.

## Type

Built-in text styles only, so Dynamic Type works everywhere. Serif = New York, via `.fontDesign(.serif)`.

| Token | SwiftUI | Default size | Use |
|-------|---------|--------------|-----|
| Display | `.largeTitle.bold()` + `.fontDesign(.serif)` | 34 | Root large titles, recipe title |
| Title | `.title2.bold()` + serif | 22 | Content section headings ("Ingredients"), empty-state titles |
| Name | `.title3.weight(.semibold)` + serif | 20 | Recipe and meal names in lists |
| Headline | `.headline` | 17 | Row titles, button labels |
| Body | `.body` | 17 | Steps, descriptions |
| Callout | `.callout` | 16 | Change bar, banners |
| Meta | `.subheadline` | 15 | Metadata lines, secondary row text |
| Footnote | `.footnote` | 13 | Helper text, section footers |
| Badge | `.caption.weight(.semibold)` | 12 | Pills, counts |
| Figures | add `.monospacedDigit()` | — | Quantities, prices, totals |

- Large navigation titles are serif app-wide: set once with `UINavigationBarAppearance.largeTitleTextAttributes` (New York bold, from the `.largeTitle` text style). Inline titles stay SF Pro.
- Step numbers: Title style, serif, `AccentColor`.

## Spacing and shape

| Token | Value | Use |
|-------|-------|-----|
| `xxs` | 2 | Icon to label inside pills |
| `xs` | 4 | Tight stacks (title + meta) |
| `s` | 8 | Between chips, inside rows |
| `m` | 12 | Row padding, card inner gaps |
| `l` | 16 | Screen margins, card padding |
| `xl` | 24 | Between content sections |
| `xxl` | 32 | Above big headings, empty states |

- Radii: field 12, card 16, thumbnail 10, chips and pills capsule. Always `RoundedRectangle(cornerRadius:style: .continuous)`.
- Tap targets ≥ 44 pt; shopping list rows ≥ 60 pt.
- Screen margins come from `List` and `.scenePadding()`; don't hard-code 16 where the system already pads.

## Icons

SF Symbols, `.symbolRenderingMode(.hierarchical)` where it helps. Tabs: `calendar`, `book.closed`, `checklist`, `refrigerator`, `chart.bar`.

| Meaning | Symbol | Colour |
|---------|--------|--------|
| Have | `checkmark.circle.fill` | `Herb` |
| Not enough | `circle.lefthalf.filled` | `Saffron` |
| Missing | `circle.dashed` | `Beet` |
| Expiring soon | `clock` | `Saffron` |
| Expired | `exclamationmark.circle` | `Beet` |
| Estimated date | `~` prefix on the date, "estimated" in the VoiceOver label | — |
| History | `clock.arrow.circlepath` | tint |
| Dictate | `mic` / `mic.fill` while listening | tint |
| Household | member initials in circles | — |

## Components

| Component | SwiftUI | Notes |
|-----------|---------|-------|
| Tabs | `TabView` with five `.tabItem`s | Liquid Glass on iOS 26 for free; reopens on the last tab via `@SceneStorage` |
| Navigation | One `NavigationStack` per tab | Push for detail; sheets for create, review and edit tasks; full-screen cover only for cameras |
| Lists | `List` `.insetGrouped`, `.scrollContentBackground(.hidden)`, `.background(.paper)`, rows `.listRowBackground(Color.card)` | Swipe actions for quick edits |
| Primary button | `.buttonStyle(.borderedProminent)`, `.controlSize(.large)` | One per screen |
| Secondary button | `.buttonStyle(.bordered)` | |
| Chip | `.bordered` (off) / `.borderedProminent` (on), `.buttonBorderShape(.capsule)`, `.controlSize(.small)` | Variant switcher, prompt suggestions, filters |
| Status row | `Label` with a status symbol; VoiceOver reads "Have", "Not enough", "Missing" | |
| Pill | **custom** `Text` in Badge style, 8×3 padding, capsule tinted 14% | Expiry ("Tomorrow", "~5 days"), counts |
| Change bar | **custom** `.safeAreaInset(edge: .bottom)`: `TextField(axis: .vertical)` 1–4 lines, mic, then "New variant" + "Update" once there's text | Background `.bar`; `.glassEffect()` on iOS 26 |
| Skeleton | `.redacted(reason: .placeholder)` on the real layout with sample data | Respects Reduce Motion (no shimmer) |
| Empty / error | `ContentUnavailableView` with actions | Copy per screen in the screen specs |
| Undo toast | **custom** capsule above the tab bar, 4 s, one action | "Added to pantry · Undo". Posts a VoiceOver announcement |
| Sheets | `.sheet` + `.presentationDetents([.medium, .large])` | |
| Allergy alert | **custom** card: Beet 13% fill, Beet 45% outline, `exclamationmark.triangle`, two actions | The only card with an outline: safety beats calm |
| Have / Low / Out | `Picker` with `.segmented` style, selected segment tinted Herb / Saffron / Beet | Staples in rough mode |
| Offline banner | **custom** Saffron-tinted row with `icloud.slash` | Also a sync icon on rows waiting to upload |
| Notifications | `UNUserNotificationCenter`, category with two actions | Content in [pantry-plan-list.md](pantry-plan-list.md#reminders) |
| Search | `.searchable` | Recipes, Pantry |
| Charts | Swift Charts `BarMark`, `LineMark` | Spending, price history |
| Scanners | `VNDocumentCameraViewController` (receipt), `DataScannerViewController` (barcode, label text) | System UI, wrapped in `UIViewControllerRepresentable` |
| Dictation | `SFSpeechRecognizer` on device; live text goes into the field | |
| Haptics | `.sensoryFeedback(.success, trigger:)` on tick and save | |

## AI action states

All seven AI functions follow one pattern ([NFR: nothing blocks](../requirements.md)).

| State | What the user sees |
|-------|--------------------|
| Ready | A verb on a button ("Write recipe", "Plan 6 meals", "Read items"). No sparkles, no "AI" label |
| Working, new content | The real layout, redacted, with one honest status line from data we already have ("Looking at 23 pantry items, 3 expiring soon") and a Stop button |
| Working, editing | Existing content stays readable; progress sits in the control that started it ("Updating…") with Stop |
| Left the screen | The job keeps running; the list row shows "Writing…"; a toast offers "Open" when done |
| Done | Content appears; changed parts get the `Highlight` background until the next change or leaving the screen; VoiceOver announces the change note |
| Failed | Inline, where the action was: what happened, that nothing changed, Try again. The typed request is kept |
| Offline | The action is disabled, with "Needs internet" as a footnote |

## Language

App in English and Romanian, following the phone ([0006](../decisions/0006-app-languages.md)).

- One String Catalog (`Localizable.xcstrings`), English as the development language.
- Leave 30% extra room: no fixed-width labels; button rows switch to stacked with `ViewThatFits`.
- Plurals through String Catalog variants. Romanian has three forms: "1 zi", "2 zile", "20 de zile".
- Dates, quantities and money through `FormatStyle` with the current locale; money as `.currency(code: "RON")`. Mockups show the Romanian-region form `84,20 RON`. Dates: "Thu 30 Oct" / "joi, 30 oct.".
- AI output (recipes, plans, parsed items) comes back in the app language. Shop and product names keep the receipt's text.

## Accessibility

- Dynamic Type up to AX5: rows wrap, pills move under the title at accessibility sizes.
- VoiceOver labels on every symbol-only button and status; ingredient rows read as "500 grams spinach, have, expires tomorrow".
- Reduce Motion: no shimmer, highlight appears without animation.
- Contrast as above; no information in colour only.
