# Canonical Data Migration Plan (M496+)

> Rollback point: git tag `pre-canonical-migration`. Feature flag:
> `USE_CANONICAL_DATA` in `src/game/dataLoader.js`. Keep JS literals until
> staging parity is green; do NOT delete them before Step 5 passes.

## Goal
One canonical JSON source of truth per data domain. Game runtime + manifest
builder + every catalog/data page read the SAME files. No regex scraping, no
inline literals, no drift. JSON schemas in `public/schemas/v1/` are authoritative.

## Confirmed root defect
`scripts/emit-game-data.cjs:220` regex `tableRe = /export const (ENEMIES[\w]*)\s*=\s*\{([\s\S]*?)^};/gm`
only matches `export const ENEMIES*` blocks. Inline `ENCOUNTERS` enemies
(`giant_spider`@606, `void_wraith`@640/773/883, Act4/6 dragons, hidden bosses
`vault_guardian`/`void_scholar`/`echo_sovereign`) are invisible to it; it also
drops `loot`/`spellList`/`statusOnHit`/`blockChance`. Drift proven:
`void_wraith` has 3 conflicting stat sets under one id; `enemy-catalog.html`
shows goblin_scout hp:22 vs runtime hp:120.

## Canonical file layout
```
public/data/entities/heroes.json      public/data/entities/enemies.json
public/data/entities/npcs.json        public/data/entities/bosses.json
public/data/entities/companions.json
public/data/combat/encounters.json    # {ref,count,overrides} — ids only
public/data/combat/drop-tables.json   # BOSS_LOOT_TABLES + BOSS_TAP_DROPS
public/data/combat/boss-phases.json   # BOSS_PHASES + BOSS_DEATH_DIALOG
public/schemas/v1/{entity,encounters,drop-tables,boss-phases}.json
```
Full schemas + the complete source inventory table are in the Plan agent's
report (this file is the working summary; schemas authored in Phase 0 step 1).

## Migration sequence
- **Phase 0 (parallel, no behavior change):** (1) author JSON schemas;
  (2) one-shot extraction script that imports LIVE JS and serializes current
  running values to the new JSON byte-for-byte (conflicting `void_wraith`/
  `dragon_whelp` variants become distinct ids OR per-encounter `overrides`);
  (3) parity-diff script.
- **Phase 1 (sequential, dangerous core):** (4) add `src/game/dataLoader.js`,
  populate `mapData.js` ENEMIES/ENCOUNTERS/HIDDEN_BOSS from JSON behind
  `USE_CANONICAL_DATA` flag; run sim/balance/regression — must be identical;
  SAVE-COMPAT CHECKPOINT. (5) delete inline enemy literals once parity green.
- **Phase 2 (parallel after Phase 1):** (6) drop-tables.json + bossLoot.js;
  (7) boss-phases.json + bossPhases/bossDeathDialog; (8) companions.json +
  companions.js/TownScreen; (9) heroes/npcs.json + appearances.js.
- **Phase 3 (sequential after Phase 2):** (10) rewrite emit-game-data.cjs to
  pass-through + build-appearances-manifest.cjs to glob-only;
  (11) repoint enemy-catalog.html + all catalog pages to canonical JSON.
- **Phase 4:** delete dead paths, update package.json prebuild.

## {ref,count,overrides} resolution contract (Phase 0 — byte-parity)

The canonical encounter group resolves to its legacy mapData literal via,
in order:

1. `base   = enemies[ref] ?? bosses[ref]`  (enemies dict checked first)
2. `merged = { ...base, ...overrides }`     (top-level value replace == JS spread)
3. **Delete-marker pass:** for every key `k` in `overrides` whose value is
   `null` (the `DELETE_MARKER`), `delete merged[k]`.
4. `group  = { ...merged, count }`          (count carried on the group object)

**Why the delete-marker exists.** ~20 inline dragon/void encounter variants
(`dragon_patrol/dragon_whelp`, `dragon_king_fight/*`, `big_void_tide/void_wraith`,
…) legitimately OMIT `loot` and/or `statusOnHit` even though their shared-id
`ENEMIES_ACT*` base entity defines those keys. A plain JS spread can ADD or
REPLACE a key but cannot REMOVE one, so the canonical `{base+overrides}`
representation structurally could not express a legacy object whose key set is
a strict subset of its shared-id base. The marker closes that gap. `null` is
safe and unambiguous: verified that NO combatant field is ever literally `null`
anywhere in legacy mapData (ENEMIES, ENEMIES_ACT4/5/6, inline ENCOUNTERS,
HIDDEN_BOSS_ENCOUNTERS).

This contract is authored **identically in three places and must stay in
lockstep** (changing one without the others is a parity bug):

- `scripts/extract-canonical-data.mjs` → `applyOverride` / `diffBlock`
- `scripts/verify-canonical-parity.mjs` → `resolveCanonGroup` (gate)
- the future `src/game/dataLoader.js` (Phase 1, step 4) — must implement the
  same 4-step resolution

Schema support: `entity.json#/$defs/combatantOverrides` permits `null` per
property (`oneOf [<realType>, {type:null}]`) — the `null` IS the delete-marker,
not a real value. `scripts/lib/validate-canonical.mjs` was given correct
draft-2020-12 `type:"null"` support (it previously had none — a validator
omission, not a leniency). The parity gate's deep-equal remains strict and
byte-exact; the marker only changes the canonical→resolved expansion, never
the comparison.

## Save-compat (precise)
Combat/encounter/enemy objects are NOT persisted (combat is transient, rebuilt
from ENCOUNTERS each fight). Save intersection is ONLY: party/companion members
embed `class`/`appearance`/`templateId`/`attrs`/`level`, and
`history.finalParty`. Enemy/encounter migration is save-safe. The danger is
Phase 2 steps 8–9: a renamed/dropped companion `templateId` or hero
`appearance` id orphans a saved companion. Mitigation: extraction script
preserves ids verbatim; add id-presence assertion to save-load-test.mjs over
the reference saves.

## Most dangerous step
Step 4 (loader takes over live combat). Mistransforming `{...ENEMIES.x,count}`
→ `{ref,count,overrides}` silently changes combat math; the conflicting
void_wraith/dragon_whelp variants are the trap (collapsing to one stat block
alters Act 4/6 difficulty). Rollback: flip `USE_CANONICAL_DATA` off (literals
still present until step 5); hard revert to tag `pre-canonical-migration`.

## Verification gates
- `scripts/verify-canonical-parity.mjs`: expand every encounter via legacy JS
  vs new loader, deep-equal each enemy object. Gate for steps 4 & 5.
- game-vs-images.html diff: every encounter/boss id has a manifest entry with
  ≥1 sprite; no manifest entity absent from canonical JSON. Proves the
  giant_spider bug class closed.
- `npm test` (balance/simulator/damage/stats) unchanged; `save-load-test.mjs`
  zero errors + id-presence; `check-regression.mjs` within thresholds.
- Staging deploy only until user confirms; emberveil prod gated on approval.
