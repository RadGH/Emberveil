#!/usr/bin/env node
/**
 * approve-image-review-v2.cjs
 *
 * Process approvals from the Image Review V2 page. The page emits a list of
 * `<id>\t<path>` lines; pass entry IDs (one per arg) to this script.
 *
 *   node scripts/approve-image-review-v2.cjs <entryId> [<entryId> ...]
 *   node scripts/approve-image-review-v2.cjs --all      # approve every open-batch entry
 *
 * For each approved entry:
 *   1. Copy archive/<batch>/<asset>_new.png  →  the live path on disk.
 *   2. Mark approved=true in the batch JSON.
 *
 * If all entries in the open batch end up approved:
 *   3. Move the open batch into history (sets approvedAt).
 *   4. Open a new empty batch under the next milestone (current + 1).
 *
 * Re-run `node scripts/build-image-review-v2.cjs` afterwards to refresh the
 * page data file.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const BATCH_DIR = path.join(PUBLIC, 'assets', 'data', 'image_review_batches');
const BATCH_INDEX = path.join(BATCH_DIR, 'index.json');

function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function saveJson(p, o) { fs.writeFileSync(p, JSON.stringify(o, null, 2) + '\n'); }

function resolveFromAssets(rel) {
  // Paths in batch JSON are written relative to public/assets/, e.g. "../images/..."
  return path.normalize(path.join(PUBLIC, 'assets', rel));
}

function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error('Usage: approve-image-review-v2.cjs <entryId> [<entryId> ...]');
    console.error('       approve-image-review-v2.cjs --all');
    console.error('       approve-image-review-v2.cjs --all --exclude <tok1>,<tok2>,...');
    console.error('         (substring-match each token against entry id/group/pose/path; skip matching entries)');
    process.exit(2);
  }
  const idx = loadJson(BATCH_INDEX);
  if (!idx.open) { console.error('No open batch.'); process.exit(1); }
  const batchPath = path.join(BATCH_DIR, `${idx.open.id}.json`);
  const batch = loadJson(batchPath);
  const wantAll = args.includes('--all');
  // M464 — --exclude <a,b,c> flag. Strings get substring-matched against
  // every entry's id, group, pose, and live/new path. Used to "approve
  // everything except these for-review items in one shot."
  let exclude = [];
  const exIdx = args.indexOf('--exclude');
  if (exIdx >= 0 && exIdx + 1 < args.length) {
    exclude = args[exIdx + 1].split(',').map(s => s.trim()).filter(Boolean);
  }
  function isExcluded(entry) {
    if (!exclude.length) return false;
    const hay = [
      entry.id || '', entry.assetId || '',
      entry.group || '', entry.pose || '',
      entry.live || '', entry.new || '', entry.old || '',
    ].join('\n').toLowerCase();
    return exclude.some(tok => hay.includes(tok.toLowerCase()));
  }
  // M412 — accept either entry.id OR entry.assetId so legacy openai-gen-*
  // entries (no .id field) can still be approved/discarded.
  const keyOf = (e) => e.id || e.assetId;
  const wanted = wantAll
    ? new Set(batch.entries.filter(e => !isExcluded(e)).map(keyOf))
    : new Set(args.filter(a => !a.startsWith('--') && a !== exclude.join(',')));

  let approvedCount = 0;
  let discardedCount = 0;
  let excludedCount = 0;
  for (const entry of batch.entries) {
    if (entry.approved) continue;
    if (wantAll && isExcluded(entry)) { excludedCount++; continue; }
    if (!wanted.has(keyOf(entry))) continue;
    const newRel = entry.new;
    const liveRel = entry.live || entry.old || entry.new;
    if (!newRel || !liveRel) {
      // Ghost entry — no path data at all. Mark approved with a discard note
      // rather than crashing, so --all can clean up old empty entries.
      entry.approved = true;
      entry.approvedAt = new Date().toISOString();
      entry.note = (entry.note || '') + ' [auto-approved: ghost entry, no file]';
      discardedCount++;
      console.log(`discarded ${keyOf(entry)}: no path data`);
      continue;
    }
    const newPath = resolveFromAssets(newRel);
    const livePath = resolveFromAssets(liveRel);
    if (!fs.existsSync(newPath)) {
      // Candidate file missing (e.g. openai-gen entries that were never
      // produced). Mark approved with a note so the page stops showing
      // them as pending forever — manual cleanup if regen is wanted later.
      entry.approved = true;
      entry.approvedAt = new Date().toISOString();
      entry.note = (entry.note || '') + ' [auto-approved: candidate file missing, no copy performed]';
      discardedCount++;
      console.log(`discarded ${keyOf(entry)}: candidate missing (${newPath})`);
      continue;
    }
    if (newPath !== livePath) fs.copyFileSync(newPath, livePath);
    entry.approved = true;
    entry.approvedAt = new Date().toISOString();
    approvedCount++;
    console.log(`approved ${keyOf(entry)}: ${newRel} → ${liveRel}`);
  }
  if (discardedCount) console.log(`(${discardedCount} entries auto-cleared without copy)`);
  if (excludedCount)  console.log(`(${excludedCount} entries skipped by --exclude)`);
  saveJson(batchPath, batch);

  // If every entry now approved, freeze the batch and open the next.
  const allDone = batch.entries.length > 0 && batch.entries.every(e => e.approved);
  if (allDone) {
    const frozen = { id: batch.id, milestone: batch.milestone, approvedAt: new Date().toISOString() };
    idx.history = [frozen, ...(idx.history || [])];
    const nextMilestone = (batch.milestone || 0) + 1;
    const nextId = `m${nextMilestone}`;
    idx.open = { id: nextId, milestone: nextMilestone, openedAt: new Date().toISOString() };
    saveJson(BATCH_INDEX, idx);
    const nextBatchPath = path.join(BATCH_DIR, `${nextId}.json`);
    if (!fs.existsSync(nextBatchPath)) {
      saveJson(nextBatchPath, { id: nextId, milestone: nextMilestone, openedAt: idx.open.openedAt, entries: [] });
    }
    console.log(`\n✓ Batch ${batch.id} fully approved. Moved to history. Opened new batch: ${nextId}.`);
  } else {
    const remaining = batch.entries.filter(e => !e.approved).length;
    console.log(`\n${approvedCount} approved this run. ${remaining} pending in ${batch.id}.`);
  }
  console.log('\nReminder: run `node scripts/build-image-review-v2.cjs` to refresh the page data.');
}

main();
