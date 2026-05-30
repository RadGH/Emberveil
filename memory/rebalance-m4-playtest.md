# M208 Playtest Checklist (M4 of rebalance arc)

Active config: `public/data/balance/balance.active.json` (= `balance.tuned-M208.json`)
Revert: `cp public/data/balance/balance.baseline-2026-04-21.json public/data/balance/balance.active.json`

## Knobs landed
- `enemies.globalMultipliers.hp = 0.55`
- `enemies.globalMultipliers.damage = 0.28`
- `enemies.globalMultipliers.armor = 0.75`
- `enemies.ngPlus.hpBase = 1.35` (was 4.5 — huge compression)
- `enemies.ngPlus.hpBossMult = 1.25` (was 1.35)
- `enemies.ngPlus.dmgBase = 1.25` (was 2.8)
- `enemies.ngPlus.armorLinear = 0.25` (was 0.55)
- `economy.globalMultipliers.xp = 3.0` (parties level faster to compensate)
- `economy.globalMultipliers.gold = 1.2`
- `combat.mitigation.liveFormula = 'curve-dr'` (shipped M207)
- `combat.tap.globalMult = 1.0` (no change yet — reserve for mid-patch if tap feels weak)

## Sim snapshot (3 seeds × 100 iters, maxRounds=80, no potions, no loot drops)
- **balanced** (warrior+rogue+cleric): avg Act reached 4.66, deaths 100% — dying at Act 4 boss `unraveler` or Act 5 boss `the_architect_final`
- **greedy-damage** (solo monk, all DEX): avg Act 1.99, deaths 100% — capped at Act 2 entry `ash_patrol`
- **greedy-tank** (solo warrior, 40/60 STR/CON): avg Act 2.1, deaths 100% — Act 1 boss `grax_final` or Act 3 entry

Target vs actual:
| target | actual | status |
|---|---|---|
| solo >80% death by Act 4 | 100% die by Act 3 | ✅ over-delivers |
| balanced ~25% death | 100% sim death but reaching Act 4-5 | ⚠ sim is harsher than live (no potions/drops); live playtest needed |
| greedy-damage 40%+ | 100% | ✅ |
| greedy-tank ~15% | 100% | ⚠ over-delivers; live test with potions may soften |
| final boss needs 3+ party | solos cap at Act 3, balanced reaches Act 5 boss | ✅ structural gate holds |

## What the sim does NOT model (so live will be more forgiving)
- Potions & consumables
- Mid-run loot drops (policy gear is frozen at level-up tier, rarity bumps at L4/9/16)
- Tap Power weapon affix
- Black Market vendor
- Talent point allocations beyond class skill defaults
- Shrine rest / full-run attrition (sim fully heals between fights)

## Live playtest focus
1. **Solo monk run, Act 1 → 3.** Should feel rough by Act 2 boss, hard-wall at Act 3 entry.
2. **Solo warrior run.** Should fail at Act 1 boss without gear luck.
3. **3-hero balanced run to Act 4 boss.** Should be completable with potions + good gear; without potions should feel dicey.
4. **Act 5/6 bosses.** Confirm these require full 3+ party.
5. **Ring auto-slot + Tap power impact.** Verify tap damage still feels meaningful with armor curve-DR in place.
6. **Gold economy.** With gold 1.2× and shop prices 1.0×, confirm hiring the first companion (100g) is reachable in Act 1.

## Follow-ups if live feels off
- Balanced too squishy → drop `enemies.ngPlus.dmgBase` to 1.2 or raise `combat.maxHp.base` to 60.
- Solo too punishing early → raise `enemies.globalMultipliers.damage` to 0.35 but drop `ngPlus.dmgBase` to 1.2 to spread lethality to later acts.
- Final boss too easy → bump `ngPlus.hpBossMult` back to 1.35.
- Combat drags → raise `enemies.globalMultipliers.damage` (faster kills both ways).

## Files touched in M208
- `public/data/balance/balance.active.json` — tuned knobs
- `public/data/balance/balance.tuned-M208.json` — preserved snapshot of the tuned preset
- `public/data/balance/balance.baseline-2026-04-21.json` — unchanged, safety net
