import { describe, it, expect } from 'vitest';
import { runEffects } from '../../mods/dsl.js';
import { addStatus } from '../../mods/statusModel.js';

function mkActor(name) {
  return { name, hp: 100, maxHp: 100, statuses: [], stats: {} };
}

describe('M172 — stealStatus DSL op', () => {
  it('moves a single named status from target to self', () => {
    const caster = mkActor('A');
    const target = mkActor('B');
    addStatus(target, { type: 'buff:str', amount: 4, duration: 3 });
    runEffects([
      { op: 'stealStatus', status: 'buff:str', from: 'target', to: 'self' }
    ], { caster, targets: [target] });
    expect(target.statuses.some(s => s.type === 'buff:str')).toBe(false);
    const stolen = caster.statuses.find(s => s.type === 'buff:str');
    expect(stolen).toBeDefined();
    expect(stolen.amount).toBe(4);
    expect(stolen.duration).toBe(3);
  });

  it('prefix matches transfer all buff:* entries', () => {
    const caster = mkActor('A');
    const target = mkActor('B');
    addStatus(target, { type: 'buff:str', amount: 3, duration: 2 });
    addStatus(target, { type: 'buff:int', amount: 5, duration: 4 });
    addStatus(target, { type: 'burn', duration: 3, stacks: 2 }); // should NOT be stolen
    runEffects([
      { op: 'stealStatus', prefix: 'buff:', from: 'target', to: 'self' }
    ], { caster, targets: [target] });
    expect(target.statuses.filter(s => s.type.startsWith('buff:')).length).toBe(0);
    expect(target.statuses.find(s => s.type === 'burn')).toBeDefined();
    expect(caster.statuses.filter(s => s.type.startsWith('buff:')).length).toBe(2);
  });

  it('array of status types', () => {
    const caster = mkActor('A');
    const target = mkActor('B');
    addStatus(target, { type: 'regen', duration: 3 });
    addStatus(target, { type: 'haste', duration: 2 });
    addStatus(target, { type: 'burn', duration: 3 });
    runEffects([
      { op: 'stealStatus', status: ['regen', 'haste'], from: 'target', to: 'self' }
    ], { caster, targets: [target] });
    expect(target.statuses.map(s => s.type).sort()).toEqual(['burn']);
    expect(caster.statuses.map(s => s.type).sort()).toEqual(['haste', 'regen']);
  });

  it('max limit caps transfer count', () => {
    const caster = mkActor('A');
    const target = mkActor('B');
    addStatus(target, { type: 'buff:str', amount: 3, duration: 2 });
    addStatus(target, { type: 'buff:int', amount: 5, duration: 4 });
    addStatus(target, { type: 'buff:dex', amount: 2, duration: 2 });
    runEffects([
      { op: 'stealStatus', prefix: 'buff:', from: 'target', to: 'self', max: 1 }
    ], { caster, targets: [target] });
    expect(caster.statuses.length).toBe(1);
    expect(target.statuses.length).toBe(2);
  });
});
