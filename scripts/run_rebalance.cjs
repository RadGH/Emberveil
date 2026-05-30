#!/usr/bin/env node
// Standalone Node port of the rebalance sim from public/assets/rebalance.html.
// Usage: node scripts/run_rebalance.js [label]
// Writes public/assets/rebalance_snapshots/<label>.json and updates index.json.
//
// Keep DATA TABLES + sim functions in sync with rebalance.html. If you change
// one, change the other.

const fs = require('fs');
const path = require('path');

// === DATA TABLES (mirrored from rebalance.html) ===
const HEROES = [
  ['warrior',      'STR', 'tank',    1.10, 0.00, 0.10, 'Frontline'],
  ['fighter',      'STR', 'tank',    1.00, 0.10, 0.15, 'Frontline'],
  ['paladin',      'STR', 'tank',    0.95, 0.45, 0.25, 'Holy'],
  ['ranger',       'DEX', 'dps',     1.20, 0.00, 0.00, 'Ranged'],
  ['rogue',        'DEX', 'burst',   1.18, 0.00, 0.00, 'Assassin'],
  ['cleric',       'INT', 'healer',  0.93, 1.00, 0.30, 'Holy'],
  ['bard',         'INT', 'support', 0.91, 0.60, 0.40, 'Support'],
  ['mage',         'INT', 'caster',  1.30, 0.00, 0.20, 'Caster'],
  ['necromancer',  'INT', 'caster',  1.15, 0.20, 0.10, 'Shadow'],
  ['warlock',      'INT', 'caster',  1.25, 0.00, 0.10, 'Shadow'],
  ['demon_hunter', 'DEX', 'burst',   1.19, 0.00, 0.00, 'Shadow'],
  ['scavenger',    'DEX', 'dps',     1.00, 0.10, 0.00, 'Ranger'],
  ['swashbuckler', 'DEX', 'dps',     1.15, 0.00, 0.10, 'Blade'],
  ['dragon_knight','STR', 'tank',    1.20, 0.00, 0.15, 'Frontline'],
  ['pyromancer',   'INT', 'caster',  1.24, 0.00, 0.00, 'Caster'],
  ['stormcaller',  'INT', 'caster',  1.25, 0.10, 0.10, 'Caster'],
  ['druid',        'INT', 'healer',  0.70, 0.85, 0.20, 'Nature'],
  ['oracle',       'INT', 'support', 0.92, 0.70, 0.45, 'Support'],
  ['tactician',    'STR', 'support', 0.80, 0.20, 0.30, 'Support'],
  ['chronomancer', 'INT', 'caster',  1.05, 0.30, 0.30, 'Caster'],
];

const COMPANIONS = [
  ['dire_wolf',    14, 12, 3,  12],
  ['forest_owl',   4,  16, 10, 6],
  ['ember_drake',  12, 10, 12, 11],
  ['shadow_cat',   6,  16, 10, 8],
  ['crystal_golem',14, 4,  8,  16],
  ['spirit_wisp',  3,  12, 14, 6],
  ['bone_hound',   12, 12, 4,  12],
  ['ice_sprite',   3,  14, 13, 7],
  ['swamp_frog',   12, 10, 4,  14],
  ['void_moth',    3,  14, 15, 6],
];

const TAP_WEAPONS = [
  { id: 'blade',          cd: { unit: 'turns', n: 0 }, power: [8, 14],  targeting: 'single' },
  { id: 'bow',            cd: { unit: 'turns', n: 2 }, power: [25, 40], targeting: 'single' },
  { id: 'catapult',       cd: { unit: 'rounds', n: 5 }, power: [35, 55], targeting: 'aoe_group' },
  { id: 'star_caller',    cd: { unit: 'rounds', n: 4 }, power: [50, 60], targeting: 'aoe_group' },
  { id: 'ninja_stars',    cd: { unit: 'turns', n: 2 }, power: [12, 18], targeting: 'chain' },
  { id: 'fireball',       cd: { unit: 'turns', n: 3 }, power: [30, 45], targeting: 'aoe_group' },
  { id: 'dragon_call',    cd: { unit: 'rounds', n: 8 }, power: [38, 46], targeting: 'aoe_all' },
  { id: 'chain_lightning',cd: { unit: 'turns', n: 3 }, power: [18, 28], targeting: 'chain' },
  { id: 'spirit_hammer',  cd: { unit: 'rounds', n: 4 }, power: [40, 60], targeting: 'single' },
  { id: 'void_lance',     cd: { unit: 'rounds', n: 3 }, power: [25, 40], targeting: 'line' },
];

