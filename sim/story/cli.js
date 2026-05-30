#!/usr/bin/env node
/**
 * sim/story/cli.js — Headless Story Mode campaign simulator CLI.
 *
 * Usage:
 *   node sim/story/cli.js \
 *     --seeds 10 \
 *     --seedStart 1 \
 *     --storyteller chronicler \
 *     --difficulty normal \
 *     --policy deterministic \
 *     --maxNodes 250 \
 *     --out /tmp/sim-out.json \
 *     --workers 4
 *
 * --seeds N          Number of seeds to simulate (starting from --seedStart). Default: 1.
 * --seedStart N      First seed value. Default: 1.
 * --storyteller id|all  Storyteller id or "all" for all 6. Default: chronicler.
 * --difficulty id|all   Difficulty or "all" for all 5. Default: normal.
 * --policy name      Policy: deterministic | greedy | storyFirst | explorer | combatHeavy | directorAware | random. Default: deterministic.
 * --maxNodes N       Max nodes per campaign. Default: 250.
 * --out path         Output JSON file path. Default: /tmp/story-sim-out.json.
 * --workers N        Worker thread count. Default: CPU count - 1, min 1.
 */

import { parseArgs } from 'node:util';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// Known storyteller / difficulty ids
// ---------------------------------------------------------------------------
const ALL_STORYTELLERS = ['chronicler', 'ash_prophet', 'warbringer', 'trickster', 'pilgrim', 'iron_judge'];
const ALL_DIFFICULTIES = ['relaxed', 'normal', 'hard', 'brutal', 'iron_judge'];

const POLICY_NAMES = ['deterministic', 'greedy', 'storyFirst', 'explorer', 'combatHeavy', 'directorAware', 'random'];

// ---------------------------------------------------------------------------
// Worker path — this same file acts as both the worker and the main thread.
// ---------------------------------------------------------------------------

if (!isMainThread) {
  // ── Worker mode ──────────────────────────────────────────────────────────
  const { jobs } = workerData;

  async function runWorker() {
    // Lazy-import policy and runCampaign inside the worker.
    const { runCampaign } = await import('./runCampaign.js');
    const policies = await loadPolicies();

    const results = [];
    for (const job of jobs) {
      const policy = policies[job.policy] || policies.deterministic;
      try {
        const result = await runCampaign({
          seed: job.seed,
          storyteller: job.storyteller,
          difficulty: job.difficulty,
          policy,
          maxNodes: job.maxNodes,
          recordCombatLogs: false,
        });
        results.push({ ok: true, job, summary: stripLog(result) });
      } catch (err) {
        results.push({ ok: false, job, error: String(err) });
      }
    }

    parentPort.postMessage({ done: true, results });
  }

  runWorker().catch(err => {
    parentPort.postMessage({ done: true, results: [], fatalError: String(err) });
  });

} else {
  // ── Main thread ──────────────────────────────────────────────────────────
  main().catch(err => {
    console.error('CLI fatal error:', err);
    process.exit(1);
  });
}

