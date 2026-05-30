// Balance report: runs the combat simulator against real save-file parties
// across a sampled set of encounters. Emits a markdown summary.
//
// Usage: node scripts/balance-report.mjs > memory/balance-report-pre.md
//
// Goal (per M264 user spec):
//   - Typical fights should land ~10 rounds to feel good
//   - Bosses should be harder
//   - Healers tilt the outcome
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSimulation, runMonteCarlo } from '../src/game/simulator.js';
import { ENCOUNTERS } from '../src/maps/mapData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const SAVES_DIR  = '/home/radgh/claude/assets/references/emberveil/saves';

function loadSaves() {
  const files = fs.readdirSync(SAVES_DIR).filter(f => f.endsWith('.json'));
  const saves = [];
  for (const f of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(SAVES_DIR, f), 'utf8'));
      const data = JSON.parse(raw.data);
      const party = data.party || [];
      if (!party.length) continue;
      saves.push({ name: raw.heroName || f, file: f, party });
    } catch (e) {
      console.error('skip', f, e.message);
    }
  }
  return saves;
}

// Sampled encounters across acts, trash vs boss.
const SAMPLE_ENCOUNTERS = [
  // Act 1 trash + boss
  ['goblin_patrol',       1, 'trash'],
  ['spider_nest',         1, 'trash'],
  ['border_boss',         1, 'boss'],
  ['thornwood_boss',      1, 'boss'],
  // Act 2
  ['ash_patrol',          2, 'trash'],
  ['veil_cult_camp',      2, 'trash'],
  ['lava_titan',          2, 'boss'],
  ['veil_high_priest',    2, 'boss'],
  // Act 3
  ['demon_patrol',        3, 'trash'],
  ['hell_garrison',       3, 'trash'],
  ['archfiend_malgrath',  3, 'boss'],
  ['emberveil_sovereign', 3, 'boss'],
  // Act 4
  ['void_horde',          4, 'trash'],
  ['cosmic_assault',      4, 'trash'],
  ['unraveler',           4, 'boss'],
  // Act 5
  ['primordial_patrol',   5, 'trash'],
  ['genesis_nest',        5, 'trash'],
  // Act 6
  ['dragon_patrol',       6, 'trash'],
  ['ancient_dragon_fight',6, 'boss'],
  ['dragon_king_fight',   6, 'boss'],
].filter(([id]) => !!ENCOUNTERS[id]);

const RUNS = 200;

function runFor(saveName, party, encId, act) {
  const enc = ENCOUNTERS[encId];
  if (!enc) return null;
  const mc = runMonteCarlo({ heroes: party, encounter: enc, act, runs: RUNS, baseSeed: 1 });
  return {
    winRate: mc.winRate,
    avgRounds: mc.avgRounds,
    medianRounds: mc.medianRounds,
    partyDeaths: mc.avgPartyDeaths ?? null,
  };
}

function fmtPct(x) { return (x * 100).toFixed(0) + '%'; }
function fmtNum(x) { return x == null ? '—' : x.toFixed(1); }

function runAll(label) {
  const saves = loadSaves();
  const lines = [];
  lines.push(`## ${label}`);
  lines.push('');
  for (const s of saves) {
    const partySummary = s.party.map(p => `${p.name}/${p.class || p.cls || '?'} L${p.level}`).join(', ');
    lines.push(`### ${s.name} — ${partySummary}`);
    lines.push('');
    lines.push('| Encounter | Act | Tier | Win% | Avg Rounds | Median |');
    lines.push('|-----------|----:|------|-----:|-----------:|-------:|');
    for (const [encId, act, tier] of SAMPLE_ENCOUNTERS) {
      const r = runFor(s.name, s.party, encId, act);
      if (!r) continue;
      lines.push(`| ${encId} | ${act} | ${tier} | ${fmtPct(r.winRate)} | ${fmtNum(r.avgRounds)} | ${fmtNum(r.medianRounds)} |`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function summary(label) {
  const saves = loadSaves();
  const trashRounds = [];
  const bossRounds = [];
  const bossWin = [];
  const trashWin = [];
  for (const s of saves) {
    for (const [encId, act, tier] of SAMPLE_ENCOUNTERS) {
      const r = runFor(s.name, s.party, encId, act);
      if (!r) continue;
      if (tier === 'trash') { trashRounds.push(r.avgRounds); trashWin.push(r.winRate); }
      else { bossRounds.push(r.avgRounds); bossWin.push(r.winRate); }
    }
  }
  const avg = a => a.length ? (a.reduce((s,v)=>s+v,0)/a.length) : 0;
  return {
    label,
    trashAvgRounds: avg(trashRounds),
    bossAvgRounds: avg(bossRounds),
    trashWinRate: avg(trashWin),
    bossWinRate: avg(bossWin),
    n_trash: trashRounds.length,
    n_boss: bossRounds.length,
  };
}

const mode = process.argv[2] || 'full';
if (mode === 'summary') {
  const s = summary(process.argv[3] || 'run');
  console.log(JSON.stringify(s, null, 2));
} else {
  console.log('# Emberveil Balance Report');
  console.log('');
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log(`Runs per cell: ${RUNS}`);
  console.log('');
  console.log(runAll(process.argv[3] || 'Current'));
  const s = summary('summary');
  console.log('## Aggregate');
  console.log('');
  console.log(`- Trash: avg ${s.trashAvgRounds.toFixed(1)} rounds, win ${fmtPct(s.trashWinRate)} (n=${s.n_trash})`);
  console.log(`- Boss:  avg ${s.bossAvgRounds.toFixed(1)} rounds, win ${fmtPct(s.bossWinRate)} (n=${s.n_boss})`);
}