const TAP_UTILITIES = [
  { id: 'rejuvenate',     cd: { unit: 'turns', n: 3 },  power: [15, 25], kind: 'heal',   targeting: 'single' },
  { id: 'heal',           cd: { unit: 'rounds', n: 4 }, power: [50, 50], kind: 'heal',   targeting: 'allies_near' },
  { id: 'shield',         cd: { unit: 'rounds', n: 3 }, power: [25, 25], kind: 'shield', targeting: 'allies_near' },
  { id: 'deflect',        cd: { unit: 'rounds', n: 5 }, power: [20, 20], kind: 'shield', targeting: 'single' },
  { id: 'enchant',        cd: { unit: 'turns', n: 2 },  power: [0,0],    kind: 'buff',   targeting: 'single' },
  { id: 'cleanse',        cd: { unit: 'rounds', n: 3 }, power: [15, 15], kind: 'heal',   targeting: 'single' },
  { id: 'rally',          cd: { unit: 'rounds', n: 6 }, power: [0,0],    kind: 'buff',   targeting: 'allies_near' },
  { id: 'haste',          cd: { unit: 'rounds', n: 5 }, power: [0,0],    kind: 'buff',   targeting: 'single' },
  { id: 'taunt_totem',    cd: { unit: 'rounds', n: 6 }, power: [0,0],    kind: 'buff',   targeting: 'single' },
  { id: 'phoenix_feather',cd: { unit: 'rounds', n: 10}, power: [30, 30], kind: 'heal',   targeting: 'single' },
];

const TARGETS = {
  tank:   { hp: 500,  armor: 0.35, evade: 0.02, aoeMul: 1.00 },
  elite:  { hp: 300,  armor: 0.22, evade: 0.05, aoeMul: 1.00 },
  group:  { hp: 180,  armor: 0.08, evade: 0.04, aoeMul: 2.20 },
  boss:   { hp: 1200, armor: 0.40, evade: 0.00, aoeMul: 0.60 },
};
const ACTS = [1,2,3,4,5,6];
const LEVELS = [1,5,10,15];

// === Stat builders ===
function heroBaseAttrs(primary) {
  const a = { STR: 8, DEX: 8, INT: 8, CON: 8 };
  a[primary] = 14;
  return a;
}
function heroStats(hero, level) {
  const [,primary,role,dmgMul,healMul,shieldMul] = hero;
  const attrs = heroBaseAttrs(primary);
  attrs[primary] += (level - 1);
  const passivePts = Math.floor((level - 1) / 2);
  const primaryBonus = Math.ceil(passivePts * 0.6);
  const critBonus = passivePts * 2;
  attrs[primary] += primaryBonus;
  const talents = [3,8,13,18,23,28].filter(t => level >= t).length;
  const talentMul = 1 + talents * 0.10;
  const weaponBase = 6 + level * 1.5;
  const attrMod = Math.floor((attrs[primary] - 10) / 2);
  const hitChance = 0.85;
  const crit = Math.min(0.45, 0.05 + critBonus / 100);
  return { primary, role, dmgMul, healMul, shieldMul, weaponBase, attrMod, hitChance, crit, talentMul, level };
}
function companionStats(comp, level) {
  const [,STR,DEX,INT] = comp;
  const prim = Math.max(STR, DEX, INT);
  const weaponBase = 4 + level * 1.0;
  const attrMod = Math.floor((prim - 10) / 2);
  return { weaponBase, attrMod, hitChance: 0.80, crit: 0.08, talentMul: 1 + Math.floor(level/5)*0.10, level };
}

// === Sim functions ===
function rng() { return Math.random(); }

