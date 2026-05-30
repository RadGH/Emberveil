## Schema Reference

v1 JSON schemas live in `public/schemas/v1/`. Point any editor at them via `$schema` for inline validation.

### File index

| Schema            | Describes                                           |
|-------------------|-----------------------------------------------------|
| `pack.json`       | A mod pack — wrapper over any mix of content kinds  |
| `skill.json`      | A single skill/spell                                |
| `effect-dsl.json` | One op in the skill effect pipeline (15 ops total)  |
| `class.json`      | A playable class                                    |
| `item.json`       | Weapon, armor, trinket, consumable                  |
| `event-chain.json`| A branching event (node graph with choices)         |
| `appearance.json` | Visual appearance (decoupled from class)            |
| `character.json`  | A specific hero/companion/NPC                       |
| `loot.json`       | A loot table (deterministic or rolled)              |

### Pack formats accepted

The registry accepts three shapes:

1. **Canonical pack** — `{ id, version, skills: [...], classes: [...], ... }`
2. **Bare array** — `[ {...}, {...} ]` — kind inferred from the first entity's shape
3. **Single entity** — `{ id: ..., mpCost: ... }` — kind inferred

### Effect DSL ops (18)

`damage`, `heal`, `applyStatus`, `buff`, `setFlag`, `requireFlag`, `consumeStatus`, `resourceSwap`, `echo`, `ritual`, `modifyTurnOrder`, `onHit`, `onCrit`, `onKill`, `onEvent`, `incrementFlag`, `consumeFlag`, `requireFlags`.

Runtime: `src/mods/dsl.js`. Each op receives a context `{ caster, targets, rng, flags, log, emit, skillsById }` and mutates actors or queues triggers.

### Canonical stat names

Use short lowercase keys everywhere: `str`, `dex`, `int`, `con`. Pack loader will eventually warn-normalize `strength→str` etc. (wishlist — M131).

### Not yet validated

In-browser JSON-Schema validation via AJV is **shelved** (120KB cost). Current validation is structural (unknown-op detection). To upgrade later: lazy-load AJV only when `custom-content.html` opens; see wishlist "AJV full JSON-Schema validation" entry for the spec.
