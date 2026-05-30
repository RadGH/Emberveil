import { describe, expect, it } from 'vitest';
import { evalPredicate, validatePredicate } from '../storyPredicate.js';

const ctx = {
  flags: { met_maera: true },
  factions: { lantern_court: 3 },
  counters: { relics: 2 },
  quests: { q1: { status: 'active', phase: 'hunt', outcomes: [] } },
  companions: [{ id: 'maera', recruited: true, active: true, approval: 4 }],
  inventory: [{ id: 'ember_key' }],
  party: [{ class: 'warrior', attrs: { STR: 12, DEX: 8 } }],
};

describe('story predicate DSL', () => {
  it('evaluates boolean composition and canonical ops', () => {
    expect(evalPredicate({ op: 'all', terms: [
      { op: 'flag', flag: 'met_maera' },
      { op: 'faction', faction: 'lantern_court', min: 2 },
      { op: 'counter', counter: 'relics', cmp: '>=', value: 2 },
      { op: 'quest', questId: 'q1', status: 'active', phase: 'hunt' },
      { op: 'item', itemId: 'ember_key' },
      { op: 'companion', companion: 'maera', recruited: true, min: 3 },
      { op: 'class', class: 'warrior' },
      { op: 'stat', stat: 'STR', min: 10 },
    ] }, ctx)).toBe(true);
  });

  it('supports not/any and fails closed on unknown ops', () => {
    expect(evalPredicate({ op: 'any', terms: [{ op: 'flag', flag: 'missing' }, { op: 'not', term: { op: 'flag', flag: 'missing' } }] }, ctx)).toBe(true);
    expect(evalPredicate({ op: 'mystery' }, ctx)).toBe(false);
  });

  it('validates nested unknown operations for authoring tools', () => {
    const issues = validatePredicate({ op: 'all', terms: [{ op: 'unknown' }] });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('unknown');
  });
});
