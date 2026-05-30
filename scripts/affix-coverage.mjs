#!/usr/bin/env node
/**
 * scripts/affix-coverage.mjs — M301 Task 6
 *
 * Generates 5000 random items per act bucket, counts how often each affix
 * appears, and flags affixes with zero appearances in early acts (Act 1-2) or
 * any act they should appear in.
 *
 * Writes public/assets/data/affix-coverage.json.
 *
 * Usage:
 *   node scripts/affix-coverage.mjs
 *   node scripts/affix-coverage.mjs --samples=10000
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const { WEAPON_BASES, ARMOR_BASES, AFFIXES_ACT1, RARITIES, QUALITIES, SHIELD_AFFIXES, generateItem } =
  await import(path.join(GAME_ROOT, 'src/game/items.js'));
const { AFFIXES_M305 } = await import(path.join(GAME_ROOT, 'src/game/affixes.js'));

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; })
);
const SAMPLES = parseInt(args.samples ?? '5000', 10);

const ALL_BASES = { ...WEAPON_BASES, ...ARMOR_BASES };
const BASE_KEYS = Object.keys(ALL_BASES);

// Collect all declared affixes (excluding base intrinsic markers)
const allAffixIds = new Set([
  ...(AFFIXES_ACT1.prefixes || []).map(a => a.id),
  ...(AFFIXES_ACT1.suffixes || []).map(a => a.id),
  ...(SHIELD_AFFIXES || []).map(a => a.id),
  // M305: new affixes
  ...(AFFIXES_M305 || []).map(a => a.id),
]);

// Since the game currently only has AFFIXES_ACT1, we treat all acts as using
// Act 1's pool. If per-act affix pools are added later, update this map.
const ACT_POOLS = {
  1: AFFIXES_ACT1,
  2: AFFIXES_ACT1,
  3: AFFIXES_ACT1,
  4: AFFIXES_ACT1,
  5: AFFIXES_ACT1,
};
const ACTS = [1, 2, 3, 4, 5];

// perAct[act][affixId] = count
const perAct = {};
for (const act of ACTS) perAct[act] = {};

console.log(`affix-coverage: ${SAMPLES} items per act, ${ACTS.length} acts...`);

for (const act of ACTS) {
  const pool = ACT_POOLS[act];
  for (let i = 0; i < SAMPLES; i++) {
    const baseKey = BASE_KEYS[Math.floor(Math.random() * BASE_KEYS.length)];
    // Vary rarities: normal/magic/rare at act-appropriate odds
    const rarIdx = Math.floor(Math.random() * (act + 2));
    const rarity = RARITIES[Math.min(rarIdx, RARITIES.length - 1)];
    const quality = QUALITIES[Math.floor(Math.random() * QUALITIES.length)];
    let item;
    try { item = generateItem(baseKey, rarity, quality, pool); } catch { continue; }
    if (!item) continue;
    for (const affix of (item.affixes || [])) {
      if (affix.baseIntrinsic) continue;
      perAct[act][affix.id] = (perAct[act][affix.id] || 0) + 1;
    }
  }
}

// Build per-affix coverage summary
const affixCoverage = [];
for (const id of allAffixIds) {
  const actCounts = {};
  const missingActs = [];
  for (const act of ACTS) {
    const cnt = perAct[act][id] || 0;
    actCounts[act] = cnt;
    if (cnt === 0) missingActs.push(act);
  }
  // "Missing in early acts" = zero appearances in Act 1 or 2
  const missingEarly = missingActs.filter(a => a <= 2);
  affixCoverage.push({
    id,
    actCounts,
    totalAppearances: Object.values(actCounts).reduce((s, v) => s + v, 0),
    missingActs,
    missingEarlyActs: missingEarly,
    flagged: missingEarly.length > 0,
  });
}

affixCoverage.sort((a, b) => a.totalAppearances - b.totalAppearances);

const flagged = affixCoverage.filter(a => a.flagged);

const out = {
  generated:    new Date().toISOString(),
  samplesPerAct: SAMPLES,
  acts:         ACTS,
  totalAffixes: affixCoverage.length,
  flaggedCount: flagged.length,
  affixCoverage,
};

const outPath = path.join(GAME_ROOT, 'public/assets/data/affix-coverage.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

if (flagged.length === 0) {
  console.log(`OK — all ${affixCoverage.length} affixes appear in Acts 1-2.`);
} else {
  console.warn(`FLAGGED: ${flagged.length} affix(es) missing from early acts:`);
  for (const a of flagged) {
    console.warn(`  ${a.id}: missing in Acts [${a.missingEarlyActs.join(',')}]  total=${a.totalAppearances}`);
  }
}
console.log(`Wrote ${outPath}`);
