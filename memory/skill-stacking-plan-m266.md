# Skill Stacking Audit & Fix — M266

## TL;DR

**The bug:** `_mergeInto` in `skills.js:2149` stacked `damageMult` **additively** across every unlocked upgrade. Designers wrote upgrade descriptions like "damage increases to 200% STR", intending the new value to *replace* the previous one — but the merge added it on top.

**Impact:** **43 of 63 damage skills (68%) scaled ≥2× higher than their tooltip implied.** Top offender: `Big Score` (scavenger) — tooltip says 4.2×, actual 10.3× (2.5× overrun). Ylva's Shield Bash at L19 was 4.9× STR instead of the tooltip's 2.0×.

**Fix:** two-line change in `skills.js` making upgrade merges REPLACE instead of ADD, while talents continue to stack additively (their wording is "+X%"). Tooltips in the Skill Tree now render the effective multiplier via `mergeSkillForCast`, with a small `(base X×, upgraded)` annotation when the number differs from the base.

**Side effect:** since skills now deal ~40% of pre-fix damage, the M265 enemy HP buff (was 2.5×) has been dialed back to 2.0× so boss fights still average ~10 rounds. Enemy damage back to 1.0× (was 1.1×).

---

## The problem

`_mergeInto` — used both when applying talents and when applying upgrades inside `mergeSkillForCast` — had this number branch:

```js
else if (typeof v === 'number') {
  dst[k] = (typeof cur === 'number' ? cur : 0) + v;
}
```

That's correct for **talents**, which are written as "+30% damage" → `{ damageMult: 0.3 }` (additive bonus on top of base).

It's **wrong** for **upgrades**, which are written as "damage increases to 200% STR" → `{ damageMult: 2.0 }` (the designer means "set it to 2.0", not "add 2.0"). Additive merge instead produced base + 2.0.

Because `mergeSkillForCast` applies talents FIRST then upgrades, and every upgrade the player's level has unlocked stacks, a knight at L19 with Shield Bash got:

```
base 1.1
 + talent ksb_pow (+0.3 = +30% damage)   →  1.4
 + L5 upgrade Crushing Bash (1.5)         →  2.9
 + L10 upgrade Bulwark Strike (2.0)       →  4.9
```

Tooltip said "200% STR". Actual: 490% STR. 2.45× overrun.

## Audit output (summary)

Full table in `memory/skill-stacking-audit.md`. Top offenders:

| Skill | Class | Tooltip | Effective | Overrun |
|-------|-------|--------:|----------:|--------:|
| Bone Spike | necromancer | 1.1× | 3.30× | 3.00× |
| Song of Ruin | bard | 2.0× | 5.37× | 2.69× |
| Wild Bolt | sorcerer | 2.8× | 6.90× | 2.46× |
| Big Score | scavenger | 4.2× | 10.30× | 2.45× |
| Shield Bash | knight | 2.0× | 4.90× | 2.45× |
| Whirlwind | warrior | 1.5× | 3.60× | 2.40× |
| Multi-Shot | ranger | 1.3× | 3.20× | 2.46× |
| Aimed Shot | ranger | 3.0× | 6.70× | 2.23× |
| Meteor | pyromancer | 5.0× | 10.80× | 2.16× |
| Arcane Surge | mage | 7.0× | 16.50× | 2.36× |

The pattern is uniform across classes: skills with 2 upgrades overrun by ~2.3×; skills with talents that also boost damageMult overrun by 2.5×+.

## Fix

### 1. Merge behavior

`_mergeInto` now accepts `{ additive = true }`. Default stays additive (for talents). Upgrades pass `additive: false` so their number values REPLACE:

```js
// skills.js:2204
_mergeInto(merged.effect, effectOnly, { additive: false });
_mergeInto(merged,        topBleed,  { additive: false });
```

Arrays still concat (`statusEffects` on upgrades stack with base). Booleans still OR (`taunt: true` etc).

### 2. Post-fix audit

Same script, after the change:

- **43 → 1 outlier** at the ≥2× threshold.
- The remaining outlier is `Slow Time` (chronomancer), which has a talent `st_power` = +50% that's *intended* additive behavior — that's a talent, not an upgrade.
- All 62 other damage skills now produce effective multipliers within 1.0× – 1.3× of their tooltip value.

### 3. Tooltip wiring

`SkillTreeScreen` previously rendered the raw `skill.damageMult` (base value, no upgrades). Now it calls `mergeSkillForCast(skill, char)` and shows the effective value with the base annotated:

