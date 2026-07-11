# Emberveil Code Review — M271

## Executive Summary

The codebase is healthy for a rapid-iteration prototype, but three structural strains are now visible and growing: (1) `CombatScreen.js` has crossed the 4,877-line threshold and holds orchestration, AI, damage pipeline, rendering, HUD, meter, debug modal, and two different overlays — it's the single largest extraction opportunity; (2) state mutation & write-back paths remain fragile — the M266 fix was correct but the same by-id pattern is duplicated at `CombatScreen.js:1347-1356` and `2961-2970` and will drift again; (3) hot-loop DOM work (`_renderMeter` full `innerHTML` rewrite per hit, `_updateHud` per-damage-event `querySelector` storm) is now material because combat emits many more meter events since M267. No critical security issues; one correctness bug around passive `slotCount` duplicate-node mult is highly likely a real bug (passives.js:130); a handful of `setTimeout` state-mutation races and a likely `_meterAdd*` silent-drop for enemies-not-pre-seeded also need attention.

Top three concerns, ranked:
1. `passives.js:130` — `mult = r * slotCount[node.id]` double-counts rank for duplicated tree slots (pyromancer's `igniting`×2, stormcaller's `stormcharged`×2). Needs verification against intent; either fix math or fix storage (one rank-slot, not one rank-id).
2. `CombatScreen.js` size + cohesion — splitting out `damageResolver`, `aiTargeting`, `meterTracker`, and `backgroundRenderer` would cut ~1800 lines and unblock future testing.
3. Per-hit `_renderMeter` innerHTML rewrite (CombatScreen.js:957-962) — called 4 ways from `_applyDamage`/`_meterAdd*`; trivial to coalesce via `requestAnimationFrame`/dirty flag.

---

## 1. Stale / Dead Code

| File:line | Description |
|-----------|-------------|
| `src/game/formulas.js:266` | `// TODO: m85 expose %pen via legendary/unique affixes only` — ~200 milestones old. Either implement or delete. |
| `src/game/classUnlocks.js:140-142` | `TODO: add event-driven hooks` — aged; intended hooks (end-of-act, boss kill) already exist elsewhere. Re-assess or remove. |
| `src/game/classUnlocks.js:185` | `TODO: wire kill counter + boss-HP` — same vintage; low-priority. |
| `src/audio/AudioManager.js:815-823` | `M65/M70 aliases for legacy sfx keys` — ~200 milestones old. Audit whether call sites for the old keys still exist; if not, drop the alias table. |
| `src/ui/screens/MapScreen.js:597` | Comment `M64: clouds/parallax sky removed` describing a deletion. Tombstone comments like this can be dropped. |
| `src/ui/screens/CombatScreen.js:4074` | `M46: enemy name label above sprite removed per user feedback` — tombstone. |
| `src/ui/screens/CombatScreen.js:15-48` | `M231 Attack Speed ISOLATED, feature-flagged` block: flag default flipped to ON in M236. The "revert strategy" commentary is stale and the key can be promoted out of feature-flag status (or the block folded into the regular action loop). |
| `src/ui/screens/CombatScreen.js:1519-1522` | `// M89: extraAction — after the regular turn runs, if actor has a pending` — three blank lines follow the comment; looks like the body was moved elsewhere but the block-comment was left. |
| `src/ui/screens/CombatScreen.js:84-133` | `SPRITE_MAP` duplicates company/enemy/class ids that are now also emitted by `resolveSprite` (appearances.js). Worth confirming the map isn't entirely shadowed. |
| `src/game/gameState.js:47` | `let _state = { ...DEFAULT_STATE };` — module-initial `_state` shares the inner arrays (`party`, `companions`, `inventory`, `zoneNodeIds`) with `DEFAULT_STATE`. The acknowledged bug-fix in `init()` at L53-95 explicitly comments about this. The module-initial assignment is now dead for production (always overridden by `init`/`load`) but if anything reads `_state.inventory` before those run it still has the reference bug. Recommend replicating the `init()` pattern for the module-init line or using a factory. |

## 2. Bugs & Logic Issues

