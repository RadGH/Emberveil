#!/usr/bin/env node
/**
 * scripts/batch-rebalance.mjs — M301 Task 2
 *
 * Reads a scenarios JSON file, runs each variant through the headless combat
 * sim (parallelised via worker_threads up to 4 workers), then writes:
 *   public/assets/data/batch-rebalance.json
 *   public/assets/data/batch-rebalance.csv
 *
 * Also writes a timestamped snapshot to:
 *   public/assets/rebalance_snapshots/<ISO-date>T<time>.json
 * so check-regression.mjs can compare across runs.
 *
 * Usage:
 *   node scripts/batch-rebalance.mjs
 *   node scripts/batch-rebalance.mjs --scenarios=scripts/scenarios/skill-tweaks.json
 *   node scripts/batch-rebalance.mjs --scenarios=scripts/scenarios/skill-tweaks.json --runs=400
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const GAME_ROOT  = path.resolve(__dirname, '../');

// Parse CLI args
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; })
);
const SCENARIOS_FILE = args.scenarios || path.join(__dirname, 'scenarios/skill-tweaks.json');
const OVERRIDE_RUNS  = args.runs ? parseInt(args.runs, 10) : null;

// ---------------------------------------------------------------------------
// Worker thread — does the actual simulation work to avoid blocking the main thread.
// ---------------------------------------------------------------------------
if (!isMainThread) {
  // Install browser shims in worker thread too
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
  if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
  if (typeof globalThis.localStorage === 'undefined') {
    const _store = new Map();
    globalThis.localStorage = {
      getItem: k => _store.get(k) ?? null,
      setItem: (k, v) => _store.set(k, String(v)),
      removeItem: k => _store.delete(k),
      clear: () => _store.clear(),
    };
  }
  if (typeof globalThis.getComputedStyle === 'undefined') {
    globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });
  }

  const { runSimulation } = await import(path.join(GAME_ROOT, 'src/game/simulator.js'));
  const { ENCOUNTERS }    = await import(path.join(GAME_ROOT, 'src/maps/mapData.js'));
  const { CLASSES }       = await import(path.join(GAME_ROOT, 'src/game/classes.js'));
  const { autoAssignAttrs, autoGenerateEquipment } = await import(path.join(GAME_ROOT, 'src/game/simulator.js'));

  const { scenario, runs, seed } = workerData;

  // Build party from template string or inline definition
  function buildParty(template) {
    if (!template) {
      // Minimal fallback: single warrior L5
      return [{
        id: 'warrior_0', name: 'Warrior', class: 'warrior', cls: 'warrior', level: 5,
        attrs: { STR: 18, DEX: 10, INT: 8, CON: 14 }, equipment: {},
      }];
    }
    if (typeof template === 'string') {
      // Parse template like "default_warrior_l5", "default_mage_l10"
      const m = template.match(/default_(\w+)_l(\d+)/i);
      if (!m) return [];
      const classId = m[1];
      const level   = parseInt(m[2], 10);
      const attrs   = autoAssignAttrs(classId, level);
      const equipment = autoGenerateEquipment(classId, level);
      return [{ id: 'hero_0', name: classId.charAt(0).toUpperCase() + classId.slice(1), class: classId, cls: classId, level, attrs, equipment }];
    }
    if (Array.isArray(template)) return template;
    return [];
  }

  const encounter = ENCOUNTERS[scenario.encounter];
  if (!encounter) {
    parentPort.postMessage({ error: `Unknown encounter: ${scenario.encounter}` });
    process.exit(0);
  }

  const party = buildParty(scenario.partyTemplate || scenario.attackers);
  if (!party.length) {
    parentPort.postMessage({ error: `Could not build party for ${scenario.id}` });
    process.exit(0);
  }

  const baseSeed = scenario.seed ?? seed ?? 42;
  const act      = scenario.act ?? 1;

  let wins = 0, totalRounds = 0;
  const dmgSamples = [], roundSamples = [];
  const actWinRate = { [act]: 0 };

  for (let i = 0; i < runs; i++) {
    const r = runSimulation({ heroes: party, encounter, act, seed: baseSeed + i });
    if (r.winner === 'party') wins++;
    totalRounds += r.rounds;
    roundSamples.push(r.rounds);
    const totalDmg = r.log.filter(e => e.type === 'hit').reduce((s, e) => s + e.dmg, 0);
    dmgSamples.push(totalDmg);
  }

  const mean = arr => arr.reduce((s, v) => s + v, 0) / (arr.length || 1);
  const median = arr => {
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
  };
  const stdDev = (arr, mu) => Math.sqrt(arr.reduce((s, v) => s + (v - mu) ** 2, 0) / (arr.length || 1));

  const winRate    = wins / runs;
  const meanRounds = mean(roundSamples);
  const meanDmg    = mean(dmgSamples);

  parentPort.postMessage({
    id:           scenario.id,
    label:        scenario.label,
    encounter:    scenario.encounter,
    act,
    runs,
    winRate,
    meanRounds,
    medianRounds: median(roundSamples),
    stdDevRounds: stdDev(roundSamples, meanRounds),
    meanDamage:   meanDmg,
    medianDamage: median(dmgSamples),
    stdDevDamage: stdDev(dmgSamples, meanDmg),
    actWinRates:  { [act]: winRate },
  });
}

// ---------------------------------------------------------------------------
// Main thread
// ---------------------------------------------------------------------------
if (isMainThread) {
  const OUT_DIR      = path.join(GAME_ROOT, 'public/assets/data');
  const SNAP_DIR     = path.join(GAME_ROOT, 'public/assets/rebalance_snapshots');
  const JSON_OUT     = path.join(OUT_DIR, 'batch-rebalance.json');
  const CSV_OUT      = path.join(OUT_DIR, 'batch-rebalance.csv');

  fs.mkdirSync(OUT_DIR,  { recursive: true });
  fs.mkdirSync(SNAP_DIR, { recursive: true });

  // Load scenarios file
  if (!fs.existsSync(SCENARIOS_FILE)) {
    console.error(`Scenarios file not found: ${SCENARIOS_FILE}`);
    process.exit(1);
  }
  const scenariosSpec = JSON.parse(fs.readFileSync(SCENARIOS_FILE, 'utf8'));
  const defaults      = scenariosSpec.defaults || {};
  const scenarios     = scenariosSpec.scenarios || [];
  const RUNS          = OVERRIDE_RUNS ?? defaults.runs ?? 200;

  if (!scenarios.length) {
    console.error('No scenarios found in', SCENARIOS_FILE);
    process.exit(1);
  }

  console.log(`batch-rebalance: ${scenarios.length} scenario(s), ${RUNS} runs each, up to 4 workers`);

  // Run scenarios in parallel (max 4 workers)
  const MAX_WORKERS = 4;
  const results     = [];
  const queue       = [...scenarios];
  let   active      = 0;

  await new Promise((resolve, reject) => {
    function spawnNext() {
      if (!queue.length && active === 0) { resolve(); return; }
      while (active < MAX_WORKERS && queue.length) {
        const scenario = queue.shift();
        active++;
        const worker = new Worker(__filename, {
          workerData: { scenario, runs: RUNS, seed: defaults.seed ?? 42 },
        });
        worker.on('message', msg => {
          if (msg.error) {
            console.warn(`  [WARN] ${scenario.id}: ${msg.error}`);
          } else {
            results.push(msg);
            console.log(`  [OK]  ${msg.id}: win=${(msg.winRate * 100).toFixed(1)}%  rounds=${msg.meanRounds.toFixed(1)}`);
          }
          active--;
          spawnNext();
        });
        worker.on('error', err => {
          console.error(`  [ERR] ${scenario.id}:`, err.message);
          active--;
          spawnNext();
        });
      }
    }
    spawnNext();
  });

  // Sort results back to scenario order
  const idxMap = Object.fromEntries(scenarios.map((s, i) => [s.id, i]));
  results.sort((a, b) => (idxMap[a.id] ?? 999) - (idxMap[b.id] ?? 999));

  const report = {
    generated:  new Date().toISOString(),
    scenariosFile: SCENARIOS_FILE,
    runs:       RUNS,
    results,
  };

  // Write JSON output
  fs.writeFileSync(JSON_OUT, JSON.stringify(report, null, 2));
  console.log(`\nWrote ${JSON_OUT}`);

  // Write CSV output
  const csvHeader = 'id,label,encounter,act,runs,winRate,meanRounds,medianRounds,stdDevRounds,meanDamage,medianDamage,stdDevDamage';
  const csvRows = results.map(r =>
    [
      r.id, `"${(r.label||'').replace(/"/g,'""')}"`, r.encounter || '', r.act, r.runs,
      r.winRate.toFixed(4), r.meanRounds.toFixed(2), r.medianRounds.toFixed(2), r.stdDevRounds.toFixed(2),
      r.meanDamage.toFixed(1), r.medianDamage.toFixed(1), r.stdDevDamage.toFixed(1),
    ].join(',')
  );
  fs.writeFileSync(CSV_OUT, [csvHeader, ...csvRows].join('\n'));
  console.log(`Wrote ${CSV_OUT}`);

  // Write snapshot
  const snapName = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '.json';
  const snapPath = path.join(SNAP_DIR, snapName);
  fs.writeFileSync(snapPath, JSON.stringify(report, null, 2));
  console.log(`Snapshot → ${snapPath}`);
}
