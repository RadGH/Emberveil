# Proposed Unified Mod Schema

> **Status:** Proposal, not implemented. The HTML quiz-report at `public/assets/mod-system-report.html` is where you pick which parts of this to adopt.

## Goals

1. One spelling per concept — no more `STR` / `str` / `strength`.
2. JSON-first, so mods can be shipped as files and validated before loading.
3. A tiny "effect DSL" that encodes all 50 [spell ideas](./spells-and-skills.md#gaps--opportunities) without engine changes per spell.
4. A flag ledger for events that chain.

## Canonical keys

**Attributes** — lowercase full word, always:

```json
{ "strength": 6, "dexterity": 3, "intelligence": 1, "constitution": 5 }
```

**Stats on items/skills/buffs** — same lowercase full word. No more `str` vs `STR`.

**Loader shim:** at load time, accept legacy short forms (`str, dex, int, con`) and uppercase forms and normalize to the canonical. Emit a console warning listing every shim hit — mods shipped publicly should clean these up.

## Character file

```json
{
  "$schema": "https://radgh.github.io/RSG-Demos/game13/schemas/character.v1.json",
  "id": "my_warlock",
  "name": "Vex",
  "class": "warlock",
  "portrait": {
    "base": "warlock",
    "face": "paladin",
    "custom": null
  },
  "attributes": { "strength": 3, "dexterity": 4, "intelligence": 7, "constitution": 4 },
  "skills": ["corruption", "my_custom_soul_tether"],
  "startingEquipment": ["dragonbone_staff", "cloth_robe"]
}
```

- `portrait.base` = which class's body/silhouette.
- `portrait.face` = which class's face layer is composited on top.
- `portrait.custom` = future escape hatch for uploaded art; **not used as a default** (per user rule).

## Skill file (effect-DSL)

```json
{
  "$schema": ".../skill.v1.json",
  "id": "my_soul_tether",
  "name": "Soul Tether",
  "school": "magic",
  "mpCost": 20,
  "cooldown": 6,
  "target": { "shape": "single", "side": "ally" },
  "effects": [
    { "op": "setFlag", "flag": "tethered_{caster.id}_{target.id}", "value": true },
    { "op": "onEvent", "event": "death", "of": "target",
      "then": [{ "op": "revive", "who": "caster", "hpPct": 25 }] }
  ]
}
```

### Effect operators (minimal set to cover all 50 ideas)

| op | Notes |
|---|---|
| `damage` | `{ amount, type, stat, mult }` |
| `heal` / `barrier` | `{ amount, stat, mult }` |
| `applyStatus` | `{ type, duration, power, chance }` |
| `buff` / `debuff` | `{ stat, delta, duration }` |
| `setFlag` / `clearFlag` / `incrementFlag` | ledger writes (see events) |
| `requireFlag` | short-circuit if false |
| `onHit` / `onDodge` / `onCrit` / `onKill` / `onEvent` | reactive triggers with nested `then` |
| `echo` | re-run effect at `mult` power |
| `consumeStatus` | e.g. bleed detonate |
| `resourceSwap` | hp↔mp |
| `ritual` | `{ rounds, interruptOn }` — multi-turn cast |
| `modifyTurnOrder` | `{ target, delta }` |

Every one of the 50 spell ideas compiles to ≤4 ops. The engine gets **one** dispatcher instead of 50 special cases.

## Item file

```json
{
  "id": "my_frostbrand",
  "type": "weapon",
  "subtype": "sword",
  "weaponCategory": "heavy",
  "damage": [7, 13],
  "affixes": [
    { "stat": "strength", "value": 2 },
    { "stat": "critChance", "value": 0.05 }
  ],
  "onHit": [{ "op": "applyStatus", "type": "frozen", "chance": 0.15, "duration": 1 }]
}
```

## Event file

See [`events.md`](./events.md) — `requires` / `setFlags` / `consumesFlag` / `incrementFlag` / `weight`.

## Schema validation

- Ship JSON-Schema files under `/schemas/` (character, skill, item, event, class, enemy).
- Loader runs Ajv at boot in dev, logs every violation.
- Public mods must pass validation; otherwise the Custom Content page blocks them with inline errors.

## Cooldowns

Replace `actor.skillCooldown` (single slot) with `actor.cooldowns: { [skillId]: number }` so a unit can have multiple skills on independent timers. Back-compat: the old field becomes a view over the new map keyed by "the most recently used skill."

## "Prompt for Claude" format

When the player hits **Export Prompt** on the quiz-report, it produces:

```
SYSTEM: You are generating content for Emberveil (game13). Conform to these schemas: <inline links>
USER: Build me <N> spells / <N> events / <1> character with these constraints:
- Class: warlock, portrait.base=warlock, portrait.face=paladin
- Themes: [blood-pact, time]
- Do not duplicate these existing mechanics: [list from buckets]
- Output valid JSON for each schema, one file per entity.
```

This is what makes the whole loop work: schema first, generation second, validation third, load fourth.
