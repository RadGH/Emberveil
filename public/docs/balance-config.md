# Balance config system

The game reads one JSON file at boot — `public/data/balance/balance.active.json` — to source every major balance number. Swapping that file is the entire revert mechanism.

## Presets shipped

| File | Purpose |
|------|---------|
| `balance.baseline-2026-04-21.json` | Pre-rebalance (M64) snapshot. Reverts to old gameplay. |
| `balance.active.json` | What the game loads. Seeded from baseline in M1. |

Drop new presets next to these. To activate one, copy it over `balance.active.json`.

## Scope (M1)

M1 extracted the **tuning levers** — every constant likely to move in M4:

- Hero hire-cost (`heroes.hireCost.base`, `.scaling`)
- Creation budget (`heroes.creation.baseAttrPoints`, `.attrPointsPerLevel`)
- XP table + cadence (`progression.xpTable`, `.statPointsPerLevel`, `.talentPointLevels`, `.passivePointEveryNLevels`)
- Stat derivations (`combat.maxHp.*`, `combat.maxMp.*`)
- Hit/dodge/crit (`combat.hit`, `combat.dodge.hero`, `combat.dodge.companion`, `combat.crit`)
- Damage range (`combat.damage.*`)
- Spell power, DoT, mana regen (`combat.spell.*`)
- Life/mana steal divisor (`combat.steal.*`)
- Mitigation selector (`combat.mitigation.*` — ships with `liveFormula='flat'`, `simulatorFormula='legacy'` to preserve existing dual paths)
- NG+ scaling (`enemies.ngPlus.*`)
- Loot quality + rarity affix count (`loot.*`)
- **Global multipliers** — the main M4 knobs:
  - `enemies.globalMultipliers.{hp, damage, armor, hit, dodge}`
  - `economy.globalMultipliers.{gold, xp, shopPrice, dropRate}`

## Not in config

- Enemy per-line HP/damage/armor (still in `src/maps/mapData.js`). Adjust via global multipliers instead.
- Individual skill damage multipliers (still in `src/game/skills.js`). Out of scope for M4's solo-unbeatable target.
- Affix value ranges (still in `src/game/items.js` per-act tables). Global loot multipliers cover M4 targets.

These can be extracted later if a balance change requires it. Document the decision in the wishlist.

## Loader API

`src/game/balance-loader.js`:

```js
getBalance()           // → frozen current config. Read-only.
setBalance(json, from) // replace current. Validates. Throws on bad shape.
loadBalanceFromUrl(u)  // fetch + setBalance. Browser-only helper.
resetBalance()         // → DEFAULTS (embedded baseline).
```

The loader ships with **embedded DEFAULTS identical to baseline-2026-04-21.json**. If `balance.active.json` is missing or fetch fails, the game still runs on baseline defaults (console warn only).

Node CLI callers (M2 sim):
```js
import { setBalance } from '../src/game/balance-loader.js';
import balance from '../public/data/balance/balance.active.json' with { type: 'json' };
setBalance(balance, 'sim-cli');
```

## Rules

1. **Never mutate** the object returned by `getBalance()` — it's frozen.
2. **Every key in DEFAULTS must exist in every preset.** Add new keys to baseline first, then the other presets.
3. **Baseline reproduces old behavior exactly.** If a preset misses a key, the loader throws — silent fallbacks are forbidden.
4. **Validate after edit**: `npm test -- --run` — the balance-simulator suite catches most accidental formula drift.
