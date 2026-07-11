---
name: Next Session Checklist
description: Remaining work from the sprite generation + balance session (2026-04-16). Resume here.
type: project
---

## Remaining Work

### 1. Hero Pose Sprite Generation (highest priority)
13 heroes need 6 poses each (south, east, east_attack, east_spell, east_block, east_ko) = **78 sprites total**.

**Heroes that need poses generated:**
necromancer, bard, druid, demon_hunter, tactician, chronomancer, stormcaller, dragon_knight, swashbuckler, scavenger, pyromancer, warlock, cleric

All 13 already have **portraits** generated and saved. Their portrait asset_ids are in:
`public/images/spritecook/spritecook-assets.json`

**How to generate:**
- Use `generate_game_art` MCP tool with `reference_asset_id` set to each hero's portrait asset_id
- Theme: "dark fantasy medieval", Style: "16-bit SNES RPG style", 64x64, pixel=true, bg_mode=transparent
- Download the presigned pixel URL with curl, save to `public/images/spritecook/<id>_<pose>.png`
- Cost: ~12 credits per sprite, ~936 credits total. Balance was 5,436 credits as of end of session.

**Portrait asset_ids for reference:**
- necromancer: `602609b8-524b-40d4-b0f1-7a1a5ee1b2b0`
- bard: `20f30802-cbf3-4dee-bd7b-3559de28b67a`
- druid: `31e8dbf9-8111-4f53-a092-b8e3cab0ce64`
- demon_hunter: `2ef1591a-4d0c-4a5d-bef3-d7a1cd627ec5`
- tactician: `313eab72-b70b-4bf3-a971-3c2bb66cab80`
- chronomancer: `c7d102e2-473a-4ffa-a702-488423cc7028`
- stormcaller: `b77d1806-428e-4ba3-a138-61e1cf4c4f0b`
- dragon_knight: `23ce88d1-5821-4142-a198-96d56dff4839`
- swashbuckler: `885156f2-97da-4f67-9b18-5b595984f405`
- scavenger: `52b834f0-358b-4ffb-b943-bfe45098d50f`
- pyromancer: `ddc04435-d862-468d-b974-7f98f17ab3f0`
- warlock: `b780621a-bd9d-45b7-94c1-7d5c14f60e56`
- cleric: `a325f327-069f-46b4-bc8d-2c03cf89e3b7`

### 2. Enemy Sprite Generation (after heroes)
~43 enemy characters need portraits + poses. Not yet started.

### 3. Companion Animation Sprites
10 companions have static sprites but need walk/attack animation frames. Lower priority.

### 4. Combat Backgrounds (generated but NOT wired in)
26 combat backgrounds exist at `public/images/combat_bg/` with a `backgrounds.json` manifest. They are NOT integrated into CombatScreen.js. The procedural background system (zone palettes, parallax layers, stars, embers) already exists in `CombatScreen._drawBackground()`. Decision needed: overlay, replace, or leave procedural.

### 5. Balance Test Status
All 40 balance tests PASS (`src/game/__tests__/balance.test.js`). Current results with realistic equipment:
- Acts 1-5 regulars: 100% win rate
- Act 6 regulars: 94% avg (dragon_elite at 70%)
- Bosses: 0-8% from Act 3 onward (expected — simulator omits status effects, potions, tap weapons)
- Tap weapons are documented but not simulated (flat damage, only viable early game)

### 6. Known Issues
- The `pet_familiar` was regenerated as a black cat (was a blue floating alien). All 5 sprites replaced, description updated in companions.js. Verify it looks correct in-game.
- 4 pets have no image files at all: pet_bone_hound, pet_hunting_hound, pet_storm_elemental, pet_golem. The portrait fallback chain hides broken images (display:none).
- The re-redesign report (`public/news/re-redesign.html`) has generation prompts on all 30 character cards now. The IntersectionObserver was fixed (threshold 0.12→0 with rootMargin) for mobile Safari.

## Current Milestone
M119 is deployed. The milestone number auto-increments with each `release.sh` run.

## Files to Know
- `src/game/spriteUtils.js` — portrait resolution with 3-level fallback (spritecook → old portrait → sprite east → hide)
- `public/images/spritecook/spritecook-assets.json` — manifest of all SpriteCook asset_ids
- `public/news/re-redesign.html` — visual report showing all generated sprites with before/after
- `src/maps/mapData.js` — enemy stat blocks (buffed Acts 2-6 this session)
- `src/game/formulas.js` — damage formulas (nerfed: 0.4/1.0 multipliers, spell bonus floor(INT*0.25))
- `src/game/simulator.js` — Monte Carlo combat simulator
- `e2e/` — Playwright tests (bugs.spec.js, full-flow.spec.js, gameplay.spec.js, combat-balance.spec.js)
