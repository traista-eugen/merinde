# Requirements

## MVP scope

Everything marked `mvp` in [brainstorm.md](brainstorm.md), delivered on iOS for the hackathon submission on **4 Nov 2026** (milestone M1).

### User stories

Format: _As a \<user\>, I want \<goal\> so that \<reason\>._
Each story becomes one GitHub issue; add the issue number once created.

#### Households and accounts

| ID | Story | Issue |
|----|-------|-------|
| US-01 | As a family member, I want to sign in with Apple or email so that my data is safe and synced across devices. | [#1](https://github.com/traista-eugen/merinde/issues/1) |
| US-02 | As a household owner, I want to create a household and invite family with a code or link so that we share one pantry, plan and list. | [#2](https://github.com/traista-eugen/merinde/issues/2) |

#### Recipes

| ID | Story | Issue |
|----|-------|-------|
| US-03 | As a cook, I want to generate a recipe from a short prompt, using what's in our pantry, so that I don't start from a blank page. | [#3](https://github.com/traista-eugen/merinde/issues/3) |
| US-04 | As a cook, I want to ask for a change and have the same recipe update in place so that I don't lose track in a long chat. | [#4](https://github.com/traista-eugen/merinde/issues/4) |
| US-05 | As a cook, I want to create a variant when an ingredient is missing or I want something different, so that I keep the original and can switch between them. | [#5](https://github.com/traista-eugen/merinde/issues/5) |
| US-06 | As a cook, I want to see a recipe's history and undo a change so that experimenting is safe. | [#6](https://github.com/traista-eugen/merinde/issues/6) |
| US-07 | As a cook, I want a recipe to show which ingredients we have and which are missing, with a one-tap variant that avoids the missing ones. | [#7](https://github.com/traista-eugen/merinde/issues/7) |

#### Pantry

| ID | Story | Issue |
|----|-------|-------|
| US-08 | As a member, I want to add food by typing or speaking a quick list so that stocking the pantry takes seconds. | [#8](https://github.com/traista-eugen/merinde/issues/8) |
| US-09 | As a member, I want every pantry item to have a quantity and an expiry date, estimated if I don't enter one, so that we know what to use first. | [#9](https://github.com/traista-eugen/merinde/issues/9) |
| US-10 | As a cook, I want cooking a recipe to subtract its ingredients from the pantry so that stock stays accurate. | [#10](https://github.com/traista-eugen/merinde/issues/10) |

#### Meal planning

| ID | Story | Issue |
|----|-------|-------|
| US-11 | As a planner, I want a plan for tomorrow's meals that uses what expires soonest so that food doesn't go bad. | [#11](https://github.com/traista-eugen/merinde/issues/11) |
| US-12 | As a planner, I want the plan's missing ingredients added to the shopping list so that I don't have to write it myself. | [#12](https://github.com/traista-eugen/merinde/issues/12) |

#### Shopping list

| ID | Story | Issue |
|----|-------|-------|
| US-13 | As a shopper, I want a shared list that updates live, where I can add items by hand and tick them off one-handed in the store. | [#13](https://github.com/traista-eugen/merinde/issues/13) |
| US-14 | As a shopper, I want ticked items added to the pantry automatically so that restocking needs no extra input. | [#14](https://github.com/traista-eugen/merinde/issues/14) |
| US-15 | As a shopper, I want to see which shop is cheapest for my current list, based on prices from all households. | [#15](https://github.com/traista-eugen/merinde/issues/15) |

#### Scanning

| ID | Story | Issue |
|----|-------|-------|
| US-16 | As a shopper, I want to scan a receipt and have the shop, items, quantities and prices read for me, then review and fix matches, so that the pantry and expenses update without typing. | [#16](https://github.com/traista-eugen/merinde/issues/16) |
| US-17 | As a member, I want to scan a product's barcode to see its name and nutrition. | [#17](https://github.com/traista-eugen/merinde/issues/17) |
| US-18 | As a member, I want to photograph an expiry date on a label so that the pantry item gets the right date. | [#18](https://github.com/traista-eugen/merinde/issues/18) |

#### Expenses and prices

| ID | Story | Issue |
|----|-------|-------|
| US-19 | As a household, we want to see our grocery spending per shop, week and month. | [#19](https://github.com/traista-eugen/merinde/issues/19) |
| US-20 | As a shopper, I want to see a product's price history across shops so that I notice price increases and cheaper options. | [#20](https://github.com/traista-eugen/merinde/issues/20) |

## Out of scope for MVP

- The Android app (after the hackathon).
- Everything marked `new` in [brainstorm.md](brainstorm.md), e.g. week planning, per-member diets, offline list, split-shop suggestions, nutrition per recipe.
- EUR and shops outside Romania.

## Non-functional requirements

- **Platforms:** native iOS for the hackathon, native Android after; no web or desktop.
- **Market:** Romania first (RON), then Europe (EUR); money is always stored with its currency.
- **Users:** accounts and households; pantry, plan, list, recipe and expense data is shared within a household and private to it.
- **Performance:** every AI action shows progress; nothing blocks the app while the model works.
- **Security / privacy:** prices are pooled anonymously across households; receipts and photos stay private; receipt parsing drops personal data; GDPR privacy notice before opening to other households.
- **Languages:** English and Romanian, following the phone; AI output in the app language ([0006](decisions/0006-app-languages.md)).
- **Accessibility:** Dynamic Type and VoiceOver labels on every screen.
- **Design:** follows [docs/design](design/README.md).
