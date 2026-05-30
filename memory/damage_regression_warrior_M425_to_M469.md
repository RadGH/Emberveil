# Damage Regression Investigation — Warrior L20: M425 → M469

**Date:** 2026-05-12
**Question:** Why did Warrior L20 sim damage jump from 1002 (M425) to 3049 (M469)? Is this a deliberate buff, a bug-fix side effect, or unintended drift? Does it explain Act 2+ feeling like a cakewalk?

---

## 1. Bottom line

The ~3× jump is **almost entirely a benchmark-instrumentation change**, not a Warrior balance change. In commit `b72e8a811` ("M426: benchmark AI fix + Ranger nerf + role reclassification") the synthetic damage-report dummies were turned into **invulnerable, zero-damage punching bags** (HP ×2, dmg `[0,0]`, hit `0`) so that fragile classes (Paladin, Monk) could be measured without getting KO'd before they cast anything. Side effect: every class — including Warrior — now runs the **full 50-round sim window** instead of dying mid-fight against the old dummy that dealt 46–70 dmg/round at L20.

- **Warrior class data, skills, formulas, and gear** are byte-identical between M425 (commit `278768cba`) and M469 (commit `096417614`). Diff of `classes.js` shows only weapon-key alias renames (`2h_sword`→`sword2h`, `shield_bash`→`cleave`). `skills.js` Warrior block is unchanged.
- **Enemy HP in real encounters** is also byte-identical (`enemies.json` snapshots M425 vs M470 match exactly: Act 1 avg 1349 HP, Act 4 avg 1200, Act 5 avg 1480, Act 6 avg 1220).
- AoE damage rose ~10× over the same span because M426 also taught the sim AI to pick `type:'zone'` skills (Consecration etc.) and to include `target:'all_enemies'`, and M428 rewrote the picker to sort by `damageMult × hits × targetCount` instead of mpCost. Those AI changes affect *measured* output but not live combat balance for Warrior (Warrior has no `zone`/`all_enemies` skills).

The user's "Act 2 feels like a cakewalk" complaint is **NOT explained by these numbers** — actual gameplay HP/damage didn't change. The Damage Report's 3× jump is a measurement artifact. Any real Act 2+ difficulty issue lives elsewhere (gear scaling, loot drops, enemy AI changes), and should be investigated against in-game telemetry, not the damage report.

---

## 2. Numeric breakdown

L20 Warrior, solo party, single-target dummy (all values are 8-run averages of total damage dealt by the lead hero during the sim window):

| Milestone | L1 | L5 | L10 | L15 | L20 | Notes |
|-----------|----|----|----|----|-----|-------|
| M422 | 483 | 452 | 604 | 680 | 800 | baseline pre-rebalance |
| M423 | 483 | 434 | 611 | 621 | 843 | minor variance |
| M424 | 483 | 605 | 571 | 565 | 709 | sim drift |
| **M425** | **521** | **692** | **746** | **1012** | **1002** | last "old dummy" snapshot |
| **M426** | **533** | **837** | **1694** | **2282** | **3022** | **dummy made invulnerable** ⬅ jump |
| M427 | 533 | 856 | 1669 | 2306 | 3116 | companion power-tier scaling (no Warrior touch) |
| M428 | 533 | 892 | 1764 | 2214 | 3131 | damage-score AI rewrite (no Warrior touch) |
| **M469** | **533** | **920** | **1655** | **2246** | **3049** | current — within run-to-run noise of M426 |

The only step-change is **M425 → M426 (1002 → 3022, +201%)**. Every subsequent milestone is within ±5% of M426, i.e. statistical noise from the 8-run-per-cell sample.

AoE-mode jump is even larger: L20 aoe-solo went 402 → 6932 (≈17×) at M425→M426. Same root cause + zone-skill picker (commit `b72e8a811` simulator.js diff lines 366–376) + later damage-score AI (M428, `9dc5b24ab`). Does not affect Warrior live combat (no Warrior AoE besides Whirlwind, which was already counted).

---

## 3. Per-system attribution

### M426 (`b72e8a811`) — benchmark dummy overhaul, **accounts for the entire jump**

`scripts/damage-report-snapshot.mjs` lines 89–109 in current HEAD vs M425:

