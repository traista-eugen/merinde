# 0007: Five tabs, Plan first, scanners where results land

- **Status:** accepted
- **Date:** 2026-10-28

## Context

The iOS skeleton ([#22](https://github.com/traista-eugen/merinde/issues/22)) planned tabs Recipes, Plan, List, Pantry, Spending. Open questions: where scanning lives (receipt, barcode, expiry label), and where household settings go. Everything else is built on this structure, so changing it late is expensive.

## Options considered

1. #22's tabs as they are, Recipes first.
2. A centre Scan tab that opens a camera with a mode picker.
3. The same five tabs with Plan first; no Scan tab; each scanner opens from where its result lands; household and settings behind a toolbar button.

## Decision

Option 3. Details in [design/navigation.md](../design/navigation.md).

- Tabs: Plan, Recipes, List, Pantry, Spending. The app reopens on the last-used tab.
- Receipt scan: List (Done shopping), Spending (`+`), Pantry (Add food). Barcode: Pantry (Add food). Expiry label: pantry item, add-review row.
- Scanners are the system ones (`VNDocumentCameraViewController`, `DataScannerViewController`).
- Household button (members' initials) at the top left of every tab root opens the Household sheet: members, invite, language, privacy, sign out.

## Consequences

- Follows HIG (tabs navigate, they don't act) and needs no custom camera screen.
- Scanning is less prominent in the demo; the demo script must show it from the List and Pantry.
- Household switching needs a new entry point if users can join several households later.
