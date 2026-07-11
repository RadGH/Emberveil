/**
 * enemyInstance.test.js — M-S17 enemy instance modifier tests.
 *
 * 8 cases:
 *   1. No modifier: instance is a deep clone of base enemy.
 *   2. affix 'tough': HP increased by ~30%.
 *   3. affix 'extra_strong': DMG increased by ~30%.
 *   4. championTier 'champion': HP + DMG bumped; isChampion set.
 *   5. statMultipliers: hp × 1.5.
 *   6. addSkills: spells array extended.
 *   7. nameOverride: name field replaced.
 *   8. Composition: champion + tough + nameOverride all compose.
 */

import { describe, it, expect } from 'vitest';
import { buildEnemyInstance, applyAffix } from '../storyEnemyInstance.js';
import { ENEMIES } from '../../maps/mapData.js';

// ---------------------------------------------------------------------------
// Find a real enemy id to use in tests.
// ---------------------------------------------------------------------------

function _firstEnemyId() {
  const keys = Object.keys(ENEMIES || {});
  return keys[0] || null;
}

// If ENEMIES is empty in headless test env, use a stub.
const STUB_ENEMY_ID = '_test_goblin';
const STUB_ENEMY = { id: STUB_ENEMY_ID, name: 'Goblin', hp: 30, maxHp: 30, armor: 2, dodge: 10, hit: 75, dmg: [5, 12], spells: [], tags: ['beast'], xpValue: 15, gold: [5, 20] };

// Inject stub into ENEMIES if needed.
if (!ENEMIES[STUB_ENEMY_ID]) {
  ENEMIES[STUB_ENEMY_ID] = STUB_ENEMY;
}

// ---------------------------------------------------------------------------
// 1. No modifier — deep clone
// ---------------------------------------------------------------------------

describe('buildEnemyInstance — no modifier', () => {
  it('returns a deep clone of the base enemy', () => {
    const inst = buildEnemyInstance(STUB_ENEMY_ID, {});
    expect(inst.id).toBe(STUB_ENEMY_ID);
    expect(inst.hp).toBe(STUB_ENEMY.hp);
    expect(inst.name).toBe(STUB_ENEMY.name);
    // Must not be the same reference.
    inst.hp = 999;
    expect(ENEMIES[STUB_ENEMY_ID].hp).toBe(30); // original unchanged
  });
});

// ---------------------------------------------------------------------------
// 2. Affix 'tough' — HP +30%
// ---------------------------------------------------------------------------

describe('buildEnemyInstance — affix tough', () => {
  it('increases hp by ~30%', () => {
    const inst = buildEnemyInstance(STUB_ENEMY_ID, { affixes: ['tough'] });
    const expected = Math.round(30 * 1.3);
    expect(inst.hp).toBe(expected);
    expect(inst.maxHp).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// 3. Affix 'extra_strong' — DMG +30%
// ---------------------------------------------------------------------------

describe('buildEnemyInstance — affix extra_strong', () => {
  it('increases dmg by ~30%', () => {
    const inst = buildEnemyInstance(STUB_ENEMY_ID, { affixes: ['extra_strong'] });
    const expected = STUB_ENEMY.dmg.map(d => Math.round(d * 1.3));
    expect(inst.dmg).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// 4. championTier 'champion' — HP + DMG bumped; isChampion set
// ---------------------------------------------------------------------------

describe('buildEnemyInstance — championTier champion', () => {
  it('sets isChampion and bumps HP + DMG', () => {
    const inst = buildEnemyInstance(STUB_ENEMY_ID, { championTier: 'champion' });
    // Base champion: +50% HP, +30% DMG (then stat mods from rollChampionModifiers).
    expect(inst.isChampion).toBe(true);
    expect(inst.hp).toBeGreaterThan(30); // at minimum +50% of 30 = 45
    // DMG[0] should be >= original * 1.3 (may have additional stat mods).
    expect(inst.dmg[0]).toBeGreaterThan(STUB_ENEMY.dmg[0]);
  });

  it('championMods is an array of modifier ids', () => {
    const inst = buildEnemyInstance(STUB_ENEMY_ID, { championTier: 'champion' });
    expect(Array.isArray(inst.championMods)).toBe(true);
    expect(inst.championMods.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 5. statMultipliers — hp × 1.5
// ---------------------------------------------------------------------------

describe('buildEnemyInstance — statMultipliers', () => {
  it('applies hp multiplier', () => {
    const inst = buildEnemyInstance(STUB_ENEMY_ID, { statMultipliers: { hp: 1.5 } });
    expect(inst.hp).toBe(Math.round(30 * 1.5));
    expect(inst.maxHp).toBe(Math.round(30 * 1.5));
  });

  it('applies armor multiplier', () => {
    const inst = buildEnemyInstance(STUB_ENEMY_ID, { statMultipliers: { armor: 2.0 } });
    expect(inst.armor).toBe(Math.round(2 * 2.0));
  });
});

// ---------------------------------------------------------------------------
// 6. addSkills — spells array extended
// ---------------------------------------------------------------------------

describe('buildEnemyInstance — addSkills', () => {
  it('appends skills to spells and spellList', () => {
    const inst = buildEnemyInstance(STUB_ENEMY_ID, { addSkills: ['fireball', 'shadowstrike'] });
    expect(inst.spells).toContain('fireball');
    expect(inst.spells).toContain('shadowstrike');
    expect(inst.spellList).toContain('fireball');
  });
});

// ---------------------------------------------------------------------------
// 7. nameOverride
// ---------------------------------------------------------------------------

describe('buildEnemyInstance — nameOverride', () => {
  it('replaces the enemy name', () => {
    const inst = buildEnemyInstance(STUB_ENEMY_ID, { nameOverride: 'Goblin Warlord' });
    expect(inst.name).toBe('Goblin Warlord');
  });
});

// ---------------------------------------------------------------------------
// 8. Composition: champion + tough + nameOverride
// ---------------------------------------------------------------------------

describe('buildEnemyInstance — composition', () => {
  it('composes champion + tough + nameOverride correctly', () => {
    const inst = buildEnemyInstance(STUB_ENEMY_ID, {
      affixes: ['tough'],
      championTier: 'champion',
      nameOverride: 'Goblin Champion',
    });

    expect(inst.name).toBe('Goblin Champion');
    expect(inst.isChampion).toBe(true);
    // HP should be at least: (30 * 1.3 tough) * 1.5 champion base = 58.5 → 59 min.
    expect(inst.hp).toBeGreaterThan(40);
  });

  it('unknown enemy id returns a stub, not an error', () => {
    const inst = buildEnemyInstance('totally_unknown_enemy_xyzzy', {});
    expect(inst.id).toBe('totally_unknown_enemy_xyzzy');
    expect(inst.tags).toContain('_unknown');
    expect(typeof inst.hp).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// 9. applyAffix — standalone
// ---------------------------------------------------------------------------

describe('applyAffix — standalone', () => {
  it('unknown affix is a no-op', () => {
    const inst = { id: 'x', hp: 20, maxHp: 20 };
    const result = applyAffix(inst, 'nonexistent_affix');
    expect(result.hp).toBe(20);
  });

  it('regen affix tags the enemy', () => {
    const inst = { id: 'x', hp: 20, maxHp: 20, tags: [] };
    applyAffix(inst, 'regen');
    expect(inst.tags).toContain('regen');
    expect(inst._regenPct).toBeCloseTo(0.05);
  });
});