| Field | M425 dummy | M426+ dummy |
|-------|-----------|------------|
| `hp` | `hpScale * 8` (e.g. L20: 11,680) | `hpScale * 16` (e.g. L20: 23,360) |
| `dmg` | `[6 + lv*2, 10 + lv*3]` (L20: `[46, 70]`) | `[0, 0]` |
| `hit` | `70 + lv` (L20: 90) | `0` |

Consequence: with `dmg=0 hit=0`, the dummy can never kill the hero, and the hero plays out the full `maxRounds=50` window (`runSimulation` default, `simulator.js:785`). Previously, a L20 Warrior (~600–900 HP) facing 50–70 dmg/round died around round 13–16; now they live 50 rounds. **50 / 15 ≈ 3.3×** — matches the observed 3.04× damage jump precisely. The doubled HP on the dummy is to prevent the hero killing it mid-window for the same "run full duration" reason.

Author intent (commit message + inline comment, line 99–101): "Otherwise low-HP classes like Paladin / Monk register near-zero because they get KO'd before they can cast anything." This was a **deliberate measurement fix**, not a balance change. The downside — that high-HP/sustain classes also now show inflated numbers — wasn't called out.

Same commit also added zone-type skills and `target:'all_enemies'` to the AoE branch of `simHeroAI` (`simulator.js:368–377`) and to the "strongest damage skill" fallback (`simulator.js:380`). Warrior has no zone or all_enemies skills, so this affects Paladin/Druid/etc. — not the Warrior 3× number.

Also in M426: Ranger `aimed_shot` nerf (1.5 → 1.4 base mult, L5 2.2 → 1.9, L10 3.0 → 2.4 + executeChance 0.3 → 0.15). Unrelated to Warrior.

### M427 (`9c58847b1`) — companion power-tier scaling + class rebalance pass

Warrior untouched. Touched skills: Mage Arcane Surge, Fighter Killing Blow, Rogue Backstab/Shadow Step, Runesmith, Monk, Scavenger, Warlock. No effect on Warrior numbers.

### M428 (`9dc5b24ab`) — damage-score AI

Rewrote sim hero damage-skill picker to sort by expected damage rather than mpCost (`simulator.js`). Improves Mage/multi-hit class numbers in benchmarks. Warrior picks the same skills (Cleave/Whirlwind/Battle Cry) regardless because they're the only damage options in his kit; no behavioral change for Warrior.

### M429–M444 — no relevant sim/class/skill changes

M429 weapon-scoring rework, M444 key-alias rename pass (`2h_sword` → `sword2h`, `shield_bash` → `cleave`, `mace` → `iron_mace`). Cosmetic — no stat impact.

### M469 (`096417614`) — enemy block + spell coverage

Touched `simulator.js` for **enemy-side** AI (enemy spells, enemy block). Hero-side AI and damage formulas unchanged. Should slightly *reduce* hero damage when enemies block more, not raise it. M469 Warrior L20 = 3049 vs M428 = 3131 confirms this (within noise, very slightly lower).

---

## 4. Why difficulty feels easy in Act 2+

**The damage report cannot answer this.** The 3× damage jump in the report is benchmark instrumentation, not gameplay scaling. From the data inspected:

