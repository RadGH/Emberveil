#!/usr/bin/env node
/**
 * build-storyteller-balance.cjs
 *
 * Runs the campaign sim matrix and writes balance data to
 * public/assets/data/story/balance/M<milestone>.json.
 *
 * Usage:
 *   node scripts/build-storyteller-balance.cjs [--seeds N] [--milestone M]
 *
 * Default: 25 seeds per cell (6 storytellers × 4 difficulties = 600 runs).
 * Pass --seeds 100 for the full 2400-run nightly pass.
 *
 * Writes:
 *   public/assets/data/story/balance/M<N>.json
 *   public/assets/data/story/balance/latest.json (always overwritten)
 */

'use strict';

// Polyfill for ESM imports in CJS context via dynamic require
process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || '';

const path = require('path');
const fs   = require('fs');
const { Worker, workerData, parentPort, isMainThread } = require('worker_threads');
const { execSync } = require('child_process');

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf(name);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
}

const SEEDS     = parseInt(getArg('--seeds', '25')) || 25;
const MILESTONE = getArg('--milestone', _getCurrentMilestone());

const STORYTELLERS = ['chronicler', 'ash_prophet', 'warbringer', 'trickster', 'pilgrim', 'iron_judge'];
const DIFFICULTIES = ['relaxed', 'normal', 'hard', 'nightmare'];

const ROOT    = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'assets', 'data', 'story', 'balance');

function _getCurrentMilestone() {
  try {
    const meta = JSON.parse(fs.readFileSync(path.join(ROOT, '..', 'game13_releases', 'game_meta.json'), 'utf8'));
    const releases = meta.releases || {};
    const latest = Math.max(0, ...Object.keys(releases).map(Number));
    return `M${latest + 1}`;
  } catch (_) { return 'M999'; }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// This script is the CJS orchestrator only — the actual worker runs in
// scripts/balance-worker.mjs (ESM) to avoid require()-on-ESM issues.
// The isMainThread guard is kept for safety but the worker branch is unreachable.

// Main thread
async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const cells = {};
  const total = STORYTELLERS.length * DIFFICULTIES.length;
  let done = 0;

  console.log(`\n[build-storyteller-balance] Matrix: ${STORYTELLERS.length} storytellers × ${DIFFICULTIES.length} difficulties × ${SEEDS} seeds = ${total * SEEDS} runs`);

  const promises = [];

  for (const storytellerId of STORYTELLERS) {
    for (const difficulty of DIFFICULTIES) {
      const p = new Promise((resolve, reject) => {
        const workerScript = path.join(__dirname, 'balance-worker.mjs');
        const w = new Worker(workerScript, {
          workerData: { storytellerId, difficulty, seeds: SEEDS, rootDir: ROOT },
        });
        w.on('message', msg => resolve(msg));
        w.on('error', reject);
        w.on('exit', code => { if (code !== 0) resolve({ storytellerId, difficulty, seeds: 0, error: `exit ${code}` }); });
      });
      p.then(result => {
        done++;
        const key = `${storytellerId}_${difficulty}`;
        cells[key] = result;
        const pct = (done / total * 100).toFixed(0);
        process.stdout.write(`\r  [${pct}%] ${storytellerId}/${difficulty}: act1=${Math.round((result.act1Rate||0)*100)}%  `);
      });
      promises.push(p);
    }
  }

  await Promise.all(promises);

  console.log('\n');

  const output = {
    generatedAt:  new Date().toISOString(),
    milestone:    MILESTONE,
    seedCount:    SEEDS,
    storytellers: STORYTELLERS,
    difficulties: DIFFICULTIES,
    cells,
  };

  const outFile    = path.join(OUT_DIR, `${MILESTONE}.json`);
  const latestFile = path.join(OUT_DIR, 'latest.json');

  fs.writeFileSync(outFile, JSON.stringify(output, null, 2));
  fs.writeFileSync(latestFile, JSON.stringify(output, null, 2));

  console.log(`[build-storyteller-balance] Wrote ${outFile}`);

  // Quick threshold summary
  console.log('\n--- Threshold Check (Normal difficulty) ---');
  for (const st of STORYTELLERS) {
    const c = cells[`${st}_normal`];
    if (!c) { console.log(`  ${st}: no data`); continue; }
    const ok1 = (c.act1Rate || 0) >= 0.9;
    const ok3 = (c.act3Rate || 0) >= 0.6;
    console.log(`  ${st}: act1=${Math.round((c.act1Rate||0)*100)}% ${ok1?'PASS':'FAIL'} | act3=${Math.round((c.act3Rate||0)*100)}% ${ok3?'PASS':'FAIL'}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
