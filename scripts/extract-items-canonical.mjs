#!/usr/bin/env node
/**
 * scripts/extract-items-canonical.mjs — one-shot canonical extraction (items).
 *
 * Imports the LIVE src/game/items.js + src/game/uniques.js modules and
 * serializes the 12 pure data consts + UNIQUES to canonical JSON byte-for-byte
 * (key order normalized by the writer; deep-equal in the parity gate is
 * order-insensitive so this is irrelevant to correctness).
 *
 * Writes:
 *   public/data/items.json    { version, source, <12 consts> }
 *   public/data/uniques.json  { version, source, uniques:{...} }
 *
 * Re-runnable; output is deterministic. Run BEFORE wiring dataLoader so the
 * frozen snapshot embedded in verify-items-parity.mjs is captured from this.
 *
 * Usage: node scripts/extract-items-canonical.mjs
 */

import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const GAME_ROOT  = path.resolve(__dirname, '..');
const P = (rel) => new URL(path.join(GAME_ROOT, rel).replace(/\\/g, '/'), 'file:///').href;

globalThis.window = undefined;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const items   = await import(P('src/game/items.js'));
const uniques = await import(P('src/game/uniques.js'));

const ITEM_CONSTS = [
  'RARITIES', 'QUALITIES', 'RARITY_COLORS', 'WEAPON_BASES', 'ARMOR_BASES',
  'AFFIXES_ACT1', 'SHIELD_AFFIXES', 'ITEM_SETS', 'ITEM_SCORE_WEIGHTS',
  'MATERIALS', 'SALVAGE_YIELD', 'POTIONS',
];

const itemsDoc = {
  version: 1,
  source: 'src/game/items.js pure data consts (canonical-data migration)',
};
for (const c of ITEM_CONSTS) {
  if (items[c] === undefined) throw new Error(`items.js export "${c}" missing`);
  itemsDoc[c] = items[c];
}

const uniquesDoc = {
  version: 1,
  source: 'src/game/uniques.js UNIQUES const (canonical-data migration)',
  uniques: uniques.UNIQUES,
};

const write = (rel, obj) => {
  const abs = path.join(GAME_ROOT, rel);
  writeFileSync(abs, JSON.stringify(obj, null, 2) + '\n');
  console.log(`wrote ${rel}`);
};

write('public/data/items.json', itemsDoc);
write('public/data/uniques.json', uniquesDoc);
console.log('extraction complete.');
