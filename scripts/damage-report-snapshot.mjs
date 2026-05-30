// Damage Report snapshot generator.
//
// Runs runMonteCarlo for every class × {single, aoe} target × {solo, group}
// party config × every BENCHMARK_LEVELS level. Records average damage,
// healing, and mitigation per-hero and per-class. Writes one JSON file per
// milestone under public/assets/data/damage-report/.
//
// Usage:
//   node scripts/damage-report-snapshot.mjs                     # auto-detect milestone
//   node scripts/damage-report-snapshot.mjs --milestone M423    # explicit
//
// Output schema (per snapshot):
// {
//   "version": 1,
//   "milestone": "M423",
//   "generated": "2026-05-06T...",
//   "classes": [
//     {
//       "id": "stormcaller", "name": "Stormcaller", "role": "aoe_dps",
//       "byLevel": [
//         { "level": 1, "single": { "solo": {...}, "group": {...} },
//                       "aoe":    { "solo": {...}, "group": {...} } },
//         ...
//       ]
//     }
//   ]
// }
//
// Each scenario block has: { damage, healing, mitigation, runs }.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  runSimulation,
  autoAssignAttrs,
  getBenchmarkGearPack,
  BENCHMARK_LEVELS,
} from '../src/game/simulator.js';
import { CLASSES } from '../src/game/classes.js';
import { getUnlockedSkills } from '../src/game/skills.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'assets', 'data', 'damage-report');

const RUNS_PER_CELL = 8;
const MAX_ROUNDS_TARGET = 6; // we cap with a 6-round encounter to surface burst windows

const ARGS = process.argv.slice(2);
const argMs = (() => {
  const i = ARGS.findIndex(a => a === '--milestone');
  if (i >= 0 && ARGS[i + 1]) return ARGS[i + 1];
  return null;
})();

function readMilestone() {
  if (argMs) return argMs;
  try {
    const meta = JSON.parse(fs.readFileSync(path.join(ROOT, '..', 'game13_releases', 'game_meta.json'), 'utf8'));
    const max = Math.max(...Object.keys(meta.releases || {}).map(k => parseInt(k, 10)).filter(Number.isFinite));
    return `M${max}`;
  } catch { return `Mlatest`; }
}

// Heuristic role classification — used by the damage-report.html filter UI.
const ROLE_BY_CLASS = {
  warrior: 'tank', knight: 'tank', dragon_knight: 'tank',
  // Paladin's kit is built around conditional bonuses vs undead/demons + heals.
  // Slotted under support; benchmark dummies never trigger holy bonuses.
  paladin: 'support',
  fighter: 'single_dps', barbarian: 'single_dps', berserker: 'single_dps',
  rogue: 'single_dps', ranger: 'single_dps', monk: 'single_dps', shadow_dancer: 'single_dps',
  witch_hunter: 'single_dps', runesmith: 'single_dps',
  swashbuckler: 'single_dps', scavenger: 'single_dps', demon_hunter: 'single_dps',
  stormcaller: 'aoe_dps', pyromancer: 'aoe_dps', cryomancer: 'aoe_dps', necromancer: 'aoe_dps',
  mage: 'aoe_dps', warlock: 'aoe_dps', sorcerer: 'aoe_dps', oracle: 'aoe_dps',
  chronomancer: 'support', enchanter: 'support', bard: 'support',
  // Druid like Shaman: heals + entangle/regrowth + aoe storm — hybrid DPS.
  druid: 'hybrid_dps',
  tactician: 'support', tinker: 'support',
  // Shaman has both single-target (Spirit Bolt) and AoE (Spirit Chain → Storm
  // of Spirits) plus a heal totem. Compared against neither pure single-DPS
  // nor pure AoE-DPS bands; "hybrid_dps" gets its own median.
  shaman: 'hybrid_dps',
  priest: 'healer', cleric: 'healer',
};

// Build a synthetic enemy for the encounter.
function makeEnemy(name, level) {
  const hpScale = 200 + (level - 1) * 60;
  return {
    id: `dummy_${name}`,
    name,
    // Very high HP so they survive the full sim window — we measure DPS, not kills
    hp: hpScale * 16,
    maxHp: hpScale * 16,
    armor: 0, // damage report measures raw class output, not armor penetration
    // Minimal damage / hit so they don't kill the lead before we measure
    // (M426). Otherwise low-HP classes like Paladin / Monk register near-zero
    // because they get KO'd before they can cast anything.
    dmg: [0, 0],
    hit: 0,
    dodge: 5,
    level,
    cls: 'beast',
    skills: [],
  };
}

