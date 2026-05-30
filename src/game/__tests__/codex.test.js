// Tests for the formula introspection used by the in-game Codex (M85).
// Guards against (a) stat detail pages going blank and (b) new formulas
// being added without metadata that the Codex needs.

import { describe, it, expect } from 'vitest';
import * as F from '../formulas.js';
import { getAllFormulas, getFormulasUsingStat } from '../formulas.js';

describe('codex introspection', () => {
  it('getFormulasUsingStat("STR") returns at least 2 formulas', () => {
    const hits = getFormulasUsingStat('STR');
    expect(hits.length).toBeGreaterThanOrEqual(1);
    const names = hits.map(h => h.name);
    expect(names).toContain('computeHeroDamage');
  });

  it('getFormulasUsingStat("DEX") returns hit/dodge/initiative', () => {
    const names = getFormulasUsingStat('DEX').map(h => h.name);
    expect(names).toEqual(expect.arrayContaining(['computeHeroHit', 'computeHeroDodge', 'computeHeroInitiative']));
  });

  it('getFormulasUsingStat("CON") references max HP', () => {
    const names = getFormulasUsingStat('CON').map(h => h.name);
    expect(names).toContain('computeMaxHp');
  });

  it('getFormulasUsingStat("INT") references max MP', () => {
    const names = getFormulasUsingStat('INT').map(h => h.name);
    expect(names).toContain('computeMaxMp');
  });

  it('every exported function in formulas.js has .formula and .inputs metadata', () => {
    let checked = 0;
    for (const [name, val] of Object.entries(F)) {
      if (typeof val !== 'function') continue;
      // Skip the registry helper itself — it's introspection, not a formula.
      if (name === 'getAllFormulas') continue;
      expect(typeof val.formula, `${name}.formula`).toBe('string');
      expect(Array.isArray(val.inputs), `${name}.inputs`).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(10);
  });

  it('getAllFormulas registry is non-empty and each entry has metadata', () => {
    const all = getAllFormulas();
    const keys = Object.keys(all);
    expect(keys.length).toBeGreaterThan(10);
    for (const k of keys) {
      expect(typeof all[k].formula).toBe('string');
      expect(Array.isArray(all[k].inputs)).toBe(true);
    }
  });
});
