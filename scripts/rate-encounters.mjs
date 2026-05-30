#!/usr/bin/env node
/**
 * scripts/rate-encounters.mjs — M301 Task 4
 *
 * Runs the headless combat sim against every encounter in mapData.js using a
 * typical party profile for the encounter's act, and writes per-encounter
 * predicted win-rate + difficulty tier to:
 *   public/assets/data/encounter-ratings.json
 *
 * Usage:
 *   node scripts/rate-encounters.mjs
 *   node scripts/rate-encounters.mjs --runs=200
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const GAME_ROOT  = path.resolve(__dirname, '../');

// Install shims
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

const { runSimulation, autoAssignAttrs, autoGenerateEquipment } = await import(path.join(GAME_ROOT, 'src/game/simulator.js'));
const { ENCOUNTERS } = await import(path.join(GAME_ROOT, 'src/maps/mapData.js'));

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; })
);
const RUNS     = parseInt(args.runs ?? '100', 10);
const BASE_SEED = 42;

// Act -> typical party level mapping
const ACT_LEVELS = { 1: 5, 2: 10, 3: 15, 4: 20, 5: 25, 6: 28 };

// Build a balanced 3-person party for the given act
function buildDefaultParty(act) {
  const level = ACT_LEVELS[act] ?? 5;
  const members = [
    { classId: 'warrior', id: 'warrior_0' },
    { classId: 'mage',    id: 'mage_0'    },
    { classId: 'cleric',  id: 'cleric_0'  },
  ];
  return members.map(m => ({
    id: m.id,
    name: m.classId.charAt(0).toUpperCase() + m.classId.slice(1),
    class: m.classId,
    cls:   m.classId,
    level,
    attrs: autoAssignAttrs(m.classId, level),
    equipment: autoGenerateEquipment(m.classId, level),
  }));
}

// Difficulty tier from win-rate
function difficultyTier(winRate) {
  if (winRate >= 0.75) return 'easy';
  if (winRate >= 0.55) return 'normal';
  if (winRate >= 0.35) return 'hard';
  return 'deadly';
}

// Color hint (for the page rendering)
function tierColor(tier) {
  return { easy: '#60c060', normal: '#e0c020', hard: '#e08020', deadly: '#e04040' }[tier] || '#c0c0c0';
}

// Attempt to guess the act for an encounter from its id/name
// (mapData groups them but doesn't tag each encounter with an act).
// We use a heuristic keyword map.
function guessAct(encId, encData) {
  const id = encId.toLowerCase();
  // Act-specific keywords
  if (/goblin|bandit|spider|wolf|thornwood|border|prologue/.test(id)) return 1;
  if (/ash|veil|cult|obsidian|lava|dust|cinder/.test(id)) return 2;
  if (/demon|hell|inferno|archfiend|imp|devil|shattered|rift/.test(id)) return 3;
  if (/void|cosmic|unravel|null|abyss/.test(id)) return 4;
  if (/primordial|genesis|deep|titan/.test(id)) return 5;
  if (/dragon|wyrm|drake/.test(id)) return 6;
  return 1; // fallback
}

const encIds = Object.keys(ENCOUNTERS);
console.log(`rate-encounters: rating ${encIds.length} encounters, ${RUNS} runs each...`);

const ratings = [];
let idx = 0;
for (const encId of encIds) {
  idx++;
  const encounter = ENCOUNTERS[encId];
  const act       = guessAct(encId, encounter);
  const party     = buildDefaultParty(act);

  let wins = 0, totalRounds = 0;
  for (let i = 0; i < RUNS; i++) {
    const r = runSimulation({ heroes: party, encounter, act, seed: BASE_SEED + i });
    if (r.winner === 'party') wins++;
    totalRounds += r.rounds;
  }

  const winRate  = wins / RUNS;
  const avgRounds = totalRounds / RUNS;
  const tier     = difficultyTier(winRate);

  ratings.push({
    id:          encId,
    name:        encounter.name || encId,
    act,
    runs:        RUNS,
    winRate,
    winRatePct:  Math.round(winRate * 100),
    avgRounds:   parseFloat(avgRounds.toFixed(1)),
    difficulty:  tier,
    color:       tierColor(tier),
    partyLevel:  ACT_LEVELS[act] ?? 5,
  });

  if (idx % 10 === 0 || idx === encIds.length) {
    process.stdout.write(`  ${idx}/${encIds.length}\r`);
  }
}
process.stdout.write('\n');

const out = {
  generated: new Date().toISOString(),
  runs: RUNS,
  ratings,
};

const outPath = path.join(GAME_ROOT, 'public/assets/data/encounter-ratings.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`Wrote ${outPath} (${ratings.length} encounters)`);
