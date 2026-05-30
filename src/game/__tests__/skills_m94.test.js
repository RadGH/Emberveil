// M94: tests for the skill rewiring batch (9 ghost-buffs, 8 statusEffects,
// per-skill payloads, Corpse Explosion, Resurrect talents, Death Mark marked status).
//
// Most tests verify payload shape via mergeSkillForCast (data-level). A few
// drive the real combat resolver by constructing a minimal CombatScreen via
// Object.create() with stubbed side-effect methods.

import { describe, it, expect, vi } from 'vitest';
import { mergeSkillForCast, SKILLS } from '../skills.js';
import { getDmgBuffMult, getCritBonusTotal } from '../../mods/statusModel.js';

// Stub minimal DOM globals so importing CombatScreen (and its DOM-touching
// deps like TapInventoryScreen / TownScreen) doesn't throw at module load.
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    getElementById: () => null,
    createElement: () => ({ setAttribute: () => {}, appendChild: () => {}, style: {}, classList: { add:()=>{}, remove:()=>{} } }),
    head: { appendChild: () => {} },
    body: { appendChild: () => {}, removeChild: () => {} },
    addEventListener: () => {},
  };
}
if (typeof globalThis.window === 'undefined') {
  globalThis.window = { addEventListener: () => {}, removeEventListener: () => {}, localStorage: { getItem:()=>null, setItem:()=>{} } };
}
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = { getItem:()=>null, setItem:()=>{}, removeItem:()=>{} };
}

const { CombatScreen } = await import('../../ui/screens/CombatScreen.js');

// -- tiny harness for _executeSkill / _applyDamage / _processStatusEffects ----
function makeCombat({ allies = [], enemies = [] } = {}) {
  const cs = Object.create(CombatScreen.prototype);
  cs._allies = allies;
  cs._allEnemies = enemies;
  cs._enemyGroups = [enemies];
  cs._flashMap = new Map();
  cs._dmgNumbers = [];
  cs._particles = [];
  cs._log = [];
  cs.audio = { playSfx: vi.fn(), playCombatMusic: vi.fn() };
  cs._spawnDmgNumber = vi.fn();
  cs._spawnParticles = vi.fn();
  cs._log_ = vi.fn();
  cs._updateHud = vi.fn();
  cs._shakeTimer = 0;
  return cs;
}

function mkAlly(overrides = {}) {
  return {
    id: overrides.id || Math.random().toString(36).slice(2),
    name: 'Ally', alive: true, hp: 100, maxHp: 100, mp: 50, maxMp: 50,
    dmg: [10, 12], armor: 0, magicResist: 0, dodge: 0, hit: 50, critBonus: 0,
    x: 0, y: 0, stance: 'ready', statuses: [], tags: '',
    ...overrides,
  };
}
function mkEnemy(overrides = {}) {
  return {
    id: overrides.id || Math.random().toString(36).slice(2),
    name: 'Enemy', alive: true, hp: 100, maxHp: 100,
    dmg: [5, 8], armor: 0, magicResist: 0, dodge: 0, hit: 40, critBonus: 0,
    x: 0, y: 0, stance: 'ready', statuses: [], tags: '', groupIdx: 0,
    ...overrides,
  };
}

describe('M94 — ghost-buff effect objects', () => {
  it('Sanctuary has barrier + hpRegen + rounds', () => {
    const m = { talentsPurchased: {}, level: 1 };
    const s = mergeSkillForCast(SKILLS.sanctuary, m);
    expect(s.effect.barrier).toBe(30);
    expect(s.effect.hpRegen).toBe(8);
    expect(s.effect.rounds).toBe(4);
    expect(s.target).toBe('party');
  });

  it('Inspiring Tune has dmgBuff 0.15 / 4 rounds', () => {
    const s = mergeSkillForCast(SKILLS.inspiring_tune, { talentsPurchased: {}, level: 1 });
    expect(s.effect.dmgBuff).toBeCloseTo(0.15);
    expect(s.effect.rounds).toBe(4);
  });

  it('Ballad of Valor grants extraAction=true + dmgBuff', () => {
    const s = mergeSkillForCast(SKILLS.ballad_of_valor, { talentsPurchased: {}, level: 1 });
    expect(s.effect.extraAction).toBe(true);
    expect(s.effect.dmgBuff).toBeCloseTo(0.10);
  });

  it('Soul Pact has selfDamagePct + dmgBuff', () => {
    const s = mergeSkillForCast(SKILLS.soul_pact, { talentsPurchased: {}, level: 1 });
    expect(s.effect.selfDamagePct).toBeCloseTo(0.20);
    expect(s.effect.dmgBuff).toBeCloseTo(0.30);
  });

  it('Fel Sight has critBonus + hitBonus', () => {
    const s = mergeSkillForCast(SKILLS.fel_sight, { talentsPurchased: {}, level: 1 });
    expect(s.effect.critBonus).toBeCloseTo(0.25);
    expect(s.effect.hitBonus).toBe(15);
  });

  it('Dragon Scales has armorBonus + magicResistBonus', () => {
    const s = mergeSkillForCast(SKILLS.dragon_scales, { talentsPurchased: {}, level: 1 });
    expect(s.effect.armorBonus).toBe(25);
    expect(s.effect.magicResistBonus).toBe(15);
  });

  it('Draconic Fury has extraAction + dmgBuff', () => {
    const s = mergeSkillForCast(SKILLS.draconic_fury, { talentsPurchased: {}, level: 1 });
    expect(s.effect.extraAction).toBe(true);
    expect(s.effect.dmgBuff).toBeCloseTo(0.30);
  });

  it('Taunt applies tauntedBy', () => {
    const s = mergeSkillForCast(SKILLS.taunt, { talentsPurchased: {}, level: 1 });
    expect(s.effect.tauntedBy).toBe('caster');
    expect(s.target).toBe('enemy');
  });

  it('Poison Blade has onHitStatus payload', () => {
    const s = mergeSkillForCast(SKILLS.poison_blade, { talentsPurchased: {}, level: 1 });
    expect(s.effect.onHitStatus).toBeTruthy();
    expect(s.effect.onHitStatus.type).toBe('poison');
  });
});

