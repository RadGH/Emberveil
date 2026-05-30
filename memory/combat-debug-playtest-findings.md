# Combat Debug Playtest Findings (M377)

## Methodology

- Harness: `scripts/combat-debug-replay.cjs` (read-only over combat code).
- Drives `src/game/simulator.js` headless over 5 representative encounters
  × 5 seeds = **25 combats**, **6,089 synthesized events** total.
- Party: warrior, cleric, mage, ranger at L12 with act-2-tier gear.
- Encounters: `goblin_camp` (Act 1), `corrupted_outpost` (Act 1 mid),
  `obsidian_garrison` (Act 2), `archfiend_malgrath` (Act 3 boss),
  `dragon_king_fight` (Act 6 boss).
- Per-encounter buffers: `public/assets/data/combat-debug/<key>.json`.
- Aggregate: `public/assets/data/combat-debug/_findings.json`.
- Live UI capture: NOT performed in this pass — see Critical #1. The harness
  ships with a documented DevTools recipe at the bottom of
  `scripts/combat-debug-replay.cjs` for reproducing live buffer dumps.

## Critical (must-fix)

### 1. Simulator and CombatScreen share zero code paths — parity check is structurally impossible from sim alone

- **Evidence:** `grep -n combatDebug src/game/simulator.js` → no matches.
  All 20 `combatDebug.push(...)` call sites live inside
  `src/ui/screens/CombatScreen.js` (lines 589, 598, 657, 1378, 1419, 1436,
  1445, 2199, 2338, 2349, 2461, 2475, 2815, 2872, 2877, 3781, 3923, 4081,
  4180, 4304).
- **Expected:** the user's stated goal — "compare a single trial's
  deterministic output against what the instrumented CombatScreen would
  produce for the same seeded RNG + same party + same encounter" — is
  not currently achievable. The two systems implement the combat loop
  independently (`runSimulation` in `simulator.js:486` vs `_advanceTurn`
  / `_executeSkill` / `_applyDamage` in `CombatScreen.js`).
- **Impact:** users cannot trust that "balance-snapshot.cjs"-derived
  win-rates predict the player experience. Any bug that lives only in the
  UI path (Damage Meter bucketing, legendary procs, status ticks, riposte
  counters, soulbind redirection, champion shield halving, marked +30%
  amp, barrier absorb) is invisible to sim playtests.
- **Fix direction (next agent):** either (a) extract a shared combat core
  module both call into, or (b) instrument simulator.js with the same 20
  `combatDebug.push` call sites so a sim run produces a comparable buffer.
  Option (b) is the cheaper diagnostic; option (a) is the right fix.

### 2. Simulator does not invoke legendary effect dispatch at all

- **Evidence:** `simulator.js:486-627` (the entire `runSimulation` loop)
  contains no reference to `legendaryEffects.js`, `dispatchLegendaryHook`,
  `getActorLegendaryIds`, or anything pertaining to procs. CombatScreen
  calls `_dispatchLegendaryHook` (line 4074) at attack/hit/crit/kill, and
  this is exactly where the M369 Dragon Breath attribution bug lived.
- **Impact:** the M369-class of bug (legendary proc dealing damage but
  attributed to "Attack" on the meter) is undetectable from headless
  runs. Any new legendary added to `legendaryEffects.js` is also untested
  by `balance-snapshot.cjs` / Monte Carlo.
- **Fix direction:** mirror the proc dispatch in simulator at parity
  points (`onAttack`, `onHit`, `onCrit`, `onKill`), with the same
  breakdown shape (`{ skillName, element, legendary: true }`) so meter
  attribution matches.

### 3. Simulator does not emit per-status tick events; status durations decrement silently

- **Evidence:** `simulator.js:507-516` decrements `dmgBuff` and
  `dmgReductRounds` per round but no `status_tick` event is recorded in
  the `log` array. CombatScreen has a `status_apply` push at line 4304
  and (per the M377 instrumentation contract) ticks per round.
- **Impact:** poison/burn/bleed DoT damage cannot be attributed to its
  source skill from sim — every DoT contributes 0 to sim's per-skill
  totals because tick handlers are not implemented.
- **Counts (this run):** 22 `status_no_ticks` findings raised across the
  25 runs, one per encounter that triggered any buff/revive cast.

## High-priority (consistency)

### 4. Simulator never produces meter_add{kind:'mit'} or meter_add{kind:'dodge'} events

- CombatScreen pushes both (`_meterAddMit` at 1435, `_meterAddDodge` at
  1444). Simulator's log entries only carry `type` ∈ {hit, miss, heal,
  revive, buff, skill_other}. Mitigation totals on the post-combat
  Damage Meter ("Damage Reduction", "Barrier") have no sim counterpart.
- **Why this matters:** the user's "Combat Log vs Damage Meter vs Combat
  Report" parity question explicitly includes mitigation. If mitigation
  numbers diverge, that bug only surfaces in live play.

### 5. Simulator hit log entries are missing `crit` and `targetHpAfter` after kill

- **Evidence:** `simulator.js:468-471` pushes `{ raw, dmg, lifeSteal,
  targetHpAfter, skill }` but no `crit` field. The crit branch at
  line 431 modifies `scaled` in place but never records that the hit
  was a crit.
- **Impact:** audit pattern (c) "crit fired but rolled above threshold"
  cannot be checked from sim output. CombatScreen DOES push `crit_check`
  events with the roll (line 2872), so live runs are fine — sim is the
  blind spot.

### 6. Cleric AI rationality looked OK in the sample

