#!/usr/bin/env node
// M2 — Headless full-run simulator CLI.
//
// Usage:
//   node sim/index.js                                # all 3 policies, 100 iters, seed=1
//   node sim/index.js --policy=balanced --iters=100 --seed=1
//   node sim/index.js --all --iters=50 --out=sim/reports/run.json
//
// Loads balance.active.json at boot, then plays full runs (act 1 → act 6)
// for each policy and reports death rates / act reached / gold.

import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setBalance } from '../src/game/balance-loader.js';
import { runOne } from './runloop.js';
import { aggregate, formatSummary } from './report.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const gameRoot = resolve(__dirname, '..');

function parseArgs(argv) {
  const args = { policy: null, iters: 100, seed: 1, all: false, out: null };
  for (const a of argv.slice(2)) {
    if (a === '--all') args.all = true;
    else if (a.startsWith('--policy=')) args.policy = a.slice(9);
    else if (a.startsWith('--iters=')) args.iters = parseInt(a.slice(8), 10);
    else if (a.startsWith('--seed=')) args.seed = parseInt(a.slice(7), 10);
    else if (a.startsWith('--out=')) args.out = a.slice(6);
  }
  if (!args.policy && !args.all) args.all = true;
  return args;
}

async function loadPolicy(name) {
  const mod = await import(`./policies/${name}.js`);
  return { name, buildParty: mod.buildParty, rebuildForLevel: mod.rebuildForLevel, meta: mod.policyMeta };
}

function loadBalance() {
  const p = join(gameRoot, 'public/data/balance/balance.active.json');
  const json = JSON.parse(readFileSync(p, 'utf-8'));
  setBalance(json, 'sim-cli');
  return p;
}

async function runPolicy(name, iters, baseSeed) {
  const policy = await loadPolicy(name);
  const results = [];
  for (let i = 0; i < iters; i++) {
    results.push(runOne({ policy, seed: baseSeed + i }));
  }
  return { policy: name, results, summary: aggregate(results) };
}

async function main() {
  const args = parseArgs(process.argv);
  const balancePath = loadBalance();
  console.log(`# Emberveil M2 simulator — balance: ${balancePath}`);
  console.log(`# iters=${args.iters} seed=${args.seed}`);
  console.log('');

  const policies = args.all ? ['balanced', 'greedy-damage', 'greedy-tank'] : [args.policy];
  const all = [];
  const t0 = Date.now();
  for (const p of policies) {
    const res = await runPolicy(p, args.iters, args.seed);
    console.log(formatSummary(res.policy, res.summary));
    all.push(res);
  }
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('');
  console.log(`# elapsed ${elapsed}s`);

  if (args.out) {
    const outPath = resolve(gameRoot, args.out);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      args,
      balancePath,
      results: all,
    }, null, 2));
    console.log(`# wrote ${outPath}`);
  } else {
    // Default: also stash a timestamped report under sim/reports/
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const outPath = join(gameRoot, `sim/reports/${ts}.json`);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify({ timestamp: new Date().toISOString(), args, balancePath, results: all }, null, 2));
    console.log(`# report ${outPath}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
