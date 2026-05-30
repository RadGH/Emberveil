#!/usr/bin/env node
/**
 * spritecook-boss-postprocess.cjs
 *
 * Post-generation helper for SpriteCook boss regens.
 *
 * For one character id, performs:
 *   1. Backs up any existing public/images/openai_v2/<id>_<pose>.png files
 *      to public/images/openai_v2/_pre_spritecook/  (one-time per file —
 *      already-archived files are not overwritten).
 *      Why: build-appearances-manifest checks openai_v2 BEFORE spritecook.
 *      Moving the old boss files into _pre_spritecook/ (which is in
 *      SKIP_DIRS) makes the manifest fall through to spritecook/<id>_<pose>
 *      naturally, with no per-id override needed.
 *   2. Enrols the new files in the OPEN image-review-v2 batch so the user
 *      can review them on /assets/image-review-v2.html.
 *
 * Usage:
 *   node scripts/spritecook-boss-postprocess.cjs <char_id> <prompt> [pose1 pose2 ...]
 *
 *   If poses are omitted, all 7 canonical poses are processed.
 *
 * Caller is expected to have already written the new pose PNGs into
 * public/images/spritecook/<id>_<pose>.png before invoking this script.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT          = path.resolve(__dirname, '..');
const PUB           = path.join(ROOT, 'public');
const IMG_OPENAI    = path.join(PUB, 'images', 'openai_v2');
const IMG_SPRITECOK = path.join(PUB, 'images', 'spritecook');
const BACKUP_DIR    = path.join(IMG_OPENAI, '_pre_spritecook');
const BATCH_INDEX   = path.join(PUB, 'assets/data/image_review_batches/index.json');
const BATCH_DIR     = path.join(PUB, 'assets/data/image_review_batches');

const CANONICAL_POSES = [
  'portrait', 'south', 'east',
  'east_attack', 'east_spell', 'east_block', 'east_ko',
];

function log(msg) { console.log(`[spritecook-postprocess] ${msg}`); }

function backupOpenAi(charId, poses) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  let archived = 0;
  for (const pose of poses) {
    const src = path.join(IMG_OPENAI, `${charId}_${pose}.png`);
    const dst = path.join(BACKUP_DIR, `${charId}_${pose}.png`);
    if (!fs.existsSync(src)) continue;
    if (fs.existsSync(dst)) {
      // Already archived; leave the original openai_v2 copy in place
      // but it'll still take precedence over spritecook. Move it.
      fs.unlinkSync(src);
      continue;
    }
    fs.renameSync(src, dst);
    archived++;
  }
  // Also move any non-canonical leftovers (e.g. _openai_sheet.png so the
  // manifest doesn't see it as an orphan owned by openai_v2).
  const sheetSrc = path.join(IMG_OPENAI, `${charId}_openai_sheet.png`);
  const sheetDst = path.join(BACKUP_DIR, `${charId}_openai_sheet.png`);
  if (fs.existsSync(sheetSrc) && !fs.existsSync(sheetDst)) {
    fs.renameSync(sheetSrc, sheetDst);
  } else if (fs.existsSync(sheetSrc)) {
    fs.unlinkSync(sheetSrc);
  }
  log(`${charId}: archived ${archived} openai_v2 files to _pre_spritecook/`);
}

function enrolInOpenBatch(charId, prompt, poses) {
  if (!fs.existsSync(BATCH_INDEX)) {
    log(`WARN: ${BATCH_INDEX} missing — skipping batch enrolment`);
    return 0;
  }
  const idx = JSON.parse(fs.readFileSync(BATCH_INDEX, 'utf8'));
  const open = idx.open;
  if (!open) {
    log('WARN: no open batch — skipping enrolment');
    return 0;
  }
  const batchPath = path.join(BATCH_DIR, `${open.id}.json`);
  if (!fs.existsSync(batchPath)) {
    log(`WARN: ${batchPath} missing — skipping enrolment`);
    return 0;
  }
  const batch = JSON.parse(fs.readFileSync(batchPath, 'utf8'));
  if (!Array.isArray(batch.entries)) batch.entries = [];

  // Drop existing un-approved spritecook-boss entries for this character.
  batch.entries = batch.entries.filter(
    e => !(e.group === charId && e.source === 'spritecook-boss' && !e.approved)
  );

  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  let added = 0;
  for (const pose of poses) {
    const livePng = path.join(IMG_SPRITECOK, `${charId}_${pose}.png`);
    if (!fs.existsSync(livePng)) continue;
    const liveRel = `../images/spritecook/${charId}_${pose}.png`;
    const oldRel  = fs.existsSync(path.join(BACKUP_DIR, `${charId}_${pose}.png`))
      ? `../images/openai_v2/_pre_spritecook/${charId}_${pose}.png`
      : liveRel;
    batch.entries.push({
      id: `spritecookboss_${charId}_${pose}`,
      group: charId,
      pose,
      category: 'boss',
      source: 'spritecook-boss',
      prompt,
      old: oldRel,
      new: liveRel,
      live: liveRel,
      approved: false,
      addedAt: now,
    });
    added++;
  }
  fs.writeFileSync(batchPath, JSON.stringify(batch, null, 2) + '\n');
  log(`${charId}: enrolled ${added} entries in open batch ${open.id}`);
  return added;
}

function main() {
  const [,, charId, prompt, ...poseArgs] = process.argv;
  if (!charId || prompt === undefined) {
    console.error('Usage: spritecook-boss-postprocess.cjs <char_id> <prompt> [pose1 pose2 ...]');
    process.exit(2);
  }
  const poses = poseArgs.length ? poseArgs : CANONICAL_POSES;
  backupOpenAi(charId, poses);
  enrolInOpenBatch(charId, prompt, poses);
}

if (require.main === module) main();
