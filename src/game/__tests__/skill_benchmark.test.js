// M396 — Per-class skill benchmark.
//
// For every class at each benchmark level, compute the average per-cast skill
// damage on a level-matched dummy. Weapon Scaling is always on (the legacy
// attribute-based mode has been removed). Surfaces outliers so we can tune
// skill damageMult values to bring classes within a tight band of each other.
//
// This test never fails on numbers (balance is a moving target). It writes the
// table to console.log for human review and asserts only that every class has
// at least one usable damaging skill at level 1 (sanity check).

import { describe, it, expect } from 'vitest';
import {
  heroToCombatant,
  autoAssignAttrs,
  getBenchmarkGearPack,
  BENCHMARK_LEVELS,
} from '../simulator.js';
import { CLASSES } from '../classes.js';
import { getUnlockedSkills, mergeSkillForCast } from '../skills.js';
import { getBalance } from '../balance-loader.js';

// Weapon Scaling is always on — stat term is always the weapon midpoint.
function _statVal(_stat, _attrs, _weaponScaling, dmg) {
  if (dmg) return (dmg[0] + dmg[1]) / 2;
  return 0;
}

function _categoryFor(skill, weaponCat) {
  if (skill.damageCategory) return skill.damageCategory;
  // M411 — weapon category drives the spell category (parity with combat).
  if (skill.type === 'magic' || skill.type === 'heal') return 'magic';
  const wc = (weaponCat || '').toLowerCase();
  if (wc === 'magic' || wc === 'heavy' || wc === 'light') return wc;
  return 'heavy';
}

function _avgSkillDmg(classId, level, weaponScaling = true) {
  const attrs = autoAssignAttrs(classId, level);
  const equipment = getBenchmarkGearPack(classId, level);
  const cls = CLASSES.find(c => c.id === classId);
  if (!cls) return null;
  const member = {
    id: `${classId}_L${level}`,
    name: cls.name,
    class: classId, className: cls.name,
    level,
    attrs,
    equipment,
    skills: cls.skills || [],
    talentsPurchased: {},
  };
  const cmb = heroToCombatant(member);
  const skills = getUnlockedSkills(classId, level)
    .map(s => mergeSkillForCast(s, member))
    .filter(s => s && (s.damageMult > 0));
  if (!skills.length) return null;

  const balSkill = getBalance().combat?.skill || {};
  const heroMult = balSkill.heroDamageMult ?? 1.0;
  const intCoef = getBalance().combat?.formulas?.intSpellPowerCoef ?? 0.025;
  const spellPower = +(((attrs.INT || 8) * intCoef).toFixed(3));
  const attackPower = Math.round((attrs.STR || 8) * 1.5);
  const dmg = cmb.dmg || [1, 2];
  const weaponMid = (dmg[0] + dmg[1]) / 2;
  const affixSP = cmb.affixSpellPower || 0;

  const samples = skills.map(s => {
    const stat = _statVal(s.damageStat, attrs, weaponScaling, dmg);
    const cat = _categoryFor(s, cmb.weaponCategory);
    const catMult = cat === 'magic' ? (balSkill.magicMult ?? 0.78)
                  : cat === 'heavy' ? (balSkill.heavyMult ?? 1.00)
                  : (balSkill.lightMult ?? 1.00);
    const isSpell = cat === 'magic';
    const powerBonus = isSpell ? (spellPower + affixSP) : (attackPower * 0.05);
    const weaponFlavor = isSpell ? 0 : Math.round(weaponMid * 0.1);
    const mult = (s.damageMult || 1.0) * heroMult * catMult;
    const base = Math.round(stat * mult * (1 + powerBonus)) + weaponFlavor;
    return { name: s.name, mult: s.damageMult, dmg: base };
  });
  const avg = samples.reduce((a, b) => a + b.dmg, 0) / samples.length;
  // Average basic-attack damage: weaponMid * 1.0 + crit shrug.
  return { avg: Math.round(avg), basic: Math.round(weaponMid), samples };
}

describe('M396 — per-class skill damage benchmark', () => {
  it('reports avg skill damage vs basic attack across all classes/levels (both modes)', () => {
    const reportLines = [];
    for (const cls of CLASSES) {
      const row = [`${cls.name.padEnd(14)}`];
      for (const lvl of BENCHMARK_LEVELS) {
        const on = _avgSkillDmg(cls.id, lvl, true);
        if (!on) { row.push(`L${lvl}: --`); continue; }
        const ratioOn = (on.avg / Math.max(1, on.basic)).toFixed(1);
        row.push(`L${String(lvl).padStart(2)} ${String(on.avg).padStart(3)}/${String(on.basic).padStart(2)}=${ratioOn}x`);
      }
      reportLines.push(row.join('  '));
    }
    // eslint-disable-next-line no-console
    console.log('\nM396+ SKILL BENCHMARK (avg skill dmg / basic attack — weapon scaling always on)\n' + reportLines.join('\n') + '\n');

    // Sanity: every class should have at least one usable damaging skill by
    // level 25 under default mode (some support classes like Bard / Cleric
    // gate their first damager behind level 5+).
    for (const cls of CLASSES) {
      const r = _avgSkillDmg(cls.id, 25, true);
      expect(r, `${cls.id} should have a usable damaging skill by L25`).not.toBeNull();
      expect(r.avg).toBeGreaterThan(0);
    }
  });
});
