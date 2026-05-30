import fs from 'node:fs';
import { runSimulation } from '../src/game/simulator.js';
import { ENCOUNTERS } from '../src/maps/mapData.js';

const raw = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const data = JSON.parse(raw.data);
const party = data.party;
const encId = process.argv[3];
const act = parseInt(process.argv[4], 10) || 1;
const enc = ENCOUNTERS[encId];
const result = runSimulation({ heroes: party, encounter: enc, act, seed: 1, maxRounds: 25 });
console.log('winner:', result.winner, 'rounds:', result.rounds);
console.log('parties:', result.party.map(p => `${p.name} hp=${p.hp}/${p.maxHp} alive=${p.alive}`));
console.log('enemies:', result.enemies.map(e => `${e.name} hp=${e.hp}/${e.maxHp} alive=${e.alive}`));
console.log('---last 15 log---');
for (const l of (result.log || []).slice(-15)) console.log(JSON.stringify(l));
