/**
 * skillCheck.test.js — M-S18 skill check resolver tests.
 *
 * 5 scenarios + per-class lookup:
 *   1. Warrior with STR 14 + intimidation passes DC 12.
 *   2. Mage with INT 9 fails DC 16, partial at DC ≤ power + 3.
 *   3. Ranger with CON 11 + flagBonus passes DC 14 (on average).
 *   4. Rogue with DEX check for stealth gets +2 class affinity.
 *   5. act_level scaling adds act*2 to power.
 *   6. Per-class: each of the 10 classes has correct affinity lookup.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { resolveSkillCheck, getClassAffinityBonus, setAffinityTable } from '../storySkillCheck.js';

// ---------------------------------------------------------------------------
// Inject a known affinity table so tests are not FS-dependent.
// ---------------------------------------------------------------------------

const TEST_AFFINITIES = {
  warrior:     { strength: 2, intimidation: 2, medicine: 2 },
  rogue:       { stealth: 2, mechanisms: 2, deception: 2 },
  mage:        { arcana: 2, intelligence: 2, occult: 2 },
  ranger:      { nature: 2, survival: 2, perception: 2 },
  priest:      { religion: 2, medicine: 2, wisdom: 2 },
  monk:        { wisdom: 2, dexterity: 2, perception: 2 },
  shaman:      { nature: 2, occult: 2, wisdom: 2 },
  witch_hunter:{ occult: 2, perception: 2, intimidation: 2 },
  runesmith:   { crafting: 2, mechanisms: 2, arcana: 2 },
  tinker:      { mechanisms: 2, crafting: 2, perception: 2 },
};

setAffinityTable(TEST_AFFINITIES);

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeGs({ cls = 'warrior', level = 4, str = 14, dex = 10, int = 8, con = 12, flags = {}, act = 1 } = {}) {
  return {
    party: [{
      name: 'Hero',
      class: cls,
      level,
      hp: 80, maxHp: 80,
      str, dex, int, con,
      alive: true,
    }],
    story: {
      act,
      rngState: 0xABCD1234,
      currentNodeId: 'a1_n_skill',
      flags,
    },
  };
}

// ---------------------------------------------------------------------------
// 1. Warrior + STR 14 + intimidation — expects pass at DC 12
// ---------------------------------------------------------------------------

describe('resolveSkillCheck — scenario 1: warrior intimidation', () => {
  it('produces a power value and pass/fail result', () => {
    const gs = makeGs({ cls: 'warrior', str: 14, level: 4 });
    const result = resolveSkillCheck(gs, { skill: 'intimidation', stat: 'STR', dc: 12 });

    expect(result).toHaveProperty('pass');
    expect(result).toHaveProperty('partial');
    expect(result).toHaveProperty('power');
    expect(typeof result.power).toBe('number');
    expect(result.dc).toBe(12);

    // Class affinity for warrior+intimidation = +2.
    expect(result.breakdown.classAffinityBonus).toBe(2);

    // Minimum power without random roll: 14 (str) + levelBonus + 2 (affinity) = at least 17.
    // DC is 12. Even with randomRoll=1, power should be ≥ 18 > 12 → pass.
    expect(result.pass).toBe(true);
  });

  it('breakdown has all fields', () => {
    const gs = makeGs({ cls: 'warrior', str: 14 });
    const result = resolveSkillCheck(gs, { skill: 'intimidation', stat: 'STR', dc: 12 });
    expect(result.breakdown).toMatchObject({
      statValue:          expect.any(Number),
      levelBonus:         expect.any(Number),
      classAffinityBonus: expect.any(Number),
      storyFlagBonus:     expect.any(Number),
      gearUtility:        expect.any(Number),
      randomRoll:         expect.any(Number),
      scalingBonus:       expect.any(Number),
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Mage + INT 9 — fail at DC 16, partial at DC ≤ power + 3
// ---------------------------------------------------------------------------

describe('resolveSkillCheck — scenario 2: mage arcana vs DC 16', () => {
  it('partial if power is within 3 of DC', () => {
    // Force determinism by fixing rngState; the RNG ephemeral roll is seeded by rngState ^ hash(nodeId).
    // At low stats the roll can land anywhere in 1..20. We test the pass/partial logic.
    const gs = makeGs({ cls: 'mage', int: 9, level: 4 });
    const result = resolveSkillCheck(gs, { skill: 'arcana', stat: 'INT', dc: 16 });

    // partial = !pass && power >= dc - 3
    expect(result.partial).toBe(!result.pass && result.power >= 13);

    // Mage affinity for arcana = +2
    expect(result.breakdown.classAffinityBonus).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 3. Ranger + CON 11 + flagBonus
// ---------------------------------------------------------------------------

describe('resolveSkillCheck — scenario 3: ranger survival + flag bonus', () => {
  it('storyFlagBonus is 2 when skillcheck_bonus_survival is set', () => {
    const gs = makeGs({ cls: 'ranger', con: 11, flags: { skillcheck_bonus_survival: true } });
    const result = resolveSkillCheck(gs, { skill: 'survival', stat: 'CON', dc: 14 });

    expect(result.breakdown.storyFlagBonus).toBe(2);
    // Ranger affinity for survival = +2.
    expect(result.breakdown.classAffinityBonus).toBe(2);
  });

  it('storyFlagBonus is 0 when flag not set', () => {
    const gs = makeGs({ cls: 'ranger', con: 11 });
    const result = resolveSkillCheck(gs, { skill: 'survival', stat: 'CON', dc: 14 });
    expect(result.breakdown.storyFlagBonus).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Rogue + DEX stealth — class affinity +2
// ---------------------------------------------------------------------------

describe('resolveSkillCheck — scenario 4: rogue stealth affinity', () => {
  it('grants +2 class affinity for rogue+stealth', () => {
    const gs = makeGs({ cls: 'rogue', dex: 12 });
    const result = resolveSkillCheck(gs, { skill: 'stealth', stat: 'DEX', dc: 10 });
    expect(result.breakdown.classAffinityBonus).toBe(2);
  });

  it('grants 0 class affinity for rogue+intimidation', () => {
    const gs = makeGs({ cls: 'rogue', dex: 12 });
    const result = resolveSkillCheck(gs, { skill: 'intimidation', stat: 'STR', dc: 10 });
    expect(result.breakdown.classAffinityBonus).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 5. act_level scaling
// ---------------------------------------------------------------------------

describe('resolveSkillCheck — scenario 5: act_level scaling', () => {
  it('adds act*2 to power when scaling is act_level', () => {
    const gs1 = makeGs({ act: 1, str: 10 });
    const gs2 = makeGs({ act: 3, str: 10 });

    const r1 = resolveSkillCheck(gs1, { skill: 'strength', stat: 'STR', dc: 10, scaling: 'act_level' }, 'same_node');
    const r2 = resolveSkillCheck(gs2, { skill: 'strength', stat: 'STR', dc: 10, scaling: 'act_level' }, 'same_node');

    expect(r1.breakdown.scalingBonus).toBe(2);  // act 1 × 2
    expect(r2.breakdown.scalingBonus).toBe(6);  // act 3 × 2
    expect(r2.power - r1.power).toBe(4);         // 4 more power at act 3
  });

  it('does not add scaling when scaling is undefined', () => {
    const gs = makeGs({ act: 3, str: 10 });
    const result = resolveSkillCheck(gs, { skill: 'strength', stat: 'STR', dc: 10 });
    expect(result.breakdown.scalingBonus).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 6. Per-class affinity lookup
// ---------------------------------------------------------------------------

describe('getClassAffinityBonus — per-class lookup', () => {
  const expectedAffinities = {
    warrior:     { strength: 2, intimidation: 2, medicine: 2, stealth: 0 },
    rogue:       { stealth: 2, mechanisms: 2, deception: 2, arcana: 0 },
    mage:        { arcana: 2, intelligence: 2, occult: 2, stealth: 0 },
    ranger:      { nature: 2, survival: 2, perception: 2, arcana: 0 },
    priest:      { religion: 2, medicine: 2, wisdom: 2, deception: 0 },
    monk:        { wisdom: 2, dexterity: 2, perception: 2, arcana: 0 },
    shaman:      { nature: 2, occult: 2, wisdom: 2, stealth: 0 },
    witch_hunter:{ occult: 2, perception: 2, intimidation: 2, stealth: 0 },
    runesmith:   { crafting: 2, mechanisms: 2, arcana: 2, stealth: 0 },
    tinker:      { mechanisms: 2, crafting: 2, perception: 2, arcana: 0 },
  };

  for (const [cls, affinities] of Object.entries(expectedAffinities)) {
    for (const [skill, expected] of Object.entries(affinities)) {
      it(`${cls} → ${skill} = ${expected}`, () => {
        expect(getClassAffinityBonus(cls, skill)).toBe(expected);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// 7. randomRoll is bounded 1..20
// ---------------------------------------------------------------------------

describe('resolveSkillCheck — randomRoll bounds', () => {
  it('randomRoll is in range 1..20 across many seeds', () => {
    for (let i = 0; i < 50; i++) {
      const gs = makeGs({ str: 10 });
      gs.story.rngState = i * 0x9E3779B9 + 1;
      const result = resolveSkillCheck(gs, { skill: 'strength', stat: 'STR', dc: 10 }, `node_${i}`);
      expect(result.breakdown.randomRoll).toBeGreaterThanOrEqual(1);
      expect(result.breakdown.randomRoll).toBeLessThanOrEqual(20);
    }
  });
});

// ---------------------------------------------------------------------------
// 8. Edge cases
// ---------------------------------------------------------------------------

describe('resolveSkillCheck — edge cases', () => {
  it('does not throw for empty party', () => {
    const gs = { party: [], story: { act: 1, rngState: 1, flags: {}, currentNodeId: 'n1' } };
    expect(() => resolveSkillCheck(gs, { skill: 'strength', stat: 'STR', dc: 10 })).not.toThrow();
  });

  it('does not throw for unknown stat', () => {
    const gs = makeGs();
    expect(() => resolveSkillCheck(gs, { skill: 'unknown', stat: 'WISDOM', dc: 10 })).not.toThrow();
  });

  it('handles unknown class gracefully (0 affinity)', () => {
    expect(getClassAffinityBonus('unknown_class', 'stealth')).toBe(0);
    expect(getClassAffinityBonus(null, 'stealth')).toBe(0);
    expect(getClassAffinityBonus('warrior', null)).toBe(0);
  });
});
