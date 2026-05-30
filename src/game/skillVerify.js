// src/game/skillVerify.js
// M65 — Systematic skill verification harness.
//
// For every entry in SKILLS, build a throwaway "combat state" (one dummy
// caster, three dummy allies, three dummy enemies) and simulate the skill's
// declared effect against that state. Report any skill whose simulation
// produced zero observable change in HP, MP, statuses, or flags.
//
// This mirrors (loosely) the logic in CombatScreen._executeSkill. It is NOT
// the authoritative resolver — it's a lint check. If this reports a skill as
// dead, the real combat resolver probably also can't handle it.
//
// Usage (in debug/dev builds):
//   window.__verifySkills()
// Prints a grouped console report and returns { ok, broken } arrays.

import { SKILLS } from './skills.js';

function makeDummy(name, { enemy = false } = {}) {
  return {
    id: name,
    name,
    alive: true,
    hp: 100, maxHp: 100,
    mp: 100, maxMp: 100,
    armor: 0, dodge: 10, hit: 80,
    dmg: [5, 10],
    statuses: [],
    stance: 'ready',
    enemy,
    attrs: { STR: 10, DEX: 10, INT: 10, CON: 10 },
  };
}

function snapshot(units) {
  return units.map(u => ({
    hp: u.hp,
    mp: u.mp,
    alive: u.alive,
    dmgBuff: u.dmgBuff || 0,
    dmgReduct: u.dmgReduct || 0,
    dodgeBuff: u.dodgeBuff || 0,
    extraAction: u.extraAction || 0,
    statuses: (u.statuses || []).map(s => `${s.type}:${s.power || 0}:${s.duration || 0}`).join('|'),
  }));
}

function diff(a, b) {
  const out = [];
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    for (const k of Object.keys(y)) {
      if (x[k] !== y[k]) out.push(`[${i}].${k}: ${x[k]} -> ${y[k]}`);
    }
  }
  return out;
}

// Simulate one skill against a fresh state. Returns list of observable changes.
function simulate(skill) {
  const caster = makeDummy('caster');
  const allies = [caster, makeDummy('ally1'), makeDummy('ally2')];
  const enemies = [makeDummy('e1', { enemy: true }), makeDummy('e2', { enemy: true }), makeDummy('e3', { enemy: true })];
  // Pre-wound one ally so heals & revives have something to do.
  allies[1].hp = 40;
  // Pre-kill one ally so revive has a target.
  allies[2].hp = 0; allies[2].alive = false;

  const before = snapshot([...allies, ...enemies]);
  const eff = skill.effect || {};
  const INT = 10, CON = 10, STR = 10;

  try {
    switch (skill.type) {
      case 'heal': {
        const tgt = [...allies].filter(a => a.alive).sort((a, b) => (a.hp/a.maxHp)-(b.hp/b.maxHp))[0];
        if (tgt) tgt.hp = Math.min(tgt.maxHp, tgt.hp + Math.round((skill.healMult || 1) * INT));
        break;
      }
      case 'revive': {
        const fallen = allies.filter(a => !a.alive);
        const targets = eff.reviveAll ? fallen : fallen.slice(0, 1);
        for (const t of targets) { t.alive = true; t.hp = Math.max(1, Math.floor(t.maxHp * (eff.reviveHp || 0.3))); }
        break;
      }
      case 'buff': {
        let tgts = [];
        if (skill.target === 'party') tgts = allies.filter(a => a.alive);
        else if (skill.target === 'self') tgts = [caster];
        else tgts = [allies.find(a => a.alive && a.hp < a.maxHp) || caster];
        for (const t of tgts) {
          if (eff.dmgBuff)   { t.dmgBuff = (t.dmgBuff || 0) + eff.dmgBuff; }
          if (eff.dmgReduct) { t.dmgReduct = eff.dmgReduct; }
          if (eff.dodgeBuff) { t.dodgeBuff = (t.dodgeBuff || 0) + eff.dodgeBuff; }
          if (eff.barrier)   { t.statuses.push({ type:'barrier', duration: eff.duration||2, power: eff.barrier }); }
          if (eff.shield)    { t.statuses.push({ type:'barrier', duration: eff.shield.duration||2, power: (eff.shield.conMult||3)*CON }); }
          if (eff.extraAction) { t.extraAction = (t.extraAction || 0) + eff.extraAction; }
          if (eff.regen)     { t.statuses.push({ type:'regen', duration: eff.duration||2, power: eff.regen }); }
        }
        break;
      }
      case 'magic':
      case 'melee':
      case 'physical':
      case 'debuff': {
        // Damage skills — hit one or more enemies.
        let tgts;
        if (!skill.aoe || skill.aoe === 'single') tgts = [enemies[0]];
        else tgts = enemies;
        const stat = skill.damageStat === 'int' ? INT : skill.damageStat === 'str' ? STR : 10;
        const dmg = Math.max(1, Math.round(stat * (skill.damageMult || 1)));
        for (const t of tgts) {
          t.hp -= dmg;
          if (t.hp <= 0) { t.hp = 0; t.alive = false; }
          for (const se of (skill.statusEffects || [])) {
            t.statuses.push({ type: se.type, duration: se.duration || 2, power: se.power || 3 });
          }
        }
        break;
      }
      case 'passive': {
        // Passives don't produce in-combat observable effects via cast.
        return { type: 'passive', changes: ['(passive — not cast)'] };
      }
      default: {
        return { type: skill.type || 'unknown', changes: [] };
      }
    }
  } catch (err) {
    return { type: skill.type, changes: [], error: err.message };
  }

  const after = snapshot([...allies, ...enemies]);
  return { type: skill.type, changes: diff(before, after) };
}

export function verifySkills() {
  const results = [];
  for (const [id, skill] of Object.entries(SKILLS)) {
    const r = simulate(skill);
    results.push({ id, name: skill.name, class: skill.class, type: skill.type, ...r });
  }
  const broken = results.filter(r => r.type !== 'passive' && (!r.changes || r.changes.length === 0));
  const ok = results.filter(r => r.changes && r.changes.length > 0);

  /* eslint-disable no-console */
  console.group(`[skillVerify] ${results.length} skills — ${broken.length} broken, ${ok.length} ok`);
  if (broken.length) {
    console.warn('BROKEN (no observable effect):');
    for (const b of broken) console.warn(`  ${b.class}/${b.id} (${b.name}) [${b.type}]${b.error ? ' ERROR: ' + b.error : ''}`);
  }
  console.log('OK skills:', ok.length);
  console.groupEnd();
  /* eslint-enable no-console */
  return { ok, broken, all: results };
}

// Expose globally when debug mode is on.
if (typeof window !== 'undefined') {
  window.__verifySkills = verifySkills;
}
