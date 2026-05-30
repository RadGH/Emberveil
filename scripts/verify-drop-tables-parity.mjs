#!/usr/bin/env node
/**
 * scripts/verify-drop-tables-parity.mjs — Phase 2 step 6 gate.
 *
 * Proves the canonical drop-tables.json resolved through dataLoader.js is
 * deep-equal to the legacy inline literals:
 *   - BOSS_LOOT_TABLES  (was src/game/bossLoot.js)
 *   - BOSS_TAP_DROPS    (was src/maps/mapData.js)
 *
 * While the inline literals still exist they are imported live and diffed.
 * Once they are removed, the "legacy" side is taken from a frozen snapshot
 * embedded here (captured byte-for-byte from the pre-deletion literals) so
 * the gate keeps proving parity against the original values forever.
 *
 * Exit 0 on full parity; exit 1 with a readable diff on any mismatch.
 *
 * Usage: node scripts/verify-drop-tables-parity.mjs
 */

import { fileURLToPath } from 'node:url';
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

// ── Frozen legacy snapshot (captured byte-for-byte from the pre-deletion
//    inline literals: bossLoot.js BOSS_LOOT_TABLES + mapData.js BOSS_TAP_DROPS).
//    Deep-equal is order-insensitive, so this is the authoritative legacy ref. ──
const LEGACY_BOSS_LOOT_TABLES = {
  grax_veil_touched: { bases: ['ring', 'amulet', 'cloth_chest', 'wand'], rarity: 'rare', quality: 'medium', rolls: 2, affix: 'void', uniques: ['emberheart_pendant'], uniqueChance: 0.20 },
  lava_titan: { bases: ['heavy_chest', 'heavy_legs', 'ring', 'amulet', 'mace'], rarity: 'rare', quality: 'high', rolls: 2, affix: 'fire', uniques: ['lava_titans_mantle'], uniqueChance: 0.20 },
  archfiend_malgrath: { bases: ['heavy_chest', 'ring', 'amulet', 'staff', 'greatsword'], rarity: 'rare', quality: 'high', rolls: 3, affix: 'demonic', uniques: ['malgraths_soulbrand'], uniqueChance: 0.20 },
  emberveil_sovereign: { bases: ['heavy_chest', 'ring', 'amulet', 'staff', 'necklace'], rarity: 'legendary', quality: 'elite', rolls: 3, affix: 'sovereign', uniques: ['sovereigns_eye'], uniqueChance: 0.25 },
  the_unraveler: { bases: ['ring', 'amulet', 'wand', 'staff', 'cloth_chest'], rarity: 'legendary', quality: 'elite', rolls: 3, affix: 'void', uniques: ['voidbinder', 'unravelers_sigil'], uniqueChance: 0.25 },
  the_architect: { bases: ['ring', 'amulet', 'staff', 'heavy_chest', 'necklace'], rarity: 'legendary', quality: 'exotic', rolls: 3, affix: 'primordial', uniques: ['architects_blueprint', 'staff_of_primordial', 'plate_of_creation'], uniqueChance: 0.30 },
  ancient_dragon: { bases: ['heavy_chest', 'heavy_legs', 'helmet', 'amulet', 'greatsword'], rarity: 'legendary', quality: 'elite', rolls: 2, affix: 'dragon', uniques: ['ancient_dragon_scale'], uniqueChance: 0.30 },
  dragon_king: { bases: ['heavy_chest', 'heavy_legs', 'helmet', 'greatsword', 'amulet', 'ring'], rarity: 'legendary', quality: 'exotic', rolls: 4, affix: 'dragon', uniques: ['dragon_kings_headguard'], uniqueChance: 0.35 },
};
const LEGACY_BOSS_TAP_DROPS = {
  thornwood: 'bow',
  ember_plateau: 'fireball',
  shattered_core: 'catapult',
  eternal_void: 'star_caller',
  primordial_nexus: 'spirit_hammer',
  dragon_throne: 'dragon_call',
};

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
const bossLootMod = await import(P('src/game/bossLoot.js'));
const mapDataMod = await import(P('src/maps/mapData.js'));

const cases = [
  ['BOSS_LOOT_TABLES (dataLoader vs frozen legacy)', LEGACY_BOSS_LOOT_TABLES, dataLoader.BOSS_LOOT_TABLES],
  ['BOSS_LOOT_TABLES (bossLoot.js export vs frozen legacy)', LEGACY_BOSS_LOOT_TABLES, bossLootMod.BOSS_LOOT_TABLES],
  ['BOSS_TAP_DROPS (dataLoader vs frozen legacy)', LEGACY_BOSS_TAP_DROPS, dataLoader.BOSS_TAP_DROPS],
  ['BOSS_TAP_DROPS (mapData.js export vs frozen legacy)', LEGACY_BOSS_TAP_DROPS, mapDataMod.BOSS_TAP_DROPS],
];

let totalDiffs = 0;
for (const [label, legacy, resolved] of cases) {
  const a = norm(legacy);
  const b = norm(resolved);
  if (a === b) {
    console.log(GRN('  OK ') + label + ` — ${Object.keys(legacy).length} key(s), identical`);
    continue;
  }
  totalDiffs++;
  console.error(RED('  FAIL ') + label);
  const la = JSON.parse(a), lb = JSON.parse(b);
  const keys = new Set([...Object.keys(la), ...Object.keys(lb)]);
  for (const k of keys) {
    if (JSON.stringify(la[k]) !== JSON.stringify(lb[k])) {
      console.error('    key "' + k + '"');
      console.error('      legacy : ' + JSON.stringify(la[k]));
      console.error('      resolved: ' + JSON.stringify(lb[k]));
    }
  }
}

console.log('');
if (totalDiffs === 0) {
  console.log(GRN('DROP-TABLES PARITY OK: 0 diffs (BOSS_LOOT_TABLES + BOSS_TAP_DROPS byte-identical to legacy literals).'));
  process.exit(0);
} else {
  console.error(RED(`DROP-TABLES PARITY FAIL: ${totalDiffs} case(s) differ.`));
  process.exit(1);
}
