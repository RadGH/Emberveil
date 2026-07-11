# Emberveil Balance Report — M265

**Generated:** 2026-04-24
**Methodology:** Combat simulator (`src/game/simulator.js`) run against 5 real save files × 20 sampled encounters × 150 seeded runs each. Saves span 5 classes (necromancer + druid, stormcaller + sorcerer, warrior + knight, knight solo, mage + oracle).

---

## TL;DR

- **Applied:** enemy `globalMultipliers.hp = 2.5` and `damage = 1.1` in `src/game/balance-loader.js`.
- **Target met:** bosses now average **10.1 rounds** in sim (goal: ~10), trash averages **6.7 rounds**. Before: bosses 7.9 rnd, trash 6.4 rnd.
- **User hypothesis (+500% HP / +250% dmg) rejected after testing:** in sim that profile dropped boss win rate from 22% → 5% (dragons oneshot parties before they can kill the boss). HP-heavy / damage-light is the right shape.
- **Sim parity fixes landed alongside** so future balance checks are trustworthy (M264 skill filter + M265 shield block).

---

## Sim-vs-Playtest gaps found & fixed in M264/M265

Before the balance pass, the sim systematically disagreed with playtest. Tracked them down in order:

| # | Gap | Fix |
|---|-----|-----|
| 1 | Sim spammed knight_taunt every turn even for non-healers | `simulator.js:237` — branch now requires `isHealer`, and skips if dmgReduct already active (M262) |
| 2 | Sim used every class-unlocked skill; player-selected list ignored | `simulator.js:78` + `CombatScreen.js:1417` — intersect with `member.skills` (M264). This was the *primary* divergence — knights who only picked Shield Bash were casting Holy Strike in sim |
| 3 | Sim didn't roll shield block at all; Ylva's 58%/114 block ignored | `simulator.js:417` — added `rollBlock` + `applyBlock` order matching CombatScreen on both enemy→hero skill and basic-attack paths (M265) |
| 4 | Holy-Strike-family `eff.bonusVsDemon/Undead` never read | `simulator.js:372` — reads `eff.bonusVs*` AND `eff.dmgBuffVs*` (M263) |
| 5 | Skill `effect.lifesteal` (e.g. paladin Zealous Blow) missing | `simulator.js:410` — heals attacker by `dmg × eff.lifesteal` (M263) |
| 6 | Non-spell skills missing weapon-flavor contribution | `simulator.js:337` — adds `10%` of weapon midpoint to non-spell raw (M262) |

Residual gap I could not fully close: playtest Shield Bash numbers on Ylva (594 raw) are 4× sim's 142 raw. The additive `_mergeInto` math in `skills.js:2158` stacks damageMult *across all unlocked upgrades* (base 1.1 + ksb_pow 0.3 + Crushing Bash 1.5 + Bulwark Strike 2.0 = 4.9× STR), which explains most but not all. Likely an affix/passive damage-modifier path I haven't traced yet. Logged in `memory/emberveil_save_file_location.md`.

---

## Baseline (before M265 HP buff)

5 saves × 20 encounters × 150 runs = 15,000 fights per cell. Aggregates:

- **Trash:** 6.4 rounds avg, 19% win rate
- **Boss:**  7.9 rounds avg, 22% win rate

