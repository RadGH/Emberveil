// M274: tests for the extracted resolveIncomingDamage canonical pipeline.
import { describe, it, expect, vi } from 'vitest';
import { resolveIncomingDamage } from '../../ui/screens/_damagePipeline.js';

const mkTarget = (over = {}) => ({
  hp: 200, maxHp: 200, alive: true, stance: 'ready',
  armor: 0, magicResist: 0, blockChance: 0, blockPower: 0,
  passiveResistAll: 0,
  ...over,
});

describe('resolveIncomingDamage — type routing', () => {
  it('true damage bypasses block + armor + resist', () => {
    const t = mkTarget({ armor: 100, magicResist: 100, blockChance: 1, blockPower: 50 });
    const r = resolveIncomingDamage(100, t, { type: 'true' });
    expect(r.dmg).toBe(100);
    expect(r.tag).toBeNull();
    expect(r.breakdown.type).toBe('true');
  });

  it('physical damage uses armor', () => {
    const t = mkTarget({ armor: 30, magicResist: 50 });
    const r = resolveIncomingDamage(100, t, { type: 'physical' });
    expect(r.dmg).toBeLessThan(100);
    expect(r.breakdown.type).toBe('physical');
  });

  it('magic damage uses magicResist, not armor', () => {
    const tArmor  = mkTarget({ armor: 200, magicResist: 0 });
    const tResist = mkTarget({ armor: 0,   magicResist: 30 });
    const a = resolveIncomingDamage(100, tArmor,  { type: 'magic' });
    const b = resolveIncomingDamage(100, tResist, { type: 'magic' });
    expect(a.dmg).toBe(100);            // huge armor doesn't reduce magic
    expect(b.dmg).toBeLessThan(100);    // resist does
  });
});

describe('resolveIncomingDamage — block stage', () => {
  it('full block sets dmg = 0 and tag = "blocked"', () => {
    const t = mkTarget({ blockChance: 1, blockPower: 200 });
    const r = resolveIncomingDamage(100, t, { type: 'physical' });
    expect(r.dmg).toBe(0);
    expect(r.tag).toBe('blocked');
    expect(r.breakdown.blocked).toBe(100);
    expect(r.blocked).toBe(true);
  });

  it('partial block reduces dmg and tags "blocked N"', () => {
    const t = mkTarget({ blockChance: 1, blockPower: 30, armor: 0 });
    const r = resolveIncomingDamage(100, t, { type: 'physical' });
    expect(r.dmg).toBe(70);
    expect(r.tag).toBe('blocked 30');
    expect(r.breakdown.blocked).toBe(30);
  });

  it('block sets target.stance = "block"', () => {
    const t = mkTarget({ blockChance: 1, blockPower: 50 });
    resolveIncomingDamage(100, t, { type: 'physical' });
    expect(t.stance).toBe('block');
  });

  it('block does NOT fire on magic damage even at 100% chance', () => {
    const t = mkTarget({ blockChance: 1, blockPower: 100, magicResist: 0 });
    const r = resolveIncomingDamage(100, t, { type: 'magic' });
    expect(r.dmg).toBe(100);
    expect(r.blocked).toBeFalsy();
  });

  it('does not roll block when blockChance is 0', () => {
    const t = mkTarget({ blockChance: 0, blockPower: 100 });
    const r = resolveIncomingDamage(100, t, { type: 'physical' });
    expect(r.dmg).toBe(100);
    expect(r.blocked).toBeFalsy();
  });
});

describe('resolveIncomingDamage — meter telemetry', () => {
  it('reports block + armor absorb separately', () => {
    const addMit = vi.fn();
    const t = mkTarget({ blockChance: 1, blockPower: 30, armor: 50 });
    resolveIncomingDamage(100, t, { type: 'physical', meter: { addMit }, round: 3 });
    // Block should fire with 30 absorbed
    const blockCall = addMit.mock.calls.find(c => c[2] === 'Block');
    expect(blockCall).toBeTruthy();
    expect(blockCall[1]).toBe(30);
    expect(blockCall[3]).toEqual({ round: 3 });
    // Armor should also fire with the post-block reduction
    const armorCall = addMit.mock.calls.find(c => c[2] === 'Armor');
    expect(armorCall).toBeTruthy();
  });

  it('reports magic-type absorb as "Spell Resist"', () => {
    const addMit = vi.fn();
    const t = mkTarget({ magicResist: 30 });
    resolveIncomingDamage(100, t, { type: 'magic', meter: { addMit }, round: 1 });
    const call = addMit.mock.calls.find(c => c[2] === 'Spell Resist');
    expect(call).toBeTruthy();
  });

  it('skips telemetry when meterTrackTarget=false', () => {
    const addMit = vi.fn();
    const t = mkTarget({ blockChance: 1, blockPower: 50 });
    resolveIncomingDamage(100, t, { type: 'physical', meter: { addMit }, meterTrackTarget: false });
    expect(addMit).not.toHaveBeenCalled();
  });
});

describe('resolveIncomingDamage — passiveResistAll', () => {
  it('applies a final % reduction on top of armor/resist', () => {
    const tNoPas = mkTarget({ armor: 0 });
    const tPas   = mkTarget({ armor: 0, passiveResistAll: 50 }); // 50%
    const a = resolveIncomingDamage(100, tNoPas, { type: 'physical' });
    const b = resolveIncomingDamage(100, tPas,   { type: 'physical' });
    expect(b.dmg).toBeLessThan(a.dmg);
    expect(b.dmg).toBe(Math.round(a.dmg * 0.5));
  });
});

describe('resolveIncomingDamage — breakdown shape', () => {
  it('always includes raw, final, type', () => {
    const t = mkTarget();
    const r = resolveIncomingDamage(100, t, { type: 'physical' });
    expect(r.breakdown.raw).toBe(100);
    expect(r.breakdown.final).toBe(r.dmg);
    expect(r.breakdown.type).toBe('physical');
  });

  it('includes resistType when provided + type=magic', () => {
    const t = mkTarget({ magicResist: 30 });
    const r = resolveIncomingDamage(100, t, { type: 'magic', resistType: 'fire' });
    expect(r.breakdown.resistType).toBe('fire');
  });

  it('omits resistType for physical damage', () => {
    const t = mkTarget({ armor: 30 });
    const r = resolveIncomingDamage(100, t, { type: 'physical', resistType: 'fire' });
    expect(r.breakdown.resistType).toBeUndefined();
  });
});
