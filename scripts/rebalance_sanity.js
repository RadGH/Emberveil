// Tiny sanity script for combat-sim.js. Run with:
//   node scripts/rebalance_sanity.js
import {
  CLASSES, HIREABLES, COMPANIONS, TAP_WEAPONS,
  buildHero, buildCompanion, buildTapWeaponSubject, runBatch,
} from '../public/assets/engine/combat-sim.js';

function row(label, r) {
  console.log(`${label.padEnd(34)} dps=${r.dps.mean.toFixed(1).padStart(8)} ±${r.dps.std.toFixed(1).padStart(6)}  hps=${r.hps.mean.toFixed(1).padStart(7)}  surv=${(r.survival*100).toFixed(0)}%  ttk=${r.ttk.mean.toFixed(1)}`);
}

const RUNS = 5;
const SCENS = [['tank',1],['group',2],['swarm',3]];

console.log('=== Heroes (lvl 10) ===');
for (const c of CLASSES.slice(0, 6)) {
  const h = buildHero(c.id, 10);
  for (const [b, t] of SCENS) row(`${c.id} vs ${b}/act${t}`, runBatch(h, b, t, RUNS, 42));
}

console.log('\n=== Companions ===');
for (const sp of COMPANIONS) {
  const c = buildCompanion(sp);
  row(`${sp.id} vs tank/act1`, runBatch(c, 'tank', 1, RUNS, 99));
}

console.log('\n=== Tap Weapons ===');
for (const w of TAP_WEAPONS) {
  const s = buildTapWeaponSubject(w);
  row(`tap:${w.id} vs swarm/act1`, runBatch(s, 'swarm', 1, RUNS, 7));
}

console.log('\nDone. NaN check:');
const h = buildHero('mage', 10);
const r = runBatch(h, 'tank', 3, 10, 1);
console.log('mage tank/act3 mean dps =', r.dps.mean, 'isFinite=', Number.isFinite(r.dps.mean));
