/**
 * powerScore — M288
 *
 * Single number summarising a hero's combat strength. Used by the Power tab
 * on the Stats dashboard to chart growth over time and compare role mix.
 *
 * Formula (intentionally additive so each contribution stays interpretable):
 *
 *   power =
 *     level                     × 20                  // base scale per level
 *     + sum(STR, DEX, INT, CON) × 1                   // raw attribute spread
 *     + (skill ranks)           × 10                  // unlocked actives
 *     + (passive points)        × 8
 *     + (gear total score)      × 0.5                 // computeItemScores total
 *     + (max HP)                × 0.05
 *     + (max MP)                × 0.05
 *
 * The weights are tuned so a fresh level-1 hero scores ~80 and a fully-built
 * Act 6 hero scores ~3000-5000. Exact numbers don't matter much — what
 * matters is that the value moves smoothly with progression.
 */

import { computeItemScores } from './items.js';

export function computePowerScore(char) {
  if (!char) return 0;
  const level = char.level || 1;
  const a = char.attrs || {};
  const attrSum = (a.STR || 0) + (a.DEX || 0) + (a.INT || 0) + (a.CON || 0);
  const skills = Array.isArray(char.skills) ? char.skills.length : 0;
  const passives = (char.passivePoints || 0) || (char.passives && Object.keys(char.passives).length) || 0;
  const eqp = char.equipment || {};
  let gearScore = 0;
  for (const slot of Object.keys(eqp)) {
    const it = eqp[slot]; if (!it) continue;
    try { gearScore += computeItemScores(it, char).total; } catch (_) {}
  }
  const hp = char.maxHp || 0;
  const mp = char.maxMp || 0;
  const power = (
    level * 20 +
    attrSum * 1 +
    skills * 10 +
    passives * 8 +
    gearScore * 0.5 +
    hp * 0.05 +
    mp * 0.05
  );
  return Math.round(power);
}

/** Aggregate offense/defense/utility role scores for the hero (for the Power
 *  tab Role-Mix donut). */
export function computeRoleMix(char) {
  if (!char) return { offense: 0, defense: 0, utility: 0 };
  const eqp = char.equipment || {};
  let off = 0, def = 0, util = 0;
  for (const slot of Object.keys(eqp)) {
    const it = eqp[slot]; if (!it) continue;
    try {
      const sc = computeItemScores(it, char);
      off += sc.offense; def += sc.defense; util += sc.utility;
    } catch (_) {}
  }
  return { offense: off, defense: def, utility: util };
}
