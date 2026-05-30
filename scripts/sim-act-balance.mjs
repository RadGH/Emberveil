#!/usr/bin/env node
/**
 * sim-act-balance.mjs
 *
 * Headless combat sim with the explicitly requested party:
 *   Fighter / Stormcaller / Cleric / Mage  + a War Dog companion.
 *
 * Runs each Act's representative encounters, prints rounds & survivor HP,
 * so we can iterate on balance numbers and watch the round count rise.
 *
 * Usage:
 *   node scripts/sim-act-balance.mjs
 *   node scripts/sim-act-balance.mjs --runs=20 --seed=1
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// shims
if (typeof globalThis.document === 'undefined') {
  globalThis.document = { documentElement: { style:{} }, getElementById:()=>null,
    querySelector:()=>null, querySelectorAll:()=>({forEach:()=>{}}),
    createElement:()=>({style:{},appendChild:()=>{},setAttribute:()=>{}}),
    head:{appendChild:()=>{}}, body:{appendChild:()=>{}} };
}
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
if (typeof globalThis.crypto === 'undefined') {
  const { webcrypto } = await import('node:crypto');
  globalThis.crypto = webcrypto;
}
if (typeof globalThis.localStorage === 'undefined') {
  const _s = new Map();
  globalThis.localStorage = { getItem:k=>_s.get(k)??null, setItem:(k,v)=>_s.set(k,String(v)),
    removeItem:k=>_s.delete(k), clear:()=>_s.clear() };
}
if (typeof globalThis.getComputedStyle === 'undefined') {
  globalThis.getComputedStyle = () => ({ getPropertyValue:()=>'' });
}

const { runSimulation, autoAssignAttrs, autoGenerateEquipment } =
  await import(path.join(ROOT, 'src/game/simulator.js'));
const { ENCOUNTERS } = await import(path.join(ROOT, 'src/maps/mapData.js'));
const { setBalance } = await import(path.join(ROOT, 'src/game/balance-loader.js'));

// Load the active balance file so the sim mirrors live gameplay.
import fs from 'node:fs';
const balPath = path.join(ROOT, 'public/data/balance/balance.active.json');
if (fs.existsSync(balPath)) {
  try { setBalance(JSON.parse(fs.readFileSync(balPath, 'utf8')), 'active'); }
  catch (e) { console.warn('[sim] failed to load active balance:', e.message); }
}

const args = Object.fromEntries(process.argv.slice(2)
  .filter(a=>a.startsWith('--')).map(a=>{const [k,v]=a.slice(2).split('=');return [k,v??true];}));
const RUNS = parseInt(args.runs ?? '15', 10);
const BASE_SEED = parseInt(args.seed ?? '1', 10);
const NG = parseInt(args.ng ?? '0', 10);

// Per-act party levels mirroring expected progression.
const ACT_LEVELS = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 19 };
const ACT1_START = !!args.act1start; // override Act 1 to L1 hero (prologue context)
// --solo flag: reduce party to a single hero (paladin) to repro low-level wipes.
const SOLO = !!args.solo;
// --ng=1 also triggers full L20 party so NG+ Act 1 is "post-game" combat.
const NG_PARTY_LEVEL = NG > 0 ? 20 : null;

function buildParty(act) {
  const lvl = NG_PARTY_LEVEL || (ACT1_START && act === 1 ? 1 : (ACT_LEVELS[act] || 5));
  const configs = SOLO
    ? [ { id:'p_paladin', classId:'paladin', name:'Paladin' } ]
    : [
        { id:'p_fighter',     classId:'fighter',     name:'Fighter' },
        { id:'p_stormcaller', classId:'stormcaller', name:'Stormcaller' },
        { id:'p_cleric',      classId:'cleric',      name:'Cleric' },
        { id:'p_mage',        classId:'mage',        name:'Mage' },
      ];
  const heroes = configs.map(cfg => ({
    id: cfg.id, name: cfg.name, class: cfg.classId, cls: cfg.classId, level: lvl,
    attrs: autoAssignAttrs(cfg.classId, lvl),
    equipment: autoGenerateEquipment(cfg.classId, lvl),
    skills: [], hp:null, mp:null,
  }));
  // Add a War Dog companion (lvl synced via _effectiveLevel by sim isn't applied
  // there, but we let the sim use its template stats — that's exactly what
  // the player sees today).
  // M380: companion-level-sync stamps _effectiveLevel for stat scaling. The
  // dog stays template-level 1 but scales toward the hero average.
  if (SOLO) return heroes; // solo runs no companion
  const dog = {
    id:'comp_war_dog', name:'War Dog', class:'companion', cls:'companion',
    isCompanion:true, level: 1, _effectiveLevel: lvl,
    attrs:{ STR:10, DEX:12, INT:2, CON:10 },
    equipment:{}, skills:[], hp:null, mp:null,
  };
  return [...heroes, dog];
}

// Encounter → resolved act number for actMultiplier lookup. Prologue uses
// act 0 even though we list it under "Act 1" for the report layout.
const ENC_ACT_OVERRIDE = {
  prologue_pair: 0,
  prologue_miniboss: 0,
  prologue_scout: 0,
};

// Representative encounter per act.
const ACT_ENCOUNTERS = {
  1: ['prologue_scout', 'prologue_pair', 'prologue_miniboss', 'border_boss', 'corrupted_outpost'],
  2: ['veil_high_priest', 'big_ash_swarm'],
  3: ['demon_patrol', 'hell_garrison', 'big_demon_horde', 'archfiend_malgrath'],
  4: ['void_horde', 'cosmic_assault', 'unraveler'],
  5: ['primordial_patrol', 'genesis_nest', 'the_architect_final'],
};

function simAct(act, runs) {
  const party = buildParty(act);
  const encs  = ACT_ENCOUNTERS[act];
  const rows  = [];
  for (const encId of encs) {
    const enc = ENCOUNTERS[encId];
    if (!enc) { rows.push({ encId, error:'missing' }); continue; }
    let wins=0, totalRounds=0, totalAlive=0, totalAllies=0, totalNearDeath=0;
    let totalCompDead=0;
    for (let i=0; i<runs; i++) {
      // Re-clone party each run (sim mutates HP/MP).
      const heroes = JSON.parse(JSON.stringify(party));
      const useAct = ENC_ACT_OVERRIDE[encId] ?? act;
      const r = runSimulation({ heroes, encounter: enc, act: useAct, ng: NG, seed: BASE_SEED + i, maxRounds: 60 });
      if (r.winner === 'party') wins++;
      totalRounds += r.rounds;
      for (const p of r.party) {
        totalAllies++;
        if (p.alive) totalAlive++;
        if (p.alive && p.hp / p.maxHp < 0.25) totalNearDeath++;
        if (!p.alive && p.isCompanion) totalCompDead++;
      }
    }
    rows.push({
      encId, name: enc.name,
      winRate: (wins/runs*100).toFixed(0)+'%',
      avgRounds: (totalRounds/runs).toFixed(1),
      survivors: (totalAlive/runs).toFixed(1)+' / '+(party.length),
      nearDeaths: (totalNearDeath/runs).toFixed(1),
      compDead: (totalCompDead/runs).toFixed(1),
    });
  }
  return rows;
}

function pad(s, n) { s=String(s); return s + ' '.repeat(Math.max(0, n-s.length)); }

console.log(`\n=== Sim: Fighter / Stormcaller / Cleric / Mage + War Dog | runs/scenario=${RUNS} ===\n`);
for (const act of [1,2,3,4,5]) {
  const lvl = ACT_LEVELS[act];
  console.log(`Act ${act} (party L${lvl}):`);
  console.log(`  ${pad('encounter',26)} ${pad('win',5)} ${pad('rounds',7)} ${pad('survivors',12)} ${pad('near-dead',9)} comp-dead`);
  for (const r of simAct(act, RUNS)) {
    if (r.error) { console.log(`  ${r.encId}: ${r.error}`); continue; }
    console.log(`  ${pad(r.encId,26)} ${pad(r.winRate,5)} ${pad(r.avgRounds,7)} ${pad(r.survivors,12)} ${pad(r.nearDeaths,9)} ${r.compDead}`);
  }
  console.log();
}
