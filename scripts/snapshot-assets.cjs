/**
 * snapshot-assets.cjs
 *
 * Freezes the current public/assets/data/*.json state into
 * public/assets/data/snapshots/M###/ for the current milestone.
 * Idempotent: skips if the snapshot directory already exists.
 *
 * Also writes a changelog-structured.json snapshot so each milestone
 * preserves its own changelog slice.
 *
 * Usage:
 *   node scripts/snapshot-assets.cjs          # auto-detects milestone from game_meta.json
 *   node scripts/snapshot-assets.cjs --force  # overwrite even if snapshot exists
 *
 * Wired into release.sh after the main game_meta.json update, before
 * the final summary output.
 *
 * Data types captured (mirrors emit-game-data.cjs outputs):
 *   companions, classes, enemies, dungeons, status-effects,
 *   achievements, skills, affixes, items, bosses
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT         = path.resolve(__dirname, '..');
const DATA_DIR     = path.join(ROOT, 'public/assets/data');
const SNAPSHOTS_DIR = path.join(DATA_DIR, 'snapshots');
const META_PATH    = path.resolve(ROOT, '../game13_releases/game_meta.json');

const FORCE = process.argv.includes('--force');

// ─── Resolve milestone number ──────────────────────────────────────────────

function resolveMilestone() {
  try {
    const meta = JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
    const keys = Object.keys(meta.releases || {}).map(Number).filter(Number.isFinite);
    if (!keys.length) return null;
    return Math.max(...keys);
  } catch (e) {
    console.warn('[snapshot-assets] Could not read game_meta.json:', e.message);
    return null;
  }
}

// ─── Data types to snapshot ────────────────────────────────────────────────

const DATA_TYPES = [
  'companions',
  'classes',
  'enemies',
  'dungeons',
  'status-effects',
  'achievements',
  'skills',
  'affixes',
  'items',
  'bosses',
];

// ─── Main ──────────────────────────────────────────────────────────────────

const milestoneNum = resolveMilestone();
if (milestoneNum === null) {
  console.warn('[snapshot-assets] No milestone found — skipping snapshot.');
  process.exit(0);
}

const snapshotDir = path.join(SNAPSHOTS_DIR, 'M' + milestoneNum);

if (fs.existsSync(snapshotDir) && !FORCE) {
  console.log('[snapshot-assets] Snapshot M' + milestoneNum + ' already exists — skipping (use --force to overwrite).');
  process.exit(0);
}

fs.mkdirSync(snapshotDir, { recursive: true });

let copied = 0;
let missing = 0;

for (const type of DATA_TYPES) {
  const src = path.join(DATA_DIR, type + '.json');
  const dst = path.join(snapshotDir, type + '.json');
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dst);
    copied++;
  } else {
    missing++;
    console.warn('[snapshot-assets] Missing: ' + src + ' — skipped');
  }
}

// Also copy changelog-structured.json as the changelog slice for this milestone
const changelogSrc = path.join(ROOT, 'public/assets/changelog-structured.json');
if (fs.existsSync(changelogSrc)) {
  fs.copyFileSync(changelogSrc, path.join(snapshotDir, 'changelog-structured.json'));
  copied++;
}

// Write a manifest so the UI knows what this snapshot contains
const manifest = {
  milestone: milestoneNum,
  created: new Date().toISOString(),
  types: DATA_TYPES.filter(t => fs.existsSync(path.join(snapshotDir, t + '.json'))),
};
fs.writeFileSync(path.join(snapshotDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

console.log(
  '[snapshot-assets] M' + milestoneNum + ' snapshot complete — ' +
  copied + ' files copied' +
  (missing ? ', ' + missing + ' missing' : ''),
);