function simHeroTurn(s, _target, targetKind) {
  const t = TARGETS[targetKind];
  let total = 0;
  for (let i = 0; i < 6; i++) {
    if (rng() < t.evade) continue;
    if (rng() >= s.hitChance) continue;
    let dmg = (s.weaponBase + rng() * s.weaponBase + s.attrMod) * s.dmgMul * s.talentMul;
    if (i % 3 === 0) dmg += (8 + s.level * 2) * s.dmgMul * s.talentMul;
    if (rng() < s.crit) dmg *= 1.8;
    dmg *= (1 - t.armor);
    total += dmg;
  }
  return total;
}
function simHeroHeal(s) {
  if (s.healMul <= 0) return { heal: 0, shield: 0, overheal: 0 };
  let heal = 0, shield = 0, over = 0;
  // Split heals into smaller HoT ticks across all 6 turns to reduce overheal waste.
  for (let i = 0; i < 6; i++) {
    const amount = (10 + s.level * 3) * s.healMul * s.talentMul * 0.5;
    if (rng() < 0.06) over += amount; else heal += amount;
    if (s.shieldMul > 0 && i % 4 === 0) {
      shield += (8 + s.level * 2) * s.shieldMul * s.talentMul;
    }
  }
  return { heal, shield, overheal: over };
}
function simTapWeapon(w, level, targetKind) {
  const t = TARGETS[targetKind];
  const tapsPerRound = 6 / (1 + w.cd.n);
  const cdMul = w.cd.unit === 'rounds' ? 1 / (1 + w.cd.n * 0.5) : 1;
  const [lo, hi] = w.power;
  let total = 0;
  const scale = 1 + level * 0.08;
  const iters = Math.max(1, Math.round(tapsPerRound * cdMul));
  for (let i = 0; i < iters; i++) {
    let dmg = (lo + rng() * (hi - lo)) * scale;
    if (w.targeting === 'aoe_group' || w.targeting === 'aoe_all') dmg *= t.aoeMul;
    if (w.targeting === 'chain') dmg *= Math.min(3, 1 + t.aoeMul * 0.5);
    if (w.targeting === 'line') dmg *= Math.min(2.5, 1 + t.aoeMul * 0.4);
    dmg *= (1 - t.armor * 0.7);
    total += dmg;
  }
  return total;
}
function simTapUtility(u, level) {
  if (u.kind !== 'heal' && u.kind !== 'shield') return { heal: 0, shield: 0, overheal: 0 };
  const [lo] = u.power;
  const tapsPerRound = u.cd.unit === 'turns' ? 6 / (1 + u.cd.n) : 6 / (1 + u.cd.n * 2);
  const iters = Math.max(1, Math.round(tapsPerRound));
  const scale = 1 + level * 0.06;
  let heal = 0, shield = 0, over = 0;
  for (let i = 0; i < iters; i++) {
    const amt = lo * scale;
    if (u.kind === 'heal') {
      if (rng() < 0.2) over += amt; else heal += amt;
    } else shield += amt;
  }
  return { heal, shield, overheal: over };
}
function simCompanion(s, targetKind) {
  const t = TARGETS[targetKind];
  let total = 0;
  for (let i = 0; i < 6; i++) {
    if (rng() >= s.hitChance) continue;
    let dmg = (s.weaponBase + rng() * s.weaponBase + s.attrMod) * s.talentMul;
    if (rng() < s.crit) dmg *= 1.6;
    dmg *= (1 - t.armor);
    total += dmg;
  }
  return total;
}

const SCENARIOS = [];
for (const act of ACTS) for (const tk of Object.keys(TARGETS)) SCENARIOS.push({ act, targetKind: tk });

const mean = arr => arr.reduce((a,b)=>a+b,0) / arr.length;

