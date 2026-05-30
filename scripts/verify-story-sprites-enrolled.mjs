#!/usr/bin/env node
/**
 * verify-story-sprites-enrolled.mjs — M-S21
 *
 * Verifies that all story NPC and enemy sprites:
 *   1. Exist at public/images/openai_v2/<id>_<pose>.png (all 9 poses)
 *   2. Are enrolled in the open image-review-v2 batch (M462 rule)
 *
 * Exits 0 if all sprites pass, 1 if any fail.
 *
 * Usage:
 *   node scripts/verify-story-sprites-enrolled.mjs
 *   node scripts/verify-story-sprites-enrolled.mjs --report
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const OUT_DIR    = path.join(ROOT, 'public', 'images', 'openai_v2');
const BATCH_DIR  = path.join(ROOT, 'public', 'assets', 'data', 'image_review_batches');
const BATCH_IDX  = path.join(BATCH_DIR, 'index.json');
const NPC_FILE   = path.join(ROOT, 'data', 'story', 'npcs.json');
const ENEMY_FILE = path.join(ROOT, 'data', 'story', 'enemies-story.json');

const POSES = [
  'portrait', 'south', 'east',
  'east_attack', 'east_spell', 'east_block',
  'east_ko', 'east_cheer', 'east_wound',
];

const args = process.argv.slice(2);
const REPORT = args.includes('--report');

// ---------------------------------------------------------------------------
// Load data
// ---------------------------------------------------------------------------
function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { return null; }
}

const npcs    = loadJson(NPC_FILE)   || [];
const enemies = loadJson(ENEMY_FILE) || [];
const allChars = [
  ...npcs.map(n => ({ id: n.id, name: n.fullName, type: 'npc' })),
  ...enemies.map(e => ({ id: e.id, name: e.name, type: 'enemy' })),
];

// Load open batch
let openBatchEntries = [];
if (fs.existsSync(BATCH_IDX)) {
  const idx = loadJson(BATCH_IDX);
  const openId = idx?.open?.id;
  if (openId) {
    const batchPath = path.join(BATCH_DIR, `${openId}.json`);
    const batch = loadJson(batchPath);
    openBatchEntries = batch?.entries || [];
  }
}

// Build set of enrolled character ids
const enrolledIds = new Set(
  openBatchEntries
    .filter(e => e.source === 'openai-9pose')
    .map(e => e.group)
);

// ---------------------------------------------------------------------------
// Check each character
// ---------------------------------------------------------------------------
const results = {
  ok: [],
  missingSprites: [],
  notEnrolled: [],
  partialSprites: [],
};

for (const char of allChars) {
  const { id, name, type } = char;

  // Check poses
  const presentPoses = [];
  const missingPoses = [];
  for (const pose of POSES) {
    const p = path.join(OUT_DIR, `${id}_${pose}.png`);
    if (fs.existsSync(p) && fs.statSync(p).size > 500) {
      presentPoses.push(pose);
    } else {
      missingPoses.push(pose);
    }
  }

  const hasAllPoses  = missingPoses.length === 0;
  const hasAnyPose   = presentPoses.length > 0;
  const enrolled     = enrolledIds.has(id);

  if (!hasAnyPose) {
    results.missingSprites.push({ id, name, type, presentPoses, missingPoses });
  } else if (!hasAllPoses) {
    results.partialSprites.push({ id, name, type, presentPoses, missingPoses });
    if (!enrolled) results.notEnrolled.push({ id, name, type });
  } else {
    if (!enrolled) {
      results.notEnrolled.push({ id, name, type });
    } else {
      results.ok.push({ id, name, type });
    }
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const totalChars = allChars.length;
const totalOk    = results.ok.length;

console.log(`\nM-S21 Sprite Verification`);
console.log(`=========================`);
console.log(`Characters checked: ${totalChars} (${npcs.length} NPCs + ${enemies.length} enemies)`);
console.log(`All 9 poses + enrolled: ${totalOk}`);
console.log(`Missing (no poses at all): ${results.missingSprites.length}`);
console.log(`Partial (some poses): ${results.partialSprites.length}`);
console.log(`Not enrolled in open batch: ${results.notEnrolled.length}`);

if (results.missingSprites.length > 0) {
  console.log(`\nMISSING SPRITES:`);
  results.missingSprites.forEach(c => {
    console.log(`  [${c.type}] ${c.id} — ${c.name}`);
  });
}

if (results.partialSprites.length > 0) {
  console.log(`\nPARTIAL SPRITES (some poses present):`);
  results.partialSprites.forEach(c => {
    console.log(`  [${c.type}] ${c.id} — ${c.name}`);
    console.log(`    present: ${c.presentPoses.join(', ')}`);
    console.log(`    missing: ${c.missingPoses.join(', ')}`);
  });
}

if (results.notEnrolled.length > 0) {
  console.log(`\nNOT ENROLLED in open review batch:`);
  results.notEnrolled.forEach(c => {
    console.log(`  [${c.type}] ${c.id}`);
  });
}

if (REPORT || results.ok.length > 0) {
  console.log(`\nOK:`);
  results.ok.forEach(c => {
    console.log(`  [${c.type}] ${c.id} — ${c.name}`);
  });
}

const pass = results.missingSprites.length === 0 &&
             results.notEnrolled.length === 0 &&
             results.partialSprites.length === 0;

console.log(`\nVerification: ${pass ? 'PASS' : 'FAIL (see above)'}`);
process.exit(pass ? 0 : 1);
