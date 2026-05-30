// M273: meter aggregation tests. Validates the pure data-layer extracted
// from CombatScreen (src/ui/screens/_meterTracker.js). Specifically guards
// the M272 fix: all four add-* helpers must lazy-create rows for any actor
// (was previously asymmetric — only damage created entries).
import { describe, it, expect } from 'vitest';
import {
  createMeter,
  meterAddDamage,
  meterAddHeal,
  meterAddMit,
  meterAddDodge,
  meterRows,
  meterTotals,
} from '../../ui/screens/_meterTracker.js';

const ally = (id, name) => ({ id, name });
const enemy = (id, name) => ({ id, name });

describe('meter — basic add', () => {
  it('records damage with source attribution', () => {
    const m = createMeter();
    meterAddDamage(m, ally('h1', 'Hero'), 100, 'Shield Bash', { side: 'ally', round: 1 });
    meterAddDamage(m, ally('h1', 'Hero'),  50, 'Attack',      { side: 'ally', round: 2 });
    const d = m.data.get('h1');
    expect(d.damage).toBe(150);
    expect(d.sources['Shield Bash']).toBe(100);
    expect(d.sources['Attack']).toBe(50);
    expect(d.hits.length).toBe(2);
  });

  it('records heal with separate healSources bucket', () => {
    const m = createMeter();
    meterAddHeal(m, ally('h1', 'Cleric'), 80, 'Heal',      { side: 'ally', round: 1 });
    meterAddHeal(m, ally('h1', 'Cleric'), 20, 'Lifesteal', { side: 'ally', round: 1 });
    const d = m.data.get('h1');
    expect(d.heal).toBe(100);
    expect(d.healSources['Heal']).toBe(80);
    expect(d.healSources['Lifesteal']).toBe(20);
    expect(d.damage).toBe(0);
  });

  it('records mitigation buckets', () => {
    const m = createMeter();
    meterAddMit(m, ally('h1', 'Tank'), 50, 'Armor',   { side: 'ally', round: 1 });
    meterAddMit(m, ally('h1', 'Tank'), 30, 'Block',   { side: 'ally', round: 2 });
    meterAddMit(m, ally('h1', 'Tank'), 20, 'Barrier', { side: 'ally', round: 3 });
    const d = m.data.get('h1');
    expect(d.mitigation).toBe(100);
    expect(d.mitSources['Armor']).toBe(50);
    expect(d.mitSources['Block']).toBe(30);
    expect(d.mitSources['Barrier']).toBe(20);
  });

  it('records dodge as a count, not a damage value', () => {
    const m = createMeter();
    meterAddDodge(m, ally('h1', 'Rogue'), { side: 'ally', round: 1 });
    meterAddDodge(m, ally('h1', 'Rogue'), { side: 'ally', round: 2 });
    const d = m.data.get('h1');
    expect(d.mitSources['Dodge (count)']).toBe(2);
    expect(d.mitigation).toBe(0); // dodge doesn't add to absorbed-damage total
  });

  it('drops zero / negative damage events silently', () => {
    const m = createMeter();
    expect(meterAddDamage(m, ally('h1', 'X'), 0, 'Attack')).toBe(false);
    expect(meterAddDamage(m, ally('h1', 'X'), -5, 'Attack')).toBe(false);
    expect(m.data.has('h1')).toBe(false);
  });
});

describe('meter — lazy entry creation (M272 fix)', () => {
  it('all four helpers lazy-create entries for any actor', () => {
    // Pre-M272: only meterAddDamage created entries. Heal/mit/dodge calls
    // for an enemy without an existing damage entry would silently no-op.
    const m1 = createMeter();
    expect(meterAddDamage(m1, enemy('e1', 'Goblin'), 10, 'Stab')).toBe(true);
    expect(m1.data.has('e1')).toBe(true);

    const m2 = createMeter();
    expect(meterAddHeal(m2, enemy('e1', 'Healer Goblin'), 10, 'Patch')).toBe(true);
    expect(m2.data.has('e1')).toBe(true);

    const m3 = createMeter();
    expect(meterAddMit(m3, enemy('e1', 'Tank Goblin'), 10, 'Armor')).toBe(true);
    expect(m3.data.has('e1')).toBe(true);

    const m4 = createMeter();
    expect(meterAddDodge(m4, enemy('e1', 'Quick Goblin'))).toBe(true);
    expect(m4.data.has('e1')).toBe(true);
  });
});

describe('meter — rows + filtering', () => {
  it('rows are sorted desc by chosen mode', () => {
    const m = createMeter();
    meterAddDamage(m, ally('h1', 'Big'),    300, 'Bash',  { side: 'ally' });
    meterAddDamage(m, ally('h2', 'Small'),  100, 'Stab',  { side: 'ally' });
    meterAddDamage(m, ally('h3', 'Medium'), 200, 'Slash', { side: 'ally' });
    const rows = meterRows(m, 'damage', { showEnemies: false });
    expect(rows.map(r => r.name)).toEqual(['Big', 'Medium', 'Small']);
  });

  it('hides enemies by default; surfaces them on showEnemies', () => {
    const m = createMeter();
    meterAddDamage(m, ally('h1',  'Hero'),   100, 'Attack', { side: 'ally' });
    meterAddDamage(m, enemy('e1', 'Goblin'),  50, 'Bite',   { side: 'enemy' });
    expect(meterRows(m, 'damage', { showEnemies: false }).length).toBe(1);
    expect(meterRows(m, 'damage', { showEnemies: true }).length).toBe(2);
  });

  it('filters out rows with zero in the chosen mode', () => {
    const m = createMeter();
    meterAddDamage(m, ally('h1', 'A'), 100, 'Hit', { side: 'ally' }); // damage only
    meterAddHeal(m,   ally('h2', 'B'),  80, 'Mend', { side: 'ally' }); // heal only
    expect(meterRows(m, 'damage').map(r => r.name)).toEqual(['A']);
    expect(meterRows(m, 'heal').map(r => r.name)).toEqual(['B']);
  });
});

describe('meter — totals', () => {
  it('aggregates across all rows', () => {
    const m = createMeter();
    meterAddDamage(m, ally('h1', 'A'), 100, 'X', { side: 'ally' });
    meterAddDamage(m, ally('h2', 'B'), 250, 'Y', { side: 'ally' });
    meterAddHeal(m,   ally('h3', 'C'),  90, 'Z', { side: 'ally' });
    meterAddMit(m,    ally('h1', 'A'),  60, 'Armor', { side: 'ally' });
    expect(meterTotals(m)).toEqual({ damage: 350, heal: 90, mitigation: 60 });
  });
});