- **Enemy HP per Act (snapshots/M425 vs M470 `enemies.json`):** byte-identical. Act 1 avg 1349, Act 4 avg 1200, Act 5 avg 1480, Act 6 avg 1220. (Note: Act 1 average is inflated by a high-HP boss in the dataset; the modal grunt is ~120–300 HP.)
- **Enemy HP scaling with player level:** does **not** happen in regular acts. Only the Infinite Dungeon scales (`infiniteDungeon.js:108` `scaleEnemy`, `hpScale = 1.15^floor`). So if hero damage genuinely grew (which it didn't in M425→M469 for Warrior — the *report number* grew, not the in-combat damage), enemy HP would not follow.
- **Hero damage in actual play** is governed by `formulas.js` `computeHeroDamage` + skill mults + gear affixes, all of which are unchanged on the Warrior path.

If the user's perception of "Act 2 cakewalk" is real and consistent, candidate causes worth investigating separately (not done here per scope):

1. **Loot/gear power creep:** M429 reworked weapon scoring ("uses Total Damage"); newer affix rolls or starting equipment may push hero damage faster than enemy stats expect.
2. **Companion power-tier scaling (M427):** P3+ companions now do 970–1292 sim damage at L20 vs the old flat ~926. A party of hero + 3 strong companions vs Act 2 enemies with unchanged HP would feel trivial.
3. **AI changes (M428 damage-score, M469 enemy block):** the M428 hero AI is smarter; if enemies aren't, the asymmetry shows up most clearly in mid-game where enemies have low HP and the hero has full skill tree.
4. **Enemy spell coverage M469:** if the M469 fix uncovered or fixed bugs in *enemy spell AI* without rebalancing damage, enemies may now do *less* (a previously broken cast that now fails a check, etc.).
5. **Achievement / class-unlock bonuses** that pile up between Act 1 and Act 2.

Verifying any of these requires either a real-encounter (Act-2 enemy roster) damage-report variant, or playtest telemetry — not the synthetic-dummy report.

---

## 5. Recommended fix paths (options — no implementation)

### A. Fix the damage-report measurement to remain comparable across milestones

The cleanest move. Doesn't touch live balance, just stops the misleading 3× headline.

- **Option A1:** Switch `damage` from "total damage during window" to **"damage per round"** (divide by sim's reported `rounds`). DPR is invariant to whether the hero lived 13 or 50 rounds.
- **Option A2:** Keep total but cap `maxRounds` at a value the L20 Warrior would have survived under the old dummy (~15 rounds). Cheap but arbitrary.
- **Option A3:** Re-introduce a *slow-bleed* dummy: dmg `[ceil(lv*0.5), ceil(lv*0.8)]`, hit 30 — kills hero around the 50-round mark only, so high-survivability classes still get measured and low-HP classes still survive long enough. Requires re-snapshotting all classes.

A1 is best — it's the metric we actually care about and is what real combat scoring uses elsewhere in the codebase.

### B. Investigate Act 2+ difficulty separately

This is the **real** user concern. Suggested approach:

- Add an "Act-realistic encounter" benchmark to the damage report: use real enemy rosters from `enemies.json` filtered by `act`, instead of synthetic dummies. Report time-to-kill (TTK) per Act, not raw damage.
- Sample-playtest Act 2 / Act 3 with a fresh L8–L12 Warrior + typical companion party and log per-encounter rounds and casualties. If TTK is < 3 rounds for trash and < 6 for elites, it's too easy.
- If confirmed, candidates to scale up: Act 2–5 enemy `hp` (e.g. +25–40%), Act 2–5 enemy `dmg`, or introduce diminishing returns on hero damage past L8 (e.g. soft cap STR contribution to weapon damage).

### C. Audit gear / companion creep

Compare equipment power and companion DPS at L10 to enemy expected HP per Act. If a P3 companion at L10 deals 600+ DPS and Act 2 enemies have ~250 HP, the math is decided before the player even acts.

---

## Files inspected (read-only)

Snapshots:
- `/home/radgh/claude/game13/public/assets/data/damage-report/M422.json` … `M428.json`, `M469.json`
- `/home/radgh/claude/game13/public/assets/data/snapshots/M425/enemies.json`
- `/home/radgh/claude/game13/public/assets/data/snapshots/M470/enemies.json`

Source (no edits):
- `/home/radgh/claude/game13/scripts/damage-report-snapshot.mjs`
- `/home/radgh/claude/game13/src/game/simulator.js`
- `/home/radgh/claude/game13/src/game/skills.js`
- `/home/radgh/claude/game13/src/game/classes.js`
- `/home/radgh/claude/game13/src/game/infiniteDungeon.js` (HP scaling check)
- `/home/radgh/claude/game13/src/game/formulas.js` (damage formula sanity)

Git commits cited:
- `278768cba` Emberveil M424–M425 (extreme-class rebalance + companion sim scaling) — last "old dummy" snapshot
- `b72e8a811` Emberveil M426 (benchmark AI fix + Ranger nerf + role reclassification) — **root cause of the 3× jump**
- `9c58847b1` Emberveil M427 (companion power-tier scaling)
- `9dc5b24ab` Emberveil M428 (damage-score AI + Border Roads goblin nerf + Mage cut)
- `ac44522d0` Emberveil M429 (weapon scoring uses Total Damage + battle grid rework)
- `e234d577a` Emberveil M444 (key-drift audit — cosmetic alias renames)
- `096417614` Emberveil M469 (final enemy regen + 5 recurring NPCs + enemy block + spell coverage)

User should review before any rebalance.