function runSim(label, runsPerCell) {
  const result = {
    label,
    date: new Date().toISOString().slice(0,10),
    runs: runsPerCell,
    heroes: {}, companions: {}, taps: {}, utilities: {},
  };
  for (const h of HEROES) {
    const entry = { byLevel: {}, byScenario: {}, healByLevel: {} };
    for (const lvl of LEVELS) {
      const s = heroStats(h, lvl);
      const dpsRuns = [];
      for (let i = 0; i < runsPerCell; i++) dpsRuns.push(simHeroTurn(s, null, 'tank'));
      entry.byLevel[lvl] = mean(dpsRuns);
      const hruns = [], sruns = [], oruns = [];
      for (let i = 0; i < runsPerCell; i++) {
        const r = simHeroHeal(s);
        hruns.push(r.heal); sruns.push(r.shield); oruns.push(r.overheal);
      }
      entry.healByLevel[lvl] = { heal: mean(hruns), shield: mean(sruns), overheal: mean(oruns) };
    }
    const sLvl = heroStats(h, 10);
    for (const sc of SCENARIOS) {
      const runs = [];
      for (let i = 0; i < runsPerCell; i++) {
        const actMul = 1 + (sc.act - 1) * 0.08;
        runs.push(simHeroTurn(sLvl, null, sc.targetKind) * actMul);
      }
      entry.byScenario[`${sc.targetKind}_a${sc.act}`] = mean(runs);
    }
    result.heroes[h[0]] = entry;
  }
  for (const c of COMPANIONS) {
    const entry = { byLevel: {} };
    for (const lvl of LEVELS) {
      const s = companionStats(c, lvl);
      const runs = [];
      for (let i = 0; i < runsPerCell; i++) runs.push(simCompanion(s, 'tank'));
      entry.byLevel[lvl] = mean(runs);
    }
    result.companions[c[0]] = entry;
  }
  for (const w of TAP_WEAPONS) {
    const entry = { byLevel: {}, byScenario: {} };
    for (const lvl of LEVELS) {
      const runs = [];
      for (let i = 0; i < runsPerCell; i++) runs.push(simTapWeapon(w, lvl, 'tank'));
      entry.byLevel[lvl] = mean(runs);
    }
    for (const sc of SCENARIOS) {
      const runs = [];
      for (let i = 0; i < runsPerCell; i++) {
        const actMul = 1 + (sc.act - 1) * 0.08;
        runs.push(simTapWeapon(w, 10, sc.targetKind) * actMul);
      }
      entry.byScenario[`${sc.targetKind}_a${sc.act}`] = mean(runs);
    }
    result.taps[w.id] = entry;
  }
  for (const u of TAP_UTILITIES) {
    const entry = { byLevel: {} };
    for (const lvl of LEVELS) {
      const hruns = [], sruns = [], oruns = [];
      for (let i = 0; i < runsPerCell; i++) {
        const r = simTapUtility(u, lvl);
        hruns.push(r.heal); sruns.push(r.shield); oruns.push(r.overheal);
      }
      entry.byLevel[lvl] = { heal: mean(hruns), shield: mean(sruns), overheal: mean(oruns) };
    }
    result.utilities[u.id] = entry;
  }
  return result;
}

module.exports = { runSim, HEROES, COMPANIONS, TAP_WEAPONS, TAP_UTILITIES, LEVELS, SCENARIOS };

if (require.main === module) {
  const label = process.argv[2] || 'm77';
  const runs = parseInt(process.env.RUNS || '200', 10);
  console.log(`Running rebalance sim: label=${label}, runs/cell=${runs}`);
  const t0 = Date.now();
  const res = runSim(label, runs);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
  const outDir = path.join(__dirname, '..', 'public', 'assets', 'rebalance_snapshots');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${label}.json`);
  fs.writeFileSync(outFile, JSON.stringify(res, null, 2));
  console.log(`Wrote ${outFile} in ${elapsed}s`);

  // Update index.json
  const idxFile = path.join(outDir, 'index.json');
  let idx = { files: [] };
  if (fs.existsSync(idxFile)) {
    try { idx = JSON.parse(fs.readFileSync(idxFile, 'utf8')); } catch (_) {}
  }
  if (!Array.isArray(idx.files)) idx.files = [];
  const fname = `${label}.json`;
  if (!idx.files.includes(fname)) {
    idx.files.push(fname);
    fs.writeFileSync(idxFile, JSON.stringify(idx, null, 2) + '\n');
    console.log(`Added ${fname} to index.json`);
  }

  // Sanity sample
  const heroIds = Object.keys(res.heroes);
  const dpsL10 = heroIds.map(id => [id, res.heroes[id].byLevel[10]]).sort((a,b)=>b[1]-a[1]);
  const avg = mean(dpsL10.map(x => x[1]));
  console.log(`\nAvg hero DPS L10 (tank): ${avg.toFixed(1)}`);
  console.log('Top 3:', dpsL10.slice(0,3).map(([id,v]) => `${id}=${v.toFixed(1)}`).join(', '));
  console.log('Bot 3:', dpsL10.slice(-3).map(([id,v]) => `${id}=${v.toFixed(1)}`).join(', '));
}
