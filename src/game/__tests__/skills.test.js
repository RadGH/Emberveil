// M89: tests for mergeSkillForCast — talent + upgrade merging.
import { describe, it, expect } from 'vitest';
import { mergeSkillForCast, SKILLS } from '../skills.js';

describe('mergeSkillForCast', () => {
  it('returns a deep clone of effect when no talents or upgrades selected', () => {
    const m = { talentsPurchased: {}, level: 1 };
    const merged = mergeSkillForCast(SKILLS.battle_cry, m);
    expect(merged.effect.dmgBuff).toBe(0.2);
    merged.effect.dmgBuff = 999;
    expect(SKILLS.battle_cry.effect.dmgBuff).toBe(0.2); // original untouched
  });

  it('merges a talent effect into the skill effect (numeric add)', () => {
    // Unbreakable: base reflect 0.1 + Thorns talent reflect 0.25 → 0.35
    const m = { talentsPurchased: { ub_reflect: true }, level: 1 };
    const merged = mergeSkillForCast(SKILLS.unbreakable, m);
    expect(merged.effect.reflect).toBeCloseTo(0.35);
    expect(merged.effect.dmgReduct).toBeCloseTo(0.5);
  });

  it('applies upgrade bonus by character level', () => {
    // M266: upgrade damageMult now REPLACES (was additive). Cleave L5 upgrade
    // sets damageMult to 1.5; aoe: adjacent2 also applies.
    const m = { talentsPurchased: {}, level: 5 };
    const merged = mergeSkillForCast(SKILLS.cleave, m);
    expect(merged.damageMult).toBeCloseTo(1.5);
    expect(merged.aoe).toBe('adjacent2');
  });

  it('highest reached upgrade tier wins (replace semantics)', () => {
    const m = { talentsPurchased: {}, level: 20 };
    const merged = mergeSkillForCast(SKILLS.cleave, m);
    // M266: both upgrades apply but the later one replaces → 2.0.
    expect(merged.damageMult).toBeCloseTo(2.0);
  });

  it('talent that changes aoe promotes to top-level (Wider Spin → row2)', () => {
    const m = { talentsPurchased: { ww_extra: true }, level: 1 };
    const merged = mergeSkillForCast(SKILLS.whirlwind, m);
    expect(merged.aoe).toBe('row2');
  });

  it('concatenates statusEffects arrays from talents', () => {
    const m = { talentsPurchased: { cl_bleed: true }, level: 1 };
    const merged = mergeSkillForCast(SKILLS.cleave, m);
    expect(Array.isArray(merged.statusEffects)).toBe(true);
    expect(merged.statusEffects.some(s => s.type === 'bleed')).toBe(true);
  });

  it('null/undefined skill passes through safely', () => {
    expect(mergeSkillForCast(null, {})).toBe(null);
  });

  it('smoke-merges every skill in SKILLS with all talents purchased at max level', () => {
    const allTalents = {};
    for (const sk of Object.values(SKILLS)) {
      for (const t of (sk.talents || [])) allTalents[t.id] = true;
    }
    const m = { talentsPurchased: allTalents, level: 99 };
    for (const sk of Object.values(SKILLS)) {
      const merged = mergeSkillForCast(sk, m);
      expect(merged).toBeTruthy();
      expect(merged.name).toBe(sk.name);
      expect(merged.effect).toBeTruthy();
    }
  });
});