function makeEncounter(targetCount, level) {
  const enemies = [];
  for (let i = 0; i < targetCount; i++) enemies.push(makeEnemy(`Dummy ${i + 1}`, level));
  return { id: 'damage_report_dummy', name: `Dummy x${targetCount}`, enemies };
}

function makeHero(classId, level) {
  const cls = CLASSES.find(c => c.id === classId);
  if (!cls) return null;
  const attrs = autoAssignAttrs(classId, level);
  const equipment = getBenchmarkGearPack(classId, level);
  // Auto-spend talent points conceptually — give them a fully unlocked skill set
  const skills = getUnlockedSkills(classId, level).map(s => s.id);
  // Pre-roll all talents: synthesize a plausible talent set via skill ids
  const talentsPurchased = {};
  return {
    id: `${classId}_L${level}_${Math.random().toString(36).slice(2, 7)}`,
    name: cls.name,
    class: classId,
    className: cls.name,
    level,
    attrs,
    equipment,
    skills,
    talentsPurchased,
    autoBuild: { auto_attrs: true, auto_passive: true, auto_active: true },
    autoEquip: true,
  };
}

// M423 — companion entries for the same snapshot harness. Heroes-only mode
// understated companion contribution per user feedback (Frost Wyrmling out-DPS'd
// the Runesmith and Witch Hunter at L20). Adding them here so the Damage Report
// page surfaces them next to hero classes.
// One companion per power tier so the report shows the rating spread.
const COMPANION_ROSTER = [
  { id: 'war_dog',          name: 'War Dog (P1)',                  attrs: { STR:10, DEX:12, INT:2,  CON:10 } },
  { id: 'shadow_cat',       name: 'Shadow Cat (P2)',               attrs: { STR:10, DEX:13, INT:8,  CON:10 } },
  { id: 'dire_wolf',        name: 'Dire Wolf (P3)',                attrs: { STR:13, DEX:13, INT:6,  CON:12 } },
  { id: 'ember_drake',      name: 'Ember Drake (P4)',              attrs: { STR:13, DEX:13, INT:14, CON:13 } },
  { id: 'frost_wyrmling',   name: 'Frost Wyrmling (P5)',           attrs: { STR:11, DEX:12, INT:13, CON:13 } },
];

function makeCompanion(rosterEntry, level) {
  // Note the templateId — heroToCombatant uses that to look up power tier.
  return {
    id: `${rosterEntry.id}_L${level}_${Math.random().toString(36).slice(2, 7)}`,
    templateId: rosterEntry.id,
    name: rosterEntry.name,
    class: 'companion',
    className: rosterEntry.name,
    isCompanion: true,
    level: 1, // template level — scaling kicks in via _effectiveLevel
    _effectiveLevel: level,
    effectiveLevel: level,
    attrs: rosterEntry.attrs,
    equipment: {},
    skills: [],
    talentsPurchased: {},
  };
}

function makeFiller(level) {
  // Use a generic warrior as filler so the lead hero's contribution is isolated.
  // We mark the filler so the post-aggregation can subtract its damage if
  // needed. (Currently we just record dpsPerHero by name — collisions handled
  // by suffixing.)
  return makeHero('warrior', Math.max(1, level - 1));
}

function makeParty(classId, level, mode /* 'solo' | 'group' */) {
  const lead = makeHero(classId, level);
  if (mode === 'solo') return [lead];
  const filler = [makeFiller(level), makeFiller(level), makeFiller(level)].map((m, i) => ({
    ...m, name: `Filler ${i + 1}`, id: `${m.id}_f${i}`,
  }));
  return [lead, ...filler];
}

function runScenario(classId, level, targetCount, partyMode) {
  const party = makeParty(classId, level, partyMode);
  const enc = makeEncounter(targetCount, level);
  const totalDmg = []; const totalHeal = []; const totalMit = [];
  for (let i = 0; i < RUNS_PER_CELL; i++) {
    const sim = runSimulation({ heroes: party, encounter: enc, act: 1, seed: 1000 + i });
    const lead = party[0];
    // Sum lead's contribution from the combat log directly.
    let dmg = 0, heal = 0, mit = 0;
    for (const ev of sim.log) {
      const isLeadActor = ev.actor === lead.name || ev.source === lead.name || ev.attacker === lead.name;
      if (!isLeadActor) continue;
      if (ev.type === 'hit')      dmg += ev.dmg || 0;
      else if (ev.type === 'heal') heal += ev.amount || ev.heal || 0;
      else if (ev.type === 'skill' && ev.dmg) dmg += ev.dmg || 0;
    }
    // Lead-on-target mitigation: damage they took that was absorbed by armor/barrier.
    for (const ev of sim.log) {
      const targetIsLead = ev.target === lead.name;
      if (!targetIsLead) continue;
      if (ev.preMitigation && ev.dmg != null) mit += Math.max(0, ev.preMitigation - ev.dmg);
    }
    totalDmg.push(dmg); totalHeal.push(heal); totalMit.push(mit);
  }
  const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  return {
    damage: Math.round(avg(totalDmg)),
    healing: Math.round(avg(totalHeal)),
    mitigation: Math.round(avg(totalMit)),
    runs: RUNS_PER_CELL,
  };
}

