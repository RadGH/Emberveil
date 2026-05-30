---
name: Playtest checklist M271
description: Morning-playtest verification for everything shipped M264–M271. Updated 2026-04-24.
type: reference
---

# Playtest Checklist — M264–M271

Quick pass through features shipped since the last playtest session. Goal: catch any regressions from the rapid iteration before sinking time into a long session.

## 🎯 Priority checks (do these first)

### 1. Tinker class + Clockwork Turret (M269/M270)
- [ ] New Game → Create Hero → is **Tinker** present? Should be locked unless Act 1 is complete (or cheat "unlock all classes" is on).
- [ ] Rolling a Tinker from Create Hero → hero art renders (portrait + south).
- [ ] Ashfort (Act 2 town) tavern → **Ysolde Cogwright** (female Tinker, L3, 220g) available to hire.
- [ ] Hired Ysolde → her skills array is populated (should have Clockwork Bolt + any others unlocked at L3) and pending skill/passive points auto-spent.
- [ ] Open Skill Tree on Tinker → purchase the **"Deploy Turret"** talent on Clockwork Bolt → Clockwork Turret companion appears in party (or bench if full).
- [ ] Turret's 5 poses render in combat (portrait, south, east, east_attack, east_ko). Should match the brass/clockwork aesthetic.

### 2. Combat Report — everything (M267/M268)
- [ ] Win a fight → Combat Report button on victory modal → opens.
- [ ] **Lose a fight** (die) → Combat Report button on defeat modal → opens. (new in M268)
- [ ] Beat the final boss → Combat Report button present alongside New Game+. (new in M268)
- [ ] Report has three tabs: **DAMAGE / HEALS / MITIGATION**.
- [ ] Expand a character row → sources listed. Expand a source → per-hit log.
- [ ] **"Show enemies"** checkbox top-right → enemy rows appear with purple "ENEMY" pill. (new in M268)
- [ ] Per-hit log shows round, target, CRIT badge, overkill, overheal, mitigation passthrough tags.

### 3. Skill name attribution in meter (M268)
- [ ] Cast **Magic Missile** (mage) → the meter row is attributed to "Magic Missile", NOT "Attack".
- [ ] Same check for Fireball, Bone Spike, Clockwork Bolt, Holy Strike.
- [ ] Rejuvenation (heal) shows up in HEAL tab, not DAMAGE.

### 4. Skill tooltip accuracy after the M266 stacking fix
- [ ] Open Skill Tree → any skill with an upgrade + a purchased talent (e.g. a level-10+ knight's Shield Bash).
- [ ] Tooltip "Damage: X× STR" should MATCH the actual damage dealt in combat (previously divergent by 2–3×).
- [ ] If a skill has upgrades, tooltip shows annotation `(base 1.1×, upgraded)` when effective ≠ base.

### 5. HP persistence on Hard (M266)
- [ ] Set difficulty to Hard.
- [ ] Take damage in a fight, win.
- [ ] Start the next fight → hero HP starts at the post-fight value, NOT full max.
- [ ] Same check for a companion in the party (the bug was companion-specific before M266).

### 6. Loot chest timing (M266)
- [ ] Beat a boss → chest appears immediately after victory / level-up dialogs close (NOT after a town visit later).

## 🧪 Secondary checks (only if time)

### DPS meter UX polish
- [ ] Meter panel is **draggable** by its header → drag, close combat, open new combat → position restored (M262).
- [ ] Cycle the meter mode button → DMG → HEAL → MIT → DMG (M267).
- [ ] Secondary-effects checkbox in combat log → inline on the right of "Combat" header, checkbox is small, log stays full-width (M262).

### Level-up auto-details (M258/M261)
- [ ] Level up with autoBuild on → dialog shows "Auto: +1 STR, +1 CON" style badges, color-coded per category.
- [ ] Freshly unlocked skill → "New Skill: ✨ [name]" line.
- [ ] If every pending point got auto-spent → "Spend Now" button is hidden; only "Continue" remains (M261).

### New Game+ button layout (M263)
- [ ] Beat the final boss → the NG+ button is on its own line (not smushed next to Continue).

### Quest indicators on map (M260)
- [ ] With an active quest referencing a story flag like `seer_met` → the relevant dialog node (Seer's Hut) shows the gold "!" indicator.
- [ ] After visiting it and completing the flag → "!" disappears.

### Map structure: new Border Roads nodes (M260)
- [ ] Border Roads zone now has 8 nodes instead of 6 — `gravel_bend`, `wayside_cache`, `briar_trail` added.
- [ ] Thornwood has `mossy_glade`, `thorn_thicket` added.

### Character Redesign "hide fully approved" (M263)
- [ ] /assets/character-redesign.html → check "Hide fully-approved characters" → chronomancer_female (and other auto-healed entries) disappear.
- [ ] Tinker + Tinker female + Clockwork Turret present and auto-approved. Sprite comparison looks decent vs. the clockwork aesthetic.

## 🚩 Known issues flagged in the code review (M271)

**Bug — critical:** pyromancer and stormcaller duplicate-slot passives are double-counted (`passives.js:130`). One purchased rank of igniting/stormcharged counts as 2 because `slotCount` multiplier fires on top of storage that's keyed by nodeId.
- **Workaround while deciding fix:** pyromancer/stormcaller characters are currently stronger than intended. Don't over-index on their sim numbers.

**Bug — high:** Combat Report under-reports enemy heal + mitigation (`CombatScreen.js:904,918,928`). Only `_meterAddDamage` lazy-creates enemy entries. If you enable "Show enemies" and see enemy dmg numbers but little/no enemy heal or mit, that's the bug, not the reality.

**Perf — medium:** Meter re-renders on every tracked event. Visible as small stutters in crowded fights.

All three are on the wishlist for triage.

## Runbook hygiene

- If any check fails, capture: browser console errors + a screenshot + the save file path under `/home/radgh/claude/assets/references/emberveil/saves/`.
- For playtest-vs-sim divergence, run `node scripts/balance-single.mjs <save.json> <encounter_id> <act>` to get a side-by-side for the same encounter.

Last updated: 2026-04-24 post-M271.
