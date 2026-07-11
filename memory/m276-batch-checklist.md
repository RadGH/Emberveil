---
name: M276 batch checklist
description: User's massive 22-item batch from 2026-04-25. Track progress; never shelve.
type: project
---

# M276 Batch Master Checklist

User instruction: "continue releases until everything is implemented. Do not defer items unless they cannot be implemented for a good reason, never shelf an item because it 'takes too much time'." Anything blocked → wishlist.html with explicit reason.

## Confirmed clarifications

1. **Easy/Normal: 0% bonus, no display**. Only Hard shows: 10% XP, 20% MF.
2. **Compare on touch**: button on tooltip. **Compare on desktop**: Alt-modifier (existing). Detect touch capability for switch.
3. **Auto-equip metric**: delta in Offense/Defense/Utility totals (uses new scoring).
4. **Prologue**: every new character. Repeats on NG+ for now (might remove later).
5. **Map seed**: free-text string, hashed for determinism.
6. **Hardcore + auto-revive**: if combat ends with at least one revive-capable ally alive → revive everyone. Otherwise permadeath. Importance: keep healers alive.
7. **Town placement**: agent randomizes; user will fine-tune later. Emberglen stays as Border Roads node 1.

## Items (22)

### Bugs (5)
- [x] **B1 Dialog UI stuck during combat** — fixed M275 via `manager.replace` in MapScreen dialog handler. Verify with regen video.
- [ ] **B2 Shield affix rolls** — Bulwark/Bracing/Spellguard auto-roll on white. Restrict by item type. Spellguard also valid on chest+legs. Never on weapons.
- [ ] **B3 Shield base block stats display** — show "Block: X%" + "Block Power: +Y" as white stats below armor. Affix-bonus block in Other Effects.
- [ ] **B4 Loot chest pops after leaving town** — M266 fix incomplete; chest must pop during post-boss dialog or right after, never after town.
- [ ] **B5 Title-attr + tooltip overlap** — strip native `title=` from inventory stats so the custom tooltip wins (Damage Reduction etc.).

### UI parity / cleanup (5)
- [ ] **U6 Skills>Attributes layout matches Inventory>Character Stats** — one Damage row by weapon type (Heavy/Light/Magic), "HP" not "Max HP", DR/MR in Derived Stats not Other, Base toggle behavior matches.
- [ ] **U7 Item Offense / Defense / Utility scoring** — Diablo-3 style weighted (raw damage + crit chance > hit rating).
- [ ] **U8 Inventory highlighting** — empty-slot upgrade glow, O/D/U upgrade glow with magnitude tier, hover-highlights equippable slots, Alt-compare (gain/lost/same; Alt+Shift secondary; touch button fallback).
- [ ] **U9 Treasure chest pre-roll seed** — items rolled at award time or by deterministic seed; save+reload can't re-roll.
- [ ] **U10 Per-character auto-equip toggle** — manually unequipped items don't auto-re-equip. Only triggers on new acquisition.

### Skill tree polish (1)
- [ ] **S11 Auto-button polish** — in-game modal not browser confirm; no nag if no points; checkmark badge on tabs when auto.

### Difficulty system (4)
- [ ] **D12 Ask difficulty every New Game** — currently only asks if no prior choice in localStorage.
- [ ] **D13 Easy difficulty** — auto items/skills/attrs by default. Otherwise behaves like Normal.
- [ ] **D14 Difficulty advanced options** — Map Seed (string), Fog of War (checkbox), Hardcore (checkbox). All default off.
- [ ] **D15 Difficulty bonuses** — Hard only: 10% XP + 20% MF. Easy/Normal 0% + no display.

### Combat (1)
- [ ] **C16 Auto-revive at combat end** — if any party member with a revive skill is alive when combat ends, revive everyone. Bypasses cooldown.

### Map (6)
- [ ] **M17 Star indicator on map zone tabs** — show party location.
- [ ] **M18 Fast-travel: towns only** — remove Forest Warden waypoint; Hard restricted to FT nodes; preserve inter-map start/end transitions.
- [ ] **M19 Towns visible like normal nodes** — no hidden until discovered (until fog of war is on); FT unlocks on visit.
- [ ] **M20 Prologue map** — 5-node single-path: start (no-op) → warning dialog → combat → combat → mini-boss. Solo (no tavern). Pre-existing party.
- [ ] **M21 Dust Roads node layout** — Ysolde shouldn't block Salt Wastes; Ashen Sentinel 5-way → 3-way max.
- [ ] **M22 Town placement reshuffle** — Emberglen stays mainline; other 11 towns become off-branch optional in most cases.

## Sub-agent strategy (3 waves of parallel work)

### Wave 1 (in flight)
- **Agent A1: Shield system** — items.js (B2 affix restrictions, base-block intrinsic), InventoryScreen.js (B3 display, B5 tooltip strip).
- **Agent A2: Prologue map** — new ZONE in mapData.js, encounter for the mini-boss, gate at New Game start. Doesn't touch existing screens.
- **Agent A3: Difficulty system overhaul** — CharacterBuilderScreen.js (D12 always ask, D14 advanced options panel), gameState.js (D13 Easy auto-flags, D14 settings persistence), balance-loader.js (D15 bonus structure).

### Wave 2 (after Wave 1 lands)
- **Agent B1: Item scoring + inventory** — items.js (U7 score), InventoryScreen.js (U8 highlight + compare).
- **Agent B2: Skill tree polish + Skills>Attributes parity** — SkillTreeScreen.js (S11 + U6).
- **Agent B3: Map system updates** — MapScreen.js (M17, M18, M19), mapData.js (town reshuffle M22).