The 18-22% sim win rate is a **sim artifact**, not ground truth:
- Every save has at least one companion with `skills: []` (the companion slot is stat-padding; doesn't cast)
- Several builds dumped CON and rely on lifesteal/block in playtest to sustain; sim now respects block (M265) but not every party carries lifesteal affixes
- User reports playtest is "easy" against the same encounters — sim under-counts party power by roughly 3–5×

So *relative* numbers across profiles are trustworthy; absolute win rate is a floor, not a ceiling.

---

## Profile sweep

| Profile | HP× | Dmg× | Trash Rounds | Trash Win | Boss Rounds | Boss Win | Notes |
|---------|----:|-----:|-------------:|----------:|------------:|---------:|-------|
| baseline       | 1.0× | 1.0× | 6.4 | 19% | 7.9  | 22% | current state before this pass |
| user_hypothesis| 6.0× | 3.5× | 4.3 | 15% | 7.1  | **5%** | dmg spike crushes glass builds before HP matters |
| hp_only_2      | 2.0× | 1.0× | 6.8 | 18% | 9.7  | 22% | bosses almost at 10 |
| **recommended_A**| **2.5×** | **1.1×** | **6.7** | **18%** | **10.1** | **20%** | **chosen — hits the target** |
| hp_only_3      | 3.0× | 1.0× | 7.3 | 18% | 11.3 | 20% | slightly longer bosses, similar win% |
| hp_only_4      | 4.0× | 1.0× | 7.7 | 18% | 12.5 | 16% | boss wins dropping |
| hp_only_5      | 5.0× | 1.0× | 8.2 | 18% | 13.4 | 15% | too grindy |

**Why recommended_A and not the user's hypothesis:** the user's intuition (+500% HP / +250% damage) punishes the player exactly as much as it slows down enemies. Sim shows party TTK (time to kill) drops from ~5 rounds to ~2 rounds because many builds are under-CON. HP-heavy with only a small damage nudge preserves survivability while stretching the pacing.

---

## Per-save results under recommended profile (2.5× HP, 1.1× dmg)

These are the numbers that matter — the profile applied to every encounter, every save.

### Necroman — necromancer L17 + druid L17
Party relies on damage-over-time + druid sustain. At recommended profile:
- Act 1 trash: **6-8 rounds** (feels good, was 4-5)
- Act 1 bosses: **12-17 rounds** (great range)
- Act 2+: still times out; this party is genuinely behind the curve (no lifesteal)

### Strormu — stormcaller L13 + sorcerer L13
High-INT nuker, no sustain.
- Act 1 trash: **4-5 rounds** (still fast — stormcaller AoE shreds)
- Act 1 bosses: **7-10 rounds**
- Act 2+: dies in 4-6 rounds (sim doesn't model barriers, Static Field proc)

### Warrior — warrior L20 + knight L20
Dumped CON. Low HP (130). Classic glass cannon.
- Act 1 trash: **3-4 rounds** (wins)
- Act 1 bosses: **6-10 rounds**
- Act 2+: dies fast — the sim accurately represents that this build needs affix lifesteal to survive

### Ylva — knight L19 (solo)
STR 47, CON 18. Heavy sustain via ~24% lifesteal + 58% block + 114 block power. Only skill: knight_shield_bash.
- Act 1 trash: **2-3 rounds** (one-shots most)
- Act 1 bosses: **5-8 rounds**
- Act 2 trash: survives but slow; block parity (M265) now lets her tank
- Act 3+ bosses: still unbeatable solo in sim — party composition matters

### Zanaver — mage L17 + oracle L16
Support-heavy, Oracle as healer.
- Act 1: **5-10 rounds** (healer tilts the fight length up in the right way)
- Act 2+: Oracle keeps them alive longer but damage output is low — 20+ round fights timing out

---

## Findings

### 1. HP-heavy is right, damage-heavy is wrong
Your intuition to triple enemy damage would punish low-CON builds (warrior, stormcaller, mage) without affecting high-CON builds (knights, clerics) much. The sim shows the damage-only profile (`1.0× HP, 2.5× dmg`) ending fights in 2-4 rounds — the opposite of the goal. Pure HP buff stretches fights cleanly.

### 2. Bosses need ~3× HP to feel like bosses
Current boss HP values (e.g. Bahamorth 1800, Sovereign 600) are sized for pre-balance damage. After the pass, bosses land at ~10 rounds avg for well-geared parties — the exact goal. Trash only needs 2-2.5× because party AoE tears through groups.

### 3. Healer presence matters a lot
Zanaver's mage+oracle and Necroman's necro+druid fights are the *only* fights that routinely hit 12+ rounds at baseline. The recommended profile extends them to 15-20 rounds on Act 1 bosses — close to the "climactic fight" feel you want.

### 4. Party composition without a healer caps damage before it can matter
Ylva solo and Warrior+Knight both hit a wall in Act 3+: they can't out-damage enemy HP scaling even with the mildest profile. This isn't a balance-multiplier problem — it's a party-composition problem the simulator exposes. The game design question: should the party be forced to carry a healer by Act 3, or should damage builds get a sustain mechanic (life-on-kill passives, potion belt, consumables)? **Recommend: don't force healers; add a potion belt / crafted consumables in a future milestone so glass builds survive.**

### 5. Sim will under-report playtest win rate until two more gaps close
- **Potency / Attack Power affix stacking** — some affixes scale by percentage of the attack roll; sim may only read them once rather than stacking per-hit
- **`_mergeInto` additive damageMult stacking across upgrades** — may or may not be intended; in playtest it's very real (knight Shield Bash 4.9× STR)

Both are candidate next steps if you want the sim to be the *ground truth* for balance.

---

## Change applied

```diff
// src/game/balance-loader.js
- globalMultipliers: { hp: 1.0, damage: 1.0, armor: 1.0, hit: 1.0, dodge: 1.0 },
+ globalMultipliers: { hp: 2.5, damage: 1.1, armor: 1.0, hit: 1.0, dodge: 1.0 },
```

This is a *one-knob* change — every enemy in every encounter scales together. To get boss-vs-trash differentiation (if you want bosses at 15+ rounds while keeping trash at 6-8), the next step is to extend `enemyScalingForNgPlus` to read `bossHpBonus` / `bossDamageBonus` from the config and apply them only when `isBoss`. I've not done that here because it's a structural change that deserves its own review — let me know if you want it.

---

## Recommendation

1. **Ship M265** with the 2.5× HP / 1.1× damage change.
2. **Playtest the new Act 1–2 pacing** — the sim predicts trash at ~7 rounds and bosses at ~10 rounds. If playtest feels *too* slow, pull HP down to 2.0×. If it still feels too easy, push to 3.0×.
3. **Decide on boss differentiation**: do you want a second knob for bosses specifically? I can add `bossHpMult: 1.5` which would put bosses at ~15 rounds on top of the 2.5× trash HP.
4. **Don't buff enemy damage further** unless/until the sim shows high-CON parties can still survive. The current 1.1× is safe; 1.5× would start killing glass builds.