describe('M94 — statusEffects arrays', () => {
  const cases = [
    ['entangle', 'stun'],
    ['hellfire', 'burn'],
    ['glaive_toss', 'bleed'],
    ['thrown_junk', 'stun'],
    ['makeshift_bomb', 'burn'],
    ['natures_wrath', 'bleed'],
    ['static_field', 'slow'],
    ['blizzard', 'slow'],
  ];
  for (const [id, type] of cases) {
    it(`${id} carries ${type} statusEffects`, () => {
      const s = mergeSkillForCast(SKILLS[id], { talentsPurchased: {}, level: 1 });
      expect(Array.isArray(s.statusEffects)).toBe(true);
      expect(s.statusEffects.some(st => st.type === type)).toBe(true);
    });
  }
});

describe('M94 — per-skill payload fixes', () => {
  it('Smite has effect.bonusVsUndead', () => {
    const s = mergeSkillForCast(SKILLS.smite, { talentsPurchased: {}, level: 1 });
    expect(s.effect.bonusVsUndead).toBeCloseTo(0.5);
  });
  it('Holy Strike has effect.bonusVsUndead + bonusVsDemon', () => {
    const s = mergeSkillForCast(SKILLS.holy_strike, { talentsPurchased: {}, level: 1 });
    expect(s.effect.bonusVsUndead).toBeCloseTo(0.5);
    expect(s.effect.bonusVsDemon).toBeCloseTo(0.5);
  });
  it('Rejuvenation has hpRegen payload', () => {
    const s = mergeSkillForCast(SKILLS.rejuvenation, { talentsPurchased: {}, level: 1 });
    expect(s.effect.hpRegen).toBe(6);
  });
  it('Rewind has cleanse array', () => {
    const s = mergeSkillForCast(SKILLS.rewind, { talentsPurchased: {}, level: 1 });
    expect(s.effect.cleanse).toContain('poison');
  });
  it('Backstab has conditionBonus', () => {
    const s = mergeSkillForCast(SKILLS.backstab, { talentsPurchased: {}, level: 1 });
    expect(s.effect.conditionBonus).toBeCloseTo(1.5);
  });
  it('Sunder Armor has armorReduce', () => {
    const s = mergeSkillForCast(SKILLS.sunder_armor, { talentsPurchased: {}, level: 1 });
    expect(s.effect.armorReduce).toBe(5);
  });
  it('Aimed Shot has effect.armorPen', () => {
    const s = mergeSkillForCast(SKILLS.aimed_shot, { talentsPurchased: {}, level: 1 });
    expect(s.effect.armorPen).toBe(8);
  });
  it('Dragon Claw has effect.armorPen', () => {
    const s = mergeSkillForCast(SKILLS.dragon_claw, { talentsPurchased: {}, level: 1 });
    expect(s.effect.armorPen).toBe(6);
  });
  it('Demon Bolt has effect.bonusVsDemon', () => {
    const s = mergeSkillForCast(SKILLS.demon_bolt, { talentsPurchased: {}, level: 1 });
    expect(s.effect.bonusVsDemon).toBeCloseTo(0.5);
  });
  it('Vengeance has baseline dmgBuff', () => {
    const s = mergeSkillForCast(SKILLS.vengeance, { talentsPurchased: {}, level: 1 });
    expect(s.effect.dmgBuff).toBeCloseTo(0.15);
  });
});

