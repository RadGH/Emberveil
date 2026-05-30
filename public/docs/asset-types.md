## Asset Type Registry

What Emberveil considers a managed asset, where it lives, and how it's indexed.

### Storage locations

| Directory                          | Contents                                          |
|------------------------------------|---------------------------------------------------|
| `public/images/spritecook/`        | Canonical character art (heroes, companions, bosses, enemies) — all 7 poses |
| `public/images/combat_bg/`         | Combat backgrounds (1536×1024) + square thumbs    |
| `public/images/map_bg/`            | Zone map backgrounds                              |
| `public/images/menu_bg/`           | Title/menu art (hero images)                      |
| `public/images/icons/`             | Item/UI icons, tap-weapon icons                   |
| `public/sfx/`                      | Sound effects (Ogg Vorbis)                        |
| `public/music/`                    | Music tracks (Ogg Vorbis)                         |
| `public/images/sprites_pixellab_archive/` | **Legacy** — to be phased out. Do not generate new files here. |

### Indexes (kept in sync with filesystem)

- `public/assets/assets.json` — human-browsable catalog rendered by `/assets/`
- `public/assets/image-review-manifest.json` — canonical pose coverage per character, drives `/assets/image-review.html`

**Rule:** every image added to disk MUST be added to BOTH indexes in the same change. No silent drops.

CI / pre-commit check: `node scripts/check-unregistered-images.cjs` walks `public/images/` and exits non-zero if any file is not referenced by `assets.json`, `image-review-manifest.json`, `spritecook-assets.json`, or any source/public file. Run it before committing an asset batch.

### Image categories in image-review

The image-review manifest groups every entry by `category`:

- `hero` — 14 classes × 7 poses
- `companion` — class-pet list × 5 poses
- `boss` — boss roster × 5 poses
- `enemy` — portrait-only
- `background` — `combat_bg/`, `map_bg/`, `menu_bg/`
- `tap-weapons` — icons + projectile/effect frames under `tap_fx/`, `tap_weapons/`, `tap_effects/`
- `orphan` — files on disk not referenced anywhere

### Character IDs

A character ID maps 1:1 to a row in image-review. Current canonical IDs are derived from:

- Hero classes: `src/game/classes.js` (`id` field per class)
- Appearances: `src/game/appearances.js`
- Companions: `src/game/companions.js` (or equivalent data file)
- Bosses/enemies: `src/game/enemies.js` + `src/game/bosses.js`

When adding a new character, the ID becomes its spritecook file prefix: `my_hero_portrait.png`, `my_hero_south.png`, etc.

### What is NOT a managed asset

- Screenshots (`release_server/screenshots/`) — managed by `take_screenshots.sh`
- Build output under `dist/` or `*_releases/milestone_*/dist/` — ephemeral
- Anything under `assets/references/` — **secrets, never committed**
