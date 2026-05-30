#!/usr/bin/env node
/**
 * scripts/verify-runtime-parity.mjs — Phase 1, step 4 gate.
 *
 * Proves that with USE_CANONICAL_DATA ON vs OFF, the exported
 * ENEMIES / ENEMIES_ACT4 / ENEMIES_ACT5 / ENEMIES_ACT6 /
 * ENCOUNTERS / HIDDEN_BOSS_ENCOUNTERS are deep-equal across both paths.
 *
 * Strategy:
 *   1. Load mapData.js once with the flag forced OFF (legacy path).
 *   2. Load mapData.js once with the flag forced ON  (canonical path).
 *   Since Node caches modules, we use separate Worker threads — each
 *   worker sets the env var before importing, so the two module
 *   instances are isolated. Each worker serialises its exports to
 *   JSON and sends them back to the main thread via postMessage.
 *
 * Exit 0 on full parity; exit 1 with a readable diff on any mismatch.
 *
 * Usage:
 *   node scripts/verify-runtime-parity.mjs
 */

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const GAME_ROOT  = path.resolve(__dirname, '..');

const RED = (s) => `\x1b[31m${s}\x1b[0m`;
const GRN = (s) => `\x1b[32m${s}\x1b[0m`;
const DIM = (s) => `\x1b[2m${s}\x1b[0m`;

// ── Worker thread ─────────────────────────────────────────────────────────────

if (!isMainThread) {
  // workerData.flag: '0' = legacy path, '1' = canonical path
  if (workerData.flag === '0') {
    process.env.USE_CANONICAL_DATA = '0';
  } else {
    delete process.env.USE_CANONICAL_DATA;
  }

  // Browser/DOM shims so mapData loads cleanly in Node.
  globalThis.window = {
    __USE_CANONICAL_DATA: workerData.flag !== '0' ? undefined : false,
    addEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    location: { href: '', search: '', hash: '' },
  };
  globalThis.document = {
    createElement: () => ({
      style: {},
      classList: { add() {}, remove() {} },
      addEventListener() {},
      appendChild() {},
    }),
    addEventListener() {},
    body: { appendChild() {} },
    head: { appendChild() {} },
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => ({ forEach() {} }),
    documentElement: { style: {} },
  };
  globalThis.localStorage = {
    getItem: () => null,
    setItem() {},
    removeItem() {},
  };
  if (typeof globalThis.crypto === 'undefined') {
    const { webcrypto } = await import('node:crypto');
    globalThis.crypto = webcrypto;
  }

  const mapDataUrl = new URL(
    path.join(GAME_ROOT, 'src/maps/mapData.js').replace(/\\/g, '/'),
    'file:///'
  ).href;

  const md = await import(mapDataUrl);

  // Serialise the exports we care about.
  // We sort keys for deterministic comparison.
  function sortKeysDeep(v) {
    if (Array.isArray(v)) return v.map(sortKeysDeep);
    if (v && typeof v === 'object') {
      const out = {};
      for (const k of Object.keys(v).sort()) out[k] = sortKeysDeep(v[k]);
      return out;
    }
    return v;
  }

  parentPort.postMessage({
    flag: workerData.flag,
    ENEMIES:                  JSON.stringify(sortKeysDeep(md.ENEMIES)),
    ENEMIES_ACT4:             JSON.stringify(sortKeysDeep(md.ENEMIES_ACT4)),
    ENEMIES_ACT5:             JSON.stringify(sortKeysDeep(md.ENEMIES_ACT5)),
    ENEMIES_ACT6:             JSON.stringify(sortKeysDeep(md.ENEMIES_ACT6)),
    ENCOUNTERS:               JSON.stringify(sortKeysDeep(md.ENCOUNTERS)),
    HIDDEN_BOSS_ENCOUNTERS:   JSON.stringify(sortKeysDeep(md.HIDDEN_BOSS_ENCOUNTERS)),
  });
  process.exit(0);
}

// ── Main thread ───────────────────────────────────────────────────────────────

function runWorker(flag) {
  return new Promise((resolve, reject) => {
    const w = new Worker(__filename, { workerData: { flag } });
    w.once('message', resolve);
    w.once('error', reject);
    w.once('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker exited with code ${code}`));
    });
  });
}

console.log('verify-runtime-parity: loading mapData.js with flag OFF (legacy) …');
const legacyResult = await runWorker('0').catch((e) => {
  console.error(RED('RUNTIME PARITY FAIL') + ' — legacy worker error: ' + e.message);
  process.exit(1);
});

console.log('verify-runtime-parity: loading mapData.js with flag ON  (canonical) …');
const canonResult  = await runWorker('1').catch((e) => {
  console.error(RED('RUNTIME PARITY FAIL') + ' — canonical worker error: ' + e.message);
  process.exit(1);
});

const DICTS = [
  'ENEMIES',
  'ENEMIES_ACT4',
  'ENEMIES_ACT5',
  'ENEMIES_ACT6',
  'ENCOUNTERS',
  'HIDDEN_BOSS_ENCOUNTERS',
];

let totalDiffs = 0;

for (const dictName of DICTS) {
  const legStr = legacyResult[dictName];
  const canStr = canonResult[dictName];

  if (legStr === canStr) {
    const keyCount = Object.keys(JSON.parse(legStr)).length;
    console.log(GRN('  OK ') + `${dictName} — ${keyCount} key(s), identical`);
    continue;
  }

  // Compute first difference
  const leg = JSON.parse(legStr);
  const can = JSON.parse(canStr);

  const legKeys = Object.keys(leg).sort();
  const canKeys = Object.keys(can).sort();

  const onlyLeg = legKeys.filter((k) => !(k in can));
  const onlyCan = canKeys.filter((k) => !(k in leg));
  const shared  = legKeys.filter((k) => k in can);

  const diffs = [];
  for (const k of onlyLeg) diffs.push(`  extra in legacy: "${k}"`);
  for (const k of onlyCan) diffs.push(`  extra in canon:  "${k}"`);
  for (const k of shared) {
    if (JSON.stringify(leg[k]) !== JSON.stringify(can[k])) {
      diffs.push(`  value mismatch for key "${k}"`);
      diffs.push(`    legacy: ${JSON.stringify(leg[k]).slice(0, 120)}`);
      diffs.push(`    canon : ${JSON.stringify(can[k]).slice(0, 120)}`);
    }
  }

  console.error(RED('  FAIL') + ` ${dictName} — ${diffs.length} diff(s):`);
  for (const d of diffs.slice(0, 20)) console.error(DIM('      ') + d);
  if (diffs.length > 20) console.error(`      ... +${diffs.length - 20} more`);
  totalDiffs += diffs.length;
}

console.log('');
if (totalDiffs === 0) {
  console.log(GRN('RUNTIME PARITY OK: all 6 dicts byte-identical between legacy and canonical paths.'));
  process.exit(0);
} else {
  console.error(RED(`RUNTIME PARITY FAIL: ${totalDiffs} total diff(s) across ${DICTS.length} dicts.`));
  process.exit(1);
}