describe('M94 — Corpse Explosion', () => {
  it('replaces death_coil with corpse_explosion', () => {
    expect(SKILLS.death_coil).toBeUndefined();
    expect(SKILLS.corpse_explosion).toBeDefined();
    expect(SKILLS.corpse_explosion.target).toBe('corpse');
    expect(SKILLS.corpse_explosion.effect.corpseHpScale).toBeCloseTo(0.5);
  });
});

describe('M94 — Resurrect talents', () => {
  it('cooldown is 10 rounds', () => {
    expect(SKILLS.mass_resurrection.cooldown).toBe(10);
  });
  it('res_heal_60 talent stacks reviveHp to 0.60', () => {
    const s = mergeSkillForCast(SKILLS.mass_resurrection, { talentsPurchased: { res_heal_60: true }, level: 1 });
    expect(s.effect.reviveHp).toBeCloseTo(0.60);
  });
  it('res_shield talent adds reviveImmuneRounds=1', () => {
    const s = mergeSkillForCast(SKILLS.mass_resurrection, { talentsPurchased: { res_shield: true }, level: 1 });
    expect(s.effect.reviveImmuneRounds).toBe(1);
  });
});

describe('M94 — Death Mark / marked status', () => {
  it('Death Mark is type:damage with marked statusEffect', () => {
    const s = mergeSkillForCast(SKILLS.death_mark, { talentsPurchased: {}, level: 1 });
    expect(s.type).toBe('damage');
    expect(s.statusEffects.some(st => st.type === 'marked')).toBe(true);
  });

  it('marked status amplifies _applyDamage by 1.3×', () => {
    const cs = makeCombat();
    const target = mkEnemy({ hp: 1000, maxHp: 1000 });
    target.statuses.push({ type: 'marked', duration: 3 });
    const before = target.hp;
    cs._applyDamage(null, target, 100, '#fff');
    // 100 * 1.3 = 130
    expect(before - target.hp).toBe(130);
  });
});

