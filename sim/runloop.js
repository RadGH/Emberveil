// Plays one full run: act 1 → act 6 regular encounters + boss.
//
// Combat is stateless between encounters — runSimulation rebuilds combatants
// from member level/attrs/equipment, starting at full HP/MP. This mirrors
// "player rests between fights at a shrine/town" and keeps the sim focused on
// per-encounter difficulty (the M4 tuning surface) rather than attrition.

import { runSimulation } from '../src/game/simulator.js';
import { ENCOUNTERS } from '../src/maps/mapData.js';
import { awardXp } from '../src/game/xp.js';

// Encounter sequence per act: regular encounters played in order then boss.
// Keeps the total short enough to run 100 iterations quickly.
export const ACT_SEQUENCE = {
  1: { regular: ['goblin_patrol', 'corrupted_outpost', 'spider_nest', 'wolf_pack', 'bear_ambush', 'bandit_ambush'], boss: ['grax_final'] },
  2: { regular: ['ash_patrol', 'obsidian_garrison', 'ember_ambush', 'veil_cult_camp'], boss: ['lava_titan', 'veil_high_priest'] },
  3: { regular: ['demon_patrol', 'hell_garrison', 'rift_assault', 'void_nexus_ambush'], boss: ['archfiend_malgrath', 'emberveil_sovereign'] },
  4: { regular: ['void_horde', 'cosmic_assault'], boss: ['unraveler'] },
  5: { regular: ['primordial_patrol', 'abyssal_garrison', 'genesis_nest'], boss: ['the_architect_final'] },
  6: { regular: ['dragon_patrol', 'wyrm_citadel', 'frost_wyrm_pack', 'storm_dragon_nest', 'dragon_elite'], boss: ['ancient_dragon_fight', 'dragon_king_fight'] },
};

function xpFromEncounter(enc) {
  if (!enc || !Array.isArray(enc.enemies)) return 0;
  let total = 0;
  for (const g of enc.enemies) total += (g.xpValue || 0) * (g.count || 1);
  return total;
}

function goldFromEncounter(enc, rng) {
  if (!enc || !Array.isArray(enc.enemies)) return 0;
  let total = 0;
  for (const g of enc.enemies) {
    const [gMin, gMax] = g.gold || [0, 0];
    for (let i = 0; i < (g.count || 1); i++) total += gMin + Math.floor(rng() * (gMax - gMin + 1));
  }
  return total;
}

export function runOne({ policy, seed }) {
  const { buildParty, rebuildForLevel } = policy;
  const party = buildParty(1);
  let gold = 0;
  let actReached = 1;
  let encountersCleared = 0;
  let rng = seededRng(seed);

  for (let act = 1; act <= 6; act++) {
    actReached = act;
    const seq = ACT_SEQUENCE[act];
    if (!seq) break;
    const list = [...seq.regular, ...seq.boss];
    for (let i = 0; i < list.length; i++) {
      const enc = ENCOUNTERS[list[i]];
      if (!enc) continue;
      const res = runSimulation({ heroes: party, encounter: enc, act, seed: seed + act * 1000 + i, maxRounds: 80 });
      const partyAlive = res.party.some(p => p.alive && p.hp > 0);
      if (!partyAlive) {
        return { outcome: 'dead', actReached: act, encountersCleared, goldAtDeath: gold, encounterLost: list[i] };
      }
      // Timeout with party alive still counts as survival (stalemate — enemy fled).
      encountersCleared++;
      const xp = xpFromEncounter(enc);
      const prevLevels = party.map(m => m.level);
      awardXp(party, Math.round(xp / party.length));
      party.forEach((m, idx) => { if (m.level !== prevLevels[idx]) rebuildForLevel(m); });
      gold += goldFromEncounter(enc, rng);
    }
  }

  return { outcome: 'cleared', actReached: 6, encountersCleared, goldAtDeath: gold };
}

function seededRng(seed) {
  let a = (seed | 0) || 1;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