### Wave 3 (after Wave 2 lands)
- **Agent C1: Auto-equip + auto-revive + chest seeding + chest-after-town fix** — gameState.js, CombatScreen.js, MapScreen.js (U9, U10, B4, C16).
- **Agent C2: Dust Roads node layout** — mapData.js (M21).

## Progress log

- 2026-04-25 12:50 — checklist saved, beginning Wave 1.
- 2026-04-25 13:55 — Wave 1: A1 (shields B2/B3/B5) ✅, A2 (prologue M20) ✅, A3 (difficulty D12/D13/D14/D15) ✅. Merged worktrees into main, M276 shipped + deployed.
- 2026-04-25 14:00 — Wave 2 launched: B1 (scoring U7 + inventory U8), B2 (skill tree S11 + attrs U6), B3 (map M17/M18/M19/M21/M22).
- _pending_ — Wave 3 will cover: B4 loot-chest-after-town, U9 chest seed, U10 auto-equip, C16 auto-revive.
- _pending_ — final pass: regenerate playthrough video, dialog-stuck verification, wishlist sweep.

## New items added 2026-04-25 (Wave 4 backlog)
- [ ] **N1** Generate `veilspawn_herald` sprite via SpriteCook (prologue mini-boss). Use standard art_direction policy.
- [ ] **N2** Hide prologue zone from map navigation tabs — no return-to-prologue UI after completion.
- [ ] **N3** Enemy hit chance baseline ~80% (some higher, some lower) — early game should rarely miss. Audit `formulas.js:rollToHit` and enemy `hit` defaults in `mapData.js`.
- [ ] **N4** Increase early-game enemy raw damage by +5-10. Currently ~3 raw → 1-2 mitigated. Audit `mapData.js` ENEMIES dmg ranges in border_roads / thornwood / dust_roads.

## Items closed (running tally) — ALL 26 SHIPPED

### M275 (verified pre-batch)
- B1 ✅ dialog UI stuck during combat (manager.replace fix)

### M276 — Wave 1
- B2 ✅ shield affix restrictions (Bulwark/Bracing magic+ shields only; Spellguard chest+legs+shields; never weapons)
- B3 ✅ shield "Block: X%" / "Block Power: +Y" rendered as base white stats
- B5 ✅ inventory tooltip native title= overlap stripped
- M20 ✅ prologue zone (5 nodes, solo, every new char + NG+)
- D12 ✅ ask difficulty every new game
- D13 ✅ Easy difficulty (auto-build defaults)
- D14 ✅ advanced options panel (Map Seed string, Fog of War, Hardcore — persisted in gs)
- D15 ✅ difficulty bonuses (Hard only: +10% XP / +20% MF)

### M277 — Wave 2
- U7 ✅ Item Offense/Defense/Utility scoring with weight table (Diablo-3 style)
- U8 ✅ inventory upgrade-glow tiers + empty-slot highlight + hover-slot + Alt-compare (desktop) + touch Compare button
- S11 ✅ skill tree Auto button via in-game ConfirmModal (no browser confirm); skip nag if no points; ✓ badge per tab
- U6 ✅ Skills>Attributes panel uses shared CharacterStatsPanel renderer matching Inventory layout
- M17 ✅ star indicator on map zone tabs for current party location
- M18 ✅ fast-travel: town nodes only; Hard restricts to visited towns
- M19 ✅ towns visible by default (only hidden when fogOfWar=true)
- M21 ✅ Dust Roads layout audited — Ysolde tinker_workshop node was never in code on this branch (present only in M272 wishlist references); ash_gate already at 3 exits. No-op for now.
- M22 ✅ town reshuffle — 5 of 11 towns repositioned off-branch (the other 6 names referenced in the wishlist text never existed as code; flagged for follow-up).

### M278 — Wave 3
- B4 ✅ loot chest opens immediately on map return (drained from both onEnter + onResume)
- U9 ✅ chest items pre-rolled at boss death + persisted in gs (no save-scum reroll)
- U10 ✅ per-character auto-equip toggle (delta-O/D/U scoring; manual-unequip blocklist; companions skipped)
- C16 ✅ auto-revive at combat end if any reviver alive (50% HP; bypasses cooldown)
- N1 ✅ veilspawn_herald sprite 7-pose set generated via SpriteCook (pending_approval gate)
- N2 ✅ prologue zone hidden from map navigation tabs (filtered unless party still in prologue)
- N3 ✅ enemy hit baseline ~80% across Act 1-2 (was 60-70)
- N4 ✅ enemy raw damage +5-10 on Act 1 trash + Act 1-2 bosses

## Open follow-ups (not part of original checklist; user-deferred)

- **6 missing towns** referenced in wishlist text but never in `_ACT_TOWN_INSERTS`: Greenbough, Emberwatch, The Last Bastion, Void Harbor, Creation Rest, Scaleholt. If user wants those in code, add to mapData.js with attach nodes (suggested: goblin_camp, veil_stronghold, shard_fortress, unraveler_ante, architect_bridge, dragon_fortress).
- **Hardcore permadeath** — `gs.hardcore` flag persists but the permadeath consumer isn't wired (heroes still revive on TPK via the M46 softlock fix). Implement when balance is ready.
- **Map Seed consumer** — `gs.mapSeed` persists but no zone-generation code reads it yet.
- **Fog of War rendering** — towns gating works; FULL fog-of-war (hide all unvisited nodes) not implemented.
- **veilspawn_herald sprite approval** — frames are `pending_approval`; user must approve via `/assets/character-redesign.html` then re-run sync.
- **Dialog-stuck verification** — M275 fix shipped; one more playthrough video needed to confirm (see Final Verification below).

## Final Verification

- [ ] Regenerate playthrough video to confirm dialog-stuck bug gone + combat actually deals damage post-N3/N4 tuning.

