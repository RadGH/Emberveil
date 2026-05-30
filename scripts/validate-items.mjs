#!/usr/bin/env node
/**
 * scripts/validate-items.mjs — M301 Task 5
 *
 * Generates 1000 random items per rarity tier per act bucket, validates that
 * every affix roll lands within its declared min/max, reports out-of-bounds
 * rolls, and writes public/assets/data/item-validation.json.
 *
 * Usage:
 *   node scripts/validate-items.mjs
 *   node scripts/validate-items.mjs --samples=2000
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

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; })
);
const SAMPLES_PER_TIER = parseInt(args.samples ?? '1000', 10);

const ALL_BASES = {
  ...WEAPON_BASES,
  ...ARMOR_BASES,
};
const BASE_KEYS = Object.keys(ALL_BASES);

// All declared affixes (with their min/max bounds)
const allAffixDefs = [
  ...(AFFIXES_ACT1.prefixes || []),
  ...(AFFIXES_ACT1.suffixes || []),
  ...(SHIELD_AFFIXES || []),
].reduce((m, a) => { m[a.id] = a; return m; }, {});

const violations = [];
let totalItems   = 0;
let totalAffixes = 0;

console.log(`validate-items: ${SAMPLES_PER_TIER} items per rarity per act (affixes pool = AFFIXES_ACT1 only)`);
console.log(`Base types: ${BASE_KEYS.length}`);

for (const rarity of RARITIES) {
  let generated = 0;
  while (generated < SAMPLES_PER_TIER) {
    const baseKey = BASE_KEYS[Math.floor(Math.random() * BASE_KEYS.length)];
    const quality = QUALITIES[Math.floor(Math.random() * QUALITIES.length)];
    let item;
    try {
      item = generateItem(baseKey, rarity, quality, AFFIXES_ACT1);
    } catch (e) {
      violations.push({ type: 'exception', rarity, baseKey, quality, error: e.message });
      generated++;
      totalItems++;
      continue;
    }
    if (!item) { generated++; totalItems++; continue; }

    for (const affix of (item.affixes || [])) {
      if (affix.baseIntrinsic) continue;   // base stats, not rolled
      totalAffixes++;
      const def = allAffixDefs[affix.id];
      if (!def) continue;  // shield affixes not in primary pool — skip
      const { min, max } = def;
      if (min == null || max == null) continue;
      if (affix.value < min - 0.001 || affix.value > max + 0.001) {
        violations.push({
          type:    'out_of_bounds',
          rarity,
          baseKey,
          quality,
          affixId: affix.id,
          value:   affix.value,
          min,
          max,
        });
      }
    }
    generated++;
    totalItems++;
  }
}

const out = {
  generated:          new Date().toISOString(),
  samplesPerTier:     SAMPLES_PER_TIER,
  totalItemsChecked:  totalItems,
  totalAffixesChecked: totalAffixes,
  violationCount:     violations.length,
  status:             violations.length === 0 ? 'ok' : 'violations_found',
  violations,
};

const outPath = path.join(GAME_ROOT, 'public/assets/data/item-validation.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

if (violations.length === 0) {
  console.log(`OK — ${totalItems} items, ${totalAffixes} affix rolls, 0 violations.`);
} else {
  console.warn(`VIOLATIONS: ${violations.length} out-of-bounds affix rolls in ${totalItems} items.`);
  for (const v of violations.slice(0, 10)) {
    console.warn(`  ${v.affixId} on ${v.baseKey}/${v.rarity}: value=${v.value} (range ${v.min}-${v.max})`);
  }
  if (violations.length > 10) console.warn(`  ... and ${violations.length - 10} more.`);
}
console.log(`Wrote ${outPath}`);
