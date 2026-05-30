#!/usr/bin/env node
/**
 * scripts/verify-combat-mods-parity.mjs — combat-modifier domain gate (M497).
 *
 * Proves the canonical JSON resolved through dataLoader.js is deep-equal to the
 * legacy inline literals:
 *   - ENEMY_SPELLS   (was src/game/enemySpells.js)
 *   - STATUS_META    (was src/game/statusEffects.js)
 *   - 6 affix-pool consts (was src/game/affixes.js):
 *       ELEMENTAL_COMBO_AFFIXES, CONDITIONAL_TRIGGER_AFFIXES,
 *       SET_HELPER_AFFIXES, DEFENSIVE_AFFIXES, RESOURCE_AFFIXES,
 *       ADVANCED_STAT_AFFIXES
 *
 * The "legacy" side is a frozen byte-for-byte snapshot captured from the
 * pre-deletion literals (scripts/.combat-mods-legacy-snapshot.json). It is the
 * authoritative reference and keeps proving parity against the original values
 * forever, even after the inline literals are removed.
 *
 * Exit 0 on full parity; exit 1 with a readable diff on any mismatch.
 *
 * Usage: node scripts/verify-combat-mods-parity.mjs
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

// Minimal browser shims so dataLoader.js loads cleanly in Node.
globalThis.window = undefined;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

// ── Frozen legacy snapshot — captured byte-for-byte from the pre-deletion
//    inline literals (enemySpells.js ENEMY_SPELLS + statusEffects.js
//    STATUS_META + affixes.js 6 data consts). Deep-equal is order-insensitive,
//    so this is the authoritative legacy reference. ──
const LEGACY = JSON.parse(
  readFileSync(path.join(__dirname, '.combat-mods-legacy-snapshot.json'), 'utf8')
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
const enemySpellsMod = await import(P('src/game/enemySpells.js'));
const statusMod = await import(P('src/game/statusEffects.js'));
const affixesMod = await import(P('src/game/affixes.js'));

const AFFIX_CONSTS = [
  'ELEMENTAL_COMBO_AFFIXES',
  'CONDITIONAL_TRIGGER_AFFIXES',
  'SET_HELPER_AFFIXES',
  'DEFENSIVE_AFFIXES',
  'RESOURCE_AFFIXES',
  'ADVANCED_STAT_AFFIXES',
];

const cases = [
  ['ENEMY_SPELLS (dataLoader.ENEMY_SPELLS_CANONICAL vs frozen legacy)', LEGACY.enemySpells, dataLoader.ENEMY_SPELLS_CANONICAL],
  ['ENEMY_SPELLS (enemySpells.js export vs frozen legacy)', LEGACY.enemySpells, enemySpellsMod.ENEMY_SPELLS],
  ['STATUS_META (dataLoader.STATUS_META_CANONICAL vs frozen legacy)', LEGACY.statusMeta, dataLoader.STATUS_META_CANONICAL],
  ['STATUS_META (statusEffects.js export vs frozen legacy)', LEGACY.statusMeta, statusMod.STATUS_META],
];
for (const c of AFFIX_CONSTS) {
  cases.push([`${c} (dataLoader.${c}_CANONICAL vs frozen legacy)`, LEGACY.affixes[c], dataLoader[`${c}_CANONICAL`]]);
  cases.push([`${c} (affixes.js export vs frozen legacy)`, LEGACY.affixes[c], affixesMod[c]]);
}

let totalDiffs = 0;
for (const [label, legacy, resolved] of cases) {
  const a = norm(legacy);
  const b = norm(resolved);
  if (a === b) {
    const n = Array.isArray(legacy) ? legacy.length : Object.keys(legacy).length;
    console.log(GRN('  OK ') + label + ` — ${n} entr${n === 1 ? 'y' : 'ies'}, identical`);
    continue;
  }
  totalDiffs++;
  console.error(RED('  FAIL ') + label);
  const la = JSON.parse(a), lb = JSON.parse(b);
  if (Array.isArray(la)) {
    const max = Math.max(la.length, lb.length);
    for (let i = 0; i < max; i++) {
      if (JSON.stringify(la[i]) !== JSON.stringify(lb[i])) {
        console.error('    index [' + i + ']');
        console.error('      legacy : ' + JSON.stringify(la[i]));
        console.error('      resolved: ' + JSON.stringify(lb[i]));
      }
    }
  } else {
    const keys = new Set([...Object.keys(la), ...Object.keys(lb)]);
    for (const k of keys) {
      if (JSON.stringify(la[k]) !== JSON.stringify(lb[k])) {
        console.error('    key "' + k + '"');
        console.error('      legacy : ' + JSON.stringify(la[k]));
        console.error('      resolved: ' + JSON.stringify(lb[k]));
      }
    }
  }
}

console.log('');
if (totalDiffs === 0) {
  console.log(GRN('COMBAT-MODS PARITY OK: 0 diffs (ENEMY_SPELLS + STATUS_META + 6 affix consts byte-identical to legacy literals).'));
  process.exit(0);
} else {
  console.error(RED(`COMBAT-MODS PARITY FAIL: ${totalDiffs} case(s) differ.`));
  process.exit(1);
}
