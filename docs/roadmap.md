# Roadmap

Each milestone here has a matching GitHub milestone. Issues are the source of truth for status; this file is the big picture.

**Deadline:** hackathon submission due **4 Nov 2026, 9:00 PM ET** (5 Nov, 04:00 Romania time).

## M0: Foundations (28–29 Oct)

- [x] Vision and brainstorm written
- [x] Stack decided: native apps (iOS first), Meta Muse models, Supabase
- [x] MVP user stories written and turned into issues
- [ ] Backend: schema, auth, households and invites working ([#21](https://github.com/traista-eugen/merinde/issues/21), [#1](https://github.com/traista-eugen/merinde/issues/1), [#2](https://github.com/traista-eugen/merinde/issues/2))
- [ ] iOS skeleton: sign in, create or join a household ([#22](https://github.com/traista-eugen/merinde/issues/22))
- [ ] AI gateway edge function calls Muse Spark and returns validated JSON ([#23](https://github.com/traista-eugen/merinde/issues/23))
- [x] Open Food Facts coverage checked for Romanian products ([#24](https://github.com/traista-eugen/merinde/issues/24))
- [ ] Apple Developer Program enrollment ($99/year) for TestFlight; approval can take a day or two ([#25](https://github.com/traista-eugen/merinde/issues/25))

## M1: MVP, hackathon submission (30 Oct – 4 Nov)

Everything marked `mvp` in [brainstorm.md](brainstorm.md) is in scope. The order below means each day ends with something demoable, and the earliest parts are the most solid if time runs short.

| Day | Build |
|-----|-------|
| 30 Oct | Recipes: generate, refine in place, variants, history, servings, favourites; member diets and allergies |
| 31 Oct | Pantry: quick add by text or voice, expiry estimates, quick corrections, rough staples, expiry reminders; cooking subtracts stock |
| 1 Nov | Meal plan for the next n days (expiring first) → shared shopping list: who ticked, offline, ticking restocks the pantry |
| 2 Nov | Receipt scan: shop, items, prices, discounts → pantry, expenses, pooled price observations with unit prices per kg or litre |
| 3 Nov | Cheapest shop and split-shop suggestion; barcode → nutrition; nutrition per recipe and day; expiry from label photo; food waste stats |
| 4 Nov | Demo household ([#42](https://github.com/traista-eugen/merinde/issues/42)), polish, demo video, submit before 9:00 PM ET ([#26](https://github.com/traista-eugen/merinde/issues/26)) |

## After the hackathon

- Android app at parity with iOS.
- Privacy notice and onboarding for households outside the family.
- Europe: EUR shops and receipts from other countries.
- Ideas marked `new` in [brainstorm.md](brainstorm.md).
