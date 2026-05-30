#!/usr/bin/env node
/**
 * approve-story-dialogue.cjs — M-S20
 *
 * Merges generated dialog nodes from data/story/_generated/<pool>.json
 * into the live data/story/dialogue-pools/<pool>.json.
 *
 * Auto-approves everything in _generated/ that passed the generator's
 * validator. Hand-authored seeds are kept first; generated nodes are
 * appended after.
 *
 * Usage:
 *   node scripts/approve-story-dialogue.cjs [--pool <name>] [--dry-run]
 *
 * After merging, run:
 *   node scripts/build-story-content-manifest.cjs
 * to verify the full content manifest is clean.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT    = path.resolve(__dirname, '..');
const GEN_DIR = path.join(ROOT, 'data', 'story', '_generated');
const POOL_DIR = path.join(ROOT, 'data', 'story', 'dialogue-pools');

const ALL_POOLS = ['arrival', 'ambush', 'shrine', 'merchant', 'lore', 'faction', 'side-quest'];

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { return null; }
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const poolArg = args.includes('--pool') ? args[args.indexOf('--pool') + 1] : null;

  const pools = poolArg ? [poolArg] : ALL_POOLS;

  let totalMerged = 0;

  for (const pool of pools) {
    const genPath  = path.join(GEN_DIR, `${pool}.json`);
    const livePath = path.join(POOL_DIR, `${pool}.json`);

    if (!fs.existsSync(genPath)) {
      console.log(`[${pool}] no _generated file — skipping`);
      continue;
    }

    const generated = loadJson(genPath);
    if (!Array.isArray(generated) || generated.length === 0) {
      console.log(`[${pool}] _generated file is empty — skipping`);
      continue;
    }

    // Load live pool
    const liveData = loadJson(livePath) || { nodes: [] };
    const existingNodes = liveData.nodes || [];

    // Build a set of existing IDs to avoid duplicates
    const existingIds = new Set(existingNodes.map(n => n.id));

    // Filter out duplicates
    const newNodes = generated.filter(n => n.id && !existingIds.has(n.id));

    if (newNodes.length === 0) {
      console.log(`[${pool}] all ${generated.length} generated nodes already exist in live pool`);
      continue;
    }

    const merged = {
      ...liveData,
      nodes: [...existingNodes, ...newNodes],
    };

    console.log(`[${pool}] merging ${newNodes.length} nodes (${existingNodes.length} existing + ${newNodes.length} new = ${merged.nodes.length} total)`);

    if (!dryRun) {
      fs.writeFileSync(livePath, JSON.stringify(merged, null, 2));
      console.log(`[${pool}] written to ${livePath}`);
    } else {
      console.log(`[${pool}] DRY RUN — would write ${merged.nodes.length} nodes to ${livePath}`);
    }

    totalMerged += newNodes.length;
  }

  console.log(`\nTotal merged: ${totalMerged} nodes`);

  if (!dryRun) {
    console.log('\nRun: node scripts/build-story-content-manifest.cjs');
  }
}

main();
