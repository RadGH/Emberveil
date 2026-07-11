/**
 * bossVariants.test.js — M-S17 boss variant system tests.
 *
 * Tests:
 *   1. resolveVariant returns null when no variant file exists.
 *   2. resolveVariant matches a variant by flag condition.
 *   3. resolveVariant returns null when condition not met.
 *   4. applyVariant applies nameOverride.
 *   5. applyVariant applies statMultipliers.
 *   6. applyVariant registers variant phases via bossPhases.registerVariantPhases.
 *   7. applyVariant returns the encounter reference (mutation in-place).
 *   8. registerVariantPhases merges phases in descending order.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { resolveVariant, applyVariant, registerVariantDefs } from '../storyBossVariants.js';
import { registerVariantPhases, getPhaseThresholds, BOSS_PHASES } from '../../game/bossPhases.js';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeGs(flags = {}, companions = []) {
  return {
    party: [{ name: 'Hero', class: 'warrior', level: 5, hp: 100, maxHp: 100, alive: true }],
    story: {
      act: 1,
      flags,
      counters: {},
      factions: {},
      quests: {},
      companions,
    },
  };
}

function makeEncounter(bossId = '_test_boss') {
  return {
    id: `encounter_${bossId}`,
    enemies: [
      { id: bossId, name: 'Test Boss', hp: 500, maxHp: 500, armor: 10, dmg: [30, 60] },
    ],
  };
}

// ---------------------------------------------------------------------------
// Register test variant definitions before tests.
// ---------------------------------------------------------------------------

const TEST_VARIANT_DEFS = {
  bossId: '_test_boss',
  variants: [
    {
      id: 'empowered',
      condition: { flag: 'test_boss_empowered' },
      phases: [
        { threshold: 0.5, name: 'Empowered Fury', onEnter: 'The boss surges!', addStatuses: [{ type: 'fury', duration: 3, power: 10 }] },
      ],
      nameOverride: 'Empowered Test Boss',
      statMultipliers: { hp: 1.25, armor: 1.1 },
    },
    {
      id: 'weakened',
      condition: { flag: 'test_boss_weakened' },
      phases: [],
      nameOverride: 'Weakened Test Boss',
      statMultipliers: { hp: 0.7, armor: 0.5 },
    },
  ],
};

// Pre-register so resolveVariant can find it.
registerVariantDefs('_test_boss', TEST_VARIANT_DEFS);

// ---------------------------------------------------------------------------
// 1. resolveVariant — no variant file
// ---------------------------------------------------------------------------

describe('resolveVariant — no match', () => {
  it('returns null for an unknown boss with no registered defs', () => {
    const gs = makeGs();
    const result = resolveVariant(gs, 'completely_unknown_boss_xyz');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. resolveVariant — flag condition matches
// ---------------------------------------------------------------------------

describe('resolveVariant — condition match', () => {
  it('returns the empowered variant when flag is set', () => {
    const gs = makeGs({ test_boss_empowered: true });
    const variant = resolveVariant(gs, '_test_boss');
    expect(variant).not.toBeNull();
    expect(variant.id).toBe('empowered');
  });

  it('returns the weakened variant when weakened flag is set', () => {
    const gs = makeGs({ test_boss_weakened: true });
    const variant = resolveVariant(gs, '_test_boss');
    expect(variant).not.toBeNull();
    expect(variant.id).toBe('weakened');
  });
});

// ---------------------------------------------------------------------------
// 3. resolveVariant — condition not met
// ---------------------------------------------------------------------------

describe('resolveVariant — condition not met', () => {
  it('returns null when neither flag is set', () => {
    const gs = makeGs({});
    const result = resolveVariant(gs, '_test_boss');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. applyVariant — nameOverride
// ---------------------------------------------------------------------------

describe('applyVariant — nameOverride', () => {
  it('replaces the boss name', () => {
    const gs = makeGs({ test_boss_empowered: true });
    const variant = resolveVariant(gs, '_test_boss');
    const encounter = makeEncounter('_test_boss');

    applyVariant(encounter, variant, '_test_boss');
    expect(encounter.enemies[0].name).toBe('Empowered Test Boss');
    expect(encounter.enemies[0]._variantName).toBe('Empowered Test Boss');
  });
});

// ---------------------------------------------------------------------------
// 5. applyVariant — statMultipliers
// ---------------------------------------------------------------------------

describe('applyVariant — statMultipliers', () => {
  it('scales hp by 1.25 for empowered variant', () => {
    const gs = makeGs({ test_boss_empowered: true });
    const variant = resolveVariant(gs, '_test_boss');
    const encounter = makeEncounter('_test_boss');
    const origHp = encounter.enemies[0].hp;

    applyVariant(encounter, variant, '_test_boss');
    expect(encounter.enemies[0].hp).toBe(Math.round(origHp * 1.25));
    expect(encounter.enemies[0].maxHp).toBe(Math.round(500 * 1.25));
  });

  it('scales hp by 0.7 for weakened variant', () => {
    const gs = makeGs({ test_boss_weakened: true });
    const variant = resolveVariant(gs, '_test_boss');
    const encounter = makeEncounter('_test_boss');

    applyVariant(encounter, variant, '_test_boss');
    expect(encounter.enemies[0].hp).toBe(Math.round(500 * 0.7));
  });
});

// ---------------------------------------------------------------------------
// 6. applyVariant — registers variant phases
// ---------------------------------------------------------------------------

describe('applyVariant — phase registration', () => {
  it('registers variant phases with bossPhases', () => {
    const gs = makeGs({ test_boss_empowered: true });
    const variant = resolveVariant(gs, '_test_boss');
    const encounter = makeEncounter('_test_boss_phases_test');
    encounter.enemies[0].id = '_test_boss_phases_test';

    // The boss id has no base phases.
    const bossId = '_test_boss_phases_test';
    applyVariant(encounter, variant, bossId);

    const thresholds = getPhaseThresholds(bossId);
    expect(thresholds).toContain(0.5);
  });
});

// ---------------------------------------------------------------------------
// 7. applyVariant — returns same encounter reference
// ---------------------------------------------------------------------------

describe('applyVariant — returns reference', () => {
  it('returns the same encounter object (mutated in place)', () => {
    const gs = makeGs({ test_boss_empowered: true });
    const variant = resolveVariant(gs, '_test_boss');
    const encounter = makeEncounter();

    const returned = applyVariant(encounter, variant, '_test_boss');
    expect(returned).toBe(encounter);
  });

  it('does not throw when encounter is null', () => {
    expect(() => applyVariant(null, {}, '_test_boss')).not.toThrow();
  });

  it('does not throw when variant is null', () => {
    const encounter = makeEncounter();
    expect(() => applyVariant(encounter, null, '_test_boss')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 8. registerVariantPhases — merges in descending order
// ---------------------------------------------------------------------------

describe('registerVariantPhases — phase merge', () => {
  it('merges phases in descending threshold order', () => {
    const bossId = '_variant_phase_test_boss';
    registerVariantPhases(bossId, [
      { threshold: 0.3, name: 'Phase C' },
      { threshold: 0.7, name: 'Phase A' },
      { threshold: 0.5, name: 'Phase B' },
    ]);

    const thresholds = getPhaseThresholds(bossId);
    expect(thresholds).toEqual([0.7, 0.5, 0.3]);
  });

  it('replaces a phase when threshold matches an existing base phase', () => {
    const bossId = '_variant_override_boss';

    // Set up a base phase.
    BOSS_PHASES[bossId] = {
      phases: [{ hpThreshold: 0.5, name: 'Base Phase', addSpells: ['base_spell'] }],
    };

    registerVariantPhases(bossId, [
      { threshold: 0.5, name: 'Variant Phase', addSpells: ['variant_spell'] },
    ]);

    const phases = BOSS_PHASES[bossId].phases;
    const phase50 = phases.find(p => p.hpThreshold === 0.5);
    expect(phase50.name).toBe('Variant Phase');
    expect(phase50.addSpells).toContain('variant_spell');
  });

  it('is a no-op for empty variantPhases array', () => {
    const bossId = '_noop_boss';
    BOSS_PHASES[bossId] = { phases: [{ hpThreshold: 0.6, name: 'Original' }] };

    registerVariantPhases(bossId, []);

    expect(BOSS_PHASES[bossId].phases[0].name).toBe('Original');
  });
});
