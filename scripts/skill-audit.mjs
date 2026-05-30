// Skill stacking audit — compares "intended" damageMult (highest upgrade value,
// what tooltip descriptions usually reference) vs "effective" damageMult under
// the current additive _mergeInto behavior in skills.js.
//
// Flags outliers where additive stacking produces >2× the intended number.
import { SKILLS, mergeSkillForCast } from '../src/game/skills.js';

// Stacking keys we care about. Purely additive under current _mergeInto.
const SCALED_KEYS = ['damageMult', 'healMult'];
// Effect-scoped keys that also stack additively inside merged.effect.
const EFFECT_SCALED = ['lifesteal', 'bonusVsDemon', 'bonusVsUndead', 'dmgBuffVsDemon', 'dmgBuffVsUndead', 'dmgReduct', 'conditionBonus'];

function maxLevel(skill) {
  const ups = skill.upgrades || [];
  return ups.reduce((m, u) => Math.max(m, u.level || 0), skill.unlockLevel || 1);
}

function intendedDamageMult(skill) {
  // Designer intent: last upgrade's damageMult is typically the "final" number
  // (e.g. "200% STR" in description). If no damageMult upgrade, use base.
  let v = skill.damageMult ?? null;
  for (const u of (skill.upgrades || [])) {
    const b = u.bonus || {};
    if (b.damageMult != null) v = b.damageMult;
  }
  return v;
}

function effectiveAtMax(skill) {
  // Simulate: member is max-level + every talent purchased.
  const lvl = maxLevel(skill);
  const talentsPurchased = {};
  for (const t of (skill.talents || [])) talentsPurchased[t.id] = true;
  const member = { level: lvl, talentsPurchased };
  return mergeSkillForCast(skill, member);
}

const rows = [];
for (const [id, skill] of Object.entries(SKILLS)) {
  if (!skill || !['melee', 'magic', 'ranged', 'heal', 'zone'].includes(skill.type)) continue;
  if (skill.damageMult == null && skill.healMult == null) continue;
  const intended = intendedDamageMult(skill);
  const merged = effectiveAtMax(skill);
  const effDamage = merged.damageMult;
  const effHeal = merged.healMult;

  // Tally how many upgrades/talents contribute to damageMult
  const contribs = [];
  if (skill.damageMult != null) contribs.push(['base', skill.damageMult]);
  for (const t of (skill.talents || [])) {
    if (t.effect && t.effect.damageMult != null) contribs.push([`talent:${t.id}`, t.effect.damageMult]);
  }
  for (const u of (skill.upgrades || [])) {
    if (u.bonus && u.bonus.damageMult != null) contribs.push([`L${u.level}:${u.name}`, u.bonus.damageMult]);
  }
  const sumContribs = contribs.reduce((s, [, v]) => s + v, 0);

  rows.push({
    id,
    name: skill.name,
    class: skill.class || '',
    type: skill.type,
    baseMult: skill.damageMult,
    intendedMult: intended,
    effectiveMult: effDamage,
    effectiveHeal: effHeal,
    overrun: intended ? (effDamage / intended) : null,
    contribs,
    sumContribs,
    maxLevel: maxLevel(skill),
  });
}

// Print audit table
console.log('# Skill Stacking Audit');
console.log('');
console.log('Shows effective damageMult at max level with all talents purchased, under the CURRENT additive `_mergeInto` behavior in `skills.js:2149`.');
console.log('');
console.log('`overrun` = effective / intended. >2.0 means the skill scales at least 2× more than the tooltip suggests.');
console.log('');
console.log('## Damage skills');
console.log('');
console.log('| Skill | Class | Type | Base | Intended (tooltip) | Effective (max level) | Overrun | Contribs |');
console.log('|-------|-------|------|-----:|-------------------:|----------------------:|--------:|----------|');
const dmgRows = rows
  .filter(r => r.baseMult != null && r.effectiveMult != null)
  .sort((a, b) => (b.overrun || 0) - (a.overrun || 0));
for (const r of dmgRows) {
  const over = r.overrun != null ? r.overrun.toFixed(2) + '×' : '—';
  const flag = r.overrun >= 2.0 ? ' 🚨' : r.overrun >= 1.5 ? ' ⚠️' : '';
  const contribStr = r.contribs.map(([k, v]) => `${k}=${v}`).join(', ');
  console.log(`| ${r.name} | ${r.class} | ${r.type} | ${r.baseMult} | ${r.intendedMult} | ${r.effectiveMult.toFixed(2)}${flag} | ${over} | ${contribStr} |`);
}

// Heal skills
const healRows = rows.filter(r => r.effectiveHeal != null);
if (healRows.length) {
  console.log('');
  console.log('## Heal skills (healMult stacking)');
  console.log('');
  console.log('| Skill | Class | Effective healMult | Contribs |');
  console.log('|-------|-------|-------------------:|----------|');
  for (const r of healRows) {
    const contribs = [];
    const sk = SKILLS[r.id];
    if (sk.healMult != null) contribs.push(['base', sk.healMult]);
    for (const u of (sk.upgrades || [])) {
      if (u.bonus?.healMult != null) contribs.push([`L${u.level}`, u.bonus.healMult]);
    }
    console.log(`| ${r.name} | ${r.class} | ${r.effectiveHeal.toFixed(2)} | ${contribs.map(([k,v])=>`${k}=${v}`).join(', ')} |`);
  }
}

// Summary stats
console.log('');
console.log('## Summary');
const n = dmgRows.length;
const bad = dmgRows.filter(r => (r.overrun || 0) >= 2.0);
const warn = dmgRows.filter(r => (r.overrun || 0) >= 1.5 && (r.overrun || 0) < 2.0);
console.log(`- ${n} damage skills audited.`);
console.log(`- ${bad.length} with overrun ≥ 2× (🚨 scaling outliers).`);
console.log(`- ${warn.length} with overrun 1.5–2× (⚠️ borderline).`);
console.log('');
console.log('## Top 10 worst outliers');
console.log('');
for (const r of bad.slice(0, 10)) {
  console.log(`- **${r.name}** (${r.class}): tooltip says ${r.intendedMult}× → actually ${r.effectiveMult.toFixed(2)}× (${r.overrun.toFixed(1)}× overrun) — contribs: ${r.contribs.map(([k,v])=>`${k}=${v}`).join(', ')}`);
}