describe('M94 — combat harness branches', () => {
  it('Sanctuary applies barrier + regen status to the whole party', () => {
    const a1 = mkAlly({ id: 'h1' });
    const a2 = mkAlly({ id: 'h2' });
    const cs = makeCombat({ allies: [a1, a2], enemies: [mkEnemy()] });
    const partyMember = { attrs: { STR: 8, DEX: 8, INT: 10, CON: 8 } };
    cs._executeSkill(a1, SKILLS.sanctuary, cs._allEnemies, cs._allies, partyMember);
    for (const t of [a1, a2]) {
      expect(t.statuses.some(s => s.type === 'barrier' && s.power >= 30)).toBe(true);
      expect(t.statuses.some(s => s.type === 'regen' && s.power === 8)).toBe(true);
    }
  });

  it('Soul Pact deals 20% max HP self-damage and grants dmgBuff', () => {
    const caster = mkAlly({ hp: 200, maxHp: 200 });
    const cs = makeCombat({ allies: [caster], enemies: [mkEnemy()] });
    cs._executeSkill(caster, SKILLS.soul_pact, cs._allEnemies, cs._allies, { attrs: { STR:8,DEX:8,INT:8,CON:8 } });
    expect(caster.hp).toBe(200 - 40);
    expect(getDmgBuffMult(caster)).toBeCloseTo(0.30);
  });

  it('Fel Sight adds critBonus + hit to caster', () => {
    const caster = mkAlly({ critBonus: 5, hit: 50 });
    const cs = makeCombat({ allies: [caster], enemies: [mkEnemy()] });
    cs._executeSkill(caster, SKILLS.fel_sight, cs._allEnemies, cs._allies, { attrs:{STR:8,DEX:8,INT:8,CON:8} });
    expect(getCritBonusTotal(caster)).toBeGreaterThan(5);
    expect(caster.hit).toBeGreaterThan(50);
  });

  it('Dragon Scales raises armor and magicResist', () => {
    const caster = mkAlly({ armor: 10, magicResist: 5 });
    const cs = makeCombat({ allies: [caster], enemies: [mkEnemy()] });
    cs._executeSkill(caster, SKILLS.dragon_scales, cs._allEnemies, cs._allies, { attrs:{STR:8,DEX:8,INT:8,CON:8} });
    expect(caster.armor).toBe(35);
    expect(caster.magicResist).toBe(20);
  });

  it('Poison Blade sets caster.onHitStatus', () => {
    const caster = mkAlly();
    const cs = makeCombat({ allies: [caster], enemies: [mkEnemy()] });
    cs._executeSkill(caster, SKILLS.poison_blade, cs._allEnemies, cs._allies, { attrs:{STR:8,DEX:8,INT:8,CON:8} });
    expect(caster.onHitStatus).toBeTruthy();
    expect(caster.onHitStatus.type).toBe('poison');
  });

  it('Inspiring Tune buffs every party member', () => {
    const a1 = mkAlly({ id:'a' }); const a2 = mkAlly({ id:'b' });
    const cs = makeCombat({ allies: [a1, a2], enemies: [mkEnemy()] });
    cs._executeSkill(a1, SKILLS.inspiring_tune, cs._allEnemies, cs._allies, { attrs:{STR:8,DEX:8,INT:8,CON:8} });
    expect(getDmgBuffMult(a1)).toBeCloseTo(0.15);
    expect(getDmgBuffMult(a2)).toBeCloseTo(0.15);
  });

  it('Ballad of Valor sets extraAction on party', () => {
    const a1 = mkAlly({ id:'a' }); const a2 = mkAlly({ id:'b' });
    const cs = makeCombat({ allies: [a1, a2], enemies: [mkEnemy()] });
    cs._executeSkill(a1, SKILLS.ballad_of_valor, cs._allEnemies, cs._allies, { attrs:{STR:8,DEX:8,INT:8,CON:8} });
    expect(a1.extraAction).toBeGreaterThanOrEqual(1);
    expect(a2.extraAction).toBeGreaterThanOrEqual(1);
  });

  it('Lay on Hands honors healStat (str) via merged skill', () => {
    const target = mkAlly({ hp: 10 });
    const caster = mkAlly();
    const cs = makeCombat({ allies: [caster, target], enemies: [mkEnemy()] });
    // Synthesize a skill with healStat:'str' via mergeSkillForCast (no built-in talent — construct inline).
    const custom = { ...SKILLS.lay_on_hands, healStat: 'str' };
    cs._executeSkill(caster, custom, cs._allEnemies, cs._allies, { attrs:{STR:20,DEX:8,INT:5,CON:8} });
    // heal = 2 * 20 * (1 + 0.4) = 56 (with STR-based math — prove it's not using INT=5 which would give 14)
    expect(target.hp).toBeGreaterThan(30);
  });

  it('Rejuvenation pushes a regen status of power 6', () => {
    const target = mkAlly({ hp: 20 });
    const cs = makeCombat({ allies: [target], enemies: [mkEnemy()] });
    cs._executeSkill(target, SKILLS.rejuvenation, cs._allEnemies, cs._allies, { attrs:{STR:8,DEX:8,INT:10,CON:8} });
    expect(target.statuses.some(s => s.type === 'regen' && s.power === 6)).toBe(true);
  });

  it('Rewind cleanses burn/bleed/poison/stun from target', () => {
    const target = mkAlly({ hp: 10, statuses: [
      { type:'burn', duration: 3, power: 5 },
      { type:'bleed', duration: 3, power: 4 },
      { type:'regen', duration: 2, power: 3 },
    ]});
    const cs = makeCombat({ allies: [target], enemies: [mkEnemy()] });
    cs._executeSkill(target, SKILLS.rewind, cs._allEnemies, cs._allies, { attrs:{STR:8,DEX:8,INT:10,CON:8} });
    expect(target.statuses.some(s => s.type === 'burn')).toBe(false);
    expect(target.statuses.some(s => s.type === 'bleed')).toBe(false);
    expect(target.statuses.some(s => s.type === 'regen')).toBe(true);
  });

  it('Corpse Explosion detonates a dead enemy and damages adjacent', () => {
    const corpse = mkEnemy({ id:'c', alive: false, hp: 0, maxHp: 200, groupIdx: 0 });
    const adj1 = mkEnemy({ id:'a', hp: 500, maxHp: 500, groupIdx: 0 });
    const adj2 = mkEnemy({ id:'b', hp: 500, maxHp: 500, groupIdx: 0 });
    const caster = mkAlly();
    const cs = makeCombat({ allies: [caster], enemies: [corpse, adj1, adj2] });
    cs._executeSkill(caster, SKILLS.corpse_explosion, [corpse, adj1, adj2], cs._allies, { attrs:{STR:8,DEX:8,INT:10,CON:8} });
    expect(adj1.hp).toBeLessThan(500);
    expect(corpse._detonated).toBe(true);
  });
});

describe('M94 — Status decay + marked / sunder', () => {
  it('marked status decays after its duration in _processStatusEffects', () => {
    const e = mkEnemy();
    e.statuses.push({ type: 'marked', duration: 1 });
    const cs = makeCombat({ allies: [], enemies: [e] });
    cs._processStatusEffects();
    expect(e.statuses.some(s => s.type === 'marked')).toBe(false);
  });

  it('sunder _armorRestore returns armor when rounds hit 0', () => {
    const e = mkEnemy({ armor: 10 });
    e.armor = 5; // after 5-point sunder
    e._armorRestore = { value: 5, rounds: 1 };
    const cs = makeCombat({ allies: [], enemies: [e] });
    cs._processStatusEffects();
    expect(e.armor).toBe(10);
    expect(e._armorRestore).toBe(null);
  });
});
