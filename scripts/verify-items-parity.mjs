#!/usr/bin/env node
/**
 * scripts/verify-items-parity.mjs — canonical-data migration gate (items + uniques).
 *
 * Proves the canonical items.json + uniques.json resolved through
 * dataLoader.js is deep-equal to the legacy inline literals that lived in:
 *   - src/game/items.js  : RARITIES, QUALITIES, RARITY_COLORS, WEAPON_BASES,
 *                          ARMOR_BASES, AFFIXES_ACT1, SHIELD_AFFIXES,
 *                          ITEM_SETS, ITEM_SCORE_WEIGHTS, MATERIALS,
 *                          SALVAGE_YIELD, POTIONS  (12 pure data consts)
 *   - src/game/uniques.js: UNIQUES
 *
 * The "legacy" side is a frozen byte-for-byte snapshot captured from the
 * pre-deletion literals (scripts/.items-legacy-snapshot.json). It is NEVER
 * regenerated — it is the authoritative reference forever, so the gate keeps
 * proving parity against the original values both BEFORE and AFTER the inline
 * literals are deleted from items.js / uniques.js.
 *
 * Deep-equal is order-insensitive (keys sorted recursively), so JSON key
 * reordering is not a diff; any value/shape change IS.
 *
 * Three sides are checked per const: the frozen legacy snapshot, the
 * dataLoader canonical export, and the live items.js / uniques.js module
 * export — all three must be identical.
 *
 * Exit 0 on full parity; exit 1 with a readable diff on any mismatch.
 *
 * Usage: node scripts/verify-items-parity.mjs
 */

import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const GAME_ROOT  = path.resolve(__dirname, '..');
const P = (rel) => new URL(path.join(GAME_ROOT, rel).replace(/\\/g, '/'), 'file:///').href;

const RED = (s) => `\x1b[31m${s}\x1b[0m`;
const GRN = (s) => `\x1b[32m${s}\x1b[0m`;

// Minimal browser shims so dataLoader.js / items.js load cleanly in Node.
globalThis.window = undefined;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

// ── Frozen legacy snapshot — captured byte-for-byte from the pre-deletion
//    inline literals in src/game/items.js + src/game/uniques.js. Authoritative
//    reference; deep-equal is order-insensitive so this remains valid
//    post-deletion. ──
const LEGACY = JSON.parse(
  readFileSync(path.join(__dirname, '.items-legacy-snapshot.json'), 'utf8')
);

function sortKeysDeep(v) {
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeysDeep(v[k]);
    return out;
  }
  return v;
}
const norm = (v) => JSON.stringify(sortKeysDeep(v));

const dataLoader = await import(P('src/game/dataLoader.js'));
const itemsMod   = await import(P('src/game/items.js'));
const uniquesMod = await import(P('src/game/uniques.js'));

// const name -> [dataLoader canonical export, live module export]
const ITEM_CONSTS = [
  ['RARITIES',           dataLoader.ITEMS_RARITIES_CANONICAL,           itemsMod.RARITIES],
  ['QUALITIES',          dataLoader.ITEMS_QUALITIES_CANONICAL,          itemsMod.QUALITIES],
  ['RARITY_COLORS',      dataLoader.ITEMS_RARITY_COLORS_CANONICAL,      itemsMod.RARITY_COLORS],
  ['WEAPON_BASES',       dataLoader.ITEMS_WEAPON_BASES_CANONICAL,       itemsMod.WEAPON_BASES],
  ['ARMOR_BASES',        dataLoader.ITEMS_ARMOR_BASES_CANONICAL,        itemsMod.ARMOR_BASES],
  ['AFFIXES_ACT1',       dataLoader.ITEMS_AFFIXES_ACT1_CANONICAL,       itemsMod.AFFIXES_ACT1],
  ['SHIELD_AFFIXES',     dataLoader.ITEMS_SHIELD_AFFIXES_CANONICAL,     itemsMod.SHIELD_AFFIXES],
  ['ITEM_SETS',          dataLoader.ITEMS_ITEM_SETS_CANONICAL,          itemsMod.ITEM_SETS],
  ['ITEM_SCORE_WEIGHTS', dataLoader.ITEMS_ITEM_SCORE_WEIGHTS_CANONICAL, itemsMod.ITEM_SCORE_WEIGHTS],
  ['MATERIALS',          dataLoader.ITEMS_MATERIALS_CANONICAL,          itemsMod.MATERIALS],
  ['SALVAGE_YIELD',      dataLoader.ITEMS_SALVAGE_YIELD_CANONICAL,      itemsMod.SALVAGE_YIELD],
  ['POTIONS',            dataLoader.ITEMS_POTIONS_CANONICAL,            itemsMod.POTIONS],
];

const cases = [];
for (const [name, canon, live] of ITEM_CONSTS) {
  cases.push([`${name} (dataLoader vs frozen legacy)`, LEGACY[name], canon]);
  cases.push([`${name} (items.js export vs frozen legacy)`, LEGACY[name], live]);
}
cases.push(['UNIQUES (dataLoader.UNIQUES_CANONICAL vs frozen legacy)', LEGACY.UNIQUES, dataLoader.UNIQUES_CANONICAL]);
cases.push(['UNIQUES (dataLoader.getUniques() vs frozen legacy)',     LEGACY.UNIQUES, dataLoader.getUniques()]);
cases.push(['UNIQUES (uniques.js export vs frozen legacy)',           LEGACY.UNIQUES, uniquesMod.UNIQUES]);

let totalDiffs = 0;
for (const [label, legacy, resolved] of cases) {
  const a = norm(legacy);
  const b = norm(resolved);
  if (a === b) {
    const n = Array.isArray(legacy) ? legacy.length : Object.keys(legacy || {}).length;
    console.log(GRN('  OK ') + label + ` — ${n} entry(ies), identical`);
    continue;
  }
  totalDiffs++;
  console.error(RED('  FAIL ') + label);
  const la = JSON.parse(a), lb = JSON.parse(b);
  const ka = Array.isArray(la) ? la.map((_, i) => i) : Object.keys(la || {});
  const kb = Array.isArray(lb) ? lb.map((_, i) => i) : Object.keys(lb || {});
  const keys = new Set([...ka, ...kb]);
  for (const k of keys) {
    if (JSON.stringify(la?.[k]) !== JSON.stringify(lb?.[k])) {
      console.error('    key "' + k + '"');
      console.error('      legacy  : ' + JSON.stringify(la?.[k]));
      console.error('      resolved: ' + JSON.stringify(lb?.[k]));
    }
  }
}

console.log('');
if (totalDiffs === 0) {
  console.log(GRN(
    `ITEMS PARITY OK: 0 diffs (12 items.js data consts + UNIQUES ` +
    `byte-identical to legacy literals).`
  ));
  process.exit(0);
} else {
  console.error(RED(`ITEMS PARITY FAIL: ${totalDiffs} case(s) differ.`));
  process.exit(1);
}
