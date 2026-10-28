# Navigation

_Approved by the user 2026-10-28. Decision: [0007](../decisions/0007-navigation.md)._

## Tabs

Five tabs, the most an iPhone tab bar holds without "More". Same tabs as [#22](https://github.com/traista-eugen/merinde/issues/22), with Plan moved first.

| # | Tab (EN / RO) | Symbol | Root screen | Why |
|---|---------------|--------|-------------|-----|
| 1 | Plan / Plan | `calendar` | Next days: meals per day, "use soon" strip, missing items | Starts the daily loop, and the first screen shows the whole idea: a plan built from what's about to expire |
| 2 | Recipes / Rețete | `book.closed` | Recipe list | The hero feature; also reached from every planned meal |
| 3 | List / Listă | `checklist` | Shopping list with cheapest shop | Opened in the store; the middle tab is easiest to reach |
| 4 | Pantry / Cămară | `refrigerator` | Pantry sorted by expiry | Where food comes in: typing, voice, scans |
| 5 | Spending / Cheltuieli | `chart.bar` | Week and month totals, price changes | Weekly use; prices and receipts live here |

- The app reopens on the last-used tab (`@SceneStorage`). First launch opens Plan.
- Until Plan is built (1 Nov), the skeleton can default to Recipes. Tab order is a one-line change.

## Screen map

```mermaid
flowchart TB
    subgraph Plan
        P[Plan: next days] -->|push| PR[Recipe]
        P -.->|sheet| PS[Swap meal]
    end
    subgraph Recipes
        R[Recipe list] -->|push| RD[Recipe]
        R -.->|sheet| RN[New recipe]
        RD -.->|sheet| RH[History] -->|push| RV[Version]
        RD -.->|sheet| RC[Cooked it]
    end
    subgraph List
        L[Shopping list] -.->|sheet| LC[Compare shops]
        L -.->|sheet| LD[Done shopping]
    end
    subgraph Pantry
        PA[Pantry] -->|push| PI[Item] -->|push| PP[Product: price history]
        PA -.->|sheet| AF[Add food] --> AR[Review items]
    end
    subgraph Spending
        S[Spending] -->|push| SR[Receipt]
        S -->|push| PP2[Product: price history]
    end
    LD -->|camera| RS[Receipt scanner] --> RR[Review receipt]
    AF -->|camera| RS
    S -.->|camera| RS
    AF -->|camera| BS[Barcode scanner]
    PI -->|camera| LS[Label scanner]
```

Solid arrows push; dotted arrows open a sheet; cameras open full screen.

## Where things live

| Thing | Where | Why |
|-------|-------|-----|
| Scanning | No Scan tab. Each scanner opens from the screen where its result lands | HIG: tabs navigate, they don't perform actions. The three scans feed different places |
| Receipt scan | List → Done shopping; Spending → `+`; Pantry → Add food | After shopping is when you hold the receipt |
| Barcode scan | Pantry → Add food → Scan barcode | Result is a product to add |
| Expiry label | Pantry item → Read date from label; the Add food review row | Result is a date on one item |
| Household and settings | Household button (member initials) at the top left of every tab root → Household sheet | One household per user in MVP, so no switcher. The faces remind you the data is shared |
| Price history | Product page, pushed from a pantry item, list item, receipt line or Spending's price changes | Prices belong to products |
| Cooked it | Recipe: button under the steps, and the More menu | You're on the recipe when you finish cooking |
| Add to plan | Recipe → More → Add to plan | |
| Diets and allergies | Household sheet → a member → Diets and allergies ([#28](https://github.com/traista-eugen/merinde/issues/28)) | They belong to people, and every member can edit their own |
| Expiry reminders | Notification → Use soon screen (Pantry tab); settings in Household sheet → You ([#39](https://github.com/traista-eugen/merinde/issues/39)) | |
| Food waste | Spending → Food waste card ([#34](https://github.com/traista-eugen/merinde/issues/34)) | Waste is money |
| Demo household | Welcome → Try the demo household; a DEMO badge replaces the household button on every tab ([#42](https://github.com/traista-eugen/merinde/issues/42)) | Always visible, one tap to reset or leave |

## Toolbar pattern

| Position | Root screens | Pushed screens |
|----------|--------------|----------------|
| Top left | Household button | Back |
| Title | Large, serif | Inline, SF Pro |
| Top right | One primary action: `+` (Recipes, Pantry, Spending) | Screen actions, then `…` More menu |

## Household sheet

- Household name and members (initials, "You"), each with a diet summary ("Vegetarian", "Allergic to nuts" in Beet). Tap → **Diets and allergies**: diet chips (Vegetarian, Vegan, Pescatarian, No pork, Halal, Low salt) and allergy chips (Nuts, Peanuts, Gluten, Lactose, Eggs, Fish, Shellfish, Soy, Sesame, Celery, Mustard, Other); selected allergies are Beet. Footnote: Merinde checks recipes against the list in code; still read labels.
- Invite: the 6-character code and a `ShareLink`.
- **You:** Expiry reminders ("Day before, 18:00"), Language ("Follows your iPhone (English)", opens the app's page in Settings), How prices are shared ([0005](../decisions/0005-pooled-price-data.md)).
- Sign out.

## First run

1. **Welcome:** a cooking video across the top half, fading into `Paper`; horizontal logo lockup ([brand.md](brand.md)) and the "food packed for the road" line; three one-line features; Sign in with Apple (`SignInWithAppleButton`, black in light mode, white in dark), Continue with email, and **Try the demo household** ([#42](https://github.com/traista-eugen/merinde/issues/42)). Video spec below.
2. **Household:** Create one (name it) or Join with a code. An invite link opens this step with the code filled in.
3. **Plan tab**, with the setup card and empty states pointing to Update pantry and New recipe.

**Demo household:** opens a ready-made household (pantry with expiring items, recipes with variants, a 3-day plan, a list, receipts from three shops, waste stats). A Saffron **DEMO** badge takes the household button's place on every tab; tapping it opens a sheet: "You're in the demo household", Keep exploring, Reset demo, Leave demo. Demo data never mixes with real households or pooled prices.

### Welcome video

| | |
|-|-|
| Content | Cooking close-ups (chopping, a pan, steam), warm light that suits the paprika and cream palette. No text, logos or faces; the wordmark sits on top |
| Format | Portrait 9:16, 1080×1920, H.264 or HEVC `.mp4`, no audio track, under ~4 MB, bundled in the app |
| Loop | 6–10 s, seamless (last frame matches the first) |
| Framing | Keep the action in the top 60%; the bottom fades into `Paper` |
| Poster | First frame as an image asset, shown until the video plays |
| Playback | `AVQueuePlayer` + `AVPlayerLooper` in an `AVPlayerLayer` (not SwiftUI `VideoPlayer`, which shows controls); muted; doesn't interrupt the user's music (`.ambient` audio session) |
| Reduce Motion, Low Power Mode | Show the poster, don't play |
| VoiceOver | Hidden (decorative) |

## Considered and rejected

| Option | Why not |
|--------|---------|
| Scan tab in the middle | A tab that triggers an action breaks HIG, and three scans feed three places |
| Settings tab | Too little in it; one household per user |
| Spending under Pantry or in "More" | Hides a feature the demo needs; five tabs fit |
| Recipes first | Plan is the daily starting point and shows the loop; recipes are one tap away from any meal |
