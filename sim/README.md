# Emberveil headless simulator (M206)

Node CLI that runs full Act 1 → Act 6 playthroughs against the current
`balance.active.json` and reports per-policy death rates. The primary tuning
harness for M208.

## Quick start

```bash
# all 3 policies, 100 iters, seed 1
node sim/index.js

# single policy
node sim/index.js --policy=balanced --iters=100 --seed=1

# write summary + per-iteration results to a file
node sim/index.js --all --iters=100 --out=sim/reports/pre-m3.json
```

Any run also auto-writes a timestamped JSON into `sim/reports/` so you can
diff two tunings later.

## Policies

| Policy | Party | Attribute dump |
|---|---|---|
| `balanced` | Warrior + Rogue + Cleric | primary + CON |
| `greedy-damage` | Solo Monk | all DEX |
| `greedy-tank` | Solo Warrior | STR + CON (heavy armor) |

Each policy exports `buildParty(level)` and `rebuildForLevel(member)` so the
run-loop can regenerate gear/attrs after every level up (stat points per
level come from `heroes.creation.attrPointsPerLevel`).

## Run loop

For each act 1..6:
1. Play every regular encounter in `ACT_SEQUENCE` in order.
2. Play each boss encounter.
3. After each win, award XP proportional to enemy `xpValue` totals.
4. Party rebuilt from current level between fights — no HP carry-over.
   This is the "rest at town/shrine" assumption; attrition is out of scope.

Outcome `dead` fires the moment a fight ends with zero party members alive.
Timeout (50+ rounds) with party alive counts as survival — stalemate, enemies
fled.

## Determinism

- Mulberry32 PRNG seeded via `--seed=N`.
- Per-encounter seed = `seed + act * 1000 + encounterIndex`.
- Same seed → identical results across runs (verified at CLI boot).

## Output fields

```
<policy>  deaths D/N (P%)   act avg A   enc avg E   gold avg G   <deaths-by-act>   first-loss: <encounter>×count ...
```

- `act avg` — average act number reached before death (1–6).
- `enc avg` — average encounters cleared.
- `first-loss` — top 5 encounters that ended runs. Useful for spotting
  outlier difficulty (e.g. `corrupted_outpost×89` = tune act-1 regular).

## Scope limitations (known; accept for M4 tuning)

The simulator inherits `src/game/simulator.js` and therefore omits:
- Tap weapons / tap utilities (M3 will fix tap power scaling)
- Combat potions (healing / mana / buff)
- Status effects other than buff/debuff rounds (burn/bleed/stun/poison not applied)
- Companion summons
- Passive tree allocation (pendingPassivePoints not auto-spent)
- Skill talent/upgrade trees beyond `mergeSkillForCast` defaults

These are acceptable for M4 because:
- Global multipliers (`enemies.globalMultipliers.{hp,damage,armor}`) apply
  uniformly to every encounter regardless of which mechanics we model.
- Policy death rates will move consistently as the knobs change, even if
  the absolute numbers are pessimistic vs. a skilled player.

If M4 tuning gets stuck, the fast follow is to extend `simulator.js` with
tap weapons + potions rather than rewriting the CLI.