> Damage: **2.0× STR** (base 1.1×, upgraded)

Players now see the exact number the combat engine uses.

### 4. Balance follow-through

Skills now do ~40% of pre-fix damage on average. That means M265's enemy-HP buff (+150% HP) was sized for inflated skill damage and is now too thick. Dialing back:

- `globalMultipliers.hp`: 2.5 → **2.0**
- `globalMultipliers.damage`: 1.1 → **1.0**

Sim verification (5 saves × 20 encounters × 150 runs each):

| State | Trash Rounds | Boss Rounds | Win% |
|-------|-------------:|------------:|-----:|
| Pre-M265 baseline (buggy skills, 1.0× HP) | 5.7 | 6.7 | 19/22% |
| M265 baseline (buggy skills, 2.5× HP) | 6.4 | 7.9 | 19/22% |
| M266 (fixed skills, 1.0× HP) | 6.4 | 7.9 | 19/22% |
| **M266 + tuned (fixed skills, 2.0× HP) ← chosen** | **6.8** | **9.7** | 18/22% |

9.7 boss rounds is exactly the ~10-round target. Trash 6.8 is a touch fast but still feels like an encounter. Sim win rates are unchanged (they're a sim-artifact floor, not ground truth — see `balance-report-m265.md`).

## Breaking-change tests

Two tests in `src/game/__tests__/skills.test.js` PINNED the old additive behavior:

```js
// old (pinned the bug)
expect(merged.damageMult).toBeCloseTo(1.1 + 1.5); // Cleave L5 → 2.6
expect(merged.damageMult).toBeCloseTo(4.6);        // Cleave L20 → 4.6
```

Updated to the new replace-on-upgrade semantics:

```js
expect(merged.damageMult).toBeCloseTo(1.5);  // Cleave L5 → 1.5
expect(merged.damageMult).toBeCloseTo(2.0);  // Cleave L20 → 2.0 (L10 upgrade wins)
```

All 202 tests now pass.

## What stayed additive (intentionally)

- **Talents** (base skill's own `.talents[]`) — they're written as "+30% damage / +0.3". Additive is correct. `ksb_pow`, `sr_power`, `wb_big`, `sb_power` etc.
- **Arrays** — `statusEffects` across talents + upgrades still concatenate. A Radiant Strike that adds holy_burn plus the base skill's existing stun still applies both.
- **Booleans** — flags like `taunt: true` still OR together.

## What changed (replace)

- **Upgrades' numeric fields** — `damageMult`, `healMult`, `mpCost`, `cooldown`, `duration`, `bonusVsDemon`, `bonusVsUndead`, `dmgReduct`, `shieldMult`, `reflect`, etc. Anything numeric in `u.bonus`.

## Risks and what to watch in playtest

1. **Low-upgrade-level skills barely change.** Base 1.1 with only the talent bonus still stacks normally. Effect is concentrated at L5+, scaling up with each unlocked tier. Early-game feel should be unchanged.
2. **Some boss fights may now feel too long** on the 2.0× HP profile if the player's class relies on one high-multiplier skill (e.g. rogue Backstab was 7.25×, now 3.2×). If that's the case, pull HP down to 1.5× or 1.75×.
3. **Some fights may now feel too short** for heal/tank builds (paladin, druid) that never relied on damageMult stacking anyway. Their effective damage barely changed; only enemies got chunkier.
4. **Status-effect skills unaffected** — the fix only touches numeric merging; buff/debuff/heal-only skills keep their status durations intact.

## Files changed

- `src/game/skills.js` — `_mergeInto` signature + both upgrade merge calls
- `src/ui/screens/SkillTreeScreen.js` — tooltip renders effective multiplier via `mergeSkillForCast`
- `src/game/balance-loader.js` — globalMultipliers tuned
- `src/game/__tests__/skills.test.js` — pinned tests updated
- `src/game/__tests__/formulas.test.js` — snapshot updated to new HP multiplier
- `scripts/skill-audit.mjs` — new audit runner (committed for future regression checks)
- `memory/skill-stacking-audit.md`, `skill-stacking-audit-post.md` — before/after tables
- `memory/skill-stacking-plan-m266.md` — this document

## Regression check

Re-run `node scripts/skill-audit.mjs` after any skill-data changes. If the "🚨 ≥2× overrun" count climbs above a few, a new outlier slipped in.