### Critical

- **`src/game/passives.js:130` — slot-duplicate multiplier double-counts.** `PASSIVE_TREES.pyromancer` lists `N.igniting` twice (line 83) and `N.stormcaller` lists `N.stormcharged` twice (line 84). `ranks[node.id]` is stored flat (see `SkillTreeScreen.js:346-348,649-652` — keyed only by nodeId), so purchasing 1 rank gives `r=1` but `slotCount=2`, producing `mult=2` → both slots contribute as if fully purchased. This makes those classes' signature passives effectively 2× stronger per point spent than every other class. The inline comment at line 93-95 says "Duplicated nodes ... stack their effect" but storage doesn't distinguish the two slots — you can't buy slot-B without also having bought slot-A. Either (a) key `passiveRanks` by `(nodeId, slotIdx)` and render both slots in UI with separate +/- buttons, or (b) drop the `* slotCount` factor and treat duplicates as intentional tree-aesthetics only. Needs a design decision — flag, don't silently fix. **Severity: Critical (balance).**

### High

- **`CombatScreen.js:904-907,918-921,928-931` — `_meterAddHeal/_meterAddMit/_meterAddDodge` silently drop entries that aren't pre-seeded.** Only allies are seeded at init (L245). If an enemy is healed (enemy `healer` role at L1704-1716) or blocks damage, the meter call no-ops because the `_meterData.get(actor.id)` returns undefined. Inconsistent with `_meterAddDamage` which lazily creates via `_meterEnsureEntry`. Symptom: enemy combat report under "Show enemies" undercounts enemy heals/mitigation. Fix: three one-liners to use `_meterEnsureEntry` in all three helpers. **Severity: High (data correctness in reports).**

- **`passives.js:153-154` — late imports.** `import { getEquipmentAffixBonuses }` and `import { getBalance }` appear mid-file after the stat functions that use them. ESM hoists, so this works, but it's fragile — a reader sees `getEquipmentAffixBonuses` used at L158 before its import declaration, and if the module is refactored or tree-shaken it becomes a lurking issue. Move to the top of the file. **Severity: High (maintainability).**

- **`CombatScreen.js:2729` — `if (target.isHero)` counts hero deaths for Vengeance.** Combatants derived from `_memberToCombatant` may or may not have `.isHero` set depending on branch — the constructor uses `m.isCompanion || m.class === 'companion'` to classify but doesn't stamp `isHero` on the opposite branch. Needs verification that `isHero` is always set for allies (grep `isHero\s*=`). If it's only on heroes but not companions, Vengeance still works; if it's set nowhere, the counter never increments. **Severity: High (stat-stacking skill silently broken).** — needs verification.

### Medium

- **`CombatScreen.js:1373` / `:2866` / `:2868` / `:1851` — bare `setTimeout` state mutations without cleanup.** `setTimeout(() => this.manager.pop(), 600)` fires unconditionally; if the screen is popped via another path (e.g. back button, auth logout) the callback runs against a detached screen. Same for `setTimeout(() => { actor.stance = 'ready'; }, 300)` — an actor can be removed from `_allies` between now and 300ms later (no verification needed to fire; just a lingering mutation). MapScreen's M266 rewrite around boss-chest polling fixed this category in one place; the CombatScreen set is still at risk. Low real-world impact because screens don't stack deeply over combat, but worth a cleanup pass. **Severity: Medium.**

- **`CombatScreen.js:2245` — `merged.effect = skill.effect ? JSON.parse(JSON.stringify(skill.effect)) : {};`** Per-cast deep clone via `JSON.parse(JSON.stringify(…))` is called for every single cast, every turn. Substitute `structuredClone(skill.effect)` (already used in `balance-loader.js:103,143`) or cache merged-skill by `(skillId, purchasedHash, level)`. **Severity: Medium (perf + consistency).**

- **`CombatScreen.js:2683` — `actor.mp = Math.min(actor.maxMp || 80, …)`** Fallback `80` hardcoded. If `maxMp` happens to be 0 or undefined on a malformed combatant, mana cap silently becomes 80. This same fallback was the M266 bug pattern — one place fixed, another latent. Replace with a recomputed `computeMaxMp(member)` or throw. **Severity: Medium.**

