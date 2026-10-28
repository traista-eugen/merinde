# Logo and app icon

_Chosen by the user 2026-10-28 from three concepts (see the "Logo & icon" page of the [mockups](README.md))._

**Steam m:** a paprika bowl whose green steam draws the "m" of Merinde.

## Files

All in [brand/](brand/), drawn on a 100-unit grid.

| File | Use |
|------|-----|
| `icon.svg` | App icon, default (light) |
| `icon-dark.svg` | App icon, dark appearance |
| `icon-tinted.svg` | App icon, tinted appearance (grey reference; the system recolours it) |
| `icon-layer-bowl.svg`, `icon-layer-steam.svg` | Foreground layers for Icon Composer |
| `mark.svg`, `mark-dark.svg`, `mark-reversed.svg` | The mark without a background, for lockups and in-app use |

## App icon

- Built in **Icon Composer** (Xcode 26): background = solid fill, group 1 = bowl, group 2 = steam. Liquid Glass adds depth on iOS 26; save as `AppIcon.icon` in the Xcode project. Check that the generated fallback looks right on iOS 17.
- Colours per appearance:

| Appearance | Background | Bowl | Steam |
|------------|------------|------|-------|
| Default | `Paper` `#F7EEDF` | `#C23B1E` | `#3B7344` |
| Dark | `#1A1410` | `#E9653F` | `#7DBE89` |
| Tinted / Clear | System | Light layer | Mid layer |

- Geometry: steam is one path, round caps, stroke 7.5; rim 72×6 (radius 3) at y 48; bowl a half-ellipse 64×30 under the rim; foot 22×5. At 40 pt and below, thicken the steam to 8.5–9.5 so it doesn't vanish.

## Lockups

| Lockup | Where |
|--------|-------|
| Horizontal: mark + "Merinde" | Welcome screen, demo video, README |
| Stacked: mark above the wordmark | Splash, App Store art |
| Reversed on paprika: bowl in `Paper`, steam in `Highlight` `#F6D58E` | On `AccentColor` backgrounds |

- Wordmark: "Merinde" in New York Bold (`.largeTitle.bold()` + `.fontDesign(.serif)`), never translated.
- Gap between mark and wordmark: ¼ of the mark's height. Clear space around the lockup: ½ the mark's height. Smallest mark: 20 pt.
- Don't outline, add gradients, rotate, or recolour the steam paprika.
