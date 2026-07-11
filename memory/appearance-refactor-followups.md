# Appearance Refactor Followups — M431+

Created: 2026-05-09
Context: images.html refactor (requirement d) — hardcoded sprite references that
still need to move to appearance-driven JSON lookups.

## Hardcoded references NOT yet refactored

### 1. `src/game/spriteUtils.js` — `resolveSprite()`
**Lines ~39–50**
The fallback chain in `resolveSprite()` still uses `member.templateId || member.classId || cls`
as raw string sprite keys. These work correctly for now because the APPEARANCES registry
is the authoritative source (checked first via `member.appearance`), but the companion
path `if (cls === 'companion') return member.templateId || member.id` means companions
without an explicit `appearance` field resolve by templateId directly.

**TODO:** Add `appearance` field to every companion template in companions.js so
the `member.appearance` branch always fires, eliminating the raw-id fallback.

### 2. `src/game/companions.js` — CLASS_PETS without `sprite` field
Most pets (skeletal_warrior, bone_golem, wolf, bear, imp, demon, war_hound,
fire_elemental, lightning_elemental, familiar) do NOT have a `sprite:` field.
They rely on the runtime falling back to `member.templateId` (the pet id).

**TODO:** Either:
  a. Add explicit `sprite: '<id>'` to every pet entry matching the spritecook filename.
  b. Or ensure the appearance registry has entries for each pet id.
Currently there are NO appearance entries for `pet_*` ids. The companions.json
export maps them as `kind: 'pet'` but the appearance registry does not cover them.

### 3. `src/ui/screens/CombatScreen.js` — SPRITE_MAP or sprite resolution
**DO NOT TOUCH per parallel-agent constraint.**
Any hardcoded id→prefix map in CombatScreen.js should be migrated to the
appearance registry in a future milestone after the parallel agent finishes.

### 4. Bosses without `appearance` entries
The bosses JSON (public/assets/data/bosses.json) lists 16 bosses.
None have appearance registry entries — they rely on the `images/bosses/` directory
which contains a separate sprite set (e.g. `architect_boss_east.png`).

**TODO (future milestone):** Add boss appearance entries to appearances.js pointing
to the `bosses/` sprite directory, so `resolveSprite()` covers them too. Currently
the appearances-manifest builder handles bosses separately (via bosses.json), which
is functional but not fully appearance-driven.

### 5. `images/sprites/` directory — ~573 orphaned old PixelLab sprites
The appearances-manifest reports ~908 orphans. The majority are in `images/sprites/`
(old PixelLab-generated sprites, superseded by spritecook equivalents).
These are safe to archive (move to `sprites_pixellab_archive/`) once confirmed
no runtime code falls back to them without a spritecook equivalent.

**Check before archiving:** Run `node scripts/audit-sprite-404s.cjs` to confirm
zero in-game 404s with the spritecook sprites, then move the sprites/ files.

### 6. `src/ui/screens/MapScreen.js` — any hardcoded encounter sprite resolution
**DO NOT TOUCH per parallel-agent constraint.**
If MapScreen.js resolves enemy sprites by raw encounter id, that should use
the appearances/enemies registry instead.

## What IS fully appearance-driven (as of M431)

- All 67 APPEARANCES entries (classes + variants + NPCs) → appearances-manifest.json
- All companions (35 entries) → companions.json → appearances-manifest.json
- All enemies (20 non-boss) → enemies.json → appearances-manifest.json
- All bosses (16) → bosses.json → appearances-manifest.json
- Orphan detection covers spritecook/, sprites/, pixellab/, bosses/ directories
- images.html renders entirely from appearances-manifest.json — zero hardcoded paths