- **`CombatScreen.js:1598,2598,2704,2717` — recursion guards on `_soulbindProcessing / _counterProcessing / _thornsProcessing`** are set/cleared synchronously. If `_applyDamage` re-enters (e.g. target dies, triggers on-kill that spawns an AoE that damages same target), a flag left set through a throw would deadlock the effect. They're wrapped in no try/finally. Low-probability but easy defensive fix. **Severity: Medium.**

- **`CombatScreen.js:2654` — `mitigated: (bd?.dmgReductAbsorb || 0) + (bd?.barrierAbsorb || 0)`** excludes `blocked` and `armor/resist` absorb from the meter event; combat report total may under-report "mitigated by this hit." Check against `_meterAddMit` callsites — they log separately but the per-event detail for the damage report is incomplete. **Severity: Medium.**

### Low

- **`CombatScreen.js:1176-1426` — `_updateHud` runs `querySelector` 4× per hero per call.** In combat with 4 heroes + 4 companions, each call is ~32 DOM lookups. Called after every damage, heal, skill use — easily 10-30 times per combat round. Cache element refs at build time. **Severity: Low (perf).**

- **`CombatScreen.js:2944` — `const ZONE_FAME_MULT = { ... }`** defined inside `_victory`. Multiple similar maps (`ZONE_UNLOCK_MAP`, `ZONE_NAMES`, `ACT_BOSS_ZONES`, `ZONE_DROP_CHANCE`, `BOSS_TAP_DROPS`) are inline constants that should live in `maps/mapData.js` as a single authoritative map registry. Currently any zone edit requires updating multiple locations. **Severity: Low.**

- **`CombatScreen.js:1382` — flee-fail enemy attack.** `const dmg = Math.max(1, enemy.dmg[0] + ... - target.armor)` bypasses the canonical pipeline (`rollToHit`, `applyMitigation`, block, crit). A flee-failed hit always lands, can't be blocked, ignores magic resist. Should call `_basicAttack(enemy, [target], false, true)` instead. **Severity: Low (tiny balance bug).**

- **`MapScreen.js:95-110` — single-shot 400 ms boss-chest open.** Comment says "let the next Map.onResume retry." Verify `onResume` is actually wired and calls `onEnter` (or has its own check). Without that, the chest can still be lost on a contrived stacking. Low risk. **Severity: Low.**

- **`skills.js:2245` vs `2246`** — `JSON.parse(JSON.stringify(skill.effect))` but `skill.statusEffects.slice()` (shallow). A status-effect object like `{ type:'burn', duration:2, chance:.5 }` in the base data is shared across casts; if any caller mutates `duration` on the merged skill's `statusEffects[0]`, they mutate SKILLS. Low probability in current code — grep suggests no mutation — but a future subtle bug. Use `structuredClone`. **Severity: Low.**

- **`gameState.js:47` initial state** (see §1). **Severity: Low** in practice (always replaced).

## 3. Performance Concerns

- **`_renderMeter` full HTML re-render per event (CombatScreen.js:957-962).** `_meterAddDamage`/`Heal`/`Mit`/`Dodge` all call it; a single skill that hits 4 targets with multi-hits+lifesteal can trigger it 8+ times in a tick. Replace with a dirty-flag that repaints once per `update()` frame. Estimated cost: `~0.2-1 ms` per call × 20 events/round × 8 rounds/combat = ~30-160 ms saved per fight on mobile.

- **`_meterData.set(actor.id, …)` + `.hits.push({...})` grows unbounded over a long combat.** Hits array is never truncated. A 30-round fight with 4 allies + 4 enemies and 6 hits/round ≈ 720 entries. Per-session footprint is tiny but the "View Combat Log" / "Combat Report" render iterates them each time. Cap `hits` at 200 or 500 entries with FIFO eviction.

- **`_updateHud` querySelector storm** — see §2 Medium. Not a frame-rate issue yet (8 chars × 4 queries) but material if companion count grows.

