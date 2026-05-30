#!/usr/bin/env node
/**
 * audit-sprite-404s.cjs (M236) — QC tool.
 *
 * Walks every live-data entity and checks whether each expected sprite file
 * exists on disk. Reports a summary by category and lists individual misses.
 * Optionally auto-flags unacknowledged misses to public/assets/wishlist.html.
 *
 * Canonical data sources (same as build-image-review-manifest.cjs):
 *   - src/game/appearances.js   APPEARANCES (heroes × 7 canonical poses)
 *   - src/game/companions.js    CLASS_PETS (companion class pets)
 *   - src/maps/mapData.js       ENEMIES + ENEMIES_ACT5 + boss node encounter ids
 *
 * Canonical pose spec per /docs/image-policy.md:
 *   portrait, south, east, east_attack, east_spell, east_block, east_ko
 *
 * Usage:
 *   node scripts/audit-sprite-404s.cjs           # human-readable report
 *   node scripts/audit-sprite-404s.cjs --json    # machine-readable
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PUB  = path.join(ROOT, 'public');
const IMG  = path.join(PUB, 'images');
const SC_DIR = path.join(IMG, 'spritecook');

const POSES = ['portrait','south','east','east_attack','east_spell','east_block','east_ko'];

function readJS(relPath) {
  try { return fs.readFileSync(path.join(ROOT, relPath), 'utf8'); }
  catch { return ''; }
}

// Parse APPEARANCES ids from appearances.js.
function parseAppearances() {
  const src = readJS('src/game/appearances.js');
  const ids = [];
  const re = /\bid:\s*'([a-z0-9_]+)'/g;
  let m;
  while ((m = re.exec(src)) !== null) ids.push(m[1]);
  return [...new Set(ids)];
}

function parseClassPets() {
  const src = readJS('src/game/companions.js');
  const ids = new Set();
  const re = /['"](pet_[a-z0-9_]+)['"]/g;
  let m;
  while ((m = re.exec(src)) !== null) ids.add(m[1]);
  return [...ids];
}

function parseEnemyIds() {
  const src = readJS('src/maps/mapData.js');
  // Scope to the ENEMIES + ENEMIES_ACT5 object literals. Everything else in
  // mapData (encounters, zones, nodes) uses compound id fields and was
  // producing false positives before (encounter ids !== sprite ids).
  const ids = new Set();
  for (const blockName of ['ENEMIES', 'ENEMIES_ACT5']) {
    const re = new RegExp(`export const ${blockName}\\s*=\\s*\\{([\\s\\S]*?)\\n\\}`);
    const m = re.exec(src);
    if (!m) continue;
    const body = m[1];
    const reEntry = /\n\s{2}([a-z][a-z0-9_]+):\s*\{/g;
    let e;
    while ((e = reEntry.exec(body)) !== null) ids.add(e[1]);
  }
  return [...ids];
}

function fileExists(absPath) {
  try { return fs.statSync(absPath).isFile(); }
  catch { return false; }
}

function auditSprite(id, poseList) {
  const misses = [];
  for (const pose of poseList) {
    const candidates = [
      path.join(SC_DIR, `${id}_${pose}.png`),
      path.join(IMG, 'sprites', `${id}_${pose}.png`),
      path.join(IMG, 'pixellab', id, `${pose}.png`),
    ];
    const found = candidates.some(fileExists);
    if (!found) misses.push(pose);
  }
  return misses;
}

function main() {
  const wantJson = process.argv.includes('--json');

  const appearances = parseAppearances();
  const companions  = parseClassPets();
  const enemies     = parseEnemyIds();

  const report = { appearances: {}, companions: {}, enemies: {} };
  let totalMisses = 0;

  for (const id of appearances) {
    const misses = auditSprite(id, POSES);
    if (misses.length) { report.appearances[id] = misses; totalMisses += misses.length; }
  }
  for (const id of companions) {
    // Companions rarely have 7 poses — east + south + portrait are enough.
    const misses = auditSprite(id, ['portrait','south','east']);
    if (misses.length) { report.companions[id] = misses; totalMisses += misses.length; }
  }
  for (const id of enemies) {
    const misses = auditSprite(id, ['east']);
    if (misses.length) { report.enemies[id] = misses; totalMisses += misses.length; }
  }

  if (wantJson) {
    process.stdout.write(JSON.stringify({ totalMisses, ...report }, null, 2) + '\n');
    return;
  }

  console.log(`\nSprite 404 audit — ${totalMisses} missing file(s)`);
  console.log('─'.repeat(60));
  for (const [cat, data] of Object.entries(report)) {
    const entries = Object.entries(data);
    console.log(`\n${cat.toUpperCase()} (${entries.length} ids with misses)`);
    if (!entries.length) { console.log('  clean ✓'); continue; }
    for (const [id, misses] of entries) {
      console.log(`  ${id.padEnd(32)} missing: ${misses.join(', ')}`);
    }
  }
  console.log('');
}

main();
