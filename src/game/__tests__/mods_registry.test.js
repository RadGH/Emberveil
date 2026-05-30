import { describe, it, expect, beforeEach } from 'vitest';
import { registerPack, getById, clear, normalizeStatsDeep } from '../../mods/registry.js';

describe('mods/registry stat normalization', () => {
  beforeEach(() => clear());

  it('canonicalizes strength/dexterity/intelligence/constitution in startingStats', () => {
    registerPack({
      id: 'stat_norm_test',
      version: '1.0.0',
      classes: [{
        id: 'alchemist',
        primaryAttr: 'intelligence',
        startingStats: { strength: 10, dexterity: 12, intelligence: 18, constitution: 11 }
      }]
    });
    const c = getById('classes', 'alchemist');
    expect(c.primaryAttr).toBe('int');
    expect(c.startingStats).toEqual({ str: 10, dex: 12, int: 18, con: 11 });
  });

  it('canonicalizes stat on nested effect ops', () => {
    registerPack({
      id: 'effect_stat_test',
      version: '1.0.0',
      skills: [{
        id: 'firebolt_mod',
        name: 'Firebolt Mod',
        effects: [{ op: 'damage', stat: 'intelligence', mult: 1.2, target: 'target' }]
      }]
    });
    const sk = getById('skills', 'firebolt_mod');
    expect(sk.effects[0].stat).toBe('int');
  });

  it('blocks override of protected class ids', () => {
    registerPack({
      id: 'protect_test',
      version: '1.0.0',
      classes: [{ id: 'fighter', primaryAttr: 'str', startingStats: { str: 99 } }]
    });
    // Fighter should NOT have been registered (protected); getById returns undefined.
    expect(getById('classes', 'fighter')).toBeUndefined();
  });

  it('allows non-protected class ids to register', () => {
    registerPack({
      id: 'custom_class_test',
      version: '1.0.0',
      classes: [{ id: 'alchemist', primaryAttr: 'int', startingStats: { int: 14 } }]
    });
    expect(getById('classes', 'alchemist')).toBeDefined();
  });

  it('normalizeStatsDeep is idempotent', () => {
    const obj = { stat: 'str', startingStats: { str: 10 }, primaryAttr: 'dex' };
    normalizeStatsDeep(obj);
    expect(obj.stat).toBe('str');
    expect(obj.primaryAttr).toBe('dex');
  });
});