- **`passives.js:106-134` `getPassiveBonuses` recomputes full object from scratch every call.** Called from `_memberToCombatant` (once) + `computeMaxHp` + `computeMaxMp` + `getEffectiveAttrs` — and each of those is called from many combat render paths. Cache per-member by `(passiveRanks hash, class)`. Low priority — modern V8 is fast here — but an easy win.

- **`CombatScreen.js:2944 _victory` contains 5 inline Map-shaped constants that get rebuilt every victory.** Hoist once at module top. Trivial.

- **No observed N² loops over party × enemies × statuses.** Status processing at L2770+ is linear per character. Good.

## 4. Refactoring Opportunities

### `CombatScreen.js` (4,877 lines) — highest-value extractions

Candidate modules to extract:

1. **`combatEngine/damagePipeline.js`** — `_resolveIncomingDamage`, `_applyDamage`, block/mitigation/barrier/soulbind/counter/thorns logic (roughly L1839-1922, 2568-2760). ~400 lines; pure-ish given `target`+`actor`+`bd`.
2. **`combatEngine/aiTargeting.js`** — `_heroAI` and `_enemyAI` (L1575-1740). ~170 lines; already calls out to skills.js and formulas.js, so extraction is clean.
3. **`combatEngine/meter.js`** — `_meterAdd*`, `_meterEnsureEntry`, `_renderMeter`, `_buildCombatReportHtml`, `_showCombatReportOverlay`, `_showCombatLogOverlay` (L882-1030 + report overlays). ~600 lines; largely self-contained state + a single DOM render target.
4. **`combatEngine/backgroundRenderer.js`** — `_drawBackground`, `_drawWeather`, `_drawParallaxLayers`, `_drawBackgroundLayers`, particle/weather bits (L3255-3475). ~300 lines; pure canvas rendering, no combat state.
5. **`combatEngine/turnOrder.js`** — `_buildTurnOrder`, `_executeTurn`, stun/skipTurn/extraAction handling (L1497-1573). ~100 lines.
6. **Debug modal & overlays** — `_openCombatDebugModal` and debug HTML are ~600 lines at L4200-4800; candidate for `screens/_combatDebugModal.js`.

Total extractable: **~2100 lines**, leaving `CombatScreen.js` ≈ 2,800 lines of orchestration/shell. Still large but tractable.

### `skills.js` — `mergeSkillForCast`

At 42 lines it's not "doing too much," but the SKILL_TOPLEVEL_KEYS whitelist (line 2209) is fragile — every time a designer adds a new upgrade key they have to remember to promote it. A data-driven marker (`topLevel: true` on effect keys) or a complete schema would be safer. Current approach silently drops unknown top-level keys into `.effect` where they do nothing.

### Inline mega-strings

- `CombatScreen.js:3047-3070` victory modal HTML (24 lines)
- `CombatScreen.js:3135-3143` defeat modal HTML
- `CombatScreen.js:4217-…` debug modal HTML (very long; 300+ lines read — extract)
- `MapScreen.js:1248-…` pause overlay HTML
- `TownScreen.js` numerous (2593 lines total, many inline template blocks)

None is ≥150 lines alone, but cumulatively they're the reason these files are hard to scan. A `templates/` subfolder with named functions returning the HTML string would help.

## 5. Security / Correctness Red Flags

- **No `eval`** in `src/` (good).
- **`innerHTML` with interpolation: 106 occurrences.** Majority interpolate numeric/stat values or values produced by `_escLog`/mitigation wrapping (`CombatScreen.js:1417` escapes `& < >` before `wrapMitigationTags`). Spot-checked:
  - `CombatScreen.js:3053` interpolates `drops.map(d=>d.name).join(', ')` — item names come from `items.js` generated tables, not user input. Safe.
  - `CombatScreen.js:3051` + `:3054` interpolate XP/gold/level-up names — all internally generated. Safe.
  - `TownScreen.js:795,1303,2178` toasts — interpolate internal strings.
  - **`CombatScreen.js:961` meter-row** interpolates `r.name` directly. `r.name` comes from `d.name` which is the combatant name (hero or enemy). Hero names come from user input in `CharacterBuilderScreen`. Need to confirm escape. If a hero is named `<img src=x onerror=...>`, it renders. **Flag this — verify escaping.** Quick fix: wrap in `escapeHtml()` before template interpolation.
  - Similar pattern at `CombatScreen.js:952` (empty state OK), at `_buildCombatReportHtml` (not read but likely same pattern) — verify.
