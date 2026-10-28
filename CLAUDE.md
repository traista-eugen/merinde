# CLAUDE.md

Merinde is a household food app: AI recipes with variants, pantry with expiry tracking, meal plans, a shared shopping list, receipt and barcode scanning, and price comparison across shops. Native iOS app first, Android after, built for the Meta Global AI Developer Hackathon, indie track (submission due 4 Nov 2026, 9:00 PM ET). Romania (RON) first, then Europe (EUR). Read `docs/vision.md` and `docs/architecture.md` for the current state, and check `docs/decisions/` before changing anything they cover.

## Where things live

- `docs/`: product and technical docs (index in `README.md`, process in `docs/workflow.md`)
- `ios/`, `android/`, `supabase/`: planned code layout (see `docs/architecture.md`)
- GitHub Issues: source of truth for work items; milestones mirror `docs/roadmap.md`

## Working agreements

- When a product or technical decision is made, update the relevant doc in `docs/` in the same change.
- Hard-to-reverse choices get a decision record in `docs/decisions/` (copy `0000-template.md`, next number).
- New ideas go in `docs/brainstorm.md` first, not straight into requirements.
- Each MVP user story in `docs/requirements.md` maps to one GitHub issue; link the issue number back.
- All AI calls go through the backend. Never put the Meta API key in an app, and never use the `-contributor` model tier (see decision 0003).
- Keep docs short: bullets and tables over prose.
