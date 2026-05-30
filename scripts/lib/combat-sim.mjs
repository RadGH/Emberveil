/**
 * scripts/lib/combat-sim.mjs
 *
 * Headless combat simulator API — M301.
 *
 * Wraps the existing src/game/simulator.js (ESM) via dynamic import so that
 * scripts running under Node 18+ can call it without a Vite build step.
 * The game modules are ESM-only; Node 18 supports top-level await + dynamic
 * import so this shim just re-exports the core API with a batch helper on top.
 *
 * Usage:
 *   import { runCombat, runBatch } from './lib/combat-sim.mjs';
 *
 *   const result = await runCombat({ attackers, defenders, opts });
 *   const batch  = await runBatch({ scenarios, runs: 200 });
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const GAME_ROOT  = path.resolve(__dirname, '../../');
const SRC_ROOT   = path.join(GAME_ROOT, 'src');

// ---------------------------------------------------------------------------
// Shim: browser globals the ESM modules touch at import time.
// We only need the subset actually evaluated by simulator.js + formulas.js.
// ---------------------------------------------------------------------------
async function _installShims() {
  if (typeof globalThis.crypto === 'undefined') {
    const { webcrypto } = await import('node:crypto');
    globalThis.crypto = webcrypto;
  }
  // document / window — some modules guard with typeof, others don't.
  if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
      documentElement: { style: {} },
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => ({ forEach: () => {} }),
      createElement: () => ({ style: {}, appendChild: () => {}, setAttribute: () => {} }),
      head: { appendChild: () => {} },
      body: { appendChild: () => {} },
    };
  }
  if (typeof globalThis.window === 'undefined') {
    globalThis.window = globalThis;
  }
  if (typeof globalThis.localStorage === 'undefined') {
    const _store = new Map();
    globalThis.localStorage = {
      getItem: k => _store.get(k) ?? null,
      setItem: (k, v) => _store.set(k, String(v)),
      removeItem: k => _store.delete(k),
      clear: () => _store.clear(),
    };
  }
  // getComputedStyle used by getRarityColor in items.js
  if (typeof globalThis.getComputedStyle === 'undefined') {
    globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });
  }
}

await _installShims();

// Dynamic-import the game ESM modules.  Node resolves from the path we give.
const simModule  = await import(path.join(SRC_ROOT, 'game/simulator.js'));
const { runSimulation, runMonteCarlo, heroToCombatant, encounterToCombatants, mulberry32 } = simModule;

export { runSimulation, runMonteCarlo, heroToCombatant, encounterToCombatants, mulberry32 };

// ---------------------------------------------------------------------------
// Statistics helpers
// ---------------------------------------------------------------------------

function _mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function _median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function _stdDev(arr, mean) {
  if (arr.length < 2) return 0;
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

function _aggregateRuns(runResults) {
  const wins      = runResults.filter(r => r.winner === 'party').length;
  const rounds    = runResults.map(r => r.rounds);
  const totalDmgs = runResults.map(r =>
    r.log.filter(e => e.type === 'hit').reduce((s, e) => s + e.dmg, 0)
  );
  const meanRounds = _mean(rounds);
  const meanDmg    = _mean(totalDmgs);
  return {
    runs:        runResults.length,
    winRate:     wins / runResults.length,
    meanRounds,
    medianRounds: _median(rounds),
    stdDevRounds: _stdDev(rounds, meanRounds),
    meanDamage:  meanDmg,
    medianDamage: _median(totalDmgs),
    stdDevDamage: _stdDev(totalDmgs, meanDmg),
  };
}

// ---------------------------------------------------------------------------
// runCombat — single encounter, optionally multi-seed
// ---------------------------------------------------------------------------

/**
 * Run one combat scenario.
 *
 * @param {Object}   opts
 * @param {Object[]} opts.attackers  - hero/member objects (same shape as party members)
 * @param {Object}   opts.defenders  - encounter object { enemies: [{...stats, count}] }
 * @param {Object}   [opts.opts]     - { act, seed, maxRounds }
 * @returns {{ winner, rounds, damageBreakdown, trace, stats }}
 */
export async function runCombat({ attackers, defenders, opts = {} }) {
  const { act = 1, seed = 1, maxRounds = 50 } = opts;
  const result = runSimulation({ heroes: attackers, encounter: defenders, act, seed, maxRounds });

  // Build damageBreakdown: per-hero total damage dealt
  const damageByActor = {};
  for (const entry of result.log) {
    if (entry.type === 'hit') {
      damageByActor[entry.actor] = (damageByActor[entry.actor] || 0) + entry.dmg;
    }
  }

  return {
    winner:          result.winner,
    rounds:          result.rounds,
    damageBreakdown: damageByActor,
    trace:           result.log,
    stats:           result.stats,
  };
}

// ---------------------------------------------------------------------------
// runBatch — N scenarios, aggregate stats per scenario
// ---------------------------------------------------------------------------

/**
 * Run a batch of scenarios, each with `runs` Monte-Carlo iterations.
 *
 * @param {Object}   opts
 * @param {Array}    opts.scenarios  - array of { id, label, attackers, defenders, act, seed? }
 * @param {number}   [opts.runs=200] - iterations per scenario
 * @returns {Object[]} array of per-scenario aggregated stats
 */
export async function runBatch({ scenarios, runs = 200 }) {
  const results = [];
  for (const sc of scenarios) {
    const { id, label, attackers, defenders, act = 1, seed = 1 } = sc;
    const runResults = [];
    for (let i = 0; i < runs; i++) {
      const r = runSimulation({ heroes: attackers, encounter: defenders, act, seed: seed + i });
      runResults.push(r);
    }
    const agg = _aggregateRuns(runResults);
    results.push({ id, label, act, ...agg });
  }
  return results;
}
