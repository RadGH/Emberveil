/**
 * emit-release-summary.cjs
 *
 * Reads game13_releases/game_meta.json, picks the largest release key,
 * and writes { milestone, date, summary } to public/assets/release-summary.json.
 *
 * Run:  node scripts/emit-release-summary.cjs
 * Wired as "prebuild" in package.json so it runs before every `npm run build`.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const metaPath   = path.resolve(__dirname, '../../game13_releases/game_meta.json');
const outPath    = path.resolve(__dirname, '../public/assets/release-summary.json');

let meta;
try {
  meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
} catch (e) {
  console.warn('[emit-release-summary] Could not read game_meta.json:', e.message);
  // Write a safe fallback so the game never 404s
  fs.writeFileSync(outPath, JSON.stringify({ milestone: 0, date: '', summary: '' }), 'utf8');
  process.exit(0);
}

const releases = meta.releases || {};
const keys = Object.keys(releases).map(Number).filter(n => !isNaN(n));
if (keys.length === 0) {
  fs.writeFileSync(outPath, JSON.stringify({ milestone: 0, date: '', summary: '' }), 'utf8');
  process.exit(0);
}

const latest = String(Math.max(...keys));
const rel    = releases[latest] || {};

const out = {
  milestone:      parseInt(latest, 10),
  date:           rel.date           || '',
  summary:        rel.summary        || '',
  categories:     Array.isArray(rel.categories)     ? rel.categories     : [],
  breakingChanges: Array.isArray(rel.breakingChanges) ? rel.breakingChanges : [],
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log(`[emit-release-summary] M${out.milestone} written to public/assets/release-summary.json`);