- **localStorage keys** prefixed `emberveil_*` consistently — no collision risk with other apps.
- **`SaveManager.importAllSaves`** (L126-147) wipes all `emberveil_*` keys before writing imported ones (L136-140). If the imported blob is malformed after the wipe, user loses everything. Do the wipe only after validating all imported entries parse, or write new keys first and delete old on success. **Flag as Medium severity bug, not security per se.**

## 6. Testing Gaps

Top 5 highest-value test additions:

1. **`CombatScreen._applyDamage` (combat damage pipeline) — no tests.** Barrier/soulbind/counter/thorns/reflect interaction is the game's most mutation-heavy code. A harness that feeds synthetic actor+target combatants and asserts HP deltas + `bd` breakdown would catch the M266-class regression immediately. Currently only `formulas.test.js` + `skills.test.js` exercise the pure pieces — the glue code is untested. **Priority: very high.**

2. **`passives.getPassiveBonuses` — no tests.** The slot-duplicate math (§2 Critical) would be flagged by a test with pyromancer + 1 rank in igniting asserting `burnOnHit: 0.15` (expected) vs 0.30 (current).

3. **`CombatScreen._meterAdd*` — no tests.** Would reveal the lazy-create asymmetry (§2 High) and the enemy-mit drop.

4. **`SaveManager.importAllSaves` — no tests.** Critical data-integrity path. Test cases: valid import, malformed blob after wipe, version migration chain (v1→v6).

5. **`CombatScreen._checkCombatEnd` + victory/defeat HP write-back — no tests.** The M266 by-id fix and the companions-ignored bug could have been caught by a snapshot test comparing gs.party/companions HP before & after combat.

Existing `src/game/__tests__/` has 11 tests, mostly formula-level — good coverage of the pure layer. Combat, save, and UI layers are under-tested.

## 7. Cleanup / Improvement Backlog (ranked)

| Effort | Risk | Value | Change | File:line |
|--------|------|-------|--------|-----------|
| XS | Low | High | Escape hero name in meter rendering | CombatScreen.js:961 |
| XS | Low | High | Fix `_meterAddHeal/Mit/Dodge` to use `_meterEnsureEntry` | CombatScreen.js:904, 918, 928 |
| XS | Low | Med | Move `passives.js` imports to top of file | passives.js:153-154 |
| XS | Low | Med | Delete aged `TODO: m85` + `TODO: m78`-style stale notes | formulas.js:266, classUnlocks.js:140,185 |
| XS | Low | Low | Hoist `_victory` inline maps to module top | CombatScreen.js:2944 |
| XS | Low | Low | Replace `JSON.parse(JSON.stringify(...))` with `structuredClone` | skills.js:2245, CombatSimulatorScreen.js:63 |
| S | Low | High | Passive slot-duplicate multiplier: decide intent, fix math **or** storage | passives.js:130 + SkillTreeScreen.js:345 |
| S | Low | High | Coalesce `_renderMeter` via dirty flag + rAF | CombatScreen.js:902,912,926,935 |
| S | Low | Med | Cache `_updateHud` element refs | CombatScreen.js:1389 |
| S | Low | Med | `importAllSaves`: validate before wipe | SaveManager.js:126 |
| S | Low | Med | Replace `maxMp \|\| 80` fallbacks with `computeMaxMp(member)` | CombatScreen.js:2683 + others |
| S | Med | Med | Route flee-fail attack through `_basicAttack` | CombatScreen.js:1378-1385 |
| S | Med | Med | Wrap recursion guards in try/finally | CombatScreen.js:2619-2636, 2701-2713, 2717-2724 |
| S | Low | Med | Audit `setTimeout` callbacks for detached-screen safety | CombatScreen.js:1373, 1713, 1771, 1829, 1851, 1903, 2866, 2868 |
| M | Low | High | Add tests for `_applyDamage` pipeline | new `__tests__/damage_pipeline.test.js` |
| M | Low | High | Add tests for `getPassiveBonuses` incl. duplicate slots | new `__tests__/passives.test.js` |
| M | Low | Med | Schema-drive `SKILL_TOPLEVEL_KEYS` (mark keys in data, not whitelist) | skills.js:2209 + data |
| M | Med | Med | Extract combat debug modal to `screens/_combatDebugModal.js` | CombatScreen.js:4200-4800 |
| L | Med | High | Extract `combatEngine/damagePipeline.js` | CombatScreen.js:1839-1922, 2568-2760 |
| L | Med | High | Extract `combatEngine/meter.js` | CombatScreen.js:882-1030 + report overlays |
| L | Med | Med | Extract `combatEngine/aiTargeting.js` | CombatScreen.js:1575-1740 |
| L | Med | Med | Extract `combatEngine/backgroundRenderer.js` | CombatScreen.js:3255-3475 |
| XL | High | Med | Unified zone metadata registry (remove inline zone maps) | CombatScreen.js:2944+ + MapScreen.js + mapData.js |

