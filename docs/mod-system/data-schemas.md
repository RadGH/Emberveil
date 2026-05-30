# Data Schemas (as-built)

> **Audited:** 2026-04-16. Every schema in this file reflects the **current JS objects in `src/game/*.js`** — not a proposal. For the proposed unified version see [`proposed-schema.md`](./proposed-schema.md).

## The naming-inconsistency table

This is the single most important table for a mod author.

| Concept | Where used | Key form | File |
|---|---|---|---|
| Strength (base) | `member.attrs` | `STR` | created by `classes.js` |
| Strength (skill scaling) | `skill.damageStat` | `'str'` / `'str_int'` | `skills.js` |
| Strength (affix) | `item.affixes[].stat` | `'str'` | `items.js`, `equipBonuses.js` |
| Strength (passive output) | `getPassiveBonuses()` | `STR` | `passives.js:50-53` |
| Mana regen affix | input | `manaRegen` or `mana_regen` | `equipBonuses.js:15-34` |
| Crit chance affix | input | `critChance` or `crit_chance` | same |
| Gold-find affix | input | `goldFind` or `gold_find` | same |

The affix loader accepts both camelCase and snake_case and normalizes to camelCase. Spells/skills do **not** normalize — you must use lowercase `'str'` exactly.

## Classes (`src/game/classes.js`)

```js
warrior: {
  name: 'Warrior',
  armorTier: 'heavy',              // 'heavy' | 'medium' | 'light' | 'cloth'
  attrs: { STR: 6, DEX: 3, INT: 1, CON: 5 },
  skills: ['cleave', 'battle_cry', 'whirlwind', 'unbreakable'],
  startingEquipment: ['longsword', 'shield', 'heavy_chest', ...],
  passiveTree: 'warrior',          // key into PASSIVE_TREES
}
```
19 classes. 5 are starters (`warrior, fighter, ranger, rogue, mage`); the rest unlock via `UNLOCK_REQUIREMENTS` (`classUnlocks.js`).

## Skills (`src/game/skills.js`, ~82 base + ~300 talent variants)

```js
cleave: {
  name: 'Cleave',
  mpCost: 8,
  cooldown: 2,
  damageStat: 'str',          // REQUIRED, lowercase
  damageMult: 1.2,
  aoe: 'adjacent2',           // optional, default 'single'
  school: 'melee',            // 'melee' | 'magic' | 'ranged' | 'heal'
  statusOnHit: [              // optional
    { type: 'bleed', chance: 0.3, duration: 3, power: 4 }
  ],
  // optional flags: heal, summon, revive, barrier, dispel, ...
}
```
Schools are informational except `'magic'` which enables spell-power scaling.

## Items (`src/game/items.js`)

### Weapon base

```js
longsword: {
  name: 'Longsword',
  type: 'weapon',
  subtype: 'sword',
  weaponCategory: 'heavy',        // 'heavy' | 'light' | 'magic'
  dmg: [6, 12],
  speed: 1.0,
  twoHanded: false,
  // optional: stunChance, bleedChance, burnChance, armorPen, offHandOk, intMult
}
```

### Armor base

```js
heavy_chest: {
  name: 'Heavy Chestplate',
  type: 'armor',                  // or 'accessory'
  slot: 'chest',                  // 'head'|'chest'|'legs'|'hands'|'feet'|'offhand'|'ring'|'necklace'
  tier: 'heavy',
  armor: 10,
  // optional: dodgeBonus, blockChance, blockPower, isShield
}
```

### Affixes

```js
{ stat: 'str', value: 2 }
```
Valid `stat` values (see `equipBonuses.js:15-34`): `str, dex, int, con, hp, mp, hit, dodge, initiative, dmg, armor, goldFind, manaRegen, lifeSteal, manaSteal, magicResist, critChance, critDamage, spellPower`.

Rarities: `normal | magic | rare | legendary`. Qualities: `low | medium | high | elite | exotic` (multiplier on affix values).

## Enemies (`src/maps/mapData.js`, 188 unique)

```js
goblin_scout: {
  id: 'goblin_scout',
  name: 'Goblin Scout',
  hp: 22, maxHp: 22,
  dmg: [4, 8],
  armor: 2, hit: 72, dodge: 15,
  xpValue: 15,
  gold: [2, 6],
  loot: ['dagger', 'light_chest'],
  // optional:
  statusOnHit: [{ type, chance, duration, power }],
  magicResist: 0,
  bonusVsClass: 'mage',
  fireResistDebuff: 0.2,
}
```

## Random events (`src/maps/randomEvents.js`, ~100 templates)

```js
{
  id: 'merchant_tinker',
  minLevel: 1,
  zone: 'forest_edge',              // or array of zones
  npcName: 'Tinker Bess',
  npcPortrait: 'tinker',
  lines: [{ speaker: 'Bess', text: '...' }],
  choices: [
    {
      text: 'Haggle',
      skillCheck: { stat: 'INT', dc: 10 },   // NB: UPPERCASE here!
      outcomes: { pass: 'haggle_win', fail: 'haggle_lose' }
    }
  ],
  outcomes: {
    haggle_win: { text: '...', reward: { gold: 30, item: 'health_potion' } }
  }
}
```
**There is no cross-event memory.** Events are one-shot with no forward references. Fixing this is the [events doc](./events.md) topic.

## Portraits

No registry. Resolution fallback chain (`spriteUtils.js:28-41`):
1. `spritecook/{id}_portrait.png`
2. `portraits/{id}.png`
3. `sprites/{id}_east.png`

`id` is derived from `member.templateId → classId → cls → class`.

For the mod "mix-and-match portrait" feature: we want `member.portraitOverride` to take precedence over all of the above, pointing to any file in `portraits/`.
