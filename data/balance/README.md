# Balance config — Emberveil rebalance system

The game reads **one file at boot**: `balance.active.json`. Swapping that file is the entire reversibility mechanism.

## Files

- `balance.active.json` — loaded at runtime. This is what the game uses.
- `balance.baseline-2026-04-21.json` — verbatim snapshot of pre-rebalance (M64) numbers. Revert target.
- Future: `balance.tuned-M205.json`, `balance.nightmare.json`, etc. Each a named preset.

## Revert

```bash
cp public/data/balance/balance.baseline-2026-04-21.json public/data/balance/balance.active.json
```

Reload the game. Done.

## Try a variant

```bash
cp public/data/balance/balance.active.json public/data/balance/balance.experiment.json  # save current
# edit balance.active.json freely
# to restore: cp balance.experiment.json balance.active.json
```

## Schema

Top-level sections (see baseline for full structure):

- `heroes` — hire cost formula, creation attribute budget
- `progression` — XP table, level cadence (stat/talent/passive points)
- `combat` — every combat constant: hp/mp base + mult, hit/dodge base + mult + cap, crit, damage derivation, spell power, steal, mitigation selector
- `enemies` — global multipliers (`hp`, `damage`, `armor`, `hit`, `dodge`) applied to every enemy, plus NG+ scaling constants
- `economy` — global multipliers (`gold`, `xp`, `shopPrice`, `dropRate`)
- `loot` — quality multiplier table, rarity affix counts
- `affixes` — reserved for M3 Tap Power affix data; existing per-act tables still live in `src/game/items.js`
- `m3Preview` — M3 curve-DR + Tap Power definitions (disabled in baseline)

## Loader

Code: `src/game/balance-loader.js`. API:

```js
import { getBalance, loadBalanceFromUrl, setBalance } from './balance-loader.js';

// Browser boot: already called by src/main.js
await loadBalanceFromUrl('/data/balance/balance.active.json');

// Anywhere:
const b = getBalance();
const hp = b.combat.maxHp.base + con * b.combat.maxHp.conMult;
```

- **Sync reads, throws on missing keys.** Silent fallbacks hide config mistakes.
- **Defaults are embedded in the loader**, so tests and Node sim can import without fetch.
- **Call `setBalance(obj)` from Node** to inject a JSON directly (M2 sim does this).

## Rules

1. Never mutate the returned object. Treat `getBalance()` as frozen.
2. Every key in baseline must exist in any preset. Add new keys to baseline first.
3. M1 constraint: active === baseline → gameplay must be identical. Verify via `memory/rebalance-m1-verification.md` smoke checklist.
