#!/usr/bin/env node
/**
 * verify-mapdata-exports-parity.mjs
 *
 * Refactor-opportunities #2 safety gate. Asserts that the public export
 * surface of src/maps/mapData.js (names + fully-resolved values) is
 * byte-identical to the frozen pre-split snapshot.
 *
 * The pre-split snapshot lives in
 *   scripts/__snapshots__/mapdata-exports.json
 * and is generated ONCE, before the god-file split, via:
 *   node scripts/verify-mapdata-exports-parity.mjs --write
 *
 * After the split, run with no args. Exit 0 + "0 diffs" means the facade
 * re-exports the identical surface; any structural drift fails the gate.
 *
 * Note: mapData.js mutates the zone arrays in place at module-init
 * (arrival / dungeon / hidden-boss / dialog-branch injection + FTL grid
 * layout). The snapshot therefore captures the FINAL post-init shape, so a
 * split that changes init order would be caught here.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAP_DIR = join(__dirname, '__snapshots__');
const SNAP_FILE = join(SNAP_DIR, 'mapdata-exports.json');

// Stable stringify: sort object keys recursively so key-ordering noise
// (e.g. a different module assembling the same object) is not a false diff.
// Functions are reduced to a stable token (we assert presence + arity, not
// source text — the split moves functions verbatim).
function normalize(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'function') return `[Function ${value.name || 'anon'}/${value.length}]`;
    if (typeof value === 'undefined') return '[undefined]';
    if (typeof value === 'number' && !Number.isFinite(value)) return `[Number ${String(value)}]`;
    return value;
  }
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  if (Array.isArray(value)) {
    const out = value.map((v) => normalize(v, seen));
    seen.delete(value);
    return out;
  }
  const out = {};
  for (const k of Object.keys(value).sort()) {
    out[k] = normalize(value[k], seen);
  }
  seen.delete(value);
  return out;
}

async function snapshotExports() {
  const mod = await import('../src/maps/mapData.js');
  const snap = {};
  for (const name of Object.keys(mod).sort()) {
    snap[name] = normalize(mod[name]);
  }
  return snap;
}

function deepDiff(a, b, path = '$', diffs = []) {
  const ta = Array.isArray(a) ? 'array' : a === null ? 'null' : typeof a;
  const tb = Array.isArray(b) ? 'array' : b === null ? 'null' : typeof b;
  if (ta !== tb) {
    diffs.push(`${path}: type ${ta} -> ${tb}`);
    return diffs;
  }
  if (ta === 'object') {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    const all = new Set([...ka, ...kb]);
    for (const k of all) {
      if (!(k in a)) { diffs.push(`${path}.${k}: missing in OLD (added)`); continue; }
      if (!(k in b)) { diffs.push(`${path}.${k}: missing in NEW (removed)`); continue; }
      deepDiff(a[k], b[k], `${path}.${k}`, diffs);
    }
  } else if (ta === 'array') {
    if (a.length !== b.length) diffs.push(`${path}: array length ${a.length} -> ${b.length}`);
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) deepDiff(a[i], b[i], `${path}[${i}]`, diffs);
  } else if (a !== b) {
    diffs.push(`${path}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
  }
  return diffs;
}

const WRITE = process.argv.includes('--write');

const current = await snapshotExports();

if (WRITE) {
  if (!existsSync(SNAP_DIR)) mkdirSync(SNAP_DIR, { recursive: true });
  if (existsSync(SNAP_FILE)) {
    console.error('Refusing to overwrite an existing frozen snapshot.');
    console.error('Delete it manually if you intentionally re-baseline.');
    process.exit(1);
  }
  writeFileSync(SNAP_FILE, JSON.stringify(current, null, 2) + '\n');
  console.log(`Frozen pre-split snapshot written: ${SNAP_FILE}`);
  console.log(`Exports captured: ${Object.keys(current).length}`);
  process.exit(0);
}

if (!existsSync(SNAP_FILE)) {
  console.error(`Missing frozen snapshot: ${SNAP_FILE}`);
  console.error('Generate it BEFORE the split with: node scripts/verify-mapdata-exports-parity.mjs --write');
  process.exit(1);
}

const frozen = JSON.parse(readFileSync(SNAP_FILE, 'utf8'));

const frozenNames = Object.keys(frozen).sort();
const currentNames = Object.keys(current).sort();
const diffs = [];

if (frozenNames.join(',') !== currentNames.join(',')) {
  const added = currentNames.filter((n) => !frozenNames.includes(n));
  const removed = frozenNames.filter((n) => !currentNames.includes(n));
  for (const n of added) diffs.push(`export added: ${n}`);
  for (const n of removed) diffs.push(`export removed: ${n}`);
}

for (const name of frozenNames) {
  if (!(name in current)) continue;
  deepDiff(frozen[name], current[name], `$.${name}`, diffs);
}

if (diffs.length === 0) {
  console.log(`verify-mapdata-exports-parity: 0 diffs (${currentNames.length} exports identical)`);
  process.exit(0);
}

console.error(`verify-mapdata-exports-parity: ${diffs.length} diffs`);
for (const d of diffs.slice(0, 200)) console.error('  ' + d);
if (diffs.length > 200) console.error(`  ... +${diffs.length - 200} more`);
process.exit(1);
