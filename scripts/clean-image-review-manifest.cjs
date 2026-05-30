/**
 * clean-image-review-manifest.cjs — M300 deprecation pass
 *
 * Reads public/assets/image-review-manifest.json and:
 *   1. Removes entries whose `file` path does not exist on disk.
 *   2. Removes duplicate entries (same `file` path — keeps first occurrence).
 *   3. Optionally: removes pending_approval entries that have a corresponding
 *      approved entry for the same group+pose (the approved copy is newer).
 *
 * Reports byte size before/after and prints a summary.
 *
 * Usage:
 *   node scripts/clean-image-review-manifest.cjs [--dry-run]
 *
 * Flags:
 *   --dry-run   Print report without writing the file.
 */

'use strict';

const fs   = require('node:fs');
const path = require('node:path');

const REPO_ROOT  = path.resolve(__dirname, '..');
const MANIFEST   = path.join(REPO_ROOT, 'public', 'assets', 'image-review-manifest.json');
const PUBLIC_DIR = path.join(REPO_ROOT, 'public');

const DRY_RUN = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function saveJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
}

/**
 * Resolve entry `file` field to an absolute path.
 * The `file` field is relative to public/assets/ (the gallery root).
 * e.g. "../images/spritecook/warrior_portrait.png"
 *   → public/images/spritecook/warrior_portrait.png
 */
function resolveFile(file) {
  // Resolve relative to public/assets/
  return path.resolve(path.join(PUBLIC_DIR, 'assets'), file);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  if (!fs.existsSync(MANIFEST)) {
    console.error('MANIFEST not found:', MANIFEST);
    process.exit(1);
  }

  const raw = fs.readFileSync(MANIFEST, 'utf8');
  const sizeBefore = Buffer.byteLength(raw, 'utf8');
  const data = JSON.parse(raw);

  const entries = data.entries;
  if (!Array.isArray(entries)) {
    console.error('Unexpected manifest shape: expected data.entries array');
    process.exit(1);
  }

  const totalBefore = entries.length;
  let removedMissing   = 0;
  let removedDuplicate = 0;
  let removedPending   = 0;

  // 1. Build approved set (group+pose combos) for step 3
  const approvedKeys = new Set();
  for (const e of entries) {
    if (e.status === 'approved') {
      const key = `${e.group || ''}::${e.pose || ''}`;
      if (key !== '::') approvedKeys.add(key);
    }
  }

  // 2. Filter pass
  const seenFiles = new Set();
  const kept = [];

  for (const entry of entries) {
    const filePath = entry.file;

    // Step A: check file exists
    const abs = resolveFile(filePath);
    if (!fs.existsSync(abs)) {
      removedMissing++;
      continue;
    }

    // Step B: deduplicate by file path
    if (seenFiles.has(filePath)) {
      removedDuplicate++;
      continue;
    }
    seenFiles.add(filePath);

    // Step C: remove pending_approval if an approved counterpart exists
    if (entry.status === 'pending_approval' || entry.status === 'pending') {
      const key = `${entry.group || ''}::${entry.pose || ''}`;
      if (key !== '::' && approvedKeys.has(key)) {
        removedPending++;
        continue;
      }
    }

    kept.push(entry);
  }

  // Update meta counts
  const byStatus = {};
  const byCategory = {};
  for (const e of kept) {
    byStatus[e.status] = (byStatus[e.status] || 0) + 1;
    byCategory[e.category] = (byCategory[e.category] || 0) + 1;
  }
  data.entries = kept;
  data._meta = data._meta || {};
  data._meta.cleanedAt = new Date().toISOString();
  data._meta.counts = {
    total: kept.length,
    by_status: byStatus,
    by_category: byCategory,
  };

  const newJson = JSON.stringify(data, null, 2) + '\n';
  const sizeAfter = Buffer.byteLength(newJson, 'utf8');

  // Report
  console.log('\n=== image-review-manifest cleanup ===');
  console.log(`Entries before  : ${totalBefore}`);
  console.log(`  Removed (missing file) : ${removedMissing}`);
  console.log(`  Removed (duplicate)    : ${removedDuplicate}`);
  console.log(`  Removed (pending+approved exists) : ${removedPending}`);
  console.log(`Entries after   : ${kept.length}`);
  console.log(`\nSize before     : ${(sizeBefore / 1024).toFixed(1)} KB`);
  console.log(`Size after      : ${(sizeAfter / 1024).toFixed(1)} KB`);
  console.log(`Saved           : ${((sizeBefore - sizeAfter) / 1024).toFixed(1)} KB`);

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No file written.');
  } else {
    saveJson(MANIFEST, data);
    console.log('\nManifest written:', MANIFEST);
  }
}

main();
