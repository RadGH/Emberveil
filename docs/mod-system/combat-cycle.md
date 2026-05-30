# Combat Cycle

> **Audited:** 2026-04-16 against `src/ui/screens/CombatScreen.js`, `src/game/simulator.js`, `src/game/formulas.js`.

## Round structure

1. `_buildTurnOrder()` sorts combatants by `initiative` (`CombatScreen.js:991-998`).
2. `_processStatusEffects()` ticks DoTs, regen, barriers, buff durations (`CombatScreen.js:993, 1973-2032`).
3. `_regenMana()` restores MP = `INT × 0.3 + affix.manaRegen` (`CombatScreen.js:2034-2054`).
4. For each combatant in order:
   - Skip if dead or `skipNextTurn` flag is set.
   - Decrement `skillCooldown`.
   - If `stun` status present → skip.
   - Route to `_heroAI()` or `_enemyAI()`.
   - If `extraAction > 0`, re-insert actor (`CombatScreen.js:1045-1049`).
5. Check victory (`every(enemy, !alive)`) / defeat (`every(ally, !alive)`).

The headless simulator (`simulator.js:391-525`) mirrors this exactly — any change to the screen loop must be ported to keep sim parity.

## Damage pipeline

```
raw → hit roll → block roll → mitigation → falloff → crit → dmgReduct → dmgBuff → final
```

### Hit

```
hitChance = clamp(actor.hit - target.dodge, 5, 95)
hit       = 70 + round(DEX × 1.2)            // cap 95
dodge(hero)      = 5 + round(DEX × 0.8)      // cap 40
dodge(companion) = 3 + round(DEX × 0.35)     // cap 15
```
`formulas.js:158-162`

### Base skill damage

```
statVal  = getSkillStat(skill.damageStat, stats)   // 'str'|'dex'|'int'|'str_int'|...
baseDmg  = round(skill.damageMult × statVal × (1 + powerBonus))
powerBonus = (INT×0.025 + affix.spellPower×0.05) for magic skills, else 0
```
`simulator.js:320-325`, `CombatScreen.js:1290-1310`

### Multi-target falloff

| Targets | Multiplier |
|---:|---:|
| 1 | 1.00 |
| 2 | 0.80 |
| 3 | 0.60 |
| 4+ | 0.50 |

### Crit

```
critPct  = min(75, 5 + passive.critPct + affix.critChance × 100)
critMult = 1.5 + affix.critDamage
```

### Mitigation (M84 formula, live)

```
physical: dmg = max(0, raw - max(0, armor))
magic:    dmg = max(0, raw - max(0, magicResist))
true:     dmg = raw   (bypass)
```
Penetration applies `%pen` first, then flat `armorPen` / `resistPen`. `formulas.js:177-228`.

### Final multipliers

```
if (target.dmgReduct) dmg = round(dmg × (1 - dmgReduct))
if (actor.dmgBuff)    dmg = round(dmg × (1 + dmgBuff))
lifeSteal mp/hp = floor(dmg × steal%)
```

## Statuses

Stored on each unit as `statuses: [{ type, duration, power }, …]`.

| Type | Effect | Stacks? |
|---|---|---|
| `burn`, `poison`, `bleed` | `power` dmg/round | yes (sum) |
| `regen` | heal `power`/round | yes |
| `barrier` | absorb `power` next hit | decays when ≤0 |
| `stun` | skip next turn | no (any stun → skip) |
| `blind` | halves hit | replace |
| `marked` | target takes +dmg | replace |
| `haste`, `taunt_totem`, `deflect`, `enchant`, `rally` | misc | varies |

Buff fields (`dmgBuff`, `dmgReduct`, `reflect`, `critBonus`, `armor`, `magicResist`, `dodgeBuff`, …) live **outside** the `statuses` array with paired `*Rounds` counters — this dual model is a known schema smell. See [proposed-schema](./proposed-schema.md).

## Targeting / AoE shapes

`single`, `adjacent`, `adjacent2`, `group`, `group2`, `row`, `row2`, `all`, `chain`, `chain3`, `multi3`, `multi4`, `random3`, `random4`, `pierce_row`, `single_overflow`.

Default AI target = lowest-HP alive enemy (`simulator.js:148-156`). Heal skills = lowest-HP ally.

## Resources

| Resource | Where | Notes |
|---|---|---|
| MP | `actor.mp / maxMp` | cost on cast, regen per round |
| Skill cooldown | `actor.skillCooldown` | global, single-slot (one skill timing per unit) |
| Extra action | `extraAction` + `extraActionRounds` | lets a unit re-enter the turn order |
| AP | — | **not modeled** — one turn per round |

The single-slot cooldown is a real limitation for the mod system: multi-skill units need a per-skill cooldown map. See [proposed-schema](./proposed-schema.md#cooldowns).