function main() {
  const milestone = readMilestone();
  const out = {
    version: 1,
    milestone,
    generated: new Date().toISOString(),
    runsPerCell: RUNS_PER_CELL,
    classes: [],
  };

  let started = Date.now();
  let totalCells = CLASSES.length * BENCHMARK_LEVELS.length * 2 * 2;
  let cellsDone = 0;

  for (const cls of CLASSES) {
    const role = ROLE_BY_CLASS[cls.id] || 'unclassified';
    const byLevel = [];
    for (const level of BENCHMARK_LEVELS) {
      const single = {};
      const aoe = {};
      for (const partyMode of ['solo', 'group']) {
        single[partyMode] = runScenario(cls.id, level, 1, partyMode);
        aoe[partyMode]    = runScenario(cls.id, level, 6, partyMode);
        cellsDone += 2;
      }
      byLevel.push({ level, single, aoe });
      const elapsed = ((Date.now() - started) / 1000).toFixed(0);
      process.stderr.write(`  [${cellsDone}/${totalCells}] ${cls.id} L${level} (${elapsed}s)\n`);
    }
    out.classes.push({ id: cls.id, name: cls.name, role, byLevel });
  }

  // Append companions as additional "classes" so they share the same graph.
  for (const comp of COMPANION_ROSTER) {
    const byLevel = [];
    for (const level of BENCHMARK_LEVELS) {
      const single = {}, aoe = {};
      for (const partyMode of ['solo', 'group']) {
        // Custom party builder for companions: solo = 1 companion vs N enemies;
        // group = companion + 3 hero fillers so AI exists alongside.
        const lead = makeCompanion(comp, level);
        const fillers = (partyMode === 'group')
          ? [makeFiller(level), makeFiller(level), makeFiller(level)].map((m, i) => ({ ...m, name: `Filler ${i + 1}`, id: `${m.id}_f${i}` }))
          : [];
        const party = [lead, ...fillers];
        const runOne = (targetCount) => {
          const enc = makeEncounter(targetCount, level);
          const dmgs = [], heals = [], mits = [];
          for (let i = 0; i < RUNS_PER_CELL; i++) {
            const sim = runSimulation({ heroes: party, encounter: enc, act: 1, seed: 1000 + i });
            let dmg = 0, heal = 0, mit = 0;
            for (const ev of sim.log) {
              const isLead = ev.actor === lead.name || ev.source === lead.name || ev.attacker === lead.name;
              if (isLead) {
                if (ev.type === 'hit') dmg += ev.dmg || 0;
                else if (ev.type === 'heal') heal += ev.amount || ev.heal || 0;
              }
              if (ev.target === lead.name && ev.preMitigation && ev.dmg != null) mit += Math.max(0, ev.preMitigation - ev.dmg);
            }
            dmgs.push(dmg); heals.push(heal); mits.push(mit);
          }
          const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
          return { damage: Math.round(avg(dmgs)), healing: Math.round(avg(heals)), mitigation: Math.round(avg(mits)), runs: RUNS_PER_CELL };
        };
        single[partyMode] = runOne(1);
        aoe[partyMode] = runOne(6);
      }
      byLevel.push({ level, single, aoe });
    }
    out.classes.push({ id: comp.id, name: comp.name, role: 'companion', byLevel });
    process.stderr.write(`  +companion ${comp.id} done\n`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `${milestone}.json`);
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

  // Maintain a manifest of available snapshots for the page to discover.
  const manifestPath = path.join(OUT_DIR, 'index.json');
  let manifest = { snapshots: [] };
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch {}
  if (!manifest.snapshots.includes(milestone)) {
    manifest.snapshots.push(milestone);
    manifest.snapshots.sort();
  }
  manifest.latest = milestone;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`✓ Damage report snapshot written: ${outPath}`);
  console.log(`  ${out.classes.length} classes × ${BENCHMARK_LEVELS.length} levels × 4 cells = ${cellsDone} sims`);
  console.log(`  manifest: ${manifestPath}`);
}

main();