- Across the 25 runs, Cleric (`Clr`) cast `Smite` (offensive) and her
  heals were emitted only at `<60%` HP thresholds matching `simHeroAI`
  in `simulator.js:217-297`. No obvious "healed when full HP" or
  "attacked when ally at 1 HP" cases observed — but see #1: this was
  measured from the sim path, not the screen path.

### 7. Zero parity warnings ≠ no bugs

- All 25 runs produced `parityWarningCount: 0`. This is **expected by
  construction**: the harness synthesizes `meter_add`, `damage_apply`,
  and `log_line` events from the same simulator log entries, so they
  cannot diverge. This is a **harness limitation** — it is recorded as
  Structural Gap "sim-not-instrumented" in `_findings.json`. Real parity
  warnings can ONLY come from the live UI path with the DevTools
  workflow documented at the bottom of `combat-debug-replay.cjs`.

## Medium-priority (clarity)

### 8. L12 party loses 0%–40% on Act 1 encounters in sim

- `goblin_camp` (Act 1): 0% win rate over 5 seeds, ~9 rounds.
- `corrupted_outpost` (Act 1 mid): 40% win rate, ~12 rounds.
- `obsidian_garrison` (Act 2): 0% win rate, 22 rounds.
- `archfiend_malgrath` (Act 3 boss): 0% win rate, ~9 rounds.
- `dragon_king_fight` (Act 6 boss): 0% win rate, ~3 rounds (one-shot).
- This is either a balance regression worth investigating or a
  party-build mismatch (the harness only loads picked skills via
  `member.skills`; an empty list defaults to all unlocked class skills,
  which is what we want here). Worth cross-checking against
  `balance-snapshot.cjs` post-M321 numbers.

### 9. Source attribution in sim looks clean

- All hit events carry the originating skill (`Cleave`, `Multi-Shot`,
  `Whirlwind`, `Blizzard`, `Aimed Shot`, `Smite`, `Fireball`, `Magic
  Missile`) or `Attack` for basic strikes. Dragon Breath, Holy Strike
  variants, riposte, soulbind splits — none surface, because sim doesn't
  run those code paths (#2, #4 above). The bucketing bug class is not
  reproducible without live capture.

## Suggestions (not bugs, polish)

- **Instrument `simulator.js` with the same `combatDebug.push` call
  sites as `CombatScreen.js`.** Once that lands, this harness will
  produce real parity-warning data and the sim/screen divergence
  question becomes empirically testable for every milestone.
- **Tag `log` entries with a `skillId`** in addition to `skill` (display
  name). The current synthesis relies on display-name string matching,
  which means renaming a skill in `skills.js` would silently break the
  parity bucketing.
- **Emit a `crit: true` field** in the simulator hit log push at
  `simulator.js:469-471`. Trivial change; unlocks audit pattern (c) for
  headless runs.
- **Add a CombatScreen end-to-end fixture test** that runs one combat
  with `combatDebug.enabled = true` and snapshots the buffer. Current
  test surface is the simulator only (`balance-snapshot.cjs`,
  `playthrough-sim.mjs`); the UI path has no comparable harness.

## Per-encounter raw numbers

| Encounter            | Win % | Avg Rds | Meter Σ | Apply Σ | Log Σ  | Diff  | Sources Seen                                                  |
|----------------------|-------|---------|---------|---------|--------|-------|---------------------------------------------------------------|
| goblin_camp          |   0 % |    9.0  | 10,696  | 10,696  | 10,696 |   0   | Attack, Cleave, Whirlwind, Aimed Shot, Multi-Shot, Smite, Fireball, Blizzard |
| corrupted_outpost    |  40 % |   12.4  | 11,217  | 11,217  | 11,217 |   0   | (same set, plus inter-act variance)                            |
| obsidian_garrison    |   0 % |   22.0  | 17,327  | 17,327  | 17,327 |   0   | + Magic Missile                                               |
| archfiend_malgrath   |   0 % |    8.6  |  9,001  |  9,001  |  9,001 |   0   | (no Magic Missile this slice)                                 |
| dragon_king_fight    |   0 % |    2.6  |  7,136  |  7,136  |  7,136 |   0   | (no Fireball — mage dies r1)                                  |

(All `Diff = 0` rows reflect the synthesis identity, not real parity —
see Finding #7.)

## Files

- Harness: `/home/radgh/claude/game13/scripts/combat-debug-replay.cjs`
- Per-encounter buffers + analysis: `/home/radgh/claude/game13/public/assets/data/combat-debug/{goblin_camp,corrupted_outpost,obsidian_garrison,archfiend_malgrath,dragon_king_fight}.json`
- Aggregate findings JSON: `/home/radgh/claude/game13/public/assets/data/combat-debug/_findings.json`
- This document: `/home/radgh/claude/game13/memory/combat-debug-playtest-findings.md`

## What the next agent should do

1. **First fix:** instrument `simulator.js` with `combatDebug.push` at
   parity points (round_start, turn_start, ai_decision, hit_check,
   crit_check, damage_apply, meter_add, status_apply, status_tick,
   legendary_proc, combat_end). Only then will this harness produce
   bug-finding signal instead of self-consistent identity rows.
2. **Then:** re-run this harness; compare against a live DevTools dump
   of the same {party, encounter, seed} (recipe at bottom of
   `combat-debug-replay.cjs`); diff the buffers; everything that differs
   is a real parity bug.
3. **Open the live capture path now** for the dragon_king_fight encounter
   in particular — that is the original M369 site and remains the
   highest-risk attribution surface (multiple legendary procs, AoE
   breath, fire element, on-kill triggers).
