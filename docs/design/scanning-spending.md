# Scanning and spending screens

_Approved by the user 2026-10-28. Stories: [#16](https://github.com/traista-eugen/merinde/issues/16)–[#20](https://github.com/traista-eugen/merinde/issues/20). Build days: 2–3 Nov. AI states follow [design-system.md](design-system.md#ai-action-states)._

Cameras are the system ones; we only design what comes after them. Photos are sent as JPEG (the API takes no HEIC).

| Scan | Camera | Opens from |
|------|--------|-----------|
| Receipt | `VNDocumentCameraViewController` (edge detection, auto-capture, retake) | List → Done shopping, Spending `+`, Pantry → Add food |
| Barcode | `DataScannerViewController`, EAN-13 / EAN-8, highlights the code | Pantry → Add food |
| Expiry date | `DataScannerViewController` text mode, tap the date, then a photo goes to `label-read` | Pantry item, Review items row |

## Review receipt (sheet, large)

| | |
|-|-|
| Working | Receipt thumbnail, skeleton header and lines, "Reading the receipt…", then "Matching 23 lines…". Lines with a known alias appear first, already matched. Stop |
| Header | Shop chain and branch ("Lidl · Calea Moșilor"), date and time, total (Figures). Tap to correct any of them |
| Check these | Saffron section with lines the AI wasn't sure of: raw text in monospace ("GARL 250G"), the guess ("Garlic?"), tap → Fix match |
| Already added from the list | Herb section, collapsed: lines matched to items ticked on the list since the last receipt. Prices are recorded; the pantry isn't added to twice ([#14](https://github.com/traista-eugen/merinde/issues/14)) |
| Matched | Raw text small, product name, quantity, line price. Toggle per line "Add to pantry"; non-food (bags, detergent) defaults off and says "Spending only" |
| Footer | "Card numbers, loyalty numbers and names are never saved." |
| Action | "Save receipt" → toast "Saved · 187,40 RON at Lidl" |
| Failed | "Couldn't read this receipt." Retake / Try again. If it's not a receipt: "This doesn't look like a receipt." Retake |

## Fix match (sheet, medium → large)

- Raw line on top ("GARL 250G · 4,99 RON"), search field prefilled with the guess.
- Results from the shared catalogue; last row "New product: …".
- Footnote: "Saved for everyone who shops at Lidl." (alias, [0005](../decisions/0005-pooled-price-data.md)).

## Barcode result (sheet, medium)

| | |
|-|-|
| Found | Product name (Title serif), brand, package size; nutrition per 100 g as a two-column table (energy, fat, carbohydrates, sugars, protein, salt); source "Open Food Facts" |
| Actions | "Add to pantry" (`.borderedProminent`) → quantity 1, estimated expiry, then "Read date from label" offer |
| Unknown | "We don't know this product yet." Name field, category picker, "Save and add" (saved to the shared catalogue, [#17](https://github.com/traista-eugen/merinde/issues/17)) |
| Working | Inline spinner under the code, "Looking up 5941234567890…" |

## Expiry date confirm (sheet, medium)

- Crop of the photo with the date highlighted, the read date large ("14 Nov 2026"), and what it replaces ("Was ~31 Oct, estimated").
- "Use this date" (`.borderedProminent`), Retake. Dates in the past ask "This date has passed. Use it anyway?"
- Formats: DD.MM.YYYY, DD/MM/YY, "expiră la", "a se consuma de preferință înainte de" ([#18](https://github.com/traista-eugen/merinde/issues/18)).

## Spending (tab root)

| | |
|-|-|
| Title | "Spending", large serif |
| Toolbar | Household button, `+` → receipt camera |
| Period | Segmented `Picker`: Week, Month |
| Total | Big figure (Display serif, Figures) "1.284 RON", "this month", change vs the previous period ("8% more than September") |
| Chart | Swift Charts `BarMark`, last 6 weeks or months, current one in accent, others in `Fill` |
| By shop | Rows: shop, total, share bar ([#19](https://github.com/traista-eugen/merinde/issues/19)) |
| Price changes | Products whose price changed since you last bought them: "Sour cream 20% · Lidl · 7,49 → 8,29 RON" with a Beet up-arrow, or Herb down-arrow ([#20](https://github.com/traista-eugen/merinde/issues/20)). Tap → Product |
| Receipts | Latest receipts; tap → Receipt (read-only review screen) |
| Empty | `ContentUnavailableView`: "No receipts yet", "Scan one after shopping to see where the money goes.", Scan receipt |

## Product (pushed)

| | |
|-|-|
| Header | Product name (Display serif), package size |
| Cheapest card | Herb-tinted: "Cheapest now: Kaufland · 7,29 RON" |
| Since last purchase | Beet line when the price rose: "+0,80 RON at Lidl since you last bought it (+11%)" |
| Chart | Swift Charts `LineMark` per shop over 3 months, from pooled observations; legend under the chart |
| Latest prices | Row per shop: latest unit price, date seen |
| Footnote | "Prices from receipts scanned by Merinde households." |
