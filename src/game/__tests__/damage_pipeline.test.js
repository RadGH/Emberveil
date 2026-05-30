// M273: tests for the canonical damage pipeline pieces — block, armor
// mitigation, dodge. Importantly NOT testing the full CombatScreen
// (DOM-coupled) — testing the pure formulas it composes. A future
// refactor extracting damagePipeline.js into a module will let this
// test file grow into a proper integration test.
import { describe, it, expect } from 'vitest';
import {
  rollBlock,
  applyBlock,
  applyMitigation,
  applyArmorMitigation,
  rollToHit,
} from '../formulas.js';

describe('block roll + apply', () => {
  it('rollBlock returns false when target.blockChance is 0/missing', () => {
    expect(rollBlock({ blockChance: 0 })).toBe(false);
    expect(rollBlock({})).toBe(false);
    expect(rollBlock(null)).toBe(false);
  });

  it('rollBlock at 1.0 always returns true', () => {
    for (let i = 0; i < 20; i++) {
      expect(rollBlock({ blockChance: 1 })).toBe(true);
    }
  });

  it('applyBlock subtracts blockPower from raw damage, floor 0', () => {
    expect(applyBlock(100, { blockPower: 30 })).toBe(70);
    expect(applyBlock(20,  { blockPower: 30 })).toBe(0);
    expect(applyBlock(50,  { blockPower: 0 })).toBe(50);
    expect(applyBlock(50,  {})).toBe(50);
    expect(applyBlock(50,  null)).toBe(50);
  });
});

describe('rollToHit', () => {
  it('returns a number between 5 and 95 (clamped)', () => {
    const c = rollToHit({ hit: 80 }, { dodge: 10 });
    expect(c).toBeGreaterThanOrEqual(5);
    expect(c).toBeLessThanOrEqual(97); // M418: softcap 99 - default 3% min miss floor
  });

  it('higher dodge lowers hit chance', () => {
    const lowDodge  = rollToHit({ hit: 80 }, { dodge: 0 });
    const highDodge = rollToHit({ hit: 80 }, { dodge: 30 });
    expect(highDodge).toBeLessThan(lowDodge);
  });

  it('higher hit raises hit chance (within clamp)', () => {
    const lowHit  = rollToHit({ hit: 50 }, { dodge: 10 });
    const highHit = rollToHit({ hit: 95 }, { dodge: 10 });
    expect(highHit).toBeGreaterThanOrEqual(lowHit);
  });
});

describe('armor mitigation', () => {
  it('zero armor passes damage through', () => {
    expect(applyArmorMitigation(100, 0)).toBe(100);
  });

  it('high armor floors damage at 15% under legacy formula', () => {
    // Legacy floor is 15% of raw, so very high armor cannot reduce below 15.
    const out = applyArmorMitigation(100, 10000);
    expect(out).toBeGreaterThanOrEqual(15);
  });

  it('damage reduction is monotonic in armor', () => {
    const low  = applyArmorMitigation(100, 10);
    const med  = applyArmorMitigation(100, 50);
    const high = applyArmorMitigation(100, 200);
    expect(low).toBeGreaterThanOrEqual(med);
    expect(med).toBeGreaterThanOrEqual(high);
  });
});

describe('applyMitigation — type routing', () => {
  it('true damage passes through unchanged', () => {
    expect(applyMitigation(100, { armor: 50, magicResist: 50 }, { type: 'true' })).toBe(100);
  });

  it('physical damage uses armor, ignores magicResist', () => {
    const physOnly = applyMitigation(100, { armor: 30, magicResist: 0 },  { type: 'physical' });
    const physBoth = applyMitigation(100, { armor: 30, magicResist: 80 }, { type: 'physical' });
    expect(physOnly).toBe(physBoth);
  });

  it('magic damage uses magicResist, ignores armor', () => {
    const magicOnly = applyMitigation(100, { armor: 0,   magicResist: 30 }, { type: 'magic' });
    const magicBoth = applyMitigation(100, { armor: 200, magicResist: 30 }, { type: 'magic' });
    expect(magicOnly).toBe(magicBoth);
  });
});