// ---------------------------------------------------------------------------
// Main thread logic
// ---------------------------------------------------------------------------

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      seeds:       { type: 'string', default: '1' },
      seedStart:   { type: 'string', default: '1' },
      storyteller: { type: 'string', default: 'chronicler' },
      difficulty:  { type: 'string', default: 'normal' },
      policy:      { type: 'string', default: 'deterministic' },
      maxNodes:    { type: 'string', default: '250' },
      out:         { type: 'string', default: '/tmp/story-sim-out.json' },
      workers:     { type: 'string', default: String(Math.max(1, cpus().length - 1)) },
    },
    allowPositionals: true,
  });

  const seedCount  = Math.max(1, Math.min(1000, parseInt(values.seeds, 10) || 1));
  const seedStart  = Math.max(1, parseInt(values.seedStart, 10) || 1);
  const maxNodes   = Math.max(1, parseInt(values.maxNodes, 10) || 250);
  const nWorkers   = Math.max(1, parseInt(values.workers, 10) || 1);
  const outPath    = values.out;
  const policyName = values.policy;

  const storytellers = values.storyteller === 'all' ? ALL_STORYTELLERS : [values.storyteller];
  const difficulties = values.difficulty  === 'all' ? ALL_DIFFICULTIES  : [values.difficulty];

  // Build full job matrix
  const jobs = [];
  for (let i = 0; i < seedCount; i++) {
    for (const storyteller of storytellers) {
      for (const difficulty of difficulties) {
        jobs.push({ seed: seedStart + i, storyteller, difficulty, policy: policyName, maxNodes });
      }
    }
  }

  const totalJobs = jobs.length;
  console.log(`[sim/story/cli] ${totalJobs} jobs | ${nWorkers} worker(s) | policy=${policyName} | maxNodes=${maxNodes}`);

  const startMs = Date.now();
  const allSummaries = [];
  let completed = 0;

  // ── Worker pool ───────────────────────────────────────────────────────────
  // Distribute jobs roughly evenly across workers.
  const chunkSize = Math.ceil(totalJobs / nWorkers);
  const workerPromises = [];

  for (let w = 0; w < nWorkers; w++) {
    const chunk = jobs.slice(w * chunkSize, (w + 1) * chunkSize);
    if (!chunk.length) continue;

    const p = new Promise((resolve, reject) => {
      const worker = new Worker(__filename, { workerData: { jobs: chunk }, type: 'module' });

      worker.on('message', msg => {
        if (msg.done) {
          if (msg.fatalError) {
            reject(new Error(`Worker ${w} fatal: ${msg.fatalError}`));
            return;
          }
          completed += msg.results.length;
          for (const r of msg.results) allSummaries.push(r);
          if (Math.floor(completed / 100) > Math.floor((completed - msg.results.length) / 100)) {
            console.log(`  [progress] ${completed}/${totalJobs} done (${Math.round(completed/totalJobs*100)}%)`);
          }
          resolve();
        }
      });

      worker.on('error', reject);
      worker.on('exit', code => {
        if (code !== 0) reject(new Error(`Worker ${w} exited with code ${code}`));
      });
    });

    workerPromises.push(p);
  }

  await Promise.all(workerPromises);

  const durationMs = Date.now() - startMs;
  const output = {
    args: { seeds: seedCount, seedStart, storytellers, difficulties, policy: policyName, maxNodes, nWorkers },
    generatedAt: new Date().toISOString(),
    durationMs,
    totalJobs,
    summaries: allSummaries,
  };

  writeFileSync(outPath, JSON.stringify(output, null, 2));

  const successful = allSummaries.filter(s => s.ok).length;
  const failed = allSummaries.filter(s => !s.ok).length;
  console.log(`[sim/story/cli] Done in ${(durationMs / 1000).toFixed(1)}s — ${successful} ok, ${failed} failed → ${outPath}`);

  if (failed > 0) {
    console.error('Failed jobs:');
    for (const s of allSummaries.filter(j => !j.ok)) {
      console.error(`  seed=${s.job.seed} storyteller=${s.job.storyteller} difficulty=${s.job.difficulty}: ${s.error}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadPolicies() {
  const [
    { deterministicPolicy },
    { greedyPolicy },
    { storyFirstPolicy },
    { explorerPolicy },
    { combatHeavyPolicy },
    { directorAwarePolicy },
    { mulberry32 },
    { makeRandomPolicy },
  ] = await Promise.all([
    import('./policies/deterministic.js'),
    import('./policies/greedy.js'),
    import('./policies/storyFirst.js'),
    import('./policies/explorer.js'),
    import('./policies/combatHeavy.js'),
    import('./policies/directorAware.js'),
    import('../../src/game/simulator.js'),
    import('./policies/random.js'),
  ]);

  return {
    deterministic: deterministicPolicy,
    greedy:        greedyPolicy,
    storyFirst:    storyFirstPolicy,
    explorer:      explorerPolicy,
    combatHeavy:   combatHeavyPolicy,
    directorAware: directorAwarePolicy,
    random:        makeRandomPolicy(mulberry32(Date.now())),
  };
}

/** Strip full log to save memory/disk in batch runs. */
function stripLog(result) {
  const { log: _log, ...rest } = result;
  return rest;
}
