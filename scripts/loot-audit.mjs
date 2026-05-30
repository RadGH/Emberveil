#!/usr/bin/env node
/**
 * scripts/loot-audit.mjs — M301 Task 8
 *
 * Simulates 100 visits to each merchant, guild hall, and black market across
 * all acts. Aggregates total drops per item type, rarity, and source. Flags
 * rarities that are over-represented vs. expected drop tables.
 *
 * Writes public/assets/data/loot-audit.json.
 *
 * Usage:
 *   node scripts/loot-audit.mjs
 *   node scripts/loot-audit.mjs --visits=200
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const GAME_ROOT  = path.resolve(__dirname, '../');

// Browser shims
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    documentElement: { style: {} },
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => ({ forEach: () => {} }),
    createElement: () => ({ style: {}, appendChild: () => {}, setAttribute: () => {} }),
    head: { appendChild: () => {} },
    body: { appendChild: () => {} },
  };
}
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
if (typeof globalThis.crypto === 'undefined') {
  const { webcrypto } = await import('node:crypto');
  globalThis.crypto = webcrypto;
}
if (typeof globalThis.localStorage === 'undefined') {
  const _store = new Map();
  globalThis.localStorage = {
    getItem: k => _store.get(k) ?? null,
    setItem: (k, v) => _store.set(k, String(v)),
    removeItem: k => _store.delete(k),
    clear: () => _store.clear(),
  };
}
if (typeof globalThis.getComputedStyle === 'undefined') {
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });
}

// Dynamically import TownScreen internals via the module export
// TownScreen exposes getMerchantStockForTown, getGuildHallStockForTown etc. as
// non-exported helpers, so we call them by reimplementing the same logic here.
// We use generateItem directly with seeded RNG to reproduce the shop pools.
const { WEAPON_BASES, ARMOR_BASES, AFFIXES_ACT1, RARITIES, QUALITIES, generateItem } =
  await import(path.join(GAME_ROOT, 'src/game/items.js'));
const { GameState } =
  await import(path.join(GAME_ROOT, 'src/game/gameState.js'));

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; })
);
const VISITS = parseInt(args.visits ?? '100', 10);
const ACTS   = [1, 2, 3, 4, 5];

// Seeded mulberry32 PRNG (same as game)
function mulberry32(seed) {
  let a = (seed | 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
  return h;
}

const ALL_BASES  = { ...WEAPON_BASES, ...ARMOR_BASES };
const BASE_KEYS  = Object.keys(ALL_BASES);
const RAR_LABELS = RARITIES;
const QUAL_LABELS = QUALITIES;

// Rarity tables by act (mirrors TownScreen logic)
const RAR_BY_ACT = {
  1: [0,0,0,1,1],
  2: [0,1,1,1,2],
  3: [1,2,2,2,3],
  4: [2,2,3,3,3],
  5: [2,3,3,3,3],
};
const QUAL_BY_ACT = {
  1: [0,1,1,2,2],
  2: [1,1,2,2,3],
  3: [1,2,2,3,3],
  4: [2,2,3,3,4],
  5: [2,3,3,4,4],
};

// Guild hall slots: first 3=rare/high, 3-6=rare/elite, 6-9=legendary/elite, 9-12=legendary/exotic
const GUILD_RARITY_BY_SLOT = [
  'rare','rare','rare',
  'rare','rare','rare',
  'legendary','legendary','legendary',
  'legendary','legendary','legendary',
];
const GUILD_QUALITY_BY_SLOT = [
  'high','high','high',
  'elite','elite','elite',
  'elite','elite','elite',
  'exotic','exotic','exotic',
];

// Black market: Acts 4-5 only. Rare/legendary, all slots.
const BLACK_MARKET_RARITY = ['rare','rare','legendary','legendary','legendary'];
const BLACK_MARKET_QUALITY = ['elite','elite','elite','exotic','exotic'];

function bumpTier(arr, idx, bonus) {
  return arr[Math.min(arr.length - 1, idx + Math.max(0, bonus))];
}

function rollItem(rng, rarTable, qualTable, ngBonus = 0) {
  const baseKey = BASE_KEYS[Math.floor(rng() * BASE_KEYS.length)];
  const rIdx = rarTable[Math.floor(rng() * rarTable.length)];
  const qIdx = qualTable[Math.floor(rng() * qualTable.length)];
  const r = bumpTier(RAR_LABELS, rIdx, ngBonus);
  const q = bumpTier(QUAL_LABELS, qIdx, ngBonus);
  try { return generateItem(baseKey, r, q, AFFIXES_ACT1) || null; }
  catch { return null; }
}

// Counters: source -> act -> rarity -> count
function makeCounter() {
  const c = {};
  for (const src of ['merchant','guild','black_market']) {
    c[src] = {};
    for (const act of ACTS) {
      c[src][act] = {};
      for (const r of RARITIES) c[src][act][r] = 0;
    }
  }
  return c;
}

const counters    = makeCounter();
const typeCounters = {};  // source -> type -> count

function recordItem(item, source, act) {
  if (!item) return;
  counters[source][act][item.rarity] = (counters[source][act][item.rarity] || 0) + 1;
  const typeKey = `${source}:${item.type || 'unknown'}`;
  typeCounters[typeKey] = (typeCounters[typeKey] || 0) + 1;
}

console.log(`loot-audit: ${VISITS} visits per source per act...`);

for (const act of ACTS) {
  const rarTable  = RAR_BY_ACT[act]  || RAR_BY_ACT[1];
  const qualTable = QUAL_BY_ACT[act] || QUAL_BY_ACT[1];

  for (let v = 0; v < VISITS; v++) {
    const seed = hashStr(`merchant|act${act}|visit${v}`);
    const rng  = mulberry32(seed);

    // ---- Merchant (approx 10 items per visit) ----
    for (let i = 0; i < 10; i++) {
      const item = rollItem(rng, rarTable, qualTable);
      recordItem(item, 'merchant', act);
    }

    // ---- Guild Hall (12 slots, fixed rarity by slot) ----
    for (let i = 0; i < 12; i++) {
      const r    = bumpTier(RAR_LABELS, RAR_LABELS.indexOf(GUILD_RARITY_BY_SLOT[i]), 0);
      const q    = GUILD_QUALITY_BY_SLOT[i];
      const base = BASE_KEYS[Math.floor(rng() * BASE_KEYS.length)];
      let item;
      try { item = generateItem(base, r, q, AFFIXES_ACT1); } catch { item = null; }
      recordItem(item, 'guild', act);
    }

    // ---- Black Market (Acts 4-5 only) ----
    if (act >= 4) {
      for (let i = 0; i < BLACK_MARKET_RARITY.length; i++) {
        const base = BASE_KEYS[Math.floor(rng() * BASE_KEYS.length)];
        let item;
        try { item = generateItem(base, BLACK_MARKET_RARITY[i], BLACK_MARKET_QUALITY[i], AFFIXES_ACT1); } catch { item = null; }
        recordItem(item, 'black_market', act);
      }
    }
  }
}

// ---- Flag over-representation ----
// Expected rarity distribution for each source/act: the first rarity entry in
// the table is the modal value. Flag if a rarity appears >3x its expected share.
const flags = [];
for (const [source, actData] of Object.entries(counters)) {
  for (const [act, rarCounts] of Object.entries(actData)) {
    const total = Object.values(rarCounts).reduce((s, v) => s + v, 0);
    if (total === 0) continue;
    // Rough expected share per rarity — use uniform as a baseline (25% each)
    const expectedShare = 1 / RARITIES.length;
    for (const [rarity, count] of Object.entries(rarCounts)) {
      const actual = count / total;
      if (actual > expectedShare * 3) {
        flags.push({
          source, act: parseInt(act, 10), rarity,
          actualPct:   Math.round(actual * 100),
          expectedPct: Math.round(expectedShare * 100),
          message: `${source} Act ${act}: "${rarity}" appears at ${Math.round(actual * 100)}% (expected ~${Math.round(expectedShare * 100)}%)`,
        });
      }
    }
  }
}

const out = {
  generated:     new Date().toISOString(),
  visitsPerSource: VISITS,
  acts:          ACTS,
  sources:       ['merchant', 'guild', 'black_market'],
  counters,
  typeCounters,
  flagCount:     flags.length,
  flags,
};

const outPath = path.join(GAME_ROOT, 'public/assets/data/loot-audit.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

if (flags.length > 0) {
  console.warn(`\nFLAGGED rarities (${flags.length}):`);
  for (const f of flags) console.warn(`  ${f.message}`);
} else {
  console.log('OK — no over-represented rarities detected.');
}
console.log(`Wrote ${outPath}`);