## Appendix: What I checked + what I skipped

**Checked thoroughly:**
- `src/game/skills.js` (esp. `_mergeInto` + `mergeSkillForCast` M266 area)
- `src/game/passives.js` (full file)
- `src/game/gameState.js` (full file)
- `src/game/formulas.js` (top 100 lines + grep of hp mutations across codebase)
- `src/engine/SaveManager.js` (full file)
- `src/ui/screens/CombatScreen.js`: structure, imports, init, `_updateHud`, `_applyDamage`, `_victory`, `_defeat`, meter helpers, `_heroAI` entry, flee handler, status decay, setTimeout usage
- `src/ui/screens/MapScreen.js`: boss-chest polling area, cross-zone link logic
- `src/game/__tests__/` directory listing
- Cross-cutting greps: `innerHTML`, `eval`, `localStorage`, `setTimeout`, `TODO/FIXME`, `JSON.parse(JSON.stringify`, late imports, circular-import risk, loose equality

**Spot-checked only:**
- `src/audio/AudioManager.js` (legacy alias tables)
- `src/ui/screens/SkillTreeScreen.js` (passive-rank storage)
- `src/game/simulator.js` (confirms shared `mergeSkillForCast` contract)
- `src/game/classUnlocks.js` (TODO scan)
- `src/ui/screens/TownScreen.js` (innerHTML usage only — did not audit logic)

**Skipped:**
- `public/data/` schema/data files (out of scope unless referenced from code)
- `src/mods/` — large, looked at file list only; not audited line-by-line
- `scripts/` — didn't audit individual script logic; assumed they're build/gen utilities
- `src/ui/screens/` screens not directly tied to combat/save/passives: `ChallengeScreen`, `CodexScreen`, `DialogScreen`, `FormulaCodexScreen`, `GameMenuScreen`, `HireBuilderScreen`, `InventoryScreen`, `LevelUpScreen`, `LoadGameScreen`, `OpeningCinematicScreen`, `PartyScreen`, `QuestLogScreen`, `SettingsScreen`, `TitleScreen`, `TapInventoryScreen`, `AchievementsScreen`, `CombatSimulatorScreen`, `OpeningCinematicScreen`, `CharacterBuilderScreen`
- Test file contents (only listed them)
- `src/ui/components/Tooltip.js` (only grep hit)
- `src/maps/mapData.js` (noted as extraction target for zone registry but not reviewed)
- `src/auth/` modules (only brushed in import check)
- Runtime behaviour — nothing was executed; all findings are static. Items flagged "needs verification" (e.g. `actor.isHero` set site, `_meterAdd*` enemy path in practice) require a run to confirm.

Everything above is READ-ONLY analysis. No code, configs, saves, or scripts were modified.
