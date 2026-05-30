// Balance sweep — re-runs sim with enemy scaling multipliers. Applies
// hpMult / dmgMult to each enemy in ENCOUNTERS BEFORE running, so we can
// compare outcomes under different scalings without code changes.
//
// Usage: node scripts/balance-sweep.mjs > memory/balance-sweep.md
import fs from 'node:fs';
import path from 'node:path';
import { runMonteCarlo } from '../src/game/simulator.js';
import { ENCOUNTERS } from '../src/maps/mapData.js';

const SAVES_DIR = '/home/radgh/claude/assets/references/emberveil/saves';
const RUNS = 150;

function loadSaves() {
  const files = fs.readdirSync(SAVES_DIR).filter(f => f.endsWith('.json'));
  const out = [];
  for (const f of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(SAVES_DIR, f), 'utf8'));
      const data = JSON.parse(raw.data);
      if ((data.party || []).length) out.push({ name: raw.heroName || f, party: data.party });
    } catch {}
  }
  return out;
}

// Deep-clone + scale each enemy. hpMult multiplies hp/maxHp; dmgMult multiplies
// the damage tuple; all other stats untouched.
function scaleEncounters(hpMult, dmgMult) {
  const copy = {};
  for (const [id, enc] of Object.entries(ENCOUNTERS)) {
    copy[id] = {
      ...enc,
      enemies: (enc.enemies || []).map(e => ({
        ...e,
        hp: Math.round((e.hp || 0) * hpMult),
        maxHp: Math.round((e.maxHp || e.hp || 0) * hpMult),
        dmg: Array.isArray(e.dmg)
          ? [Math.round(e.dmg[0] * dmgMult), Math.round(e.dmg[1] * dmgMult)]
          : e.dmg,
      })),
    };
  }
  return copy;
}

const SAMPLE = [
  ['goblin_patrol',       1, 'trash'],
  ['spider_nest',         1, 'trash'],
  ['border_boss',         1, 'boss'],
  ['thornwood_boss',      1, 'boss'],
  ['ash_patrol',          2, 'trash'],
  ['veil_cult_camp',      2, 'trash'],
  ['lava_titan',          2, 'boss'],
  ['veil_high_priest',    2, 'boss'],
  ['demon_patrol',        3, 'trash'],
  ['hell_garrison',       3, 'trash'],
  ['archfiend_malgrath',  3, 'boss'],
  ['emberveil_sovereign', 3, 'boss'],
  ['void_horde',          4, 'trash'],
  ['cosmic_assault',      4, 'trash'],
  ['unraveler',           4, 'boss'],
  ['primordial_patrol',   5, 'trash'],
  ['genesis_nest',        5, 'trash'],
  ['dragon_patrol',       6, 'trash'],
  ['ancient_dragon_fight',6, 'boss'],
  ['dragon_king_fight',   6, 'boss'],
];

function runOne(party, scaled, encId, act) {
  const enc = scaled[encId];
  if (!enc) return null;
  return runMonteCarlo({ heroes: party, encounter: enc, act, runs: RUNS, baseSeed: 1 });
}

function summary(saves, scaled) {
  const trashR = [], bossR = [], trashW = [], bossW = [];
  for (const s of saves) {
    for (const [id, act, tier] of SAMPLE) {
      const r = runOne(s.party, scaled, id, act);
      if (!r) continue;
      (tier === 'trash' ? trashR : bossR).push(r.avgRounds);
      (tier === 'trash' ? trashW : bossW).push(r.winRate);
    }
  }
  const avg = a => a.length ? a.reduce((s,v)=>s+v,0)/a.length : 0;
  return {
    trashRounds: avg(trashR), trashWin: avg(trashW),
    bossRounds: avg(bossR),   bossWin: avg(bossW),
  };
}

const saves = loadSaves();
const PROFILES = [
  ['baseline',          1.0, 1.0],
  ['user_hypo',         6.0, 3.5],
  ['hp_only_2',         2.0, 1.0],
  ['hp_only_3',         3.0, 1.0],
  ['hp_only_4',         4.0, 1.0],
  ['hp_only_5',         5.0, 1.0],
  ['recommended_A',     2.5, 1.1], // modest all-round
  ['recommended_B',     3.0, 1.0], // 3× HP only
  ['recommended_C',     3.5, 1.15],
];

console.log('# Emberveil Balance Sweep');
console.log('');
console.log(`Runs per cell: ${RUNS}. Saves tested: ${saves.map(s => s.name).join(', ')}.`);
console.log('Goal: typical fight ≈ 10 rounds, bosses longer, parties still win most of the time.');
console.log('');
console.log('## Profiles');
console.log('');
console.log('| Profile | HP× | Dmg× | Trash Rounds | Trash Win | Boss Rounds | Boss Win |');
console.log('|---------|----:|-----:|-------------:|----------:|------------:|---------:|');
for (const [name, hp, dmg] of PROFILES) {
  const scaled = scaleEncounters(hp, dmg);
  const r = summary(saves, scaled);
  console.log(`| ${name} | ${hp.toFixed(1)}× | ${dmg.toFixed(1)}× | ${r.trashRounds.toFixed(1)} | ${(r.trashWin*100).toFixed(0)}% | ${r.bossRounds.toFixed(1)} | ${(r.bossWin*100).toFixed(0)}% |`);
}
console.log('');
console.log('## Per-save detail for the chosen profile (will fill in once picked)');
