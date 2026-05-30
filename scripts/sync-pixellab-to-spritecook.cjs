#!/usr/bin/env node
/**
 * sync-pixellab-to-spritecook.cjs (M236)
 *
 * The game's sprite loader reads <id>_<pose>.png from public/images/spritecook/.
 * The character-redesign pipeline saves approved art to public/images/pixellab/<id>/<pose>.png.
 * Without a bridge step, approving art on the review page does NOT update
 * the in-game sprite.
 *
 * This script walks pixellab/<id>/ for every APPROVED frame (per
 * pixellab_redesign_state.json) and copies it into images/spritecook/
 * with the flat <id>_<pose>.png naming the game expects.
 *
 * Safe to re-run — it only copies files that differ (by mtime + size).
 * Non-approved frames + pending-review/ are skipped.
 *
 * Usage:
 *   node scripts/sync-pixellab-to-spritecook.cjs         # sync all approved frames
 *   node scripts/sync-pixellab-to-spritecook.cjs --dry   # report only, no writes
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PIXELLAB = path.join(ROOT, 'public/images/pixellab');
const SPRITECOOK = path.join(ROOT, 'public/images/spritecook');
const STATE = path.join(ROOT, 'public/data/pixellab_redesign_state.json');

const DRY = process.argv.includes('--dry');

function readJSON(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }

function needsCopy(src, dst) {
  try {
    const a = fs.statSync(src);
    if (!fs.existsSync(dst)) return true;
    const b = fs.statSync(dst);
    return (a.size !== b.size) || (a.mtimeMs > b.mtimeMs);
  } catch { return false; }
}

function main() {
  const state = readJSON(STATE);
  if (!state) { console.error('state.json missing'); process.exit(1); }
  if (!fs.existsSync(SPRITECOOK)) fs.mkdirSync(SPRITECOOK, { recursive: true });

  let copied = 0;
  let skipped = 0;
  let missingSrc = 0;

  const poses = ['portrait','south','east','east_attack','east_spell','east_block','east_ko'];

  for (const [id, entry] of Object.entries(state.characters || {})) {
    for (const pose of poses) {
      const status = (entry.framesStatus || {})[pose];
      if (!status || status !== 'approved') continue;
      const src = path.join(PIXELLAB, id, `${pose}.png`);
      const dst = path.join(SPRITECOOK, `${id}_${pose}.png`);
      if (!fs.existsSync(src)) {
        // Some characters (e.g. legacy ones where pixellab/<id>/ never had a
        // copy written) skip without noise — the spritecook file is the
        // authoritative one there.
        missingSrc++;
        continue;
      }
      if (!needsCopy(src, dst)) { skipped++; continue; }
      if (DRY) {
        console.log(`[DRY] copy ${id}/${pose}.png → spritecook/${id}_${pose}.png`);
      } else {
        fs.copyFileSync(src, dst);
      }
      copied++;
    }
  }

  console.log(`\n${DRY ? '[DRY RUN] ' : ''}sync-pixellab-to-spritecook complete`);
  console.log(`  copied:       ${copied}`);
  console.log(`  up-to-date:   ${skipped}`);
  console.log(`  missing src:  ${missingSrc} (expected for legacy characters)`);
}

main();
