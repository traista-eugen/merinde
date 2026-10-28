# Recipe screens

_Draft, 2026-10-28. Stories: [#3](https://github.com/traista-eugen/merinde/issues/3)–[#7](https://github.com/traista-eugen/merinde/issues/7), [#10](https://github.com/traista-eugen/merinde/issues/10). Build day: 30 Oct._

The recipe is the document: no chat transcript, ever. A request either updates the current variant (new version) or creates a new variant.

## Recipe list (Recipes tab root)

| | |
|-|-|
| Title | "Recipes", large serif |
| Toolbar | Household button (left), `+` New recipe (right) |
| Content | `.searchable` list; each row: cover tile (46 pt, initial), name (Name style), meta line "2 variants · 50 min", pantry pill ("Have all" in Herb, "1 low" in Saffron, "1 missing" in Beet) |
| Order | Recently edited or cooked first |
| Row actions | Tap → Recipe. Swipe: Add to tomorrow, Delete (confirm) |
| Working row | A recipe still being written shows at the top: the request in italics, "Writing…" with a `ProgressView`; tap opens the Recipe in its working state |
| Empty | `ContentUnavailableView`: book symbol, "No recipes yet", "Ask for anything: 'quick dinner with the spinach'.", button "New recipe" |
| No search results | `ContentUnavailableView.search` |

## New recipe (sheet, medium → large)

| | |
|-|-|
| Title | "New recipe", inline; Cancel (left) |
| Field | Multi-line, focused on open, mic button. Placeholder "What do you feel like?" |
| Suggestions | Chips that fill the field: "Use what's expiring", "Quick dinner", "Soup", "Vegetarian", "Kid-friendly" |
| Options | "Use what's in the pantry" toggle (on); Servings stepper (household default, 4) |
| Footer | Line: "3 items expire in the next 2 days" when relevant |
| Action | "Write recipe" (`.borderedProminent`, full width), disabled while the field is empty |
| On tap | Sheet closes, Recipe pushes in its working state |

## Recipe (pushed)

Top to bottom, in one `ScrollView` on `Paper`:

1. **Cover header:** full-width block in the recipe's cover colour ([covers](design-system.md#recipe-covers)), extending under the toolbar. Title in white Display serif, wraps; faint large initial behind it.
2. **Meta line** inside the cover, white 88%: "4 servings · 50 min · uses 3 expiring" (with `clock`).
3. **Variant chips:** one per variant, then "+ Variant". One tap switches. Long press: Rename, Delete. Off: `.bordered` tinted `Ink`; on: `.borderedProminent`.
4. **Pantry card** (only if something is missing or not enough): "1 missing, 1 not enough", the names, buttons "Variant without them" and "Add to list".
5. **Ingredients:** status symbol, quantity (Figures, semibold), name, note under the name ("You have 100 ml", "Missing"), expiry pill on the right. Use a `Grid` so the quantity column fits the widest entry ("1 legătură" in Romanian).
6. **Steps:** numbered, serif numbers in accent, Body text.
7. **Cooked it** (`.bordered`, full width) → Cooked it sheet ([#10](https://github.com/traista-eugen/merinde/issues/10)).
8. **Footer:** "Version 2 of Original · edited by Ioana, 18:42". Tap → History.

| | |
|-|-|
| Toolbar | History (`clock.arrow.circlepath`), More (`ellipsis`): Add to tomorrow, Cooked it, Share, Rename variant, Delete. Inline title appears once the big title scrolls away |
| Tab bar | Hidden on this screen (`.toolbar(.hidden, for: .tabBar)`), so the change bar owns the bottom edge |
| Change bar | Floating at the bottom (below) |
| Highlights | After an update, changed ingredients and steps get the `Highlight` background until the next change or leaving the screen |

### Change bar

| State | Shows |
|-------|-------|
| Idle | Field "Ask for a change…" with mic |
| Typing | Field outlined in accent, grows to 4 lines; row below: "New variant" (`.bordered`), "Update" (`.borderedProminent`, also the Return key) |
| Updating | Field shows the request in italics; "Updating Original…" with spinner and Stop. The recipe stays readable and scrollable |
| Making a variant | A new chip appears with a spinner and the AI's proposed name ("No eggs…"); switches to it when done |
| Updated | Line above the field: ✓ "Version 2 · Cooked in a pan instead of the oven", Undo. Stays until the next change or leaving |
| Failed | Line above the field: "Couldn't update. Your recipe hasn't changed." Try again. Request kept in the field |
| Offline | Field disabled, placeholder "Needs internet" |

- One floating container (`.safeAreaInset(edge: .bottom)`), `.bar` material, radius 28; `.glassEffect()` on iOS 26.
- The change note lives here, not in the content, so it's visible wherever you've scrolled.
- Updating doesn't dim or lock the recipe. Leaving the screen keeps the job running; a toast offers "Open" when it's done.

### Working state (generating)

- Same layout, `.redacted(.placeholder)`: title, three chips, ingredient rows, step lines.
- Above it: the request in italics, and one status line from real data: "Using 23 pantry items · 3 expire soon".
- Stop in the toolbar. Change bar hidden.

### Errors

| Case | Copy | Actions |
|------|------|---------|
| Generate failed | "Couldn't write this recipe" / "The connection dropped before it was finished." | Try again, Edit request |
| Model output unusable | "That didn't come out right" / "Merinde couldn't read the recipe it got back." | Try again |
| Edit failed | "Couldn't update. Your recipe hasn't changed." | Try again |
| Offline | Change bar and "Write recipe" disabled, footnote "Needs internet" | — |

## History (sheet, large)

| | |
|-|-|
| Title | "History · Original" (current variant), Done |
| Rows | Newest first: "Version 3", change note, who and when ("Ioana · Today 18:42"). Version 1 says "Written from 'spinach pie with telemea'" |
| Current | Marked "Current" |
| Tap | Push read-only Version: the recipe as it was, with "Restore this version" (creates a new version; history is never lost) |
| Variant | Chips at the top switch whose history you see |
| Undo | Same as restoring the previous version; also in the change bar right after an update |

## Cooked it (sheet, medium)

Built with the pantry on 31 Oct; specced here because it opens from the recipe.

| | |
|-|-|
| Title | "Cooked it", Cancel |
| Servings | Stepper, defaults to the recipe's servings; amounts rescale |
| Rows | Each ingredient with the amount to subtract and what's left ("Spinach −500 g → out"); toggle per row to skip |
| Action | "Subtract from pantry" → toast "Subtracted 7 items · Undo" |
