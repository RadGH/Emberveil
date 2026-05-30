#!/usr/bin/env node
/**
 * approve-pending-replacements.cjs
 *
 * Promotes candidate sprites listed in public/assets/pending-replacements.json
 * by copying each candidate file over its original, then removing the entry.
 *
 * Usage:
 *   node scripts/approve-pending-replacements.cjs            # approve all
 *   node scripts/approve-pending-replacements.cjs <id> ...   # approve listed ids
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'public', 'assets');
const MANIFEST = path.join(ASSETS_DIR, 'pending-replacements.json');

function resolveFromAssets(rel) {
  return path.normalize(path.join(ASSETS_DIR, rel));
}

function main() {
  const ids = process.argv.slice(2);
  if (!fs.existsSync(MANIFEST)) {
    console.error(`No manifest at ${MANIFEST}`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const keep = [];
  let approved = 0;
  for (const e of data.entries || []) {
    if (ids.length && !ids.includes(e.id)) { keep.push(e); continue; }
    const orig = resolveFromAssets(e.original);
    const cand = resolveFromAssets(e.candidate);
    if (!fs.existsSync(cand)) {
      console.warn(`skip ${e.id}: candidate missing (${cand})`);
      keep.push(e);
      continue;
    }
    fs.copyFileSync(cand, orig);
    fs.unlinkSync(cand);
    console.log(`approved ${e.id}: ${e.candidate} -> ${e.original}`);
    approved++;
  }
  data.entries = keep;
  fs.writeFileSync(MANIFEST, JSON.stringify(data, null, 2) + '\n');
  console.log(`\n${approved} approved, ${keep.length} pending.`);
}

main();
