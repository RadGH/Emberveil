#!/usr/bin/env node
/**
 * scripts/playthrough-sim.mjs — M301 Task 11
 *
 * Seeded RNG. Runs a full Act 1 -> Act 5 playthrough using the headless combat
 * sim + map navigation logic. Detects softlocks, logs per-act stats (turns to
 * clear, items found, deaths), and writes:
 *   public/assets/data/playthrough-results.json
 *
 * Usage:
 *   node scripts/playthrough-sim.mjs
 *   node scripts/playthrough-sim.mjs --seed=42
 *   node scripts/playthrough-sim.mjs --seed=42 --max-acts=3
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const GAME_ROOT  = path.resolve(__dirname, '../');

// Browser shims
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
if (typeof globalThis.crypto === 'undefined') {
  const { webcrypto } = await import('node:crypto');
  globalThis.crypto = webcrypto;
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
if (typeof globalThis.getComputedStyle === 'undefined') {
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });
}

const { runSimulation, autoAssignAttrs, autoGenerateEquipment, mulberry32 } =
  await import(path.join(GAME_ROOT, 'src/game/simulator.js'));
const { ENCOUNTERS, ACT1_ZONES, ACT2_ZONES, ACT3_ZONES, ACT4_ZONES, ACT5_ZONES } =
  await import(path.join(GAME_ROOT, 'src/maps/mapData.js'));
const { AFFIXES_ACT1, WEAPON_BASES, ARMOR_BASES, generateItem, RARITIES, QUALITIES } =
  await import(path.join(GAME_ROOT, 'src/game/items.js'));

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; })
);
const SEED     = parseInt(args.seed     ?? '42', 10);
const MAX_ACTS = parseInt(args['max-acts'] ?? '5', 10);

const rng = mulberry32(SEED);

// ---------------------------------------------------------------------------
// Party builder
// ---------------------------------------------------------------------------
function buildParty(act) {
  const level  = act === 1 ? 5 : act === 2 ? 10 : act === 3 ? 15 : act === 4 ? 20 : 25;
  const configs = [
    { classId: 'warrior', id: 'p_warrior' },
    { classId: 'mage',    id: 'p_mage'    },
    { classId: 'cleric',  id: 'p_cleric'  },
  ];
  return configs.map(cfg => ({
    id:        cfg.id,
    name:      cfg.classId.charAt(0).toUpperCase() + cfg.classId.slice(1),
    class:     cfg.classId,
    cls:       cfg.classId,
    level,
    attrs:     autoAssignAttrs(cfg.classId, level),
    equipment: autoGenerateEquipment(cfg.classId, level),
    skills:    [],
    hp:        null,  // computed by sim
    mp:        null,
  }));
}

// ---------------------------------------------------------------------------
// Zone walker
// ---------------------------------------------------------------------------
const ALL_BASE_KEYS = [...Object.keys(WEAPON_BASES), ...Object.keys(ARMOR_BASES)];

function walkZone(zone, party, act, globalRng, trace) {
  const actStats = { zoneId: zone.id, actNum: act, nodesVisited: 0, combats: 0, wins: 0, losses: 0, deaths: 0, itemsFound: 0, rounds: 0, softlock: false };
  const nodes = zone.nodes || [];
  if (!nodes.length) return actStats;

  // Build adjacency map
  const nodeMap = {};
  for (const n of nodes) nodeMap[n.id] = n;

  const startNode = nodes[0];
  let current = startNode;
  const visited = new Set([startNode.id]);
  const MAX_STEPS = nodes.length * 4;  // prevent infinite loops
  let steps = 0;

  while (steps++ < MAX_STEPS) {
    if (!current) break;

    actStats.nodesVisited++;
    trace.push({ type: 'node', zone: zone.id, node: current.id, nodeType: current.type });

    if (current.type === 'combat' || current.type === 'boss' || current.type === 'ambush' || current.type === 'challenge') {
      const encId = current.encounter;
      const enc   = encId ? ENCOUNTERS[encId] : null;
      if (enc) {
        actStats.combats++;
        const combatSeed = SEED + actStats.combats * 1000 + steps;
        const result = runSimulation({ heroes: party, encounter: enc, act, seed: combatSeed });
        actStats.rounds += result.rounds;
        if (result.winner === 'party') {
          actStats.wins++;
        } else {
          actStats.losses++;
          // Count defeated heroes as deaths
          const deadCount = result.party.filter(h => !h.alive).length;
          actStats.deaths += deadCount;
          trace.push({ type: 'defeat', zone: zone.id, node: current.id, encounter: encId, rounds: result.rounds });
          // On defeat, party limps to next node (sim-equivalent of "return to town")
        }
        trace.push({ type: 'combat', zone: zone.id, node: current.id, encounter: encId, winner: result.winner, rounds: result.rounds });
      }
    }

    if (current.type === 'treasure' || current.type === 'challenge') {
      // Simulate finding 1-3 items
      const count = 1 + Math.floor(globalRng() * 3);
      for (let i = 0; i < count; i++) {
        const baseKey = ALL_BASE_KEYS[Math.floor(globalRng() * ALL_BASE_KEYS.length)];
        const rarIdx  = Math.floor(globalRng() * (act + 1));
        const rarity  = RARITIES[Math.min(rarIdx, RARITIES.length - 1)];
        try { generateItem(baseKey, rarity, 'medium', AFFIXES_ACT1); actStats.itemsFound++; } catch {}
      }
    }

    // Navigate to next unvisited node via exits
    const exits = (current.exits || []).map(id => nodeMap[id]).filter(Boolean);
    const unvisited = exits.filter(n => !visited.has(n.id));

    let next = null;
    if (unvisited.length > 0) {
      // Prefer nodes that look like progression (boss > combat > others)
      const order = ['boss', 'combat', 'ambush', 'challenge', 'shrine', 'dialog', 'town', 'treasure', 'lore'];
      unvisited.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
      next = unvisited[0];
    } else if (exits.length > 0) {
      // All exits visited — pick one we haven't been to recently (or if all visited, done)
      const notJustVisited = exits.filter(n => n.id !== current.id);
      if (notJustVisited.length > 0 && notJustVisited[0].type === 'boss') {
        next = notJustVisited[0];
      }
    }

    if (!next) {
      // Check if we've reached an end node (no exits or only boss defeated)
      const isBossNode = current.type === 'boss';
      if (isBossNode) {
        trace.push({ type: 'zone_complete', zone: zone.id });
        break;
      }
      // Potential softlock: no reachable unvisited node and not at boss
      if (exits.length === 0) {
        trace.push({ type: 'zone_complete', zone: zone.id });
        break;
      }
      // Re-visit — this can happen in branching graphs. Break to prevent infinite.
      actStats.softlock = true;
      trace.push({ type: 'softlock', zone: zone.id, node: current.id, reason: 'No unvisited exits and not at boss' });
      break;
    }

    visited.add(next.id);
    current = next;
  }

  if (steps >= MAX_STEPS) {
    actStats.softlock = true;
    trace.push({ type: 'softlock', zone: zone.id, node: current?.id, reason: `Exceeded ${MAX_STEPS} steps` });
  }

  return actStats;
}

// ---------------------------------------------------------------------------
// Main playthrough
// ---------------------------------------------------------------------------
const ACT_ZONES = [ACT1_ZONES, ACT2_ZONES, ACT3_ZONES, ACT4_ZONES, ACT5_ZONES];
const actResults = [];
const globalTrace = [];
let totalDeaths = 0;
let totalItems  = 0;
let totalRounds = 0;
let softlockDetected = false;

for (let actIdx = 0; actIdx < Math.min(MAX_ACTS, 5); actIdx++) {
  const act   = actIdx + 1;
  const zones = ACT_ZONES[actIdx] || [];
  const party = buildParty(act);

  console.log(`\nAct ${act}: ${zones.length} zone(s)`);

  const actSummary = { act, zones: [], totalCombats: 0, totalWins: 0, totalLosses: 0, totalDeaths: 0, totalRounds: 0, totalItems: 0, softlock: false };

  for (const zone of zones) {
    const zoneStats = walkZone(zone, party, act, rng, globalTrace);
    actSummary.zones.push(zoneStats);
    actSummary.totalCombats += zoneStats.combats;
    actSummary.totalWins    += zoneStats.wins;
    actSummary.totalLosses  += zoneStats.losses;
    actSummary.totalDeaths  += zoneStats.deaths;
    actSummary.totalRounds  += zoneStats.rounds;
    actSummary.totalItems   += zoneStats.itemsFound;
    if (zoneStats.softlock) actSummary.softlock = true;

    const winPct = zoneStats.combats > 0 ? Math.round(zoneStats.wins / zoneStats.combats * 100) : 'n/a';
    console.log(`  ${zone.id}: ${zoneStats.combats} combats, ${winPct}% win, ${zoneStats.rounds} rounds, ${zoneStats.itemsFound} items${zoneStats.softlock ? ' [SOFTLOCK]' : ''}`);
  }

  totalDeaths += actSummary.totalDeaths;
  totalItems  += actSummary.totalItems;
  totalRounds += actSummary.totalRounds;
  if (actSummary.softlock) softlockDetected = true;

  actResults.push(actSummary);
}

const out = {
  generated:        new Date().toISOString(),
  seed:             SEED,
  maxActs:          MAX_ACTS,
  acts:             actResults,
  totals: {
    combats:  actResults.reduce((s, a) => s + a.totalCombats, 0),
    wins:     actResults.reduce((s, a) => s + a.totalWins,    0),
    losses:   actResults.reduce((s, a) => s + a.totalLosses,  0),
    rounds:   totalRounds,
    deaths:   totalDeaths,
    items:    totalItems,
  },
  softlockDetected,
  trace: globalTrace,
};

const outPath = path.join(GAME_ROOT, 'public/assets/data/playthrough-results.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

console.log(`\n=== Playthrough complete ===`);
console.log(`Seed: ${SEED} | Acts: ${MAX_ACTS} | Rounds: ${totalRounds} | Deaths: ${totalDeaths} | Items: ${totalItems}`);
if (softlockDetected) console.warn('WARNING: Softlock detected! See playthrough-results.json for details.');
console.log(`Wrote ${outPath}`);
